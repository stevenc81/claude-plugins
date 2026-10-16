# orchestrate

A skill that turns one Claude Code session into the conductor of a small agent team. The team can mix Claude, Codex and Gemini. For each job, the skill picks a model and an effort level from a table of public benchmark results. It also says how to brief each agent, how to check a claim with three vendors, and what to do when a vendor hits a usage limit.

The rules are in [`skills/conduct/SKILL.md`](skills/conduct/SKILL.md). The benchmark numbers and their sources are in [`skills/conduct/evidence.md`](skills/conduct/evidence.md). The model facts were checked on 2026-10-16.

## What you need

- Claude Code.
- The Codex CLI (`codex`), signed in.
- The Antigravity CLI (`agy`), signed in. The [gemini plugin README](../gemini/README.md) explains the setup.

The plugin depends on two other plugins: `gemini` from this marketplace, and `codex` from OpenAI's marketplace.

## Install

```
/plugin marketplace add openai/codex-plugin-cc
/plugin marketplace add stevenc81/claude-plugins
/plugin install orchestrate@stevenc81
/reload-plugins
```

Then ask for an agent team in plain words, or type `/orchestrate:conduct`.

## Usage limits

When a vendor stops a job at its usage limit, the skill reads the reset time from these files:

- `~/.claude/statusline-cache/usage.dat` for Claude
- `~/.claude/statusline-cache/codex-usage.dat` for Codex
- `~/.claude/statusline-cache/gemini-usage.dat` for Gemini

A custom status line script writes them, and this plugin does not include one. Without the files, the skill asks you for the reset time.

## License

MIT. See `LICENSE`.
