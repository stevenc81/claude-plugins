import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const GATE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts", "command-gate.mjs");

// Runs the hook as agy does: the tool call as JSON on stdin.
function gate(input, gateArgs = []) {
  const r = spawnSync(process.execPath, [GATE, ...gateArgs], { input, encoding: "utf8" });
  return { status: r.status, decision: r.status === 0 ? JSON.parse(r.stdout).decision : null };
}
const call = (name, args) => JSON.stringify({ toolCall: { name, args } });

test("command gate denies every command, also one plain ls or grep", () => {
  for (const cmd of [
    "ls",
    "ls /tmp/a",
    "grep -rn isDuplicate /src/core",
    "grep -r '' /Users/me/.aws/credentials",
    "grep -rn x /src > /src/out.txt",
    "ls /src | head -1",
    "cat /etc/passwd",
    ""
  ]) {
    assert.deepEqual(gate(call("run_command", { CommandLine: cmd })), { status: 0, decision: "deny" }, JSON.stringify(cmd));
  }
});

test("command gate denies subagent, schedule and page tools, with the input shape of agy 1.4.3", () => {
  // Input shape from build test b5.
  for (const name of ["invoke_subagent", "define_subagent", "manage_subagents", "browser_subagent", "schedule", "read_url_content", "open_browser_url"]) {
    assert.deepEqual(gate(call(name, { Prompt: "Reply HELLO", Role: "Greeter", TypeName: "self" })), { status: 0, decision: "deny" }, name);
  }
});

test("command gate exits nonzero on bad input, so agy denies the call", () => {
  for (const input of ["", "not json", "{}"]) {
    assert.notEqual(gate(input).status, 0, input);
  }
});

test("command gate adds each denied call to the log: a command with its text, any other tool by its name", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "command-gate-test-"));
  const log = path.join(dir, "denied.jsonl");
  try {
    for (const input of [
      call("run_command", { CommandLine: "  ls /src\n" }),
      call("run_command", { CommandLine: "grep -rn x /src > /src/out.txt" }),
      call("invoke_subagent", { Prompt: "x" }),
      call("read_url_content", { Url: "https://example.com/?q=secret" })
    ]) {
      assert.equal(spawnSync(process.execPath, [GATE, log], { input }).status, 0);
    }
    assert.deepEqual(
      fs.readFileSync(log, "utf8").trim().split("\n").map((l) => JSON.parse(l)),
      [
        { action: "command", display_name: "ls /src" },
        { action: "command", display_name: "grep -rn x /src > /src/out.txt" },
        { action: "invoke_subagent" },
        { action: "read_url_content" }
      ]
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
