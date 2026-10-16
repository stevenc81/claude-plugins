---
description: Check that Antigravity CLI works, the review models exist, and show Gemini quota
argument-hint: '[--json]'
disable-model-invocation: false
allowed-tools: Bash(node:*)
---

Check whether Antigravity CLI (`agy`) is installed, the print transport works, and auth is valid.

Run with a `Bash` timeout of 300000 (5 minutes):
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" setup "$ARGUMENTS"
```

Return the output verbatim to the user. Do not paraphrase.
