# gemini

Use the Antigravity CLI (`agy`) from inside Claude Code to fact-check with live web grounding. This plugin is for Claude Code users who want a second-opinion reviewer that goes to the live web (not just training data) to verify claims made in a conversation.

> **Heads up:** This plugin previously spawned `gemini --acp` and spoke ACP (JSON-RPC) over stdio. Google retired Gemini CLI for free/Pro/Ultra users on June 18, 2026 and replaced it with [Antigravity CLI](https://antigravity.google) (`agy`), built in Go. This plugin now runs `agy` in print mode and reads its stream-json output. The slash commands carry over. See [Migration notes](#migration-notes-gemini-cli--antigravity-cli) below.

## Goal

This plugin has one goal: to work reliably when Claude Code agents call it during multi-agent work, such as the author's `orchestrate` skill. The lead session or a subagent must always get Gemini's result back, or a clear error it can act on. Check every change against this goal.

## What you get

- `/gemini:review` fact-checks content from the current conversation. `agy` runs live web searches and returns structured findings: which claims are supported, uncertain, or contradicted, with source URLs.
- `/gemini:ask` sends any prompt to a model through `agy` and returns the answer as is. You can attach files.
- `/gemini:setup` checks that `agy` is installed and signed in, that the review model exists, and how much Gemini quota you have left.

## Requirements

- **Antigravity CLI** (`agy --version` must work). Tested on 1.4.3. The plugin relies on `--input-format=stream-json`, `--output-format=stream-json`, `--json-schema`, `--conversation` and `--disable-slash-commands`. I have not checked which older versions have them. An `agy` without one of them exits 2 with `flags provided but not defined`. Then run `agy update`. See https://antigravity.google
- **Antigravity CLI 1.4.2 or later for `/gemini:ask --dir`.** That is the oldest version on which the command hook was tested (see [`/gemini:ask`](#geminiask)). An older `agy` could ignore the hook without a warning, so `--dir` fails before the run and tells you to run `agy update`.
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
```

The only flag is `--model <id>`. Anything else after `/gemini:review` is plain natural language, not fixed syntax. Claude uses it in one of two ways:

- To choose what gets reviewed. Phrases like `check the second paragraph above` or `review what I just pasted` point Claude at specific text instead of its previous reply.
- To steer attention. Phrases like `focus on the version numbers` tell the agent which claims matter most. It still reports any other real issue it finds.

When another skill or agent calls `/gemini:review` and gives it text, it reviews exactly that text.

The review always runs as a background task, and Claude Code tells you when it finishes. In October 2026, a review of three short claims took 93 seconds on Gemini 4 Argon and 219 seconds on Gemini 3.8 Flash. A review of six claims on Flash took 11.5 minutes. A foreground run stops after 9 minutes, and a fallback to Flash adds a second run. The run time depends on the number of claims, not the length of the text.

How it works:
- Claude pipes the selected text to the companion script through a quoted heredoc. No temp files, no copy and paste.
- The companion runs `agy` in an empty temp folder with the review prompt on stdin and the JSON schema (`--json-schema`).
- The prompt tells the model to use only web search. Headless `agy` refuses file reads outside its empty temp folder, and page fetches and commands that your `agy` settings do not allow. A refused tool ends the run with no answer.
- A hook in the temp folder denies every command, also `ls` and `grep` that your `agy` settings allow, and every subagent. A web page can hold instructions for the model, so a review must never run commands. A hook denial does not end the run, and it shows in `deniedActions`.
- Search often returns `vertexaisearch.cloud.google.com/grounding-api-redirect/...` links. The plugin resolves each one to the real page URL (one request each, in parallel, 5 seconds max). If that fails, it keeps the original link.
- The report ends with a `[grounding]` footer. It counts the cited sources and lists any tools `agy` refused.
- Input is capped at 40KB. Longer content is cut on a line boundary, and the report says so.

Model: reviews run on `gemini-4-argon-high` by default. `--model <id>` picks another model from `agy models`. If the run fails, the plugin can retry once on `gemini-3.8-flash-high`. See [Which model runs the review?](#which-model-runs-the-review) for the rules. The header and the `--json` output show which model answered and why a fallback happened.

Limitations:
- Search quality depends on what the agent finds. Niche or paywalled sources may be missed. Read `uncertain` as "search did not find it," not "it is wrong."
- Claude picks the text to review from context. To be sure, quote or paste the exact text.
- The plugin does not count the tool calls that `agy` reports, so cited sources are the only sign of grounding.

Output states:

| State | `--json` fields | Text label |
|-------|----------------|------------|
| Success | `parsed` is an object, `parseError` is `null` | `review (N bytes)` |
| Degraded | `parsed` is `null`, `parseError` says why, `rawOutput` holds any text the model sent | `review (N bytes, degraded)` |
| Timed out | `timedOut` is `true`, `stopReason` is `"timeout"` | `review (N bytes, degraded)` plus a line saying the review was cut off |

`model` is the model that answered. `requestedModel` is the model the plugin tried first. `fellBack` is `true` when Flash answered, and `fallbackReason` holds the error from the first run (otherwise `null`). A text report that fell back says so in the header and on the first line.

`deniedActions` lists any tools `agy` refused. When a refusal left the model with no answer, `parseError` names the refused tools.

The exit code is `0` in all three states, because the CLI ran. A nonzero exit means the plugin itself failed (spawn error, sign-in, unknown model, used-up quota, or a hard timeout). After a fallback, a nonzero exit means both models failed, and the error names both causes. To branch on answer quality, read `parseError` and `timedOut` from `--json` output.

### `/gemini:ask`

Sends a prompt to a model and returns its answer exactly as the model wrote it.

```bash
/gemini:ask what changed in the latest Node.js release?
/gemini:ask --model gemini-3.8-flash-high explain this error in plain words
/gemini:ask --file ./notes.md --file ./plan.md which plan is riskier?
/gemini:ask --dir ./core/libs/imgqsort --dir ./core/libs/database/haar how do the blur score and duplicate search work?
/gemini:ask --prompt-file /tmp/prompt-compare.md
/gemini:ask --resume 3c758fbe-ecb4-4d7b-a9f9-94bda6aad668 --file ./plan.md and which step is the riskiest?
/gemini:ask --json summarize this thread
```

- `--model <id>` takes any ID from `agy models`. The default is `gemini-3.8-flash-medium`. An unknown ID fails with a message telling you to run `agy models`. `/gemini:ask` has no fallback model.
- Gemini 4 Argon (`gemini-4-argon-low`, `-medium`, `-high`) uses its own weekly quota. `/gemini:review` uses the same quota, so Argon asks leave fewer Argon reviews.
- The prompt can be up to 720,000 bytes, with its file and folder lists and the tool rule. That was about 165k tokens in a test.
- `agy` 1.4.3 shows the model only the first 192,000 bytes of a message, counting its own wrapper of about 400 bytes. It drops the rest without an error. So a prompt over 190,000 bytes goes in parts of up to 180,000 bytes, cut at line ends, each in its own turn of one `agy` session. Each part asks Gemini to reply with only OK. The next part goes only after a plain reply. Any other reply, a refused tool or an error stops the run with an error. The last message holds the text from the arguments, the file and folder lists and the tool rule. Only its answer is returned. `tokens` counts the whole session.
- When a conversation grows past `agy`'s compaction threshold, `agy` replaces the earlier turns with a summary, without an error. Gemini then no longer has the whole input, so a prompt in parts that `agy` compacts fails with an error.
- Tested in October 2026: a 190,000-byte message arrived whole on `gemini-3.8-flash-low`, and a 1 MB message was cut to its first 192,000 bytes. A 719 KB prompt in 4 parts arrived whole on `gemini-3.8-flash-low` and `gemini-4-argon-low`, with codes at the start, in the middle, on both sides of a part edge and at the end. At the last turn, about 164k tokens were in context. A 1 MB prompt in 6 parts was compacted on Flash at part 5, so the cap is 720,000 bytes.
- `--prompt-file <path>` reads the prompt from a file, so a long prompt needs no heredoc. Prompt text in the arguments goes before the file's text, and stdin is not read. When the prompt goes in parts, the argument text goes in the last message, after the document. So for a long document, pass the question in the arguments. To make Gemini read a whole document, put the document in the prompt.
- `--file <path>` can repeat. The plugin checks that each file exists and copies it into the empty temp folder that `agy` runs in. Gemini can read those copies and nothing else from the file's folder. The prompt lists the paths of the copies. `agy`'s file tool reads at most 800 lines or 46,080 bytes per call, so in a long file Gemini reads only the parts it looks for.
- `--resume <conversation-id>` continues an earlier ask. Every answer ends with a `[conversation] <id>` line. The plugin deletes its file copies after each ask, so pass `--file` and `--dir` again on each turn. If `agy` has no conversation with that ID, it starts a new one without the earlier turns. The plugin then fails and does not show that answer.
- `--dir <folder>` gives Gemini read access to a folder, such as a source tree. It can repeat, and the folders can be anywhere, also `/` or your home folder. The caller chooses them. The plugin passes each folder to `agy` as `--add-dir`, and the prompt lists the folders. Gemini's file tool can read only these folders. `ls` and `grep` can reach any path, so only the prompt keeps them inside these folders. `agy` has no tool to list or search a folder, so the prompt tells Gemini to use `ls` and `grep -rn`. That needs two rules in your `agy` settings (see below). Without them, `--dir` fails before the run and names the rules to add. `--dir` and `--file` can be used together.
- `--json` returns `{model, conversationId, response, tokens, deniedActions, timedOut}`.
- It runs in the foreground by default. `--background` runs it as a background task.
- `agy` runs in a fresh temp folder that is deleted afterwards. `agy`'s own saved conversations are left alone.
- If `agy` refused a tool or the run timed out, a short note follows the answer.
- The plugin tells Gemini to use web search, web pages and the local files it was given. With `--dir`, it may also run `ls` and `grep`, one plain command at a time. It tells Gemini never to run other shell commands, write files or start subagents. When `agy` runs without a terminal, it cannot ask you for permission. So one refused tool ends the run, and the answer is empty. Subagents are the exception: `agy` runs them with no allow rule and picks their model itself, so a hook denies them (see below).
- For `--dir`, add these two rules to `~/.gemini/antigravity-cli/settings.json`:

  ```json
  "permissions": { "allow": ["command(ls)", "command(grep)"] }
  ```

  The rules apply to every `agy` run, also when you use `agy` yourself. Tested on `agy` 1.4.2 and 1.4.3: with these rules, `agy` still refuses chains (`&&`, `;`), pipes and `$(...)`. But it runs a redirect such as `grep x dir > file` when the file is inside the workspace: the temp folder or a `--dir` folder. So each run also loads a hook from its temp folder, `.agents/hooks.json`. The hook runs `scripts/command-gate.mjs` before each command and before each `invoke_subagent`, `define_subagent`, `manage_subagents`, `browser_subagent` or `schedule` call. It allows one plain `ls` or `grep` command and denies anything with `;`, `&`, `|`, `<`, `>`, `$`, a backtick, a backslash, brackets or a new line. It denies every subagent and `schedule` call. If the hook fails, `agy` denies the call. A hook denial does not end the run. The plugin adds each denied command to `deniedActions` as `{"action": "command", "display_name": "<the command>"}`, and each denied subagent call as `{"action": "invoke_subagent"}`, so it shows in the refused-tools note. The hook cannot replace the two rules: `agy` refuses `ls` and `grep` without them, even when the hook allows them. The forms `command(ls *)` and `command(ls:*)` do not match. `rg` and `find` are left out, because `rg --pre` and `find -exec` run other programs.
- By default, `agy` also refuses to open web pages. Research jobs, such as reading Reddit threads, need page reads. To allow them, add this to `~/.gemini/antigravity-cli/settings.json`:

  ```json
  "permissions": { "allow": ["read_url(*)"] }
  ```

  Put all rules in one `allow` list. Gemini can then open any page it finds. It still cannot write files. Its file tool cannot read outside the given files and folders. A research run can take 8 minutes or more, so use `--background` for it.

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

1. Runs `agy` with every flag in `--flag=value` form: `--model`, one `--add-dir` for each `/gemini:ask --dir` folder, `--conversation` for `/gemini:ask --resume`, `--input-format=stream-json`, `--output-format=stream-json`, `--disable-slash-commands`, and `--print-timeout`. Reviews add `--json-schema`. `agy` runs in an empty temp folder that holds the hook (see [`/gemini:ask`](#geminiask))
2. Writes the prompt to `agy`'s stdin as one stream-json line, `{"event":"user","message":{"role":"user","content":"<prompt>"}}`. A long `/gemini:ask` prompt goes as several lines, each after the `result` of the one before (see [`/gemini:ask`](#geminiask)). Then it closes stdin, so `agy` ends after the last turn
3. Reads `agy`'s events, one JSON object per line, until stdout closes. It keeps the last `result` event: the answer (`structured_output` when a schema was used, otherwise `response`), token usage, refused tools and the conversation ID. A run with no `result` event is an error
4. Checks `agy`'s stderr for its timeout notice, and on a nonzero exit for `AGY_ERROR`, unknown model, used-up quota, and sign-in errors, in that order. The quota check comes before the sign-in check, because a quota message can contain words such as "sign in"
5. For reviews, validates the result against the schema, resolves redirect links, and renders the report

The prompt travels on stdin, so `ps` does not show it.

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
- **Tool-call observability.** `agy`'s stream-json output reports each tool call, but the plugin does not use it yet. The `[grounding]` footer counts cited sources and lists any tools `agy` refused.
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
