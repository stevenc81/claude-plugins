import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs, splitRawArgumentString, normalizeArgv } from "../scripts/lib/args.mjs";
import { ConfigError } from "../scripts/lib/errors.mjs";

test("parses empty argv", () => {
  const { options, positionals } = parseArgs([]);
  assert.deepEqual(options, {});
  assert.deepEqual(positionals, []);
});

test("parses boolean flags", () => {
  const { options } = parseArgs(["--json"]);
  assert.equal(options.json, true);
});

test("parses value flags with space separator", () => {
  const { options } = parseArgs(["--cwd", "/tmp/x"]);
  assert.equal(options.cwd, "/tmp/x");
});

test("parses value flags with = separator", () => {
  const { options } = parseArgs(["--cwd=/tmp/x"]);
  assert.equal(options.cwd, "/tmp/x");
});

test("rejects value flag without value", () => {
  assert.throws(() => parseArgs(["--cwd"]), ConfigError);
});

test("rejects value flag followed by another flag", () => {
  assert.throws(() => parseArgs(["--cwd", "--json"]), ConfigError);
});

test("rejects boolean flag with =value", () => {
  assert.throws(() => parseArgs(["--json=yes"]), ConfigError);
});

test("rejects unknown flags", () => {
  assert.throws(() => parseArgs(["--foo"]), ConfigError);
});

test("--model is now an unknown flag (dropped in v0.1)", () => {
  assert.throws(
    () => parseArgs(["--model", "best"]),
    (err) => err instanceof ConfigError && /unknown flag.*--model/i.test(err.message)
  );
});

test("disallows positionals by default", () => {
  assert.throws(() => parseArgs(["some-focus", "--cwd", "/tmp/x"]), ConfigError);
});

test("allows positionals when opted in", () => {
  const { options, positionals } = parseArgs(
    ["--cwd", "/tmp/x", "challenge", "the", "design"],
    { allowPositionals: true }
  );
  assert.equal(options.cwd, "/tmp/x");
  assert.deepEqual(positionals, ["challenge", "the", "design"]);
});

test("-- separator collects remaining as positionals", () => {
  const { options, positionals } = parseArgs(
    ["--json", "--", "--not-a-flag", "text"],
    { allowPositionals: true }
  );
  assert.equal(options.json, true);
  assert.deepEqual(positionals, ["--not-a-flag", "text"]);
});

test("splitRawArgumentString handles plain tokens", () => {
  assert.deepEqual(splitRawArgumentString("--base main --cwd /tmp/x"), [
    "--base",
    "main",
    "--cwd",
    "/tmp/x"
  ]);
});

test("splitRawArgumentString preserves quoted strings with spaces", () => {
  assert.deepEqual(
    splitRawArgumentString('--base main "focus on auth" extra'),
    ["--base", "main", "focus on auth", "extra"]
  );
});

test("splitRawArgumentString handles single quotes and escapes", () => {
  assert.deepEqual(
    splitRawArgumentString(`--base main 'don\\'t ship' `),
    ["--base", "main", "don't ship"]
  );
});

test("normalizeArgv: single joined string gets split", () => {
  assert.deepEqual(normalizeArgv(["--wait --base main"]), ["--wait", "--base", "main"]);
});

test("normalizeArgv: multi-element argv passes through", () => {
  assert.deepEqual(normalizeArgv(["--wait", "--base", "main"]), ["--wait", "--base", "main"]);
});

test("normalizeArgv: empty or whitespace returns empty", () => {
  assert.deepEqual(normalizeArgv([""]), []);
  assert.deepEqual(normalizeArgv(["   "]), []);
});

test("valueFlags adds command-specific value flags", () => {
  const { options } = parseArgs(["--model", "gemini-3.8-flash-low", "--json"], { valueFlags: ["--model"] });
  assert.equal(options.model, "gemini-3.8-flash-low");
  assert.equal(options.json, true);
});

test("listFlags collect repeated values into an array", () => {
  const { options, positionals } = parseArgs(
    ["--file", "a.txt", "--file=b/c.md", "what", "is", "this"],
    { allowPositionals: true, listFlags: ["--file"] }
  );
  assert.deepEqual(options.file, ["a.txt", "b/c.md"]);
  assert.deepEqual(positionals, ["what", "is", "this"]);
});

test("command-specific flags stay unknown for other commands", () => {
  assert.throws(() => parseArgs(["--file", "a.txt"]), (err) => /unknown flag.*--file/i.test(err.message));
});

test("--base, --wait and --background are unknown flags: the companion never used them", () => {
  for (const argv of [["--base", "main"], ["--wait"], ["--background"]]) {
    assert.throws(() => parseArgs(argv, { allowPositionals: true }), (err) => err instanceof ConfigError && /Unknown flag/.test(err.message), argv[0]);
  }
});
