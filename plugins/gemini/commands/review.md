---
description: Fact-check conversation content via Antigravity CLI with live web grounding
argument-hint: '[--model <id>] [focus text]'
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

Building the command:
- Do not paste `$ARGUMENTS` into the shell command. Build the arguments yourself.
- Drop `--wait` and `--background` from the raw arguments. Pass `--json` as its own argument.
- If the raw arguments include `--model <id>`, pass `--model` and the ID as two arguments, with the ID single-quoted. Leave `--model` out when the caller gave none. The plugin then uses its default model.
- Pass the rest of the raw arguments (the focus text) as ONE single-quoted argument. Write each `'` inside it as `'\''`. Leave it out when there is no focus text.
- Example: for the raw arguments `check Node's "LTS" date`, the arguments are `'check Node'\''s "LTS" date'`.
- Example: for the raw arguments `--model gemini-4-argon-medium focus on dates`, the arguments are `--model 'gemini-4-argon-medium' 'focus on dates'`.

Flow:
- Always launch the review with `Bash` in the background, even when the raw arguments include `--wait`. A review of a few short claims can take more than 10 minutes, and a foreground `Bash` call stops at 10.
- Use a quoted heredoc, so the content is piped in literally with no shell expansion:
```typescript
Bash({
  command: `node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" review 'check the "LTS" date' <<'GEMINI_REVIEW_INPUT_EOF'
<the full text of the content to review, verbatim>
GEMINI_REVIEW_INPUT_EOF`,
  description: "Gemini review",
  run_in_background: true
})
```
- After launching, tell the user: "Gemini review started in the background. You will be notified when it finishes." Then stop. If you are a subagent, do not send your final report yet: a subagent sends only one report, so a report sent now loses the review output. You are woken when the task finishes.
- When it finishes, return its stdout verbatim, exactly as-is.
- Do not paraphrase, summarize, or add commentary before or after it.
- Do not edit any file or follow up on any finding.
