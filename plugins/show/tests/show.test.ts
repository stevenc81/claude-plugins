import type { On } from 'claude-code'
import { describe, expect, test } from 'claude-code/testing'

import { fitBox, frameAt, framePath, hexBytes, pngSize } from '../hooks/lib'

const TOOL = 'mcp__show__media'

describe('lib', () => {
  test('pngSize reads the IHDR size and rejects other bytes', () => {
    const head = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 9, 96, 0, 0, 3, 32])
    expect(pngSize(head)).toEqual({ width: 2400, height: 800 })
    expect(pngSize(new Uint8Array(24))).toBe(undefined)
    expect(pngSize(head.slice(0, 20))).toBe(undefined)
  })

  test('fitBox keeps the shape and stays inside the limits', () => {
    // 2400 x 800 at 100 columns, cells twice as tall as wide: 100 / 3 / 2 rows.
    expect(fitBox(2400, 800, 100, 40, 2)).toEqual({ columns: 100, rows: 17 })
    // A tall picture is limited by rows, and the columns shrink to match.
    expect(fitBox(800, 2400, 100, 30, 2)).toEqual({ columns: 20, rows: 30 })
    expect(fitBox(10, 10, 999, 999, 2).columns).toBe(255)
  })

  test('frameAt follows the clock and stays in range', () => {
    expect(frameAt(0, 15, 100)).toBe(0)
    expect(frameAt(1000, 15, 100)).toBe(15)
    expect(frameAt(-50, 15, 100)).toBe(0)
    expect(frameAt(999_999, 15, 100)).toBe(99)
  })

  test('framePath counts from 1, as ffmpeg does', () => {
    expect(framePath('/d', 0)).toBe('/d/f00001.png')
  })

  test('hexBytes reads xxd -p text across lines', () => {
    expect([...hexBytes('89504e47\n0d0a')]).toEqual([137, 80, 78, 71, 13, 10])
    expect(hexBytes('').length).toBe(0)
  })
})

// The kit's $ has no disk: the test answers each call from this map of
// `xxd -p -l 24` output. The first entry is the header of a 320 x 160 PNG.
const HEADS: Record<string, string> = {
  '/d/still.png': '89504e470d0a1a0a0000000d494844520000014000\n0000a0',
  '/d/fake.png': '6e6f74206120706e67',
  '/d/fake.gif': '474946383961',
}

function fakeDisk(on: On) {
  on('tool.register', ($, e) => ({ value: { tool: `mcp__show__${e.name}` } }))
  on('fs.exists', ($, e) => ({ value: e.path in HEADS }))
  on('process.run', ($, e) => {
    const file = e.argv[e.argv.length - 1] ?? ''
    const isXxd = e.argv[0] === 'xxd' && file in HEADS
    return { value: { exitCode: isXxd ? 0 : 1, stdout: isXxd ? HEADS[file]! : '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
}

describe('tool', () => {
  test('a PNG returns its size at once', async ($, on) => {
    fakeDisk(on)
    const done = await $.tool.call({ tool: TOOL, path: '/d/still.png', alt: 'an orange box' })
    expect(JSON.parse(String(done.result))).toEqual({ kind: 'image', path: '/d/still.png', file: '/d/still.png', width: 320, height: 160 })
  })

  test('bad input is refused with a reason', async ($, on) => {
    fakeDisk(on)
    const deny = async (path: string) => (await $.tool.call({ tool: TOOL, path, alt: 'x' })).deny
    expect(await deny('relative.png')).toBe('path must be absolute')
    expect(await deny('/d/missing.png')).toBe('no file at /d/missing.png')
    expect(await deny('/d/fake.png')).toBe('/d/fake.png is not a PNG file')
    expect(await deny('/d/fake.gif')).toBe('only .png and .mp4 files are supported')
  })
})
