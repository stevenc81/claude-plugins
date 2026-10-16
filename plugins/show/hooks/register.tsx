import type { EngineInterface, Register } from 'claude-code'

import { fitBox, frameAt, framePath, hexBytes, pngSize } from './lib'

const TOOL = 'mcp__show__media'
const FPS = 15
const FRAME_WIDTH = 960
// A terminal cell's height divided by its width, in pixels (Ghostty, Iosevka).
const CELL_ASPECT = 2.0
const MAX_COLUMNS = 120
const CACHE = '/tmp/claude-show'

// What the tool returns as JSON text, and what a finished row draws from.
type Shown = { kind: 'image' | 'video'; path: string; file: string; width: number; height: number }

// The video playing now; one at a time. A finished row draws from its result
// instead. Only the play loop moves the clock: it sets startedAt as each afplay
// starts. /pause only sets isPaused and stops afplay; the loop does the rest.
type Playback = {
  id: string
  dir: string
  shown: Shown
  startedAt: number // when the sound would have started from 0
  isSounding: boolean // afplay runs, so frames follow the clock
  isPaused: boolean
  pausedAt: number
  isStopAsked: boolean // /pause stopped this afplay on purpose
}
let current: Playback | undefined

async function run($: EngineInterface, argv: string[]) {
  const done = await $.process.run(argv, { timeoutMs: 300_000 })
  if (done.exitCode !== 0) throw new Error(`${argv[0]} failed: ${done.stderr.trim().slice(0, 500)}`)
  return done.stdout
}

// Reads only the PNG header, so a file of any size can show.
async function readPngSize($: EngineInterface, file: string) {
  return pngSize(hexBytes(await run($, ['xxd', '-p', '-l', '24', file])))
}

// Splits the video into PNG frames and a wav exactly as long as the frames.
// Each call has its own folder, deleted when it ends; the poster stays.
async function prepare($: EngineInterface, path: string, dir: string) {
  await run($, ['mkdir', '-p', dir, `${CACHE}/posters`])
  await run($, ['ffmpeg', '-v', 'error', '-y', '-i', path, '-vf', `fps=${FPS},scale=${FRAME_WIDTH}:-2`, `${dir}/f%05d.png`])
  const count = (await $.fs.list(dir)).filter(f => f.name.endsWith('.png')).length
  if (count === 0) throw new Error('ffmpeg wrote no frames')

  const seconds = count / FPS
  const streams = await run($, ['ffprobe', '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', path])
  const sound = streams.trim() ? ['-i', path, '-vn', '-af', `apad=whole_dur=${seconds}`] : ['-f', 'lavfi', '-i', 'anullsrc=r=22050:cl=mono']
  await run($, ['ffmpeg', '-v', 'error', '-y', ...sound, '-t', String(seconds), '-c:a', 'pcm_s16le', `${dir}/audio.wav`])

  const size = await readPngSize($, framePath(dir, 0))
  if (!size) throw new Error('the first frame is not a PNG')
  return { count, seconds, ...size }
}

// The wav from `seconds` on, for a resume. afplay cannot start mid-file.
async function soundFrom($: EngineInterface, dir: string, seconds: number) {
  if (seconds <= 0) return `${dir}/audio.wav`
  await run($, ['ffmpeg', '-v', 'error', '-y', '-ss', seconds.toFixed(3), '-i', `${dir}/audio.wav`, '-c', 'copy', `${dir}/resume.wav`])
  return `${dir}/resume.wav`
}

