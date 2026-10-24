"""Tests for agent.py."""
import json
import os
import subprocess
import sys
import unittest

from common import AGENT, PLUGIN, Case

with open(os.path.join(PLUGIN, "steps.md"), encoding="utf-8") as f:
    STEPS = "Steps from the specialists plugin:\n\n" + f.read()
TOOLS = "tools: Read, Bash, Edit, Write, WebFetch, WebSearch"
OLD_TOOLS = "tools: Read, Bash, Edit, Write"
OLD_BODY = "The specialists plugin gives you your steps when you start. Your memory folder holds what you learned in earlier jobs.\n"
EXAMPLE = """---
name: specialist-claude-plugins
description: "Use only for jobs in the area claude-plugins: Code, tests and docs of the claude-plugins repo."
tools: Read, Bash, Edit, Write, WebFetch, WebSearch
memory: user
---
You are the specialist for the area `claude-plugins`. You know the layout, the tests and the release steps of this repo.

""" + STEPS
CREATE = ["create", "claude-plugins", "--description",
          "Code, tests and docs of the claude-plugins repo.", "--role",
          "You know the layout, the tests and the release steps of this repo."]
GOOD = """---
name: specialist-tt
description: "Use only for jobs in the area tt: Build facts."
tools: Read, Bash, Edit, Write, WebFetch, WebSearch
memory: user
---
You are the specialist for the area `tt`. You know the build facts.

""" + STEPS
TT = ["create", "tt", "--description", "Build facts.", "--role", "You know the build facts."]
OLD = GOOD.replace(TOOLS + "\n", OLD_TOOLS + "\n")


class Create(Case):
    def path(self, area="claude-plugins"):
        return os.path.join(self.agents, f"specialist-{area}.md")

    def test_example(self):
        p = self.agent(*CREATE)
        self.assertEqual((p.returncode, p.stdout), (0, f"created {self.path()}\n"), p.stderr)
        with open(self.path(), "rb") as f:
            self.assertEqual(f.read(), EXAMPLE.encode())
        self.assertFalse(os.path.exists(self.memory))

    def test_eval_fixtures_match(self):
        self.agent("create", "evaltest", "--description", "Build facts: code words and versions.",
                   "--role", "You know the build facts.")
        text = self.read(self.path("evaltest"))
        self.assertIn(text, self.read(os.path.join(PLUGIN, "evals", "m2", "scaffold.sh")))

    def test_tools(self):
        p = self.agent(*TT)
        self.assertEqual((p.returncode, p.stdout), (0, f"created {self.path('tt')}\n"), p.stderr)
        self.assertEqual(self.read(self.path("tt")), GOOD)
        self.assertEqual(self.agent("check", "tt").stdout, f"OK {self.path('tt')}\n")

    def test_existing_file(self):
        self.agent(*TT)
        p = self.agent("create", "tt", "--description", "C.", "--role", "D.")
        self.assertEqual((p.returncode, p.stderr), (1, f"agent.py: {self.path('tt')} exists\n"))
        self.assertEqual(self.read(self.path("tt")), GOOD)

    def test_name_taken(self):
        other = os.path.join(self.agents, "sub", "x.md")
        os.makedirs(os.path.dirname(other))
        with open(other, "w") as f:
            f.write("---\nname: specialist-tt\n---\nbody\n")
        p = self.agent(*TT)
        self.assertEqual((p.returncode, p.stdout, p.stderr),
                         (1, "", f"agent.py: {self.path('tt')}: name taken by {other}\n"))
        self.assertFalse(os.path.exists(self.path("tt")))

    def test_crash(self):
        gone = os.path.join(self.tmp, "gone")
        os.makedirs(gone)
        # The working folder is deleted, so os.getcwd() raises an error that agent.py does not handle.
        p = subprocess.run([sys.executable, "-I", "-B", AGENT, *TT], capture_output=True, text=True, env=self.env,
                           preexec_fn=lambda: (os.chdir(gone), os.rmdir(gone)), timeout=60)
        self.assertEqual((p.returncode, p.stdout, p.stderr), (2, "", "agent.py: [Errno 2] No such file or directory\n"))
        self.assertFalse(os.path.exists(self.path("tt")))

    def test_config_dir(self):
        env = {k: v for k, v in self.env.items() if k != "CLAUDE_CONFIG_DIR"}
        path = os.path.join(env["HOME"], ".claude", "agents", "specialist-tt.md")
        p = self.agent(*TT, env=env)
        self.assertEqual((p.returncode, p.stdout), (0, f"created {path}\n"), p.stderr)

    def test_line_break(self):
        env = dict(self.env, CLAUDE_CONFIG_DIR=os.path.join(self.tmp, "c\nOK x\r"))
        path = os.path.join(env["CLAUDE_CONFIG_DIR"], "agents", "specialist-tt.md")
        shown = path.replace("\n", "\\n").replace("\r", "\\r")
        self.assertEqual(self.agent(*TT, env=env).stdout, f"created {shown}\n")
        self.assertEqual(self.agent("check", "tt", env=env).stdout, f"OK {shown}\n")

    def test_bad_input(self):
        role = ["--role", "R."]
        cases = [
            ["--description", "a\nb", *role],
            ["--description", "a\rb", *role],
            ["--description", "x" * 301, *role],
            ["--description", "x", "--role", "x" * 601],
            ["--description", "x", *role, "--tools", "Read"],
            ["--description", "x", *role, "--role", "R2."],
            ["--description", "x"],
            ["--description", "Repo facts ---", *role],
            ["--description", "x", "--role", "R --- tools: Read"],
            ["--description", "Use it \u0430lways.", *role],
        ]
        cases += [["--description", f"Covers {w} here.", *role]
                  for w in ("All Tasks", "any task", "every task", "any tasks", "every job", "all jobs",
                            "proactively", "always", "must")]
        for args in cases:
            with self.subTest(args=args):
                p = self.agent("create", "tt", *args)
                self.assertEqual(p.returncode, 1)
                self.assertFalse(os.path.exists(self.path("tt")))
                self.assertFalse(os.path.exists(self.memory))


