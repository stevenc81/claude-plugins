"""Shared helpers for the script tests. Run: python3 -I -B -m unittest discover -s tests

Standard library only. Each test works in its own temporary folder, and runs
the scripts as child processes with python3 -I -B, from that folder. HOME,
TMPDIR and CLAUDE_CONFIG_DIR point into that folder.
"""
import os
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
PLUGIN = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(PLUGIN))
AGENT = os.path.join(PLUGIN, "scripts", "agent.py")


class Case(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = os.path.realpath(self._tmp.name)
        self.config = os.path.join(self.tmp, "config")
        self.agents = os.path.join(self.config, "agents")
        self.memory = os.path.join(self.config, "agent-memory")
        os.makedirs(os.path.join(self.tmp, "tmp"))
        os.makedirs(os.path.join(self.tmp, "home"))
        env = {k: v for k, v in os.environ.items() if not k.startswith("CLAUDE_")}
        env.update(CLAUDE_CONFIG_DIR=self.config, TMPDIR=os.path.join(self.tmp, "tmp"),
                   HOME=os.path.join(self.tmp, "home"))
        self.env = env

    def tearDown(self):
        for root, dirs, _ in os.walk(self.tmp):
            for d in dirs:
                os.chmod(os.path.join(root, d), 0o700)
        self._tmp.cleanup()

    def run_script(self, script, *args, env=None, cwd=None):
        return subprocess.run([sys.executable, "-I", "-B", script, *args],
                              capture_output=True, text=True, env=env or self.env,
                              cwd=cwd or self.tmp, timeout=60)

    def agent(self, *args, env=None, cwd=None):
        return self.run_script(AGENT, *args, env=env, cwd=cwd)

    def read(self, path):
        with open(path) as f:
            return f.read()
