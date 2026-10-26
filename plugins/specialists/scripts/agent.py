"""agent.py of the specialists plugin: list, area, create, describe and check."""
import glob
import json
import os
import re
import sys

AREA_RE = re.compile(r"^(?=.{2,30}$)[a-z0-9]+(-[a-z0-9]+)*$")
BANNED = re.compile(r"(?i)\b((all|any|every) (tasks?|jobs?)|proactively|always|must)\b")
DESCRIPTION_MAX = 300
ROLE_MAX = 600
PREFIX = "Use only for jobs in the area {area}: "
TOOLS = "Read, Bash, Edit, Write, WebFetch, WebSearch, SendMessage"
OLD_TOOLS = ("Read, Bash, Edit, Write", "Read, Bash, Edit, Write, WebFetch, WebSearch")
KEYS = ["name", "description", "tools", "memory"]
NEW = os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW  # a new file, never through a link
CLAIM = (r"""(?m)^(?:\{(?:.*?,)?[ \t]*)?(?:name|"name"|'name')[ \t]*:(?:[ \t]*[>|][-+]?)?[ \t]*(?:\r?\n[ \t]+)?"""
         r"""(["']?)specialist-AREA\1(?=[ \t\r]*(?:[,}]|$)|[ \t]+#)""")
TEMPLATE = """---
name: specialist-{area}
description: {description}
tools: {tools}
memory: user
---
You are the specialist for the area `{area}`. {role}

"""
# The steps go into each agent file: Claude Code runs no SubagentStart hook for a teammate.
STEPS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "steps.md")
STEPS_HEAD = "Steps from the specialists plugin:\n\n"


class Fail(Exception):
    """An error: main prints the reason on stderr and exits 1."""


def config_dir():
    return os.path.abspath(os.environ.get("CLAUDE_CONFIG_DIR") or os.path.join(os.path.expanduser("~"), ".claude"))


def agents_dir():
    return os.path.join(config_dir(), "agents")


def show(path):
    """The path as one line of output: line breaks are escaped."""
    return path.replace("\n", "\\n").replace("\r", "\\r")


def check_text(text, limit=DESCRIPTION_MAX):
    """Return the reason why a description (or, with limit=ROLE_MAX, a role) is bad, or None."""
    if not text.strip():
        return "is empty"
    if len(text) > limit:
        return f"is over {limit} characters"
    if "\n" in text or "\r" in text:
        return "holds a line break"
    if "---" in text:
        return "holds ---"
    if limit == DESCRIPTION_MAX and BANNED.search(text):
        return f"uses the word {BANNED.search(text).group(1)!r}"
    if not text.isascii():
        return "holds a non-ASCII character"
    return None


def check_file(area, path):
    """Return None if the agent file is good, else the reason."""
    try:
        with open(path, encoding="utf-8") as f:
            lines = f.read().split("\n")
    except FileNotFoundError:
        return "missing file"
    except (OSError, UnicodeDecodeError):
        return "cannot read"
    # Claude Code ends the frontmatter at the first ---, even inside a line. Text other than white space must follow.
    end = lines.index("---", 1) if "---" in lines[1:] else len(lines)
    if lines[0] != "---" or not "".join(lines[end + 1:]).strip() or any("---" in x for x in lines[1:end]):
        return "bad frontmatter"
    front = lines[1:end]
    keys = [line.split(":", 1)[0].strip() if ":" in line else "" for line in front]
    if bad := [key for key in keys if key not in KEYS]:
        return f"bad key {bad[0]}" if bad[0] else "bad frontmatter"
    if missing := [key for key in KEYS if key not in keys]:
        return f"missing key {missing[0]}"
    if keys != KEYS or not all(line.startswith(key + ": ") for key, line in zip(KEYS, front)):
        return "bad frontmatter"
    name, description, tools, memory = (line.split(": ", 1)[1] for line in front)
    if name != f"specialist-{area}" or not AREA_RE.fullmatch(area):
        return "bad name"
    try:
        value = json.loads(description)
    except ValueError:
        return "bad description"
    prefix = PREFIX.format(area=area)
    if (not isinstance(value, str) or json.dumps(value) != description
            or not value.startswith(prefix) or check_text(value[len(prefix):])):
        return "bad description"
    if tools != TOOLS and tools not in OLD_TOOLS:
        return "bad tools"
    if memory != "user":
        return "bad memory"
    return None


def steps_text():
    try:
        with open(STEPS, encoding="utf-8") as f:
            return STEPS_HEAD + f.read()
    except (OSError, UnicodeDecodeError):
        raise Fail(f"cannot read {STEPS}")


def sync(path):
    """Rewrite a good agent file if its tools line is not TOOLS or its steps differ from steps.md. Keep the
    other frontmatter lines and the role line. Print `updated <path>` if the file changed."""
    with open(path, encoding="utf-8") as f:
        text = f.read()
    end = text.index("\n---\n") + len("\n---\n")
    front = text[:end].split("\n")
    front[3] = "tools: " + TOOLS
    want = "\n".join(front) + text[end:].split("\n", 1)[0] + "\n\n" + steps_text()
    if text != want:
        write_new(path, want)
        print(f"updated {show(path)}")


