import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { decide } from "../scripts/tool-gate.mjs";

const GATE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts", "tool-gate.mjs");

// Runs the hook as agy does: the policy in argv, the tool call as JSON on stdin.
function gate(policy, input) {
  const r = spawnSync(process.execPath, [GATE, JSON.stringify(policy)], { input, encoding: "utf8" });
  return { status: r.status, decision: r.status === 0 ? JSON.parse(r.stdout).decision : null };
}
const call = (name, args) => JSON.stringify({ toolCall: { name, args } });

test("tool gate allows only the named tools and denies every other one, also every command", () => {
  const policy = { tools: ["search_web"] };
  assert.deepEqual(gate(policy, call("search_web", { query: "x" })), { status: 0, decision: "allow" });
  for (const [name, args] of [
    ["run_command", { CommandLine: "ls" }],
    ["run_command", { CommandLine: "grep -r '' /Users/me/.aws/credentials" }],
    ["invoke_subagent", { TypeName: "self" }],
    ["schedule", {}],
    ["read_url_content", { Url: "https://example.com/" }],
    ["read_file", { Path: "/etc/hosts" }],
    ["write_to_file", {}],
    ["tool_from_a_newer_agy", {}]
  ]) {
    assert.deepEqual(gate(policy, call(name, args)), { status: 0, decision: "deny" }, name);
  }
});

test("tool gate exits nonzero on bad input or a bad policy, so agy denies the call", () => {
  for (const input of ["", "not json", "{}", JSON.stringify({ toolCall: {} })]) {
    assert.notEqual(gate({ tools: [] }, input).status, 0, input);
  }
  const r = spawnSync(process.execPath, [GATE], { input: call("search_web", {}), encoding: "utf8" });
  assert.notEqual(r.status, 0, "no policy");
});

test("a file tool is allowed only inside a root and outside each denied folder, with every path argument checked", () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "tool-gate-test-")));
  try {
    fs.mkdirSync(path.join(root, "in", "hidden"), { recursive: true });
    fs.writeFileSync(path.join(root, "in", "a.txt"), "a");
    fs.writeFileSync(path.join(root, "in", "hidden", "h.txt"), "h");
    const policy = { fileTools: ["read_file", "view_file"], roots: [path.join(root, "in")], denied: [path.join(root, "in", "hidden")] };
    const d = (name, args) => (decide({ name, args }, policy) ? "deny" : "allow");
    assert.equal(d("read_file", { Path: path.join(root, "in", "a.txt") }), "allow");
    assert.equal(d("view_file", { AbsolutePath: path.join(root, "in", "a.txt") }), "allow");
    assert.equal(d("read_file", { Path: path.join(root, "in") }), "allow", "the root itself");
    assert.equal(d("read_file", { Path: path.join(root, "in", "hidden", "h.txt") }), "deny", "a denied folder inside a root");
    assert.equal(d("read_file", { Path: path.join(root, "in", "a.txt"), AbsolutePath: "/etc/hosts" }), "deny", "every path argument");
    assert.equal(d("read_file", { Path: 42 }), "deny");
    assert.equal(d("list_dir", { DirectoryPath: path.join(root, "in") }), "deny", "a tool not in the policy");
    assert.deepEqual(decide({ name: "read_file", args: { Path: "/etc/hosts" } }, policy), { action: "read_file", display_name: "/etc/hosts" });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("tool gate adds each denied call to the log: a command with its text, a file read with its path, any other tool by its name", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tool-gate-test-"));
  const log = path.join(dir, "denied.jsonl");
  try {
    const policy = { log, tools: ["search_web"], fileTools: ["read_file"], roots: [] };
    for (const input of [
      call("run_command", { CommandLine: "  ls /src\n" }),
      call("search_web", { query: "allowed, so not logged" }),
      call("invoke_subagent", { Prompt: "x" }),
      call("read_file", { Path: "/etc/hosts" }),
      call("read_url_content", { Url: "https://example.com/?q=secret" })
    ]) {
      assert.equal(gate(policy, input).status, 0);
    }
    assert.deepEqual(
      fs.readFileSync(log, "utf8").trim().split("\n").map((l) => JSON.parse(l)),
      [
        { action: "command", display_name: "ls /src" },
        { action: "invoke_subagent" },
        { action: "read_file", display_name: "/etc/hosts" },
        { action: "read_url_content" }
      ]
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a path in another case does not slip past a denied folder, on a folder that ignores case", () => {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "tool-gate-case-")));
  try {
    fs.mkdirSync(path.join(root, "in", "hidden"), { recursive: true });
    fs.writeFileSync(path.join(root, "in", "hidden", "h.txt"), "h");
    fs.writeFileSync(path.join(root, "in", "a.txt"), "a");
    // A broad root with a denied folder inside it, as --dir ~ holds agy's home.
    const policy = { fileTools: ["read_file"], roots: [root], denied: [path.join(root, "in", "hidden")] };
    const d = (p) => (decide({ name: "read_file", args: { Path: p } }, policy) ? "deny" : "allow");
    // On a folder that ignores case (macOS), these name the same files.
    assert.equal(d(path.join(root, "IN", "HIDDEN", "h.txt")), "deny");
    assert.equal(d(path.join(root, "in", "Hidden", "H.TXT")), "deny");
    const ignoresCase = fs.existsSync(path.join(root, "IN", "A.TXT"));
    assert.equal(d(path.join(root, "IN", "A.TXT")), ignoresCase ? "allow" : "deny");
    // Roots and denied folders given in another case are matched as on disk too.
    const upper = { ...policy, roots: [path.join(root, "IN")], denied: [path.join(root, "IN", "HIDDEN")] };
    if (ignoresCase) {
      assert.equal(decide({ name: "read_file", args: { Path: path.join(root, "in", "a.txt") } }, upper), null);
      assert.notEqual(decide({ name: "read_file", args: { Path: path.join(root, "in", "hidden", "h.txt") } }, upper), null);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
