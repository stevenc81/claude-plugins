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
const decide = (cmd, gateArgs) =>
  gate(JSON.stringify({ toolCall: { name: "run_command", args: { CommandLine: cmd } } }), gateArgs);
// The tools that GATED_TOOLS sends to the hook, other than run_command.
const SUBAGENT_TOOLS = ["invoke_subagent", "define_subagent", "manage_subagents", "browser_subagent", "schedule"];

test("command gate allows one plain ls or grep command", () => {
  for (const cmd of [
    "ls",
    "ls /tmp/a",
    "ls -la /tmp/a",
    "grep -rn isDuplicate /src/core",
    "grep -rn 'two words' /src",
    "  grep -rn \"x\" /src\n"
  ]) {
    assert.deepEqual(decide(cmd), { status: 0, decision: "allow" }, cmd);
  }
});

test("command gate denies redirects, pipes, chains, substitutions, new lines and other commands", () => {
  for (const cmd of [
    "grep -rn x /src > /src/out.txt",
    "grep -rn x /src >> /src/a.txt",
    "grep -rn x < /etc/passwd",
    "ls /src | head -1",
    "ls /src && echo hi",
    "ls /src ; echo hi",
    "ls /src & echo hi",
    "ls $(echo /src)",
    "ls `echo /src`",
    "ls \"$HOME\"",
    "ls /src\\;echo",
    "ls\nrm -rf /tmp/x",
    "ls /src\nrm -rf /tmp/x",
    "ls\r\nrm x",
    "ls (x)",
    "ls {a,b}",
    "lsof",
    "grepx",
    "cat /etc/passwd",
    "rg --pre sh x",
    "FOO=1 ls",
    ""
  ]) {
    assert.deepEqual(decide(cmd), { status: 0, decision: "deny" }, JSON.stringify(cmd));
  }
});

test("command gate exits nonzero on bad input, so agy denies the command", () => {
  for (const input of ["", "not json", "{}", JSON.stringify({ toolCall: { name: "run_command", args: { CommandLine: 1 } } })]) {
    assert.notEqual(gate(input).status, 0, input);
  }
});

test("command gate adds each denied command, and no allowed one, to the log", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "command-gate-test-"));
  const log = path.join(dir, "denied.jsonl");
  try {
    for (const CommandLine of ["ls /src", "grep -rn x /src > /src/out.txt", "cat /etc/passwd"]) {
      const input = JSON.stringify({ toolCall: { name: "run_command", args: { CommandLine } } });
      assert.equal(spawnSync(process.execPath, [GATE, log], { input }).status, 0);
    }
    assert.deepEqual(
      fs.readFileSync(log, "utf8").trim().split("\n").map((l) => JSON.parse(l)),
      [
        { action: "command", display_name: "grep -rn x /src > /src/out.txt" },
        { action: "command", display_name: "cat /etc/passwd" }
      ]
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("command gate denies subagent and schedule tools, and logs each by its tool name", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "command-gate-test-"));
  const log = path.join(dir, "denied.jsonl");
  try {
    for (const name of SUBAGENT_TOOLS) {
      // Input shape from agy 1.4.3 (build test b5).
      const input = JSON.stringify({ toolCall: { name, args: { Prompt: "Reply HELLO", Role: "Greeter", TypeName: "self" } } });
      for (const gateArgs of [[log], [log, "no-commands"]]) {
        assert.deepEqual(gate(input, gateArgs), { status: 0, decision: "deny" }, `${name} ${gateArgs}`);
      }
    }
    const logged = fs.readFileSync(log, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    assert.deepEqual(logged, SUBAGENT_TOOLS.flatMap((action) => [{ action }, { action }]));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("command gate with no-commands denies every command, also one plain ls or grep, and logs it", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "command-gate-test-"));
  const log = path.join(dir, "denied.jsonl");
  try {
    for (const cmd of ["ls", "ls /tmp/a", "grep -rn x /src", "cat /etc/passwd"]) {
      assert.deepEqual(decide(cmd, [log, "no-commands"]), { status: 0, decision: "deny" }, cmd);
    }
    assert.deepEqual(
      fs.readFileSync(log, "utf8").trim().split("\n").map((l) => JSON.parse(l).display_name),
      ["ls", "ls /tmp/a", "grep -rn x /src", "cat /etc/passwd"]
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
