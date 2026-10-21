# self-improve

A skill that improves any target an agent can read and change, such as a folder or a Datadog dashboard, toward your goal over several rounds. After each round it tells you whether the target got better, stayed flat, or got worse. The rules are in [`skills/rounds/SKILL.md`](skills/rounds/SKILL.md).

## How a round works

You give the skill a target, a goal and a number of rounds in your prompt. In Setup it asks what your prompt does not answer, turns your goal into criteria that an agent can check, and measures the start. Each round then has 4 steps:

1. Build: a builder fixes the task list.
2. Test: the skill runs its script checks and the try-outs that your goal names, such as your tests, on the real target.
3. Review: one reviewer rates the target and the test output against your criteria, finds the gaps, and checks which earlier issues are still open.
4. Reflect: the skill writes one row in `TREND.md` with the issue score from `score.py`, shows you the reflection, and turns the open issues into the next task list.

Two reviews of one target can differ, so one round can move the score by noise alone.

Before you start, read the notes in SKILL.md "Setup", such as how to keep a way back. At the end, the skill keeps its temp folder in the session's scratchpad, so you can read the results. It guards against mistakes by its agents, not against a hostile or prompt-injected agent.

## What you need

- Claude Code.
- A target to improve: a folder, or a live target that a tool, such as an MCP server, can read and change.
- Python 3. On macOS, it comes with the Xcode Command Line Tools: run `xcode-select --install` if it is missing.

The skill is tested only on macOS.

To use agents from other vendors through [orchestrate](../orchestrate), see SKILL.md "Team".

## Install

```
/plugin marketplace add stevenc81/claude-plugins
/plugin install self-improve@stevenc81
/reload-plugins
```

Then ask Claude to improve a target in rounds, or type `/self-improve:rounds`.

## License

MIT. See `LICENSE`.
