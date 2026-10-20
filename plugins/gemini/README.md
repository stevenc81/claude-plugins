# gemini

Use the Antigravity CLI (`agy`) from inside Claude Code to fact-check with live web grounding. This plugin is for Claude Code users who want a second-opinion reviewer that goes to the live web (not just training data) to verify claims made in a conversation.

> **Heads up:** This plugin previously spawned `gemini --acp` and spoke ACP (JSON-RPC) over stdio. Google retired Gemini CLI for free/Pro/Ultra users on June 18, 2026 and replaced it with [Antigravity CLI](https://antigravity.google) (`agy`), built in Go. This plugin now runs `agy` in print mode and reads its stream-json output. The slash commands carry over. See [Migration notes](#migration-notes-gemini-cli--antigravity-cli) below.

## Goal

This plugin has one goal: to work reliably when Claude Code agents call it during multi-agent work, such as the author's `orchestrate` skill. The lead session or a subagent must always get Gemini's result back, or a clear error it can act on. Check every change against this goal.

When only Gemini can do a job in this setup, and Codex cannot, the plugin supports it, with the narrowest tool access that works. Examples are video and audio input, and image output.

## What you get

- `/gemini:review` fact-checks content from the current conversation. `agy` runs live web searches and returns structured findings: which claims are supported, uncertain, or contradicted, with source URLs.
- `/gemini:ask` sends any prompt to a model through `agy` and returns the answer as is. You can attach files.
- `/gemini:setup` checks that `agy` is installed and signed in, that the review model exists, and how much Gemini quota you have left.

## Requirements

- **Antigravity CLI** (`agy --version` must work). Tested on 1.4.3. The plugin relies on `--input-format=stream-json`, `--output-format=stream-json`, `--json-schema`, `--conversation` and `--disable-slash-commands`. I have not checked which older versions have them. An `agy` without one of them exits 2 with `flags provided but not defined`. Then run `agy update`. See https://antigravity.google
- **Antigravity CLI 1.4.3 or later for `/gemini:ask --dir`.** That is the oldest version on which the hook was tested (see [The tool gate](#the-tool-gate)). An older `agy` could ignore the hook without a warning, so `--dir` fails before the run and tells you to run `agy update`.
- **Sign-in.** Run `agy -p hello` once interactively. The first call opens a browser for OAuth and writes the session under `~/.gemini/antigravity-cli/`
- **Node.js 18.18 or later**

## Install

```bash
/plugin marketplace add stevenc81/claude-plugins
/plugin install gemini@stevenc81
/reload-plugins
```

Then run `/gemini:setup` to check that everything works.

The plugin has no fixed version number. Claude Code uses the git commit as the version, so every push to `main` is a new version. To get the latest one:

```bash
claude plugin marketplace update stevenc81
claude plugin update gemini@stevenc81
```

Then run `/reload-plugins`, or start a new session.

## Usage

### `/gemini:review`

Fact-checks content from the current conversation with live web grounding. By default it reviews Claude's previous reply. You can point it at any other text in the conversation instead: an earlier reply, a paragraph you pasted, or one bullet. The agent searches the web for every claim it can check, marks each one `supported`, `uncertain` or `contradicted`, and cites its sources.

```bash
/gemini:review
/gemini:review check the second paragraph above
/gemini:review focus on the version numbers
/gemini:review --model gemini-4-argon-medium check the dates above
/gemini:review --model gemini-4-argon-high --no-fallback check the dates above
```

The flags are `--model <id>` and `--no-fallback`. Anything else after `/gemini:review` is plain natural language, not fixed syntax. Claude uses it in one of two ways:

- To choose what gets reviewed. Phrases like `check the second paragraph above` or `review what I just pasted` point Claude at specific text instead of its previous reply.
- To steer attention. Phrases like `focus on the version numbers` tell the agent which claims matter most. It still reports any other real issue it finds.

When another skill or agent calls `/gemini:review` and gives it text, it reviews exactly that text.

The review always runs as a background task, and Claude Code tells you when it finishes. In October 2026, a review of three short claims took 93 seconds on Gemini 4 Argon and 219 seconds on Gemini 3.8 Flash. A review of six claims on Flash took 11.5 minutes. A foreground run stops after 9 minutes, and a fallback to Flash adds a second run. The run time depends on the number of claims, not the length of the text.

How it works:
- Claude pipes the selected text to the companion script through a quoted heredoc. No temp files, no copy and paste.
- The companion runs `agy` in an empty temp folder with the review prompt on stdin and the JSON schema (`--json-schema`).
- The prompt tells the model to search the web for every claim, and to open a page that search returned when the search summary is not enough. It tells the model to treat page text as data. The [tool gate](#the-tool-gate) allows web search, page reads and `finish` (the tool that returns the schema answer). It denies every other tool: commands, subagents, the browser and all file reads. Your `agy` settings decide whether a page opens (see below). A hook denial does not end the run, and it shows in `deniedActions`.
- Search often returns `vertexaisearch.cloud.google.com/grounding-api-redirect/...` links. The plugin resolves each one to the real page URL (one request each, in parallel, 5 seconds max). If that fails, it keeps the original link.
- The report ends with a `[grounding]` footer. It counts the web searches that `agy` ran and how many succeeded, counts the cited sources, and lists any tools `agy` refused. `agy` streams each search step twice (ACTIVE, then DONE or ERROR), so the plugin counts each step once.
- Input is capped at 40KB. Longer content is cut on a line boundary, and the report says so.

Model: reviews run on `gemini-4-argon-high` by default. `--model <id>` picks another model from `agy models`. If the run fails, the plugin can retry once on `gemini-3.8-flash-high`. `--no-fallback` turns that retry off, for a caller that would discard a Flash result. See [Which model runs the review?](#which-model-runs-the-review) for the rules. The header and the `--json` output show which model answered and why a fallback happened.

Limitations:
- Search quality depends on what the agent finds. Niche or paywalled sources may be missed. Read `uncertain` as "search did not find it," not "it is wrong."
- Claude picks the text to review from context. To be sure, quote or paste the exact text.
- A search that `agy` reports as DONE can still return little. Read the cited sources, not only the count.

Output states:

| State | `--json` fields | Text label |
|-------|----------------|------------|
| Success | `parsed` is an object, `parseError` is `null` | `review (N bytes)` |
| Degraded | `parsed` is `null`, `parseError` says why, `rawOutput` holds any text the model sent | `review (N bytes, degraded)` |
| Timed out | `timedOut` is `true`, `stopReason` is `"timeout"` | `review (N bytes, degraded)` plus a line saying the review was cut off |

`model` is the model that answered. `requestedModel` is the model the plugin tried first. `fellBack` is `true` when Flash answered, and `fallbackReason` holds the error from the first run (otherwise `null`). A text report that fell back says so in the header and on the first line.

`deniedActions` lists any tools `agy` refused. When a refusal left the model with no answer, `parseError` names the refused tools. `searches` is `{attempted, succeeded}`.

The exit code is `0` in all three states, because the CLI ran. A nonzero exit means the plugin itself failed (spawn error, sign-in, unknown model, used-up quota, or a hard timeout). After a fallback, a nonzero exit means both models failed, and the error names both causes. To branch on answer quality, read `parseError` and `timedOut` from `--json` output.

### `/gemini:ask`

Sends a prompt to a model and returns its answer exactly as the model wrote it.

```bash
/gemini:ask what changed in the latest Node.js release?
/gemini:ask --model gemini-3.8-flash-high explain this error in plain words
/gemini:ask --file ./notes.md --file ./plan.md which plan is riskier?
/gemini:ask --dir ./core/libs/imgqsort how does ./core/libs/imgqsort/blur.cpp compute the blur score?
/gemini:ask --prompt-file /tmp/prompt-compare.md
/gemini:ask --file ./chart.png --schema ./schema.json read the values in this chart
/gemini:ask --image-out ./images make a flat icon of a red cube
/gemini:ask --resume 3c758fbe-ecb4-4d7b-a9f9-94bda6aad668 --file ./plan.md and which step is the riskiest?
/gemini:ask --json summarize this thread
```

- `--model <id>` takes any ID from `agy models`. The default is `gemini-3.8-flash-medium`. An unknown ID fails with a message telling you to run `agy models`. `/gemini:ask` has no fallback model.
- Gemini 4 Argon (`gemini-4-argon-low`, `-medium`, `-high`) uses its own weekly quota. `/gemini:review` uses the same quota, so Argon asks leave fewer Argon reviews.
- The prompt can be up to 720,000 bytes, with its file and folder lists and the tool rule. That was about 165k tokens in a test.
- `agy` 1.4.3 shows the model only the first 192,000 bytes of a message, counting its own wrapper of about 400 bytes. It drops the rest without an error. So a prompt over 190,000 bytes goes in parts of up to 180,000 bytes, cut at line ends, each in its own turn of one `agy` session. Each part asks Gemini to reply with only OK. The next part goes only after a plain reply. Any other reply, a refused tool or an error stops the run with an error. The last message holds the text from the arguments, the file and folder lists and the tool rule. Only its answer is returned. `tokens` counts the whole session.
- When a conversation grows past `agy`'s compaction threshold, `agy` replaces the earlier turns with a summary, without an error. Gemini then no longer has the whole input, so a prompt in parts that `agy` compacts fails with an error. Any run also fails when an error step comes before the compaction, or when a compacted run ends with an empty answer. That is how a too-large media file shows up (see [Media](#media)). Any other run that compacts returns its answer, with `compacted: true` in `--json` and a note after the answer.
- Tested in October 2026: a 190,000-byte message arrived whole on `gemini-3.8-flash-low`, and a 1 MB message was cut to its first 192,000 bytes. A 719 KB prompt in 4 parts arrived whole on `gemini-3.8-flash-low` and `gemini-4-argon-low`, with codes at the start, in the middle, on both sides of a part edge and at the end. At the last turn, about 164k tokens were in context. A 1 MB prompt in 6 parts was compacted on Flash at part 5, so the cap is 720,000 bytes.
- `--prompt-file <path>` reads the prompt from a file, so a long prompt needs no heredoc. The file is opened like a `--file` (see below), so a symlink is refused. Prompt text in the arguments goes before the file's text, and stdin is not read. When the prompt goes in parts, the argument text goes in the last message, after the document. So for a long document, pass the question in the arguments. To make Gemini read a whole document, put the document in the prompt.
- `--file <path>` can repeat. The plugin opens each file with `O_NOFOLLOW`, so a symlink as the last part of the path is refused. A link could otherwise pass off another file, such as a secret, as the input. A folder in the path may be a link only when root owns it, as the system links `/tmp`, `/var` and `/etc` on macOS. A link that a user made is refused, because it can point anywhere, such as `bundle/data -> ~/.aws`. The plugin checks that the open file is a regular file, and copies it through the same open file into the `files/` folder of the empty temp folder that `agy` runs in, so the file cannot be swapped in between. The [tool gate](#the-tool-gate) lets Gemini read those copies and nothing else from the file's folder. The prompt lists the paths of the copies. For text, `agy`'s file tool reads at most 800 lines or 46,080 bytes per call, so in a long file Gemini reads only the parts it looks for. Media goes in one call (see [Media](#media)).
- `--resume <conversation-id>` continues an earlier ask. Every answer ends with a `[conversation] <id>` line. The plugin deletes its file copies after each ask, so pass `--file` and `--dir` again on each turn. If `agy` has no conversation with that ID, it starts a new one without the earlier turns. The plugin then fails and does not show that answer.
- `--dir <folder>` gives Gemini read access to a folder, such as a source tree. It can repeat, and the folders can be anywhere, also `/` or your home folder. The caller chooses them. The plugin passes each folder to `agy` as `--add-dir`, and the prompt lists the folders. Gemini's file tool can read only inside these folders, and only by full path. `agy`'s own folder stays closed, also when a `--dir` folder holds it. Gemini cannot list or search a folder: `agy` lists `list_dir`, `grep_search` and `find_by_name`, but a headless model does not get them (agy 1.4.3, Flash low, two tests). Gemini runs no commands either, so name the files to read in the prompt. Without file names, Gemini guessed paths in a test and ended with no answer. `--dir` and `--file` can be used together.
- `--schema <file>` takes a JSON Schema file and passes it to `agy` as `--json-schema`. The plugin checks the answer against the schema. An empty answer or one that does not fit fails the ask (exit 1): `agy` can report success with no structured output ([agy issue #1065](https://github.com/google-antigravity/antigravity-cli/issues/1065)). The text output is the JSON, pretty-printed, then the notes. The schema may use only `type` (one type name), `properties`, `required`, `additionalProperties` (true or false), `items`, `enum`, `minimum`, `description`, `title` and `$schema`, because the plugin checks only these. A schema with other keywords fails before the run. Tested live once (agy 1.4.3, Flash low): an image read into `{number, text_colour, confident}`.
- `--json` returns `{model, conversationId, response, structuredOutput, images, tokens, deniedActions, timedOut, compacted}`. `structuredOutput` is the checked JSON with `--schema`, otherwise `null`. `images` lists the copied images with `--image-out`, otherwise `null`.
- It runs in the foreground by default. `--background` runs it as a background task.
- `agy` runs in a fresh temp folder that is deleted afterwards. `agy`'s own saved conversations are left alone.
- If `agy` refused a tool or the run timed out, a short note follows the answer.
- The plugin tells Gemini to use web search, web pages and the local files it was given. It tells Gemini never to run shell commands, write files or start subagents. The one exception is `--image-out` (see below). When `agy` runs without a terminal, it cannot ask you for permission. So one refused tool ends the run, and the answer is empty.
- Each run is gated by the [tool gate](#the-tool-gate). An ask allows web search, page reads (if your `agy` settings allow them), `finish`, and the file reader inside its own `files/` folder and the `--dir` folders.
- By default, `agy` also refuses to open web pages. Research jobs, such as reading Reddit threads, need page reads. To allow them, add this to `~/.gemini/antigravity-cli/settings.json` (but see the Flash note below):

  ```json
  "permissions": { "allow": ["read_url(*)"] }
  ```

  Put all rules in one `allow` list. Gemini can then open any page it finds, in `/gemini:ask` and in `/gemini:review`. Without this rule, a page read in a review can end the review with no answer. Gemini still cannot write files. Its file tool cannot read outside the given files and folders. A research run can take 8 minutes or more, so use `--background` for it.
- Flash note (agy 1.4.3, October 2026, with `read_url(*)` allowed): `gemini-3.8-flash-low` and `gemini-3.8-flash-medium` were not offered a tool that reads a URL. Asked to list their tools, they named 12, with `search_web` but no `read_url_content`. Asked to open a page, they answered that they had no such tool. This held for an ask, an ask with `--schema` (as a review runs), a raw `agy -p` run in text mode, and the version of this plugin before the tool gate. A review on Flash low ran 9 searches and opened no page. `agy`'s init event still lists `read_url_content`. So on Flash, Gemini works from search summaries only. Not checked on Argon. A research run on 13 October 2026 (commit 4928de3) did try to open a page. I have not checked which `agy` version and model it used.
- `--image-out <folder>` makes images. Only in such a run, Gemini may start one subagent: `agy`'s `image-generator`, which makes the image with Nano Banana 2. The folder must exist, and no part of its path may be a link that a user made. After the run, the plugin copies the new image files (PNG, JPEG, WebP, GIF) that `agy` saved for this conversation under `~/.gemini/antigravity-cli/brain/<conversation-id>/` into the folder. It opens each one with `O_NOFOLLOW`, skips links, and never overwrites a file: if the folder already has a file of the same name, the ask fails and names it. It leaves `agy`'s folder as it is. The answer lists each copy on an `[image] <path>` line, and `--json` has them in `images`. A run that makes no image fails (exit 1). The image tool fails on some plans ([agy issue #1202](https://github.com/google-antigravity/antigravity-cli/issues/1202)). Tested on `agy` 1.4.3 with Flash low: a poster, and an image made from an attached reference image.

### The tool gate

Each run loads a hook from its temp folder, `.agents/hooks.json`, with the matcher `*`, so `agy` runs `scripts/tool-gate.mjs` before every tool call. The gate fails closed: it allows only the tools that the run needs and denies every other tool, also one that a newer `agy` adds.

| Run | Allowed | Also denied |
|---|---|---|
| `/gemini:review` | `search_web`, `read_url_content`, `finish` | every file read |
| `/gemini:ask` | `search_web`, `read_url_content`, `finish`, and the file reader (`read_file`, `view_file`) with the path check below | — |
| `/gemini:ask --image-out` | the `/gemini:ask` tools; `invoke_subagent` when every subagent is of type `image-generator` and names no `Workspace`; `generate_image`, whose reference images (`ImagePaths`) pass the path check; `send_message` only to the conversation that started the subagent, which the subagent uses to answer | every other subagent type |

Every run denies commands, file writes, `schedule`, the browser tools and MCP tools, and every subagent except the one above. Your `agy` rules may allow commands such as `grep` for your own use, and a web page or a file can tell Gemini to run one: for example, to read a secret and send it out in a URL. A page can also hold instructions for the model, but a search result can too, and a search query can already carry data out. So the gate keeps secrets out of reach instead: a review reads no local file, and an ask reads only inside its roots.

The hook also sees the tool calls of the `image-generator` subagent, which runs in its own conversation (agy 1.4.3, Flash low, two tests). Its read of a file outside the roots and its reference image outside the roots were denied. Its attached reference image was allowed. It had no command or page tool. A subagent of type `self` was denied.

The path check: the gate resolves each path that a file-tool call names to its real path. A path that does not resolve, or is not absolute, is denied. The real path must be inside an allowed root, by folder boundary, not by string prefix: the run's `files/` folder or a `--dir` folder. A symlink inside a root that points out of it is denied. Two folders are always denied, also inside a root: the run's `.agents` folder (the hook and its log) and `~/.gemini/antigravity-cli`, which holds `agy`'s sign-in token, settings and saved conversations. Without the gate, Gemini read its own conversation transcript there in a test.

An allowed tool still goes through `agy`'s own rules: "allow" hands the call on. So your settings decide page reads. If the hook fails, `agy` denies the call. A hook denial does not end the run. The plugin adds each denied command to `deniedActions` as `{"action": "command", "display_name": "<the command>"}`, each denied file read as `{"action": "read_file", "display_name": "<the path>"}`, and any other denied call as `{"action": "<tool>"}`, so it shows in the refused-tools note.

The stream and the hook name the file reader `read_file`, with a `Path` argument. `agy`'s init event and docs call it `view_file`, with `AbsolutePath`. The gate accepts both. Tested on `agy` 1.4.3 with Flash low: reads inside `--dir` and of attachments worked for text, PNG, JPEG, WebP, PDF, MP4 and M4A. A file outside the roots, a symlink out of a root, the `.agents` folder and the `agy` transcript were denied. If you added the rules `command(ls)` and `command(grep)` for an older version of this plugin, the plugin no longer needs them.

### Media

Gemini reads media that you pass with `--file`, or that sits in a `--dir` folder and is named by full path. `agy`'s file tool sends it to the model as media, not as text, in one call. These are observations on `agy` 1.4.3 with `gemini-3.8-flash-low`, October 2026, mostly one test each.

| Media | Works | Fails |
|---|---|---|
| Images | PNG, JPEG, WebP, GIF | — |
| PDF | text, and a chart that exists only as pixels | — |
| Video | MP4, WebM, MOV, MKV, AVI: frames. The audio track came through in MP4 and WebM (MOV, MKV and AVI were tested without sound) | YouTube and other URLs: the model only searches the web. Download the video first |
| Audio | MP3, WAV, OGG (Opus); M4A, because the plugin copies it as `.mp4` | AAC and FLAC: `agy` refuses them by extension. The plugin refuses them before the run. Convert first: `ffmpeg -i x.flac x.mp3` |

- **Size.** The plugin refuses a `--file` media file over 24,000,000 bytes before the run. It checks the size on the open file. A 24.4 MB video worked and a 28.0 MB video failed: `agy` compacted the conversation and the model lost the task. This was measured for video only. A too-large file in a `--dir` folder cannot be checked first, so the run fails after the compaction (see the compaction rule above). Cut or shrink a large video with `ffmpeg`, for example `ffmpeg -i in.mp4 -ss 0 -t 60 -c copy part1.mp4`.
- **Length is not the limit.** A 5-minute video of 0.3 MB worked. It cost about 90 input tokens per second, in one test.
- **Detail.** The model said it got about 1 frame per second. It caught text shown for 0.4 seconds, but misread 14-pixel text in a 720p video, and end times were off by up to 1 second. For small text, cut frames with `ffmpeg` and pass them as images.
- **Audio in a video.** The model sometimes says it cannot hear a video's sound. The tool rule therefore says that video frames can include sound. With that sentence, 16 of 16 answers on videos with sound were right, against 14 of 16 without it. On 4 silent videos, neither version invented sound.
- **The 46 KB cap** of the file tool applies to text only. A 24 MB video went in one call.

### `/gemini:setup`

```bash
/gemini:setup
/gemini:setup --json
```

Setup spends one model call. It sends a canary prompt ("Reply with the single word OK") and checks that the reply echoes it. That proves sign-in works and the prompt really reached the model. A CLI change that makes `agy` exit 0 without seeing the prompt shows up as `Prompt check: FAILED`.

Two free checks run alongside it:
- **Model check** reads `agy models` and looks for the review model (Argon), the fallback model (Flash) and the `/gemini:ask` default. `ok` means all three are listed. `degraded` means one is missing: reviews still run on the other review model, or only `/gemini:ask` without `--model` is affected. `FAILED` (exit 1) means both review models are missing. `unknown` means `agy models` could not run. `--json` reports each model under `models.primary`, `models.fallback` and `models.ask`.
- **Gemini quota** reads `agy -p /usage` and shows the remaining percent with reset times: the weekly and 5-hour limits for Gemini Flash, and the weekly limit for Gemini 4 Argon. If that call fails, setup still runs and shows the quota as unknown. `--json` includes it as `quota`, with Argon under `quota.argon` (`null` when `agy` does not report Argon).

## Configuration

Environment variables:

| Variable | Default | Effect |
|----------|---------|--------|
| `GEMINI_PLUGIN_CC_PROMPT_TIMEOUT_MS` | 1200000 (20 minutes) | Passed to `agy` as `--print-timeout`. When it runs out, `agy` returns what it has so far, and the plugin marks the result as timed out. The plugin's own hard limit is 30 seconds longer, so that partial answer can arrive first. The companion flag `--timeout-ms <n>` overrides it. Foreground runs of `/gemini:review` and `/gemini:ask` pass `--timeout-ms 540000` (9 minutes), to finish before Claude Code's 10-minute limit on a foreground command. |
| `GEMINI_PLUGIN_CC_RESOLVE_SOURCES` | (unset) | Set to `0` to keep grounding redirect links as they are. |
| `GEMINI_PLUGIN_CC_RESOLVE_SOURCES_TIMEOUT_MS` | 5000 | Time limit for resolving each redirect link. |
| `GEMINI_PLUGIN_CC_DEBUG` | (unset) | Set to `1` to include the underlying cause in error output. |

## How it works

For each call, the plugin:

1. Runs `agy` with every flag in `--flag=value` form: `--model`, one `--add-dir` for each `/gemini:ask --dir` folder, `--conversation` for `/gemini:ask --resume`, `--input-format=stream-json`, `--output-format=stream-json`, `--disable-slash-commands`, and `--print-timeout`. Reviews and `/gemini:ask --schema` add `--json-schema`. `agy` runs in an empty temp folder that holds the hook (see [The tool gate](#the-tool-gate))
2. Writes the prompt to `agy`'s stdin as one stream-json line, `{"event":"user","message":{"role":"user","content":"<prompt>"}}`. A long `/gemini:ask` prompt goes as several lines, each after the `result` of the one before (see [`/gemini:ask`](#geminiask)). Then it closes stdin, so `agy` ends after the last turn
3. Reads `agy`'s events, one JSON object per line, until stdout closes. It keeps the last `result` event: the answer (`structured_output` when a schema was used, otherwise `response`), token usage, refused tools and the conversation ID. It also counts the search steps and watches for error and compaction steps. A run with no `result` event is an error
4. Checks `agy`'s stderr for its timeout notice, and on a nonzero exit for `AGY_ERROR`, unknown model, used-up quota, and sign-in errors, in that order. The quota check comes before the sign-in check, because a quota message can contain words such as "sign in"
5. For reviews, validates the result against the schema, resolves redirect links, and renders the report

The prompt travels on stdin, so `ps` does not show it.

On SIGTERM or SIGINT, and at the hard time limit, the plugin stops the `agy` child and waits until it has exited, with SIGKILL after 1.5 seconds, before it deletes the temp folder. Before October 2026, a killed plugin left `agy` running with no parent.

## FAQ

### Does this use my OpenAI / Anthropic account?

No. It uses your Antigravity CLI installation and your Google sign-in.

### Can I still use Codex or Claude Code's own review?

Yes. This plugin is Antigravity-specific and runs independently of other plugins. Use whichever reviewer fits the task.

### Which model runs the review?

`gemini-4-argon-high` by default, with one fallback to `gemini-3.8-flash-high`. `--model <id>` picks another model, for example `gemini-4-argon-medium` for a cheaper check. The fallback rules are the same for a chosen model.

The fallback rules:
- If the first run fails for any other reason than sign-in or a hard timeout, the plugin runs the review once on Flash. If the failed model was Flash at any effort level, there is no second run, because every Flash level uses the same quota. The most likely cause is a used-up Argon quota. An unknown model or another `agy` error also falls back.
- A sign-in error does not fall back, because Flash would fail the same way.
- A hard timeout does not fall back, because it used the whole time budget.
- The timeout is one budget for both runs. Flash gets only the time that is left. If less than 60 seconds are left, the plugin skips Flash and reports the Argon error.
- A run that `agy` cut off at its own time limit is not an error. The plugin returns that partial result and does not fall back.
- The first error is never hidden. The report and `fallbackReason` show it.

Why two models: Argon was faster in a test in October 2026 (93 seconds against 219 seconds for the same three claims). But Argon has only a weekly limit, separate from Flash. One review of three claims used about 1.4% of it. Flash keeps reviews working when the Argon limit runs out.

As of `agy` 1.4.2, `agy models` lists `gemini-4-argon-{low,medium,high}`, `gemini-3.8-flash-{high,medium,low}`, `claude-opus-5-5-{low,medium,high}`, `claude-sonnet-5-5-{low,medium,high}` and `gpt-oss-120b-medium`. `/gemini:setup` checks both review models and the `/gemini:ask` default, so a rename shows up there first.

### Why is a grounded review slow?

Each claim needs at least one web search, and the model reasons over the results. A review of four or five claims can take several minutes. `agy` streams progress events, but the plugin shows only the final answer, so the wait is silent until it arrives.

### Does the search cost money?

Your `agy` sign-in governs billing and quota. `/gemini:setup` shows how much Gemini quota you have left. See your Antigravity plan for details.

## Migration notes (Gemini CLI → Antigravity CLI)

On May 19, 2026 at Google I/O, Google announced that Gemini CLI was being retired for free/Pro/Ultra users on June 18, 2026 and replaced with Antigravity CLI (`agy`). This plugin migrated in response. What changed and what stayed:

- **Transport.** Now spawns `agy` in print mode, sends the prompt on stdin as stream-json, and reads its stream-json events. The previous ACP JSON-RPC handshake (`initialize`, `session/new`, `session/set_mode`, `session/set_model`, `session/prompt`, `session/cancel`, `session/update`) is gone; `agy` does not expose ACP. Until October 2026 the plugin passed `--print=<prompt>`, because `agy` ignores stdin with its default text input. That put the prompt in `ps` and capped it near 128 KiB on Linux.
- **Plan mode.** Removed. Headless `agy` cannot ask for permission, so it refuses file writes, commands and page fetches. Reviews stay read-only without a session mode.
- **Tool-call observability.** `agy`'s stream-json output reports each tool call. The plugin counts the web searches for the `[grounding]` footer, and watches for error and compaction steps. The tool gate's log shows each denied call.
- **Model selection.** Reviews pin the model, passed as `--model=<id>`. See [Which model runs the review?](#which-model-runs-the-review). Model IDs are the ones `agy models` prints. `/gemini:ask` takes any of them with `--model`.
- **Streaming progress.** `agy` streams events, but the plugin returns only the final result. The default timeout is 20 minutes.
- **Auth.** Now uses Google OAuth via `agy`. `GEMINI_API_KEY` and `gemini auth login` are no longer used.
- **Slash commands.** `/gemini:review` and `/gemini:setup` still work. `/gemini:ask` is new.

Enterprise users with a Gemini Code Assist Standard or Enterprise license retain access to the original `gemini` binary. This plugin no longer targets that path; if you need it, pin to a pre-migration tag.

## Development

Run these commands from `plugins/gemini`:

```bash
npm test
```

Unit and integration tests. The transport-level tests use a fake spawn fixture and do not require a working `agy` install.

An end-to-end smoke test that requires a working `agy`:

```bash
node tests/smoke-review.mjs
```

This feeds a small synthetic response with deliberately false claims and asserts that (a) the agent returned at least one contradicted/uncertain verdict and (b) at least one claim cites a source URL.

### Trying changes before you push

From the repository root, start Claude Code with the plugin loaded from your working tree. This applies to that session only:

```bash
claude --plugin-dir ./plugins/gemini
```

### Known problems

- Do not paste `$ARGUMENTS` into a shell string in command markdown. Quotes, `$` or a backtick in the user's text then break the command. `review.md` and `ask.md` tell Claude to pass each flag as its own argument and the free text as one single-quoted argument after `--`, so free text that starts with `--` is not read as a flag.

## License

Apache License 2.0. See `LICENSE` and `NOTICE`.

Portions of the architecture (plugin layout, test patterns, command framing) are adapted from [openai/codex-plugin-cc](https://github.com/openai/codex-plugin-cc), also Apache-2.0.