// A finished row's result, or undefined when it is not one of ours.
function parseShown(output: unknown): Shown | undefined {
  try {
    const out = typeof output === 'string' ? (JSON.parse(output) as Partial<Shown>) : undefined
    return out?.file && out.width && out.height ? (out as Shown) : undefined
  } catch {
    return undefined
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: 'media',
      description:
        'Shows a PNG image or plays an mp4 video inline in the user\'s terminal. ' +
        'An image shows at once. A video plays with sound and the call returns when it ends. ' +
        'The user can type /pause to pause and resume it, and press Esc to stop it.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to a .png or .mp4 file.' },
          alt: { type: 'string', description: 'One line that says what the picture shows.' },
        },
        required: ['path', 'alt'],
      },
      isDeferred: false,
    })
    await $.command.register({ name: 'pause', description: 'Pause or resume the video that plays now', immediate: true })
    return next(e)
  })

  on('tool.call', { tool: TOOL }, async ($, e, next) => {
    const path = String((e as { path?: unknown }).path ?? '')
    const ext = path.toLowerCase().split('.').pop()
    if (!path.startsWith('/')) return { deny: 'path must be absolute' }
    if (!(await $.fs.exists(path))) return { deny: `no file at ${path}` }

    if (ext === 'png') {
      const size = await readPngSize($, path).catch(() => undefined)
      if (!size) return { deny: `${path} is not a PNG file` }
      const shown: Shown = { kind: 'image', path, file: path, ...size }
      return { result: JSON.stringify(shown) }
    }
    if (ext !== 'mp4') return { deny: 'only .png and .mp4 files are supported' }

    const id = e.tool_use_id
    const dir = `${CACHE}/${id}`
    const poster = `${CACHE}/posters/${id}.png`
    let play: Playback | undefined
    let tick: { cancel: () => void } | undefined
    let isClosed = false
    try {
      const video = await prepare($, path, dir)
      await run($, ['cp', framePath(dir, video.count - 1), poster])
      play = {
        id,
        dir,
        shown: { kind: 'video', path, file: framePath(dir, 0), width: video.width, height: video.height },
        startedAt: 0,
        isSounding: false,
        isPaused: false,
        pausedAt: 0,
        isStopAsked: false,
      }
      current = play
      $.ui.invalidate('ui.render')

      // One tick at a time, so frames never draw out of order or after the end.
      let shownFrame = 0
      let isBusy = false
      const live = play
      tick = $.clock.every(Math.round(1000 / FPS), async () => {
        if (isBusy || isClosed || !live.isSounding) return
        isBusy = true
        try {
          const frame = frameAt((await $.clock.now()) - live.startedAt, FPS, video.count)
          if (frame !== shownFrame && !isClosed) {
            shownFrame = frame
            await $.ui.blit({ requestId: id, key: 'video', source: { file: framePath(dir, frame), format: 'png' } })
          }
        } finally {
          isBusy = false
        }
      })

      // afplay is the clock: the call returns when the sound ends. Esc aborts
      // next.signal, which kills afplay. /pause stops afplay, and this loop
      // starts it again from the paused point on resume.
      let fromMs = 0
      while (!next.signal.aborted && fromMs < video.seconds * 1000) {
        if (play.isPaused) {
          await $.process.run(['sleep', '0.2'])
          continue
        }
        const sound = await soundFrom($, dir, fromMs / 1000)
        if (play.isPaused) continue // paused while the sound was cut
        play.isStopAsked = false
        play.startedAt = (await $.clock.now()) - fromMs
        play.isSounding = true
        const player = $.process.spawn({ argv: ['afplay', sound] })
        let errors = ''
        for await (const chunk of player) if (chunk.stream === 'stderr') errors += chunk.text
        const end = await player.result
        play.isSounding = false
        if (!play.isStopAsked) {
          if (end.code !== 0 && !next.signal.aborted) return { deny: `afplay failed: ${errors.trim().slice(0, 500)}` }
          break
        }
        fromMs = play.pausedAt - play.startedAt
      }

      const shown: Shown = { kind: 'video', path, file: poster, width: video.width, height: video.height }
      return { result: JSON.stringify(shown) }
    } catch (error) {
      return { deny: String(error instanceof Error ? error.message : error) }
    } finally {
      isClosed = true
      tick?.cancel()
      if (play && current === play) current = undefined
      $.ui.invalidate('ui.render')
      await $.process.run(['rm', '-rf', dir]).catch(() => undefined)
    }
  }).catch(($, e, next) => ({ deny: `the show tool failed (${next.error.kind}); run claude --debug for details` }))

  on('command.run', { command: 'pause' }, async $ => {
    const play = current
    if (!play) return { text: 'No video is playing.' }
    play.isPaused = !play.isPaused
    if (play.isPaused && play.isSounding) {
      play.pausedAt = await $.clock.now()
      play.isSounding = false
      play.isStopAsked = true
      // Stops the sound of this video only; the play loop then waits.
      await $.process.run(['pkill', '-f', `afplay ${play.dir}/`])
    }
    $.ui.invalidate('ui.render')
    return { text: play.isPaused ? 'Video paused. Type /pause to resume.' : 'Video resumed.' }
  })

  on('ui.render', { component: 'ToolUse', props: { tool: TOOL } }, ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)
    const play = current?.id === e.props.tool_use_id ? current : undefined
    const shown = play?.shown ?? parseShown(e.props.output)
    if (!shown) return next(e)

    const { Box, Text, Image } = $.ui.resolve(e)
    const maxColumns = Math.min(MAX_COLUMNS, (e.viewport?.columns ?? 100) - 4)
    const maxRows = Math.max(8, (e.viewport?.rows ?? 40) - 8)
    const box = fitBox(shown.width, shown.height, maxColumns, maxRows, CELL_ASPECT)
    const input = e.props.input as { alt?: string } | undefined
    const alt = input?.alt?.trim() || shown.path
    const label = play
      ? play.isPaused ? 'Paused. Type /pause to resume.' : 'Playing. Type /pause to pause, or press Esc to stop.'
      : shown.kind === 'video' ? `Video: ${shown.path}` : `Image: ${shown.path}`

    return (
      <Box flexDirection="column">
        <Text dimColor>{label}</Text>
        <Image
          {...(play ? { key: 'video' } : {})}
          source={{ file: shown.file, format: 'png' }}
          columns={box.columns}
          rows={box.rows}
          alt={alt}
        />
      </Box>
    )
  })

  // The ToolUse row already shows the picture; the result row stays quiet.
  on('ui.render', { component: 'ToolResult', props: { tool: TOOL } }, ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.isErrored) return next(e)
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
}
