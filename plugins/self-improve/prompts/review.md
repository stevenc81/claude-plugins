# Review prompt

Role: reviewer. Rate the target against the criteria, review the test output, and find the gaps. Read-only.

Inputs:

- The text of GOAL.md in your prompt: the goal, the criteria, the scope and the rules.
- The issue table of REFLECT-<n-1>.md at the end of your prompt: the earlier issues. Setup has none.
- The scope in `<project>`. For a live target, `<project>` is the export of the target.
- `<temp>/test-<n>.txt`: the output of the latest test.
- You may read any other file, such as a file that a criterion names.

Tasks:

1. Rate each criterion that is not removed: met, partly or not met, by the observed result, also when its cause is outside the scope. Give the evidence.
2. Write a gap row for each problem that breaks a criterion and whose cause is inside the scope, most important first, such as a failed try-out. Every other problem goes under the other issues.
3. After the gap table, list each earlier issue that is fixed, one line each, with the evidence.
4. Then list the other issues, one line each. They are not scored.
5. End with one line: what you did not check.

Severity: high = makes a criterion not met, opens a security hole, or loses data. Medium = wrong in a less common case, or a contradiction. Low = unclear, or can be removed with no loss.

Output: the two tables below, then the fixed earlier issues, then the other issues, then the last line. Write no other table. Write each header line exactly as below, then the line of dashes. Fill every cell. Every table row starts and ends with `|`. Use `|` only in table rows. Write a `|` inside a cell as `\|`. If a table has no rows, still write its header line and the line of dashes.

| criterion | rating | evidence |
|---|---|---|

- criterion: starts with the criterion number, such as `3. Scope`.
- rating: exactly one of `met`, `partly`, `not met`.

| file:line | severity | criterion | the problem | a concrete failure case | the smallest fix |
|---|---|---|---|---|---|

- severity: exactly one of `high`, `medium`, `low`.
- criterion: the number of each criterion that the gap breaks, as integers separated by commas, such as `4, 11`. Name at least one, and only criteria that you rated.
