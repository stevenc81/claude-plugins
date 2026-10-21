"""Count the ratings and gaps in a review, compare two script check runs, or score a reflection.

Usage: python3 -I score.py --type review <GOAL.md> <review> [<earlier review>]
       python3 -I score.py --type checks [<earlier checks output>] <checks output> [--changed]
       python3 -I score.py --type reflect <reflection> [<earlier reflection>]

A review must use the two tables of review.md. Of an earlier review, the
script reads only the ratings table and skips the other tables. In a review
and a reflection, a header line is a table row with its line of dashes next.
Every other table row needs a header line above it, with no empty line between
them. A line of dashes is valid only right after a header line. No cell in a
scored table may be empty. A line that does not start with | may hold at most
2 unescaped |, and none inside a scored table.
GOAL.md must have exactly one "## Criteria" heading, and each criterion number
once. A criterion number has at most 4 digits. With an earlier review,
the script lists the criteria rated lower. A review counts met as 1 and partly
as 0.5. Its score sums the gaps by severity: high 3, medium 2, low 1. A checks
output has one line per script check: PASS | <id> | <criterion> | <detail>, or the
same with FAIL. It may have no lines. With an earlier output, both outputs
must have the same check ids, unless --changed is given (when the user changed
checks.sh). With --changed, the script compares only the ids in both outputs,
and lists the new and removed ids. The script lists the checks that went from
PASS to FAIL and back.

A reflection must have one table with the header | issue | severity | source |.
The script skips its other tables. The issue score sums the issues by the same
weights. With an earlier reflection, a lower score is progressing, a
higher score is regressing, and the same score is flat.

Exit code 2, with a message on stderr: the arguments are wrong (the message is
this text), an input cannot be read or is not in the expected format, or the
check ids differ without --changed.
"""
import re
import sys

RANK = {"not met": 0, "partly": 1, "met": 2}
WEIGHT = {"high": 3, "medium": 2, "low": 1}
RATINGS = ("criterion", "rating", "evidence")
GAPS = ("file:line", "severity", "criterion", "the problem", "a concrete failure case",
        "the smallest fix")
ISSUES = ("issue", "severity", "source")
PIPE = re.compile(r"(?<!\\)\|")
TAGS = re.compile(r"\d+(\s*,\s*\d+)*")
DASHES = "no line of dashes after the header line"
RULE = re.compile(r"\|(\s*:?-+:?\s*\|)+")
CHECK = re.compile(r"(PASS|FAIL) \| ([^\s|]+) \| (\d[^|]*?) \|(?: .*)?")


def fail(path, message):
    sys.stderr.write(f"{path}: {message}\n")
    sys.exit(2)


def usage():
    sys.stderr.write(__doc__)
    sys.exit(2)


def read(path):
    try:
        with open(path, encoding="utf-8") as f:
            return f.readlines()
    except (OSError, UnicodeDecodeError) as e:
        fail(path, f"cannot read: {e}")


def number(path, i, digits):
    if len(digits) > 4:
        fail(path, f"line {i}: a criterion number has more than 4 digits")
    return int(digits)


def active(goal):
    numbers, seen, inside, headings = set(), set(), False, 0
    for i, line in enumerate(read(goal), 1):
        if line.startswith("## "):
            inside = line.strip() == "## Criteria"
            headings += inside
        elif inside:
            match = re.match(r"(\d+)\.\s", line)
            if not match:
                continue
            n = number(goal, i, match.group(1))
            if n in seen:
                fail(goal, f"line {i}: criterion {n} is listed twice")
            seen.add(n)
            if not line.rstrip().endswith("(removed)"):
                numbers.add(n)
    if headings > 1:
        fail(goal, 'more than one "## Criteria" heading')
    if not numbers:
        fail(goal, 'no numbered criteria under "## Criteria"')
    return numbers


def tables(path, only=None):
    """Return {header: [(line number, cells)]}. Every table needs a known header.

    A row that is a known header starts a new table, also with no empty line before it.
    With only, only that header is known, and other tables are skipped.
    """
    known = (only,) if only else (RATINGS, GAPS)
    found, header, skip = {}, None, False
    lines = [line.strip() for line in read(path)]
    for i, line in enumerate(lines, 1):
        if skip:
            skip = False
            continue
        if not line.startswith("|"):
            if len(PIPE.findall(line)) >= 3 or header in found and PIPE.search(line):
                fail(path, f"line {i}: a table row must start and end with |")
            header = None
            continue
        if not line.endswith("|") or line.endswith("\\|"):
            fail(path, f"line {i}: a table row must start and end with |")
        row = tuple(c.strip() for c in PIPE.split(line)[1:-1])
        rule = RULE.fullmatch(lines[i]) if i < len(lines) else None
        if row in known:
            if not rule or lines[i].count("|") != len(row) + 1:
                fail(path, f"line {i + 1}: {DASHES}")
            if row in found:
                fail(path, f"line {i}: a second table with the same header")
            found[row], header, skip = [], row, True
        elif header is None:
            if not rule:
                fail(path, f"line {i}: a table row with no header line above it")
            if not only:
                fail(path, f"line {i}: a table with an unknown header")
            header, skip = row, True
        elif header in found:
            if len(row) != len(header):
                fail(path, f"line {i}: {len(row)} cells, the header has {len(header)}")
            if "" in row:
                fail(path, f"line {i}: a cell is empty")
            found[header].append((i, row))
    return found


