# specialists

This plugin uses Claude Code's built-in agent memory (`memory: user`). The main session stays a normal session.

The plugin works with no change to any CLAUDE.md.

## How it works

A specialist is an agent for one area, such as one repo or one system: it starts fresh for each job, and its knowledge lives in its own memory folder. The main session follows [`skills/delegate/SKILL.md`](skills/delegate/SKILL.md), and the specialist follows [`steps.md`](steps.md). `agent.py` copies `steps.md` into each agent file, because Claude Code runs no `SubagentStart` hook for an agent team teammate.

With [orchestrate](../orchestrate/skills/conduct/SKILL.md), the sentences that start with "If the specialists plugin is installed" say how it uses this plugin.

## Files it writes

The config folder is `$CLAUDE_CONFIG_DIR` if it is set, else `~/.claude`.

- Agent files: `<config folder>/agents/specialist-<area>.md`.
- Memory: `<config folder>/agent-memory/specialist-<area>/`. Who writes it: see `steps.md`, "Write your memory".

The plugin keeps no state in its own folder. Uninstalling the plugin leaves all these files in place.

## Delete the files

`<config folder>` is as in "Files it writes".

To delete one specialist and its memory:

```
rm "<config folder>/agents/specialist-<area>.md"
rm -rf "<config folder>/agent-memory/specialist-<area>"
```

To delete all specialists and their memory:

```
rm "<config folder>/agents"/specialist-*.md
rm -rf "<config folder>/agent-memory"/specialist-*
```

To back up all specialist memory:

```
cp -R "<config folder>/agent-memory" "$HOME/agent-memory-backup"
```

## Permission prompts

The skill runs `agent.py` with the Bash tool, and `agent.py` writes in the config folder. In default permission mode, Claude Code may ask before each call. To allow the calls, add this rule to `permissions.allow` in `<config folder>/settings.json`, with the full path of your config folder in place of `/Users/you/.claude`:

```
"Bash(python3 -I '/Users/you/.claude/plugins/cache/stevenc81/specialists/*/scripts/agent.py' *)"
```

The Claude Code docs say that `*` matches any text, including spaces and `/`. I have not checked that this rule matches the quoted path. Claude Code lets a specialist read and write the `.md` files in its own memory folder with no prompt.

## What you need

- Claude Code. The plugin was built against version 2.1.309.
- Auto memory on. See "Remaining risks".
- Python 3. On macOS, it comes with the Xcode Command Line Tools: run `xcode-select --install` if it is missing.

The plugin is tested only on macOS.

## Install

```
/plugin marketplace add stevenc81/claude-plugins
/plugin install specialists@stevenc81
/reload-plugins
```

Then hand jobs to agents as usual. The skill's description asks Claude Code to load it before each general-purpose or specialist Agent call.

## Tests

The script tests need no model. In this folder, run:

```
python3 -I -B -m unittest discover -s tests
```

The model tests run in `claude plugin eval`, in its own temp config. This command fails on any case that scores below 1.0:

```
claude plugin eval . --no-publish --trust-plugin --ablation none --scaffold --allow-tools Bash Write Edit WebFetch --output-dir "${TMPDIR:-/tmp}/specialists-eval" --tag check
```

The model tests cover two things: the main session runs `agent.py check` before its first `agent.py create` call or Agent call (`m1`); Claude Code loads a specialist's `MEMORY.md`, and a specialist gets its steps from its agent file (`m2`).

In eval, the sandbox blocks reads and writes under the config folder. So no model test covers:

- the specialist's own lesson checks and its memory writes;
- the choice of specialist, `create`, the bridge, reuse, and `describe`;
- any file effect of `agent.py` in a real session.

The script tests cover `agent.py`.

## Remaining risks

- The main session reads no lessons. So only the specialist's own five lesson checks stand between untrusted input and its memory. A steered specialist can still save a false lesson that looks harmless, or a secret, and later jobs in its area read it.
- An agent with Bash runs as you and can change any file you can change. This includes other specialists' memory folders and the agent files. `check` before each call finds a bad key, but not a changed role text.
- Memory has no history. A bad change can be undone only from a backup.
- Two agents of one area that run at the same time can overwrite each other's memory edits.
- If auto memory is off, specialists have no memory. `check` prints a warning when `CLAUDE_CODE_DISABLE_AUTO_MEMORY` is set or `autoMemoryEnabled` is `false` in `<config folder>/settings.json`. It reads no other settings file.
- `check` looks for another agent file that claims a specialist's name. It misses a name written with YAML escapes, such as `\x74`, and files in symlinked folders.
- A specialist that Claude Code picks by its description skips `check`. So it can run with old steps, and its frontmatter hooks run as you each time it runs.
- A description can widen its area to any job, and so steer which agent Claude Code picks. The fixed prefix, the banned words and the ban on non-ASCII characters lower this.
- Specialists get no MCP tools. An MCP tool can send data out, such as mail or posts. Every specialist reaches the web, with `WebFetch`, `WebSearch` or `curl`.
- Area names outside git repos may differ between sessions. The skill reads the existing descriptions first to lower this.

## License

MIT. See `LICENSE`.
