#!/usr/bin/env node

// agy PreToolUse hook for run_command. Each agy run loads it from the temp
// folder's .agents/hooks.json. It allows one plain `ls` or `grep` command and
// denies everything else. The user's agy rules command(ls) and command(grep)
// let agy 1.4.2 run `grep x > file` when the file is inside the workspace,
// which includes every --dir folder. agy denies the command when this hook
// fails, so bad input exits nonzero instead of printing a decision.
//
// Usage: command-gate.mjs <log>. Each denied command is added to <log> as one
// JSON line, because agy does not list hook denials in its denied_actions.
import fs from "node:fs";

// A single space or tab only after the name: `\s` would match a newline, and
// sh runs each line as its own command. The rest of the line must not hold any
// character that makes sh chain, pipe, redirect, substitute or escape.
const PLAIN_LIST_OR_SEARCH = /^(ls|grep)([ \t]+[^;&|<>`$\\\n\r(){}]*)?$/;

const command = JSON.parse(fs.readFileSync(0, "utf8")).toolCall.args.CommandLine;
if (typeof command !== "string") process.exit(1);
if (PLAIN_LIST_OR_SEARCH.test(command.trim())) {
  process.stdout.write(JSON.stringify({ decision: "allow" }));
} else {
  const log = process.argv[2];
  if (log) {
    fs.appendFileSync(log, JSON.stringify({ action: "command", display_name: command.trim().slice(0, 200) }) + "\n");
  }
  process.stdout.write(
    JSON.stringify({
      decision: "deny",
      reason: "Only one plain ls or grep command can run, with no pipes, &&, ;, redirects, $(...) or backslashes."
    })
  );
}