def check(path, i, value, allowed, column):
    if value not in allowed:
        fail(path, f"line {i}: {column} {value!r} is not one of {', '.join(allowed)}")


def rated(path, found, criteria=None):
    """Return {criterion number: rating} from the ratings table."""
    if RATINGS not in found:
        fail(path, f"no table with the header | {' | '.join(RATINGS)} |")
    if not found[RATINGS]:
        fail(path, "the ratings table has no rows")
    ratings = {}
    for i, (criterion, rating, _) in found[RATINGS]:
        match = re.match(r"(\d+)\b", criterion)
        if not match:
            fail(path, f"line {i}: the criterion cell does not start with a number")
        n = number(path, i, match.group(1))
        check(path, i, rating, RANK, "rating")
        if n in ratings:
            fail(path, f"line {i}: criterion {n} is rated twice")
        if criteria is not None and n not in criteria:
            fail(path, f"line {i}: criterion {n} is not an active criterion in GOAL.md")
        ratings[n] = rating
    if criteria is not None and criteria - set(ratings):
        fail(path, f"no rating for criterion {', '.join(map(str, sorted(criteria - set(ratings))))}")
    return ratings


def review(path, criteria):
    found = tables(path)
    ratings = rated(path, found, criteria)
    if GAPS not in found:
        fail(path, f"no table with the header | {' | '.join(GAPS)} |")
    findings = []
    for i, row in found[GAPS]:
        check(path, i, row[1], WEIGHT, "severity")
        if not TAGS.fullmatch(row[2]):
            fail(path, f"line {i}: the criterion cell must be criterion numbers separated by commas, such as 4, 11")
        tags = {number(path, i, n) for n in re.findall(r"\d+", row[2])}
        if tags - set(ratings):
            fail(path, f"line {i}: criterion {', '.join(map(str, sorted(tags - set(ratings))))} is not rated in this report")
        findings.append(row[1])
    return ratings, findings


def checks(path):
    """Return {check id: PASS or FAIL} from one run of checks.sh."""
    result = {}
    for i, line in enumerate(read(path), 1):
        match = CHECK.fullmatch(line.rstrip("\n"))
        if not match:
            fail(path, f"line {i}: not PASS | <id> | <criterion> | <detail>, or the same with FAIL")
        if match[2] in result:
            fail(path, f"line {i}: check {match[2]} is listed twice")
        result[match[2]] = match[1]
    return result


def reflection(path):
    """Return the severity of each issue in a reflection."""
    found = tables(path, ISSUES)
    if ISSUES not in found:
        fail(path, f"no table with the header | {' | '.join(ISSUES)} |")
    for i, row in found[ISSUES]:
        check(path, i, row[1], WEIGHT, "severity")
    return [row[1] for _, row in found[ISSUES]]


def counts(severities):
    return ", ".join(f"{s} {severities.count(s)}" for s in WEIGHT)


def main(args):
    if args[:1] != ["--type"] or len(args) < 2 or args[1] not in ("review", "checks", "reflect"):
        usage()
    kind, args = args[1], args[2:]
    changed = args[-1:] == ["--changed"]
    if changed:
        args = args[:-1]
    if kind == "reflect":
        if changed or len(args) not in (1, 2):
            usage()
        now = reflection(args[0])
        before = sum(WEIGHT[s] for s in reflection(args[1])) if len(args) == 2 else None
        score = sum(WEIGHT[s] for s in now)
        print(f"open issues: {counts(now)}")
        print(f"issue score: {score}")
        if before is not None:
            verdict = "progressing" if score < before else "regressing" if score > before else "flat"
            print(f"issue score before: {before}")
            print(f"verdict by score: {verdict}")
        return
    if kind == "checks":
        if len(args) not in (1, 2) or changed and len(args) == 1:
            usage()
        now = checks(args[-1])
        before = checks(args[0]) if len(args) == 2 else None
        if before is not None and set(before) != set(now) and not changed:
            fail(args[-1], "check ids differ: not compared")
        print(f"script checks passed: {list(now.values()).count('PASS')} of {len(now)}")
        if before is not None:
            shared = [c for c in now if c in before]
            for old, new in (("PASS", "FAIL"), ("FAIL", "PASS")):
                print(f"{old} to {new}: {', '.join(c for c in shared if before[c] == old and now[c] == new) or 'none'}")
            if changed:
                print(f"new ids: {', '.join(c for c in now if c not in before) or 'none'}")
                print(f"removed ids: {', '.join(c for c in before if c not in now) or 'none'}")
        return
    if changed or len(args) not in (2, 3):
        usage()
    ratings, findings = review(args[1], active(args[0]))
    if len(args) == 3:
        before = rated(args[2], tables(args[2], RATINGS))
    by_rating = ", ".join(f"{r} {list(ratings.values()).count(r)}" for r in ("met", "partly", "not met"))
    print(f"ratings: {by_rating}")
    print(f"criteria met: {sum(RANK[r] / 2 for r in ratings.values())}")
    print(f"findings: {counts(findings)}")
    print(f"score: {sum(WEIGHT[s] for s in findings)}")
    if len(args) == 3:
        lower = sorted(n for n in set(ratings) & set(before) if RANK[ratings[n]] < RANK[before[n]])
        print(f"criteria rated lower: {', '.join(map(str, lower)) or 'none'}")


if __name__ == "__main__":
    main(sys.argv[1:])
