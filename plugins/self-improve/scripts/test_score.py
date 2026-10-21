"""Tests for score.py. Run: python3 -I -B scripts/test_score.py

Standard library only. The tests write no file: each text input goes to
score.py as a /dev/fd/<n> path of a pipe.
"""
import os
import subprocess
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SCORE = os.path.join(HERE, "score.py")
PLUGIN = os.path.dirname(HERE)


class Text:
    """A text input, passed to score.py as a pipe."""

    def __init__(self, data):
        self.data = data.encode("utf-8") if isinstance(data, str) else data


def run(*args):
    argv, fds = [], []
    try:
        for a in args:
            if isinstance(a, Text):
                r, w = os.pipe()
                os.write(w, a.data)
                os.close(w)
                fds.append(r)
                argv.append(f"/dev/fd/{r}")
            else:
                argv.append(a)
        return subprocess.run([sys.executable, "-I", "-B", SCORE, *argv], pass_fds=fds,
                              capture_output=True, text=True, timeout=60)
    finally:
        for r in fds:
            os.close(r)


GOAL = "# GOAL\n\n## Criteria\n\n1. One.\n2. Two.\n3. Three (removed)\n\n## Rules\n\n4. Not a criterion.\n"
RATINGS = "| criterion | rating | evidence |\n|---|---|---|\n"
GAPS = ("| file:line | severity | criterion | the problem | a concrete failure case "
        "| the smallest fix |\n|---|---|---|---|---|---|\n")
RATED = "| 1. One | met | e |\n| 2. Two | partly | e |\n"
GAP = "| a:1 | high | 2 | p | f | x |\n"


def review(ratings=RATED, gaps=GAP):
    return Text(RATINGS + ratings + "\n" + GAPS + gaps + "\nWhat I did not check: none.\n")


def reflect(rows):
    return Text("# REFLECT\n\n| issue | severity | source |\n|---|---|---|\n" + rows
                + "\n| item | status |\n|---|---|\n| a | done |\n")


CHECKS = "PASS | C1 | 1. One | ok\nFAIL | C2 | 2. Two | bad\n"


class Valid(unittest.TestCase):
    def ok(self, *args):
        p = run(*args)
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertEqual(p.stderr, "")
        return p.stdout.splitlines()

    def test_review(self):
        out = self.ok("--type", "review", Text(GOAL), review())
        self.assertEqual(out, ["ratings: met 1, partly 1, not met 0", "criteria met: 1.5",
                               "findings: high 1, medium 0, low 0", "score: 3"])

    def test_review_earlier(self):
        earlier = review(ratings="| 1. One | met | e |\n| 2. Two | met | e |\n", gaps="")
        out = self.ok("--type", "review", Text(GOAL), review(), earlier)
        self.assertEqual(out[-1], "criteria rated lower: 2")

    def test_review_earlier_reads_only_ratings(self):
        old = (RATINGS + "| 1. One | met | e |\n| 2. Two | met | e |\n\n| a | b | c | d | e | f | g |\n"
               "|---|---|---|---|---|---|---|\n| 1 | 2 | 3 | 4 | 5 | 6 | |\n")
        out = self.ok("--type", "review", Text(GOAL), review(), Text(old))
        self.assertEqual(out[-1], "criteria rated lower: 2")

    def test_review_empty_gaps_and_aligned_dashes(self):
        text = RATINGS.replace("|---|---|---|", "|:---|:---:|---:|") + RATED + "\n" + GAPS
        out = self.ok("--type", "review", Text(GOAL), Text(text))
        self.assertIn("score: 0", out)

    def test_checks(self):
        self.assertEqual(self.ok("--type", "checks", Text(CHECKS)), ["script checks passed: 1 of 2"])
        self.assertEqual(self.ok("--type", "checks", Text("")), ["script checks passed: 0 of 0"])

    def test_checks_earlier(self):
        earlier = "FAIL | C1 | 1. One | x\nPASS | C2 | 2. Two | y\n"
        out = self.ok("--type", "checks", Text(earlier), Text(CHECKS))
        self.assertEqual(out[1:], ["PASS to FAIL: C2", "FAIL to PASS: C1"])

    def test_checks_changed(self):
        earlier = "PASS | C1 | 1. One | x\nPASS | C3 | 1. One | y\n"
        out = self.ok("--type", "checks", Text(earlier), Text(CHECKS), "--changed")
        self.assertEqual(out[-2:], ["new ids: C2", "removed ids: C3"])

    def test_reflect(self):
        now = reflect("| a | high | review-1 |\n| b | low | review-1 |\n")
        self.assertEqual(self.ok("--type", "reflect", now), ["open issues: high 1, medium 0, low 1", "issue score: 4"])

    def test_reflect_verdicts(self):
        for before, verdict in (("high", "progressing"), ("low", "regressing"), ("medium", "flat")):
            out = self.ok("--type", "reflect", reflect("| a | medium | x |\n"), reflect(f"| a | {before} | x |\n"))
            self.assertEqual(out[-1], f"verdict by score: {verdict}")


