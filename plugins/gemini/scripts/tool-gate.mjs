#!/usr/bin/env node

// agy PreToolUse hook. Each agy run loads it from the temp folder's
// .agents/hooks.json with the matcher "*", so it sees every tool call. It
// fails closed: it allows only the tools that the run's policy names, and
// denies every other tool, also one that a newer agy adds. The user's agy rules
// can allow commands such as grep, and a web page or a file can hold
// instructions for the model, so no plugin run may run a command or write a
// file, and no run may start a subagent except the one type that an
// --image-out run names. The hook also sees that subagent's own tool calls
// (live test, agy 1.4.3), so they meet the same policy. An allowed tool still goes through agy's own
// rules: "allow" hands the call on, so the user's settings decide page reads.
// agy denies the call when this hook fails, so bad input exits nonzero instead
// of printing a decision.
//
// A file tool is allowed only when each path it names resolves (realpath) to a
// place inside an allowed root, by folder boundary, and not inside a denied
// folder. A path that does not resolve is denied. So a symlink inside a root
// that points out of it is denied too. The native realpath gives the case that
// is on disk: macOS folders ignore case, and Node's own realpath keeps the
// caller's case, so `.AGENTS` would not match the denied `.agents`. The roots
// and denied folders are resolved the same way.
//
// `subagents` names the subagent types that invoke_subagent may start, and
// only with no Workspace of their own. The gate then adds the caller's
// conversation ID to the `parents` file, and allows send_message only to an
// ID in that file: a subagent may answer the conversation that started it,
// and nothing else. `imageTools` may name reference files,
// which must pass the same path check, or none.
//
// Usage: tool-gate.mjs <policy JSON>. The policy is
// {log, parents, tools, fileTools, imageTools, subagents, roots, denied}, with
// absolute real paths. Each denied call is added to `log` as one JSON line,
// because agy does not list hook denials in its denied_actions.
import fs from "node:fs";
import path from "node:path";

// The path arguments of agy's file tools. The agy docs name `AbsolutePath` for
// view_file; agy 1.4.3 streams the same tool as read_file with `Path`.
// generate_image takes a list of reference images in ImagePaths.
export const PATH_ARGS = ["AbsolutePath", "Path", "DirectoryPath", "SearchPath", "SearchDirectory", "ImagePaths"];

// A folder of the policy as it is on disk, or as given when it does not exist.
const canonical = (p) => {
  try {
    return fs.realpathSync.native(p);
  } catch {
    return path.resolve(p);
  }
};

const isInside = (child, root) => {
  const rel = path.relative(root, child);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
};

// The first path that the policy does not allow, or null when all are allowed.
// A call with no path argument is refused as "(no path)", unless `optional`.
export function refusedPath(args, { roots = [], denied = [] }, { optional = false } = {}) {
  const paths = PATH_ARGS.filter((k) => args?.[k] != null).flatMap((k) => (Array.isArray(args[k]) ? args[k] : [args[k]]));
  if (paths.length === 0) return optional ? null : "(no path)";
  for (const p of paths) {
    if (typeof p !== "string" || !path.isAbsolute(p)) return String(p);
    let real;
    try {
      real = fs.realpathSync.native(p);
    } catch {
      return p;
    }
    if (!roots.map(canonical).some((r) => isInside(real, r)) || denied.map(canonical).some((d) => isInside(real, d))) return p;
  }
  return null;
}

// agy's docs give invoke_subagent a `Subagents` list; its stream shows one
// spec's fields at the top level. Every spec must be an allowed type.
function allowedSubagents(args, types) {
  const specs = Array.isArray(args?.Subagents) ? args.Subagents : [args];
  return specs.length > 0 && specs.every((spec) => types.includes(spec?.TypeName) && spec.Workspace == null);
}

// The conversations that started an allowed subagent in this run.
function parentIds(policy) {
  try {
    return fs.readFileSync(policy.parents, "utf8").split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

export function decide({ name, args }, policy) {
  if ((policy.tools ?? []).includes(name)) return null;
  if (name === "send_message" && policy.parents && parentIds(policy).includes(args?.Recipient)) return null;
  if ((policy.fileTools ?? []).includes(name) || (policy.imageTools ?? []).includes(name)) {
    const p = refusedPath(args, policy, { optional: (policy.imageTools ?? []).includes(name) });
    return p == null ? null : { action: name, display_name: p };
  }
  if (name === "invoke_subagent" && allowedSubagents(args, policy.subagents ?? [])) return null;
  if (name === "run_command") return { action: "command", display_name: String(args?.CommandLine).trim().slice(0, 200) };
  return { action: name };
}

const invokedDirectly = process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(new URL(import.meta.url).pathname);
if (invokedDirectly) {
  const policy = JSON.parse(process.argv[2]);
  const { toolCall, conversationId } = JSON.parse(fs.readFileSync(0, "utf8"));
  const { name, args } = toolCall;
  if (typeof name !== "string") throw new Error("tool call has no name");
  const denial = decide({ name, args }, policy);
  if (denial && policy.log) fs.appendFileSync(policy.log, JSON.stringify(denial) + "\n");
  if (!denial && name === "invoke_subagent" && policy.parents) {
    if (typeof conversationId !== "string" || !conversationId) throw new Error("subagent call has no conversation ID");
    fs.appendFileSync(policy.parents, conversationId + "\n");
  }
  process.stdout.write(
    JSON.stringify(denial ? { decision: "deny", reason: "This run does not allow this tool or path." } : { decision: "allow" })
  );
}
