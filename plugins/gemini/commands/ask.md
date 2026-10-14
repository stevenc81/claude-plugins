---
description: Send a prompt to a Gemini model via Antigravity CLI and return its answer
argument-hint: '[--model <id>] [--file <path>]... [--dir <folder>]... [--json] [--background] <prompt>'
disable-model-invocation: false
allowed-tools: Bash(node:*)
---

Send a prompt to a model through `agy --print` (Antigravity CLI) and return its answer.

Raw slash-command arguments:
`$ARGUMENTS`

Core constraint:
- Your only job is to run the command and return its output verbatim to the user.
- Do not answer the prompt yourself, edit files, or act on the answer.

Input handling:
- Split the raw arguments into flags and the prompt. Flags are `--model <id>`, `--file <path>` (may repeat), `--dir <folder>` (may repeat), `--json` and `--background`. Everything else is the prompt.
- `--model` takes any model ID from `agy models`. The default is `gemini-3.8-flash-medium`.
- `--dir` gives Gemini read access to a folder, such as a source tree. It may repeat for several folders in one project. Use it instead of `--file` when there are many files. Do not combine `--dir` and `--file`.
- If there is no prompt, stop and tell the user: "Nothing to ask. Add a prompt after /gemini:ask."

Building the command:
- Do not paste `$ARGUMENTS` into the shell command. Build the arguments yourself.
- Pass `--json`, `--model <id>`, each `--dir <folder>` and each `--file <path>` as their own arguments. Leave out any flag the user did not give, and leave out `--background`.
- Single-quote each value, writing each `'` inside it as `'\''`. Example: `--file '/Users/me/Bob'\''s notes.md'`.
- Pass the prompt verbatim via stdin using a quoted heredoc. Do not paraphrase it.

Execution mode rules:
- If the raw arguments include `--background`, run in a Claude background task.
- Otherwise, run in the foreground.

Foreground flow:
- Set the `Bash` timeout to 600000 (10 minutes). `--timeout-ms 540000` gives the model 9 minutes, so a long run comes back marked as cut off before the `Bash` limit kills it.
- Invoke with a quoted heredoc so the prompt is piped in literally (no shell expansion inside it):
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" ask --timeout-ms 540000 --model 'gemini-3.8-flash-high' --file '/Users/me/Bob'\''s notes.md' <<'GEMINI_ASK_INPUT_EOF'
<the prompt, verbatim>
GEMINI_ASK_INPUT_EOF
```
- Always keep `--timeout-ms 540000` in the foreground.
- Return the command's stdout verbatim, exactly as-is.
- Do not paraphrase, summarize, or add commentary before or after it.

Background flow:
- Launch with `Bash` in the background using the same heredoc form, without `--timeout-ms`:
```typescript
Bash({
  command: `node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" ask --model 'gemini-3.8-flash-high' --file '/Users/me/notes.md' <<'GEMINI_ASK_INPUT_EOF'
<the prompt, verbatim>
GEMINI_ASK_INPUT_EOF`,
  description: "Gemini ask",
  run_in_background: true
})
```
- After launching, tell the user: "Gemini ask started in the background. You will be notified when it finishes."
- When it finishes, return its output verbatim.