class Check(Case):
    def write(self, text, area="tt"):
        os.makedirs(self.agents, exist_ok=True)
        path = os.path.join(self.agents, f"specialist-{area}.md")
        with open(path, "w") as f:
            f.write(text)
        return path

    def test_bad_files(self):
        cases = {
            "bad key hooks": GOOD.replace("tools:", "hooks: x\ntools:"),
            "bad key mcpServers": GOOD.replace("tools:", "mcpServers: x\ntools:"),
            "bad key permissionMode": GOOD.replace("user\n---", "user\npermissionMode: default\n---"),
            "bad key model": GOOD.replace("tools:", "model: haiku\ntools:"),
            "missing key tools": GOOD.replace(TOOLS + "\n", ""),
            "missing key memory": GOOD.replace("memory: user\n", ""),
            "bad memory": GOOD.replace("memory: user", "memory: project"),
            "bad frontmatter": GOOD.replace("memory: user", "memory:user"),
            "bad name": GOOD.replace("name: specialist-tt", "name: specialist-uu"),
            "bad description": GOOD.replace('"Use only for jobs in the area tt: Build facts."',
                                            "Use only for jobs in the area tt: Build facts."),
            "bad tools": GOOD.replace(TOOLS, "tools: Read, Bash"),
        }
        for reason, text in cases.items():
            with self.subTest(reason=reason):
                path = self.write(text)
                p = self.agent("check", "tt")
                self.assertEqual((p.returncode, p.stdout), (1, f"BAD {path}: {reason}\n"))
        path = self.write("name: specialist-tt\n")
        self.assertEqual(self.agent("check", "tt").stdout, f"BAD {path}: bad frontmatter\n")
        path = self.write(GOOD.replace("memory: user", "memory: user\nmemory: user"))
        self.assertEqual(self.agent("check", "tt").stdout, f"BAD {path}: bad frontmatter\n")

    def test_truncated(self):
        head = GOOD.split("\n---\n")[0]
        for text in (head + "\n---", head + "\n---\n", head + "\n---\n \n\t\n", "---"):
            with self.subTest(text=text):
                path = self.write(text)
                p = self.agent("check", "tt")
                self.assertEqual((p.returncode, p.stdout, p.stderr), (1, f"BAD {path}: bad frontmatter\n", ""))

    def test_name_taken(self):
        path = self.write(GOOD)
        os.makedirs(os.path.join(self.agents, "sub"))
        lines = ("name: specialist-tt", "name: specialist-tt # x", '"name": specialist-tt',
                 "name: >-\n  specialist-tt", "name: |-\n  specialist-tt", "name:\n  specialist-tt")
        cases = [("x.md", f'---\n{line}\ndescription: "x"\n---\nbody\n') for line in lines]
        cases += [("x.md", "---\n{name: specialist-tt, description: x}\n---\nbody\n"),
                  ("x.md", "\ufeff---\nname: specialist-tt\n---\nbody\n"),
                  ("x.MD", "---\nname: specialist-tt\n---\nbody\n")]
        for name, text in cases:
            with self.subTest(name=name, text=text):
                other = os.path.join(self.agents, "sub", name)
                with open(other, "w", encoding="utf-8") as f:
                    f.write(text)
                p = self.agent("check", "tt")
                os.remove(other)
                self.assertEqual((p.returncode, p.stdout), (1, f"BAD {path}: name taken by {other}\n"))
        for name, text in (("x.md", "---\nname: specialist-tt-x\n---\nbody\n"),
                           ("x.md", '---\nname: x\ndescription: "Works with specialist-tt"\n---\nbody\n'),
                           ("my-specialist-tt.md", "---\nname: my-specialist-tt\n---\nbody\n"),
                           ("x.md", '---\nname: x\ndescription: "The name: specialist-tt"\n---\nbody\n'),
                           ("x.md", "---\n# name: specialist-tt\nname: x\n---\nbody\n"),
                           ("x.md", "---\nname: specialist-tt.extra\n---\nbody\n")):
            with self.subTest(name=name, text=text):
                other = os.path.join(self.agents, "sub", name)
                with open(other, "w") as f:
                    f.write(text)
                p = self.agent("check", "tt")
                os.remove(other)
                self.assertEqual((p.returncode, p.stdout), (0, f"OK {path}\n"))

    def test_name_taken_in_project(self):
        path = self.write(GOOD)
        project = os.path.join(self.tmp, "proj")
        for d in (".git", "src", os.path.join(".claude", "agents")):
            os.makedirs(os.path.join(project, d))
        other = os.path.join(project, ".claude", "agents", "y.md")
        with open(other, "w") as f:
            f.write("---\nname: 'specialist-tt'\n---\nbody\n")
        p = self.agent("check", "tt", cwd=os.path.join(project, "src"))
        self.assertEqual((p.returncode, p.stdout), (1, f"BAD {path}: name taken by {other}\n"))
        self.assertEqual(self.agent("check", "tt").returncode, 0)

    def test_dashes_in_frontmatter(self):
        for text in (GOOD.replace("Build facts.", "Build facts ---"), GOOD.replace(TOOLS, TOOLS + " ---")):
            with self.subTest(text=text):
                path = self.write(text)
                self.assertEqual(self.agent("check", "tt").stdout, f"BAD {path}: bad frontmatter\n")

    def test_banned_word_in_description(self):
        for text in ("Use it always.", "Use it \\u0430lways."):
            with self.subTest(text=text):
                path = self.write(GOOD.replace("Build facts.", text))
                self.assertEqual(self.agent("check", "tt").stdout, f"BAD {path}: bad description\n")

    def test_non_ascii(self):
        for name, args in (("description", ["Use it \u0430lways.", "R."]), ("description", ["A \u2014 B.", "R."]),
                           ("role", ["A.", "Caf\u00e9 facts."])):
            with self.subTest(args=args):
                p = self.agent("create", "tt", "--description", args[0], "--role", args[1])
                self.assertEqual((p.returncode, p.stderr), (1, f"agent.py: the {name} holds a non-ASCII character\n"))
                self.assertFalse(os.path.exists(os.path.join(self.agents, "specialist-tt.md")))

    @unittest.skipIf(os.geteuid() == 0, "root reads any file")
    def test_unreadable(self):
        path = self.write(GOOD)
        os.chmod(path, 0)
        p = self.agent("check", "tt")
        self.assertEqual((p.returncode, p.stdout), (1, f"BAD {path}: cannot read\n"))

    def test_missing_file(self):
        p = self.agent("check", "tt")
        path = os.path.join(self.agents, "specialist-tt.md")
        self.assertEqual((p.returncode, p.stdout), (1, f"BAD {path}: missing file\n"))

    def test_good_file(self):
        path = self.write(GOOD)
        p = self.agent("check", "tt")
        self.assertEqual((p.returncode, p.stdout), (0, f"OK {path}\n"))

    def test_check_needs_area(self):
        self.write(GOOD)
        p = self.agent("check")
        self.assertEqual((p.returncode, p.stdout, p.stderr), (1, "", "agent.py: usage: <area>\n"))

    def test_check_updates_steps(self):
        for text in (GOOD.replace(STEPS, OLD_BODY), OLD.replace(STEPS, OLD_BODY)):
            with self.subTest(text=text):
                path = self.write(text)
                p = self.agent("check", "tt")
                self.assertEqual((p.returncode, p.stdout), (0, f"updated {path}\nOK {path}\n"))
                self.assertEqual(self.read(path), GOOD)
                p = self.agent("check", "tt")
                self.assertEqual((p.returncode, p.stdout), (0, f"OK {path}\n"))

    def test_old_tools(self):
        path = self.write(OLD)
        p = self.agent("check", "tt")
        self.assertEqual((p.returncode, p.stdout), (0, f"updated {path}\nOK {path}\n"))
        self.assertEqual(self.read(path).split("\n")[3], TOOLS)
        self.assertEqual(self.read(path), GOOD)
        self.assertEqual(self.agent("check", "tt").stdout, f"OK {path}\n")

    def test_check_leaves_bad_file(self):
        path = self.write(GOOD.replace(STEPS, OLD_BODY).replace("memory: user", "memory: project"))
        before = self.read(path)
        self.assertEqual(self.agent("check", "tt").stdout, f"BAD {path}: bad memory\n")
        self.assertEqual(self.read(path), before)

    def test_created_file_is_good(self):
        self.agent("create", "tt", "--description", 'Say "hi": twice.', "--role", "R.")
        self.assertEqual(self.agent("check", "tt").returncode, 0)

    def test_auto_memory_off(self):
        path = self.write(GOOD)
        os.makedirs(self.config, exist_ok=True)
        settings = os.path.join(self.config, "settings.json")
        for value, warn in ((False, True), (True, False), ("false", False)):
            with self.subTest(value=value):
                with open(settings, "w") as f:
                    json.dump({"autoMemoryEnabled": value}, f)
                p = self.agent("check", "tt")
                want = ("WARN auto memory is off\n" if warn else "") + f"OK {path}\n"
                self.assertEqual((p.returncode, p.stdout), (0, want))
        os.unlink(settings)
        p = self.agent("check", "tt", env=dict(self.env, CLAUDE_CODE_DISABLE_AUTO_MEMORY="1"))
        self.assertEqual(p.stdout, f"WARN auto memory is off\nOK {path}\n")


