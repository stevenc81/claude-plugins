---
description: Fact-check conversation content via Antigravity CLI with live web grounding
argument-hint: '[--model <id>] [focus text]'
disable-model-invocation: false
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" *)
---

Run a grounded fact-check of content from the current conversation via headless `agy` (Antigravity CLI). The agent runs live web searches and returns structured findings: which claims are supported, uncertain, or contradicted, with source URLs, plus any reasoning issues.

Raw slash-command arguments:
`$ARGUMENTS`

Core constraint:
- If the user called this command directly, your only job is to run the review and return Gemini's output verbatim, with no commentary before or after it. Do not fix issues, edit files, change your answer, or follow up on any finding.
- If it runs inside a larger task (you are a subagent, or another skill called it), give the output to that task, then go on with the task.

Input handling:
- Determine what to review from the user's message and conversation context:
  - If the user points at specific content (e.g., "review your last reply", "check the second bullet above", "review the paragraph starting with...", "review what I just pasted"), pass exactly that content.
  - If another skill or agent calls this command and gives you the text to review, review exactly that text.
  - Otherwise, default to the full text of your immediately previous assistant turn.
- Pass the selected content verbatim via stdin using a quoted heredoc. Do not paraphrase or abridge it.
- Make a new heredoc end marker for each call: `GEMINI_EOF_` and 8 random capital letters or digits. Never reuse the marker from the example. If a line of the content equals the marker, make a new one. A line that equals the marker ends the input early, and the shell runs the lines after it as commands.
- If there is nothing suitable to review (e.g., the user gave no reference and this is the first message of the session), stop and tell the user: "Nothing to review. Point me at the text you want audited (e.g., 'review your last reply' or paste the content), then rerun /gemini:review."

Building the command:
- Do not paste `$ARGUMENTS` into the shell command. Build the arguments yourself.
- Drop `--wait` and `--background` from the raw arguments. Pass `--json` as its own argument.
- If the raw arguments include `--model <id>`, pass `--model` and the ID as two arguments, with the ID single-quoted. Leave `--model` out when the caller gave none. The plugin then uses its default model.
- Pass the rest of the raw arguments (the focus text) as ONE single-quoted argument, after a `--` argument, so text that starts with `--` is not read as a flag. Write each `'` inside it as `'\''`. Leave out both when there is no focus text.
- Example: for the raw arguments `check Node's "LTS" date`, the arguments are `-- 'check Node'\''s "LTS" date'`.
- Example: for the raw arguments `--model gemini-4-argon-medium focus on dates`, the arguments are `--model 'gemini-4-argon-medium' -- 'focus on dates'`.

Flow:
- If you are a subagent, run the review in the foreground: see "Subagent flow" below. A subagent is not woken when its own background task ends, so its result would never come back.
- Otherwise, always launch the review with `Bash` in the background, even when the raw arguments include `--wait`. A review of a few short claims can take more than 10 minutes, and a foreground `Bash` call stops at 10.
- Use a quoted heredoc, so the content is piped in literally with no shell expansion:
```typescript
Bash({
  command: `node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" review -- 'check the "LTS" date' <<'GEMINI_EOF_7Q2KX9WM'
<the full text of the content to review, verbatim>
GEMINI_EOF_7Q2KX9WM`,
  description: "Gemini review",
  run_in_background: true
})
```
- After launching, tell the user: "Gemini review started in the background. You will be notified when it finishes." Then stop.
- When it finishes, return its stdout verbatim, exactly as-is. If the command exits nonzero, return the exit code and its stderr verbatim instead. The error and its next step are there, and stdout is empty.

## Subagent flow

- Run the same command in the foreground, with the `Bash` timeout 600000 (10 minutes) and `--timeout-ms 540000`. The review then ends by itself within 10 minutes, with a cut-off report or an error:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" review --timeout-ms 540000 -- 'check the "LTS" date' <<'GEMINI_EOF_7Q2KX9WM'
<the full text of the content to review, verbatim>
GEMINI_EOF_7Q2KX9WM
```
- Return its output as above. If the review was cut off or hit the time limit, also say so in your report, and give your caller the exact command to run in the background, without `--timeout-ms`.
