#!/usr/bin/env node

// agy PreToolUse hook. Each agy run loads it from the temp folder's
// .agents/hooks.json, for run_command and the subagent and schedule tools. It
// allows one plain `ls` or `grep` command and denies every other call it sees.
// The user's agy rules command(ls) and command(grep) let agy 1.4.2 run
// `grep x > file` when the file is inside the workspace, which includes every
// --dir folder. Subagents run with no allow rule, and agy picks their model.
// agy denies the call when this hook fails, so bad input exits nonzero instead
// of printing a decision.
//
// Usage: command-gate.mjs <log> [no-commands]. With no-commands, it denies
// every command too (for /gemini:review, which reads web pages that can hold
// instructions). Each denied call is added to <log> as one JSON line, because
// agy does not list hook denials in its denied_actions.
import fs from "node:fs";

// A single space or tab only after the name: `\s` would match a newline, and
// sh runs each line as its own command. The rest of the line must not hold any
// character that makes sh chain, pipe, redirect, substitute or escape.
const PLAIN_LIST_OR_SEARCH = /^(ls|grep)([ \t]+[^;&|<>`$\\\n\r(){}]*)?$/;

const [log, mode] = process.argv.slice(2);
const { name, args } = JSON.parse(fs.readFileSync(0, "utf8")).toolCall;
const isCommand = name === "run_command";
if (isCommand && typeof args.CommandLine !== "string") process.exit(1);
const commandsAllowed = isCommand && mode !== "no-commands";

if (commandsAllowed && PLAIN_LIST_OR_SEARCH.test(args.CommandLine.trim())) {
  process.stdout.write(JSON.stringify({ decision: "allow" }));
} else {
  if (log) {
    const entry = isCommand ? { action: "command", display_name: args.CommandLine.trim().slice(0, 200) } : { action: name };
    fs.appendFileSync(log, JSON.stringify(entry) + "\n");
  }
  process.stdout.write(
    JSON.stringify({
      decision: "deny",
      reason: commandsAllowed
        ? "Only one plain ls or grep command can run, with no pipes, &&, ;, redirects, $(...) or backslashes."
        : "This run does not allow this tool."
    })
  );
}