class Describe(Case):
    def setUp(self):
        super().setUp()
        self.path = os.path.join(self.agents, "specialist-tt.md")

    def test_good_file(self):
        self.agent(*TT)
        before = self.read(self.path).split("\n")
        p = self.agent("describe", "tt", "--description", "Build facts and release notes.")
        self.assertEqual((p.returncode, p.stdout), (0, f"described {self.path}\n"))
        after = self.read(self.path).split("\n")
        self.assertEqual(after[2], 'description: "Use only for jobs in the area tt: Build facts and release notes."')
        self.assertEqual(after[:2] + after[3:], before[:2] + before[3:])

    def test_hard_link(self):
        self.agent(*TT)
        target = os.path.join(self.tmp, "target")
        os.rename(self.path, target)
        os.link(target, self.path)
        before = self.read(target)
        self.assertEqual(self.agent("describe", "tt", "--description", "New.").returncode, 0)
        self.assertEqual(self.read(target), before)
        self.assertIn("tt: New.", self.read(self.path))

    def test_missing_file(self):
        self.assertEqual(self.agent("describe", "tt", "--description", "X.").returncode, 1)
        self.assertFalse(os.path.exists(self.path))

    def test_bad_file_and_bad_text(self):
        os.makedirs(self.agents)
        for text, description in ((GOOD.replace("tools:", "model: x\ntools:"), "X."), (GOOD, "Use it always."),
                                  (GOOD, "Facts ---"), (GOOD.replace("memory: user\n", ""), "X."), (GOOD, "A \u2014 B.")):
            with self.subTest(description=description):
                with open(self.path, "w") as f:
                    f.write(text)
                self.assertEqual(self.agent("describe", "tt", "--description", description).returncode, 1)
                self.assertEqual(self.read(self.path), text)


