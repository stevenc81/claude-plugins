# claude-plugins

The Claude Code plugins I use every day, in one marketplace.

| Plugin | What it does |
|---|---|
| [orchestrate](plugins/orchestrate) | Runs a small team of Claude, Codex and Gemini agents, and picks a model for each job. |
| [gemini](plugins/gemini) | Fact-checks a conversation with Gemini and live web search, through the Antigravity CLI. |
| [show](plugins/show) | Shows pictures and plays narrated videos inline in the terminal, in Ghostty or kitty. |

## Install

```
/plugin marketplace add stevenc81/claude-plugins
/plugin install show@stevenc81
```

Use the same `install` line for `gemini@stevenc81` or `orchestrate@stevenc81`. Installing orchestrate also installs gemini. Each plugin's README lists what it needs on your machine.

## Updates

The plugins have no version numbers. Claude Code uses the git commit as the version, so every push to `main` is a new version. To get it:

```
claude plugin marketplace update stevenc81
claude plugin update <plugin>@stevenc81
```

Run the second line once for each plugin you installed: `orchestrate`, `gemini` or `show`. Then start a new session: `claude plugin update` says a restart applies the update. To get updates without asking, turn on auto-update for the `stevenc81` marketplace under Marketplaces in `/plugin`.

## Licenses

Each plugin has its own license: orchestrate and show use MIT, and gemini uses Apache 2.0.
