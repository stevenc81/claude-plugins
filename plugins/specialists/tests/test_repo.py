"""The root README and the marketplace list the plugin."""
import json
import os
import unittest

from common import REPO


class Repo(unittest.TestCase):
    def test_readme(self):
        with open(os.path.join(REPO, "README.md")) as f:
            self.assertRegex(f.read(), r"(?m)^\| \[specialists\]\(plugins/specialists\) \|")

    def test_marketplace(self):
        with open(os.path.join(REPO, ".claude-plugin", "marketplace.json")) as f:
            market = json.load(f)
        sources = [p.get("source") for p in market["plugins"] if p.get("name") == "specialists"]
        self.assertEqual(sources, ["./plugins/specialists"])