def name_taken(area, path):
    """The reason if another .md file in the agents folder or a .claude/agents folder claims specialist-<area>."""
    folders, here = [agents_dir()], os.getcwd()
    while True:
        folders.append(os.path.join(here, ".claude", "agents"))
        if os.path.exists(os.path.join(here, ".git")) or os.path.dirname(here) == here:
            break
        here = os.path.dirname(here)
    for folder in folders:
        for root, _, names in os.walk(folder):
            for n in sorted(names):
                other = os.path.join(root, n)
                if not n.lower().endswith(".md") or os.path.realpath(other) == os.path.realpath(path):
                    continue
                try:
                    with open(other, encoding="utf-8", errors="replace") as f:
                        text = f.read().removeprefix("\ufeff")
                except OSError:
                    continue
                if text.startswith("---") and re.search(CLAIM.replace("AREA", area), text[3:].split("---", 1)[0]):
                    return f"name taken by {show(other)}"
    return None


def memory_off():
    """True if Claude Code's auto memory is off, so `memory: user` does nothing."""
    if os.environ.get("CLAUDE_CODE_DISABLE_AUTO_MEMORY"):
        return True
    try:
        with open(os.path.join(config_dir(), "settings.json"), encoding="utf-8") as f:
            return json.load(f).get("autoMemoryEnabled") is False
    except (OSError, ValueError, AttributeError):
        return False


def write_new(path, text):
    """Write the file. Unlink an old file first, so no planted link is written through."""
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        if os.path.lexists(path):
            os.unlink(path)
        with os.fdopen(os.open(path, NEW, 0o644), "w", encoding="utf-8", newline="") as f:
            f.write(text)
    except OSError as e:
        raise Fail(f"cannot write {path}: {e.strerror}")


def parse(args, names):
    """Parse `<area> --name value ...`. Every name is required, and no other option is allowed."""
    if not args:
        raise Fail("usage: " + " ".join(["<area>"] + [n + " <text>" for n in names]))
    area, found, args = args[0], {}, args[1:]
    if not AREA_RE.fullmatch(area):
        raise Fail(f"bad area {area!r}")
    while args:
        if args[0] not in names or len(args) < 2 or args[0] in found:
            raise Fail(f"bad option {args[0]!r}")
        found[args[0]], args = args[1], args[2:]
    for n in names:
        if n not in found:
            raise Fail(f"missing option {n}")
        if reason := check_text(found[n], ROLE_MAX if n == "--role" else DESCRIPTION_MAX):
            raise Fail(f"the {n[2:]} {reason}")
    return area, found


def cmd_list(args):
    """Print `<area>: <description>` for each good agent file, without the description prefix."""
    if args:
        raise Fail("list takes no arguments")
    for path in sorted(glob.glob(os.path.join(glob.escape(agents_dir()), "specialist-*.md"))):
        area = os.path.basename(path)[len("specialist-"):-len(".md")]
        if not check_file(area, path):
            with open(path, encoding="utf-8") as f:
                description = json.loads(f.read().split("\n")[2].split(": ", 1)[1])
            print(f"{area}: {description[len(PREFIX.format(area=area)):]}")


def cmd_area(args):
    if len(args) != 1:
        raise Fail("usage: area <name, path or git URL>")
    name = re.split(r"[/:]", args[0].rstrip("/"))[-1].lower()
    name = re.sub(r"[_. ]", "-", name.removesuffix(".git"))
    name = re.sub(r"-+", "-", re.sub(r"[^a-z0-9-]", "", name)).strip("-")[:30].strip("-")
    if not AREA_RE.fullmatch(name):
        raise Fail(f"no valid area name from {args[0]!r}")
    print(name)


def cmd_create(args):
    area, opts = parse(args, ["--description", "--role"])
    path = os.path.join(agents_dir(), f"specialist-{area}.md")
    if os.path.lexists(path):
        raise Fail(f"{path} exists")
    if reason := name_taken(area, path):
        raise Fail(f"{path}: {reason}")
    description = json.dumps(PREFIX.format(area=area) + opts["--description"])
    write_new(path, TEMPLATE.format(area=area, tools=TOOLS, role=opts["--role"], description=description)
              + steps_text())
    print(f"created {show(path)}")


def cmd_describe(args):
    area, opts = parse(args, ["--description"])
    path = os.path.join(agents_dir(), f"specialist-{area}.md")
    if reason := check_file(area, path):
        raise Fail(f"{path}: {reason}")
    with open(path, encoding="utf-8") as f:
        lines = f.read().split("\n")
    lines[2] = "description: " + json.dumps(PREFIX.format(area=area) + opts["--description"])
    write_new(path, "\n".join(lines))
    print(f"described {show(path)}")


def cmd_check(args):
    area, _ = parse(args, [])
    path = os.path.join(agents_dir(), f"specialist-{area}.md")
    if memory_off():
        print("WARN auto memory is off")
    reason = check_file(area, path) or name_taken(area, path)
    if not reason:
        try:
            sync(path)
        except Fail as e:
            reason = str(e)
    print(f"BAD {show(path)}: {reason}" if reason else f"OK {show(path)}")
    sys.exit(1 if reason else 0)


COMMANDS = {"list": cmd_list, "area": cmd_area, "create": cmd_create, "describe": cmd_describe, "check": cmd_check}


def main(argv):
    try:
        if not argv or argv[0] not in COMMANDS:
            raise Fail("usage: agent.py list|area|create|describe|check ...")
        COMMANDS[argv[0]](argv[1:])
    except Exception as e:  # Fail exits 1. Any other error is a crash: it exits 2, with no traceback.
        sys.stderr.write(f"agent.py: {show(str(e))}\n")
        sys.exit(1 if isinstance(e, Fail) else 2)


if __name__ == "__main__":
    main(sys.argv[1:])