class Area(Case):
    def test_names(self):
        for name, want in (("Claude_Plugins", "claude-plugins"), ("my.repo name", "my-repo-name"),
                           ("a" * 40, "a" * 30), ("Build - Release", "build-release"),
                           ("-a--b-", "a-b"), ("a" * 29 + "-b", "a" * 29), ("../settings", "settings"),
                           ("git@github.com:o/Claude_Plugins.git", "claude-plugins"),
                           ("https://github.com/o/Claude_Plugins/", "claude-plugins"),
                           ("https://github.com/o/Repo.GIT", "repo"),
                           ("/Users/me/My_Repo.x", "my-repo-x")):
            with self.subTest(name=name):
                p = self.agent("area", name)
                self.assertEqual((p.returncode, p.stdout), (0, want + "\n"))
        for args in (["area", "../"], ["area", "-x"], ["area", "-"], ["area"], ["area", "a", "b"], []):
            with self.subTest(args=args):
                p = self.agent(*args)
                self.assertEqual(p.returncode, 1)
                self.assertEqual(len(p.stderr.strip().splitlines()), 1)

    def test_bad_areas(self):
        for area in ("a--b", "a-", "-a", "a", "a" * 31, "../x", "x/../y", "tt\n"):
            for args in (["create", area, "--description", "A.", "--role", "B."],
                         ["describe", area, "--description", "A."], ["check", area]):
                with self.subTest(args=args):
                    self.assertEqual(self.agent(*args).returncode, 1)
        self.assertFalse(os.path.exists(self.agents))
        self.assertFalse(os.path.exists(self.config))


class List(Case):
    def test_fresh_config(self):
        p = self.agent("list")
        self.assertEqual((p.returncode, p.stdout, p.stderr), (0, "", ""))
        self.assertEqual(self.agent("list", "x").returncode, 1)

    def test_list(self):
        for area, description in (("tt", 'Say "hi": twice.'), ("aa", "Build facts."), ("uu", "Bad file.")):
            self.agent("create", area, "--description", description, "--role", "R.")
        tt, aa, uu = (os.path.join(self.agents, f"specialist-{a}.md") for a in ("tt", "aa", "uu"))
        self.assertIn('\\"hi\\"', self.read(tt))
        for path, old, new in ((aa, TOOLS, OLD_TOOLS), (uu, "memory: user", "memory: project")):
            text = self.read(path).replace(old, new)
            with open(path, "w") as f:
                f.write(text)
        p = self.agent("list")
        self.assertEqual((p.returncode, p.stdout), (0, 'aa: Build facts.\ntt: Say "hi": twice.\n'), p.stderr)


if __name__ == "__main__":
    unittest.main()
