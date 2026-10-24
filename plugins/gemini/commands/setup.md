---
description: Check that Antigravity CLI works, the review model exists, and show Gemini quota
argument-hint: '[--json]'
disable-model-invocation: false
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" *)
---

Check whether Antigravity CLI (`agy`) is installed, the print transport works, and auth is valid.

Raw slash-command arguments:
`$ARGUMENTS`

Do not paste the raw arguments into the shell command. The only supported argument is `--json`.

Run with a `Bash` timeout of 300000 (5 minutes). If the raw arguments include `--json`, run:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" setup --json
```
Otherwise, run:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" setup
```

Return the output verbatim to the user. Do not paraphrase.
