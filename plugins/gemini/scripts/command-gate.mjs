#!/usr/bin/env node

// agy PreToolUse hook. Each agy run loads it from the temp folder's
// .agents/hooks.json, for the tools that the hooks.json matcher names: shell
// commands, subagents and the `schedule` tool, and for /gemini:review also
// page reads. It denies every call it sees. The user's agy rules can allow
// commands such as grep, and a web page or a file can hold instructions for
// the model, so no plugin run may run a command. Subagents run with no allow
// rule, and agy picks their model. agy denies the call when this hook fails,
// so bad input exits nonzero instead of printing a decision.
//
// Usage: command-gate.mjs <log>. Each denied call is added to <log> as one
// JSON line, because agy does not list hook denials in its denied_actions.
import fs from "node:fs";

const log = process.argv[2];
const { name, args } = JSON.parse(fs.readFileSync(0, "utf8")).toolCall;
if (log) {
  const entry =
    name === "run_command" ? { action: "command", display_name: String(args?.CommandLine).trim().slice(0, 200) } : { action: name };
  fs.appendFileSync(log, JSON.stringify(entry) + "\n");
}
process.stdout.write(JSON.stringify({ decision: "deny", reason: "This run does not allow this tool." }));
