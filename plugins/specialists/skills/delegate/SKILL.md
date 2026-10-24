---
name: delegate
description: Use before you hand a job to a Claude agent of type general-purpose or specialist-<area> with the Agent tool.
---

Only the main session follows this skill. If you are an agent, ignore it.

# Delegate

Skip this skill for other agent types, such as `Explore`. If the job must call an MCP tool itself, run it as general-purpose, and skip the rest of this skill.

Terms:

- `<plugin>`: the folder two levels above this skill's base directory.
- `agent.py`: short for `python3 -I '<plugin>/scripts/agent.py'`. Run it with the Bash tool. Write the full command in each call, never in a shell variable.
- Area: a short name for the subject of a job, such as `claude-plugins` or `datadog`.
- Specialist: an agent of type `specialist-<area>`, defined by its agent file.
- Only `agent.py` writes agent files. Never write them with Write, Edit or a shell redirect.
- Single-quote every value that you put in a command: a path, a URL, an area, a description or a role. Write each `'` inside a value as `'\''`.
- If `check` prints BAD, it exits 1; use its BAD line. If any other `agent.py` command exits 1, it prints the reason on stderr.

## Area names

1. If the job reads or changes files in a git repo, run `git -C '<repo root>' remote get-url origin`. Then run `agent.py area '<that URL>'`.
2. If the repo has no origin, run `agent.py area '<repo root>'`.
3. Else, if the job is about one external system, run `agent.py area '<system>'`.
4. Else, run `agent.py area '<noun>'`. Use a short noun for the recurring job, such as `daily-digest`. Never use a verb, a date or a ticket ID.
5. Use the printed area, unless step 7 picks another. If `area` exits 1, use step 4 with a new noun.
6. Run `agent.py check '<area>'`. The area is new when it prints `missing file`.
7. For a new area, run `agent.py list`. If a description covers the job, use its area. If it covers the job in part, use its area and widen its description with `agent.py describe`. If you picked an area from the list, run `agent.py check '<area>'` for it. "Pick the agent" uses the last `check` result.

## Pick the agent

1. If `check` printed `OK` and no `updated` line, and `specialist-<area>` is in this session's agent types, call the Agent tool with `subagent_type: specialist-<area>`.
2. If `check` printed `missing file`, run `agent.py create` for the area first. Never run the job as general-purpose.
3. After `create`, or when `check` printed `updated`, use the bridge. Use it also when `check` printed `OK` but `specialist-<area>` is not in this session's agent types, and no bridge ran for this area in this session. The bridge: start `sleep 30` with the Bash tool and `run_in_background: true`. Then end the turn, and say in one line that the specialist starts in the next turn. The reason: Claude Code loads a new or changed agent file only for a later turn, and a changed file took about 25 seconds in tests. In the turn that the task's notification starts, run `agent.py check '<area>'` first. Call `specialist-<area>` only if it prints `OK`.
4. Give the specialist the rules, the goal and the job in its brief. Its memory carries only facts and methods about its area, and the brief wins over its memory.
5. A specialist has no MCP tools. If the job needs an MCP tool, make those MCP calls yourself, and give their output to the specialist in its brief, or act on its report.
6. Do not run the job in these cases:
   - `create` or `describe` exits 1, or `check` prints BAD for a reason other than `missing file`. If `create` or `describe` exits 1 because of the description or role text, first fix the text and run the command once more. This case holds only if the command fails again. Tell the user the reason.
   - `specialist-<area>` is still missing after the bridge, for example in a `claude -p` session. Tell the user that the specialist works from the next session.
   - An `agent.py` call exits with a code other than 0 or 1. Tell the user that the plugin cannot run.

## Agent files

- `list` prints `<area>: <description>` for each good agent file, without the prefix `Use only for jobs in the area <area>: `.
- `create '<area>' --description '<text>' --role '<text>'` writes the agent file and prints `created <path>`. If the file exists, or another agent file claims the name, `create` exits 1.
- `describe '<area>' --description '<text>'` replaces the description and prints `described <path>`.
- `check '<area>'` prints `OK <path>` or `BAD <path>: <reason>` for the area's agent file.
- If the steps in a good agent file differ from `steps.md`, or its tools line is old, `check` rewrites them first and prints `updated <path>`.

Rules for the texts:

- The description is one sentence on what the area covers, at most 300 characters.
- The role is one or two sentences on what the specialist knows, at most 600 characters.
- Use no line break and no `---` in either text. Use only ASCII characters in both texts.
- In the description, do not put "all", "any" or "every" before "task" or "job". Do not use "proactively", "always" or "must".

## Summary

End your reply with a section `## Specialists` in each turn where one of these happened. It lists:

- each `create` and `describe` call, with its area;
- each `WARN` line of `check`, and each `BAD` line other than `missing file`;
- each `area` or `list` command that exited 1.
