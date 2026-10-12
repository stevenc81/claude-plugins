---
description: Fact-check conversation content via Antigravity CLI with live web grounding
argument-hint: '[--wait|--background] [focus text]'
disable-model-invocation: false
allowed-tools: Bash(node:*)
---

Run a grounded fact-check of content from the current conversation via `agy --print` (Antigravity CLI). The agent runs live web searches and returns structured findings: which claims are supported, uncertain, or contradicted, with source URLs, plus any reasoning issues.

Raw slash-command arguments:
`$ARGUMENTS`

Core constraint:
- This command is analysis-only.
- Do not fix issues, edit files, or change your answer.
- Your only job is to run the review and return Gemini's output verbatim to the user.

Input handling:
- Determine what to review from the user's message and conversation context:
  - If the user points at specific content (e.g., "review your last reply", "check the second bullet above", "review the paragraph starting with...", "review what I just pasted"), pass exactly that content.
  - If another skill or agent calls this command and gives you the text to review, review exactly that text.
  - Otherwise, default to the full text of your immediately previous assistant turn.
- Pass the selected content verbatim via stdin using a quoted heredoc. Do not paraphrase or abridge it.
- If there is nothing suitable to review (e.g., the user gave no reference and this is the first message of the session), stop and tell the user: "Nothing to review. Point me at the text you want audited (e.g., 'review your last reply' or paste the content), then rerun /gemini:review."

Execution mode rules:
- If the raw arguments include `--wait`, run the review in the foreground.
- If the raw arguments include `--background`, run the review in a Claude background task.
- Otherwise, count the characters in the selected content. Over 5,000 characters, run in the background. Otherwise, run in the foreground.

Building the command:
- Do not paste `$ARGUMENTS` into the shell command. Build the arguments yourself.
- Pass each flag from the raw arguments as its own argument: `--wait`, `--background`, `--json`.
- Pass the rest of the raw arguments (the focus text) as ONE single-quoted argument. Write each `'` inside it as `'\''`. Leave it out when there is no focus text.
- Example: for the raw arguments `--wait check Node's "LTS" date`, the arguments are `--wait 'check Node'\''s "LTS" date'`.

Foreground flow:
- Set the `Bash` timeout to 600000 (10 minutes). `--timeout-ms 540000` gives the model 9 minutes in total, so a long run comes back marked as cut off before the `Bash` limit kills it.
- Invoke with a quoted heredoc so the selected content is piped in literally (no shell expansion inside the content):
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" review --timeout-ms 540000 --wait 'check Node'\''s "LTS" date' <<'GEMINI_REVIEW_INPUT_EOF'
<the full text of the content to review, verbatim>
GEMINI_REVIEW_INPUT_EOF
```
- Return the command's stdout verbatim, exactly as-is.
- Do not paraphrase, summarize, or add commentary before or after it.
- Do not edit any file or follow up on any finding.

Background flow:
- Launch the review with `Bash` in the background using the same heredoc form, without `--timeout-ms`:
```typescript
Bash({
  command: `node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" review --background 'check the "LTS" date' <<'GEMINI_REVIEW_INPUT_EOF'
<the full text of the content to review, verbatim>
GEMINI_REVIEW_INPUT_EOF`,
  description: "Gemini review",
  run_in_background: true
})
```
- After launching, tell the user: "Gemini review started in the background. You will be notified when it finishes."
- When it finishes, return its output verbatim.
