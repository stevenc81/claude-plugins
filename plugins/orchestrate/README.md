# orchestrate

A skill that turns one Claude Code session into the conductor of a small agent team. The team can mix Claude, Codex and Gemini. For each job, the skill picks a model and an effort level from a table of public benchmark results. It also says how to brief each agent, how to check a claim with three vendors, and what to do when a vendor hits a usage limit.

## Goal

The skill sends each job to the model that is best at it, and it uses each plugin only for what it does well. Every run must be reliable: each teammate's result comes back to the conductor, or the conductor sees a clear failure and acts on it. The work must also be secure, and as simple as possible. Check every change against this goal.

The rules are in [`skills/conduct/SKILL.md`](skills/conduct/SKILL.md). The benchmark numbers and their sources are in [`skills/conduct/evidence.md`](skills/conduct/evidence.md). The date the model facts were checked is at the top of `evidence.md`.

## What you need

- Claude Code.
- The Codex CLI (`codex`), signed in.
- The Antigravity CLI (`agy`), signed in. The [gemini plugin README](../gemini/README.md) explains the setup.

The plugin depends on the `gemini` plugin from this marketplace. It runs Codex through the Codex CLI, so it does not need OpenAI's codex plugin.

## Install

```
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
