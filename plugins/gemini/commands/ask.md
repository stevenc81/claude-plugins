---
description: Send a prompt to a Gemini model via Antigravity CLI and return its answer
argument-hint: '[--model <id>] [--file <path>]... [--dir <folder>]... [--prompt-file <path>] [--resume <conversation-id>] [--json] [--background] <prompt>'
disable-model-invocation: false
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" *)
---

Send a prompt to a model through headless `agy` (Antigravity CLI) and return its answer.

Raw slash-command arguments:
`$ARGUMENTS`

Core constraint:
- Your only job is to run the command and return its output verbatim to the user.
- Do not answer the prompt yourself, edit files, or act on the answer.

Input handling:
- Split the raw arguments into flags and the prompt. Flags are `--model <id>`, `--file <path>` (may repeat), `--dir <folder>` (may repeat), `--prompt-file <path>`, `--resume <conversation-id>`, `--json` and `--background`. Everything else is the prompt.
- `--model` takes any model ID from `agy models`. The default is `gemini-3.8-flash-medium`.
- `--dir` gives Gemini read access to a folder, such as a source tree. Gemini can list it with `ls` and search it with `grep`. It may repeat, and the folders can be anywhere. Use it instead of `--file` when there are many files. `--dir` and `--file` can be used together.
- `--prompt-file <path>` reads the prompt from that file. Prompt text in the arguments goes before the file's text. A long file goes to Gemini in parts, and the argument text then goes last, so pass the question for a long document as argument text.
- `--resume <conversation-id>` continues an earlier ask. Each answer ends with a `[conversation] <id>` line. Pass `--file` and `--dir` again on each turn: the plugin deletes its copies after each ask.
- If there is no prompt and no `--prompt-file`, stop and tell the user: "Nothing to ask. Add a prompt after /gemini:ask."

Building the command:
- Do not paste `$ARGUMENTS` into the shell command. Build the arguments yourself.
- Pass `--json`, `--model <id>`, `--prompt-file <path>`, `--resume <conversation-id>`, each `--dir <folder>` and each `--file <path>` as their own arguments. Leave out any flag the user did not give, and leave out `--background`.
- Single-quote each value, writing each `'` inside it as `'\''`. Example: `--file '/Users/me/Bob'\''s notes.md'`.
- With `--prompt-file`, use no heredoc. Pass any other prompt text as one single-quoted argument after the flags and a `--` argument, so text that starts with `--` is not read as a flag. Example: `--prompt-file '/tmp/prompt.md' -- '--help means what here?'`.
- Otherwise, pass the prompt verbatim via stdin using a quoted heredoc. Do not paraphrase it.
- Make a new heredoc end marker for each call: `GEMINI_EOF_` and 8 random capital letters or digits. Never reuse the marker from the examples. If a line of the prompt equals the marker, make a new one. A line that equals the marker ends the input early, and the shell runs the lines after it as commands.

Execution mode rules:
- If the raw arguments include `--background`, run in a Claude background task.
- Otherwise, run in the foreground.

Foreground flow:
- Set the `Bash` timeout to 600000 (10 minutes). `--timeout-ms 540000` gives the model 9 minutes, so a long run comes back marked as cut off before the `Bash` limit kills it.
- Invoke with a quoted heredoc so the prompt is piped in literally (no shell expansion inside it):
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" ask --timeout-ms 540000 --model 'gemini-3.8-flash-high' --file '/Users/me/Bob'\''s notes.md' <<'GEMINI_EOF_7Q2KX9WM'
<the prompt, verbatim>
GEMINI_EOF_7Q2KX9WM
```
- Always keep `--timeout-ms 540000` in the foreground.
- Return the command's stdout verbatim, exactly as-is.
- Do not paraphrase, summarize, or add commentary before or after it.

Background flow:
- Launch with `Bash` in the background using the same heredoc form, without `--timeout-ms`:
```typescript
Bash({
  command: `node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" ask --model 'gemini-3.8-flash-high' --file '/Users/me/notes.md' <<'GEMINI_EOF_7Q2KX9WM'
<the prompt, verbatim>
GEMINI_EOF_7Q2KX9WM`,
  description: "Gemini ask",
  run_in_background: true
})
```
- After launching, tell the user: "Gemini ask started in the background. You will be notified when it finishes." Then stop. If you are a subagent, do not send your final report yet: a subagent sends only one report, so a report sent now loses the ask output. You are woken when the task finishes.
- When it finishes, return its output verbatim.