class Exit2(unittest.TestCase):
    def fails(self, message, *args):
        p = run(*args)
        self.assertEqual(p.returncode, 2, p.stdout + p.stderr)
        self.assertEqual(p.stdout, "")
        self.assertIn(message, p.stderr)

    def test_usage(self):
        for args in ([], ["--type"], ["--type", "nope", "a"],
                     ["--type", "reflect"], ["--type", "reflect", "a", "b", "c"],
                     ["--type", "reflect", "a", "--changed"], ["--type", "checks"],
                     ["--type", "checks", "a", "--changed"], ["--type", "checks", "a", "b", "c"],
                     ["checks", "a"], ["a", "b"], ["--type", "review", "a"],
                     ["--type", "review", "a", "b", "--changed"], ["--type", "review", "a", "b", "c", "d"]):
            with self.subTest(args=args):
                self.fails("Usage:", *args)

    def test_cannot_read(self):
        missing = os.path.join(PLUGIN, "no such file")
        self.fails(f"{missing}: cannot read", "--type", "review", missing, review())
        self.fails("cannot read", "--type", "review", Text(GOAL), Text(b"\xff\xfe"))
        self.fails(f"{PLUGIN}: cannot read", "--type", "checks", PLUGIN)
        self.fails("cannot read", "--type", "reflect", Text(b"| \xff |"))

    def test_goal(self):
        self.fails('more than one "## Criteria"', "--type", "review", Text(GOAL + "## Criteria\n\n5. Five.\n"), review())
        self.fails("no numbered criteria", "--type", "review", Text("## Criteria\n\n3. Three (removed)\n"), review())
        self.fails("line 7: criterion 2 is listed twice", "--type", "review", Text(GOAL.replace("3. Three", "2. Three")), review())
        self.fails("line 3: a criterion number has more than 4 digits", "--type", "review", Text("## Criteria\n\n12345. Big.\n"), review())

    def test_tables(self):
        cases = [
            ("must start and end with |", RATINGS + "1. One | met | e | x\n"),
            ("must start and end with |", RATINGS + "| 1. One | met | e\n"),
            ("must start and end with |", RATINGS + "| 1. One | met | e \\|\n"),
            ("no line of dashes", "| criterion | rating | evidence |\n" + RATED),
            ("no line of dashes", "| criterion | rating | evidence |\n|---|---|\n" + RATED),
            ("a second table with the same header", RATINGS + RATED + "\n" + RATINGS + RATED),
            ("no header line above it", "| x | y |\n"),
            ("a table with an unknown header", "| x | y |\n|---|---|\n"),
            ("2 cells, the header has 3", RATINGS + "| 1. One | met |\n"),
            ("a cell is empty", RATINGS + "| 1. One | met |  |\n"),
            ("must start and end with |", RATINGS + "| 1. One | met | e |\n2. Two | met\n"),
            ("does not start with a number", RATINGS + "| 1. One | met | e |\n|---|---|---|\n"),
        ]
        for message, text in cases:
            with self.subTest(message=message, text=text):
                self.fails(message, "--type", "review", Text(GOAL), Text(text + "\n" + GAPS))

    def test_review(self):
        cases = [
            ("no table with the header | criterion", Text(GAPS)),
            ("no table with the header | file:line", Text(RATINGS + RATED)),
            ("the ratings table has no rows", review(ratings="")),
            ("does not start with a number", review(ratings="| One | met | e |\n")),
            ("rating 'good' is not one of", review(ratings="| 1. One | good | e |\n")),
            ("criterion 1 is rated twice", review(ratings=RATED + "| 1. One | met | e |\n")),
            ("criterion 3 is not an active criterion", review(ratings=RATED + "| 3. Three | met | e |\n")),
            ("no rating for criterion 2", review(ratings="| 1. One | met | e |\n", gaps="")),
            ("severity 'huge' is not one of", review(gaps=GAP.replace("high", "huge"))),
            ("more than 4 digits", review(ratings=RATED + "| 12345. Big | met | e |\n")),
            ("more than 4 digits", review(gaps=GAP.replace("| 2 |", "| 2, 12345 |"))),
            ("must be criterion numbers", review(gaps=GAP.replace("| 2 |", "| two |"))),
            ("criterion 4 is not rated in this report", review(gaps=GAP.replace("| 2 |", "| 2, 4 |"))),
        ]
        for message, text in cases:
            with self.subTest(message=message):
                self.fails(message, "--type", "review", Text(GOAL), text)
        self.fails("is not one of", "--type", "review", Text(GOAL), review(), review(ratings="| 1. One | good | e |\n"))
        self.fails("no table with the header | criterion", "--type", "review", Text(GOAL), review(), Text(GAPS))

    def test_checks(self):
        self.fails("not PASS | <id>", "--type", "checks", Text("PASS C1\n"))
        self.fails("not PASS | <id>", "--type", "checks", Text("PASS | C1 | One | x\n"))
        self.fails("check C1 is listed twice", "--type", "checks", Text("PASS | C1 | 1. a | x\nFAIL | C1 | 1. a | y\n"))
        self.fails("check ids differ", "--type", "checks", Text(CHECKS), Text("PASS | C1 | 1. One | ok\n"))

    def test_reflect(self):
        self.fails("no table with the header | issue", "--type", "reflect", Text("# REFLECT\n"))
        self.fails("severity 'urgent' is not one of", "--type", "reflect", reflect("| a | urgent | x |\n"))
        self.fails("severity '---' is not one of", "--type", "reflect", reflect("| a | low | x |\n|---|---|---|\n"))
        self.fails("must start and end with |", "--type", "reflect", reflect("| a | low | x |\nb | low\n"))


if __name__ == "__main__":
    unittest.main()
