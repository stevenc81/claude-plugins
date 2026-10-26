import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  handleSetup,
  setRunReviewForTest,
  setBinaryAvailableForTest,
  setRunCommandForTest,
  compareVersion,
  PRIMARY_REVIEW_MODEL,
  TESTED_AGY_VERSION
} from "../scripts/gemini-companion.mjs";
import { AgyAuthError, ConfigError } from "../scripts/lib/errors.mjs";

function captureStdout(fn) {
  const chunks = [];
  const orig = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk) => {
    chunks.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
    return true;
  };
  return fn()
    .finally(() => {
      process.stdout.write = orig;
    })
    .then(() => chunks.join(""));
}

// Real `agy models` output from agy 1.3.6 (TSV id<TAB>display name), trimmed.
const MODELS_TSV = [
  "gemini-4-argon-medium\tGemini 4 Argon (Medium)",
  "gemini-4-argon-high\tGemini 4 Argon (High)",
  "gemini-4-argon-low\tGemini 4 Argon (Low)",
  "gemini-3.8-flash-high\tGemini 3.8 Flash (High)",
  "gemini-3.8-flash-medium\tGemini 3.8 Flash (Medium)",
  "gemini-3.8-flash-low\tGemini 3.8 Flash (Low)",
  "gpt-oss-120b-medium\tGPT-OSS 120B (Medium)",
  ""
].join("\n");

// Real `agy --print=/usage --output-format=json` shape from agy 1.3.6, trimmed.
// Argon is its own group, with a weekly bucket only.
const ARGON_GROUP = {
  name: "Gemini 4 Argon",
  buckets: [
    {
      id: "gemini-argon-wtu-weekly",
      name: "Gemini 4 Argon Weekly Limit",
      window: "weekly",
      remaining_fraction: 0.9825,
      reset_time: "2026-10-23T01:23:48Z"
    }
  ]
};

const USAGE_JSON = JSON.stringify({
  conversation_id: "",
  status: "SUCCESS",
  response: "Gemini Models\tWeekly Limit Remaining\t97%\t2026-10-11T07:37:02Z\n",
  num_turns: 0,
  command: {
    name: "usage",
    data: {
      groups: [
        {
          name: "Gemini Models",
          buckets: [
            { id: "gemini-weekly", window: "weekly", remaining_fraction: 0.9659, reset_time: "2026-10-11T07:37:02Z" },
            { id: "gemini-5h", window: "5h", remaining_fraction: 0.9873, reset_time: "2026-10-10T16:44:37Z" }
          ]
        },
        {
          name: "Claude and GPT models",
          buckets: [
            { id: "3p-weekly", window: "weekly", remaining_fraction: 1, reset_time: "2026-10-17T11:51:36Z" },
            { id: "3p-5h", window: "5h", remaining_fraction: 1, reset_time: "2026-10-10T16:51:36Z" }
          ]
        },
        ARGON_GROUP
      ]
    }
  }
});

function fakeCommands({ models = MODELS_TSV, usage = USAGE_JSON, calls = [] } = {}) {
  return (cmd, args) => {
    calls.push([cmd, ...args]);
    const ok = (stdout) => ({ stdout, stderr: "", status: 0, signal: null, error: null });
    const fail = (stderr) => ({ stdout: "", stderr, status: 1, signal: null, error: null });
    if (args[0] === "models") return models == null ? fail("not signed in") : ok(models);
    if (args[0] === "--print=/usage") return usage == null ? fail("network down") : ok(usage);
    throw new Error(`unexpected command: ${cmd} ${args.join(" ")}`);
  };
}

const canaryOk = async (args) => ({
  stopReason: "end_turn",
  text: "OK",
  response: "OK",
  model: args?.model ?? null,
  tokens: null,
  deniedActions: [],
  timedOut: false,
  agentVersion: "9.9.9-test"
});

async function runSetup(argv = []) {
  const prev = process.exitCode;
  const out = await captureStdout(() => handleSetup(argv));
  const exitCode = process.exitCode;
  process.exitCode = prev;
  return { out, exitCode, line: (prefix) => out.split("\n").find((l) => l.startsWith(prefix)) };
}

beforeEach(() => {
  setRunReviewForTest(null);
  setBinaryAvailableForTest(() => ({ available: true, detail: "9.9.9-test" }));
  setRunCommandForTest(fakeCommands());
});
afterEach(() => {
  setRunReviewForTest(null);
  setBinaryAvailableForTest(null);
  setRunCommandForTest(null);
});

test("setup auth line reports the detected agy version, not a hardcoded one", async () => {
  setRunReviewForTest(canaryOk);
  const { out, line } = await runSetup();
  const authLine = line("Auth check:");
  assert.ok(authLine, "expected an 'Auth check:' line in the setup report");
  assert.match(authLine, /9\.9\.9-test/);
  assert.doesNotMatch(out, /1\.0\.0/);
});

test("setup spends exactly one model call: the canary on the default model", async () => {
  const runs = [];
  setRunReviewForTest(async (args) => {
    runs.push(args);
    return canaryOk(args);
  });
  const calls = [];
  setRunCommandForTest(fakeCommands({ calls }));
  await runSetup();
  assert.equal(runs.length, 1);
  assert.equal(runs[0].model, undefined);
  assert.match(runs[0].prompt, /single word OK/);
  assert.deepEqual(calls, [
    ["agy", "--print=/usage", "--output-format=json"],
    ["agy", "models"]
  ]);
});

test("setup passes the prompt check when the canary is echoed back", async () => {
  setRunReviewForTest(async (args) => ({ ...(await canaryOk(args)), text: "OK\n" }));
  const { out, exitCode, line } = await runSetup();
  assert.match(line("Prompt check:"), /ok/);
  assert.match(out, /Ready\. Try `\/gemini:review` or `\/gemini:ask`\./);
  assert.notEqual(exitCode, 1);
});

test("setup fails the prompt check when agy exits 0 without acting on the prompt", async () => {
  // Regression shape from agy 1.1.x: exit 0, but the reply shows the prompt
  // never arrived ("You just typed `--print-timeout`...").
  setRunReviewForTest(async (args) => ({
    ...(await canaryOk(args)),
    text: "Could you please provide more context? You just typed `--print-timeout`."
  }));
  const { out, exitCode, line } = await runSetup();
  assert.match(line("Prompt check:"), /FAILED/);
  assert.match(out, /command line has likely changed/);
  assert.doesNotMatch(out, /Ready\. Try/);
  assert.equal(exitCode, 1);
});

test("setup model check reports ok when the review model is listed by agy models", async () => {
  setRunReviewForTest(canaryOk);
  const { out, exitCode, line } = await runSetup();
  const modelLine = line("Model check:");
  assert.match(modelLine, /^Model check:   ok, /);
  assert.match(modelLine, new RegExp(PRIMARY_REVIEW_MODEL));
  assert.match(out, /Ready\. Try/);
  assert.notEqual(exitCode, 1);
});

test("setup model check FAILS and exits 1 when the review model is not listed", async () => {
  setRunReviewForTest(canaryOk);
  setRunCommandForTest(fakeCommands({ models: MODELS_TSV.replace(/^gemini-4-argon-high\t.*\n/m, "") }));
  const { out, exitCode, line } = await runSetup();
  assert.match(line("Model check:"), /FAILED, review model 'gemini-4-argon-high' is not listed/);
  assert.match(out, /The review model is not listed/);
  assert.match(out, /agy models/);
  assert.equal(exitCode, 1);
  const json = JSON.parse((await runSetup(["--json"])).out);
  assert.deepEqual(json.models.primary, { model: PRIMARY_REVIEW_MODEL, ok: false });
});

test("setup model check is unknown (exit 0) when agy models fails", async () => {
  setRunReviewForTest(canaryOk);
  setRunCommandForTest(fakeCommands({ models: null }));
  const { out, exitCode, line } = await runSetup();
  assert.match(line("Model check:"), /unknown, could not run `agy models`/);
  assert.match(out, /Run `agy models`/);
  assert.notEqual(exitCode, 1);
});

test("setup shows Gemini weekly, 5-hour and Argon weekly quota from /usage", async () => {
  setRunReviewForTest(canaryOk);
  const { line } = await runSetup();
  assert.equal(
    line("Gemini quota:"),
    "Gemini quota:  weekly 97% left, resets 2026-10-11T07:37:02Z; 5-hour 99% left, resets 2026-10-10T16:44:37Z; Argon weekly 98% left, resets 2026-10-23T01:23:48Z"
  );
});

test("setup reads each quota group by name, not by order: Argon listed first", async () => {
  setRunReviewForTest(canaryOk);
  const usage = JSON.parse(USAGE_JSON);
  usage.command.data.groups.reverse();
  setRunCommandForTest(fakeCommands({ usage: JSON.stringify(usage) }));
  const { out } = await runSetup(["--json"]);
  const { quota } = JSON.parse(out);
  assert.equal(quota.weekly.remainingPercent, 97);
  assert.equal(quota.fiveHour.remainingPercent, 99);
  assert.equal(quota.argon.weekly.remainingPercent, 98);
});

test("setup quota leaves out Argon when /usage has no Argon group (older agy)", async () => {
  setRunReviewForTest(canaryOk);
  const usage = JSON.parse(USAGE_JSON);
  usage.command.data.groups = usage.command.data.groups.filter((g) => !/argon/i.test(g.name));
  setRunCommandForTest(fakeCommands({ usage: JSON.stringify(usage) }));
  const { line } = await runSetup();
  assert.equal(
    line("Gemini quota:"),
    "Gemini quota:  weekly 97% left, resets 2026-10-11T07:37:02Z; 5-hour 99% left, resets 2026-10-10T16:44:37Z"
  );
  const json = JSON.parse((await runSetup(["--json"])).out);
  assert.equal(json.quota.argon, null);
});

test("setup still works and says quota is unknown when /usage fails", async () => {
  setRunReviewForTest(canaryOk);
  setRunCommandForTest(fakeCommands({ usage: null }));
  const { exitCode, line } = await runSetup();
  assert.match(line("Gemini quota:"), /unknown/);
  assert.match(line("Prompt check:"), /ok/);
  assert.notEqual(exitCode, 1);
});

test("setup still works when /usage returns unexpected JSON", async () => {
  setRunReviewForTest(canaryOk);
  setRunCommandForTest(fakeCommands({ usage: "not json" }));
  const { line } = await runSetup();
  assert.match(line("Gemini quota:"), /unknown/);
});

test("setup --json includes promptOk, modelStatus, per-model results and quota", async () => {
  setRunReviewForTest(canaryOk);
  const { out } = await runSetup(["--json"]);
  const parsed = JSON.parse(out);
  assert.equal(parsed.promptOk, true);
  assert.equal(parsed.authOk, true);
  assert.equal(parsed.transportOk, true);
  assert.equal(parsed.modelStatus, "ok");
  assert.deepEqual(parsed.models.primary, { model: PRIMARY_REVIEW_MODEL, ok: true });
  assert.deepEqual(Object.keys(parsed.models), ["primary", "ask"]);
  assert.deepEqual(parsed.models.ask, { model: "gemini-3.8-flash-medium", ok: true });
  assert.deepEqual(parsed.quota, {
    weekly: { remainingPercent: 97, resetTime: "2026-10-11T07:37:02Z" },
    fiveHour: { remainingPercent: 99, resetTime: "2026-10-10T16:44:37Z" },
    argon: { weekly: { remainingPercent: 98, resetTime: "2026-10-23T01:23:48Z" } }
  });
});

test("setup --json reports quota null when /usage fails", async () => {
  setRunReviewForTest(canaryOk);
  setRunCommandForTest(fakeCommands({ usage: null }));
  const { out } = await runSetup(["--json"]);
  assert.equal(JSON.parse(out).quota, null);
});

test("setup shows quota and model check even when the canary fails on auth", async () => {
  setRunReviewForTest(async () => {
    throw new AgyAuthError("agy is not signed in: unauthorized");
  });
  const { out, exitCode, line } = await runSetup();
  assert.match(line("Auth check:"), /failed/);
  assert.match(line("Gemini quota:"), /weekly 97% left/);
  assert.match(out, /agy -p hello/);
  assert.equal(exitCode, 1);
});

test("setup model check is degraded, not FAILED, when only the ask default model is missing", async () => {
  setRunReviewForTest(canaryOk);
  setRunCommandForTest(
    fakeCommands({ models: MODELS_TSV.replace(/^gemini-3\.8-flash-medium\t.*\n/m, "") })
  );
  const { out, exitCode, line } = await runSetup();
  assert.match(line("Model check:"), /^Model check:   degraded, .*\/gemini:ask default 'gemini-3\.8-flash-medium' is not listed/);
  assert.match(out, /Run `agy models`/);
  assert.doesNotMatch(out, /Ready\. Try/);
  assert.notEqual(exitCode, 1);

  const json = JSON.parse((await runSetup(["--json"])).out);
  assert.equal(json.modelStatus, "degraded");
  assert.deepEqual(json.models.ask, { model: "gemini-3.8-flash-medium", ok: false });
});

// Runs the hook the way agy does, from the hooks.json in the temp folder.
function hookDecision(cwd, toolCall) {
  const hooks = JSON.parse(fs.readFileSync(path.join(cwd, ".agents", "hooks.json"), "utf8"));
  const { command } = hooks["gemini-plugin-tool-gate"].PreToolUse[0].hooks[0];
  const input = JSON.stringify({ toolCall, conversationId: "c-1" });
  return JSON.parse(execFileSync("sh", ["-c", command], { input, encoding: "utf8" })).decision;
}

test("setup runs every agy call in one gated temp folder that allows no tool, and removes it", async () => {
  const cwds = new Set();
  const decisions = {};
  setBinaryAvailableForTest((cmd, args, opts) => {
    cwds.add(opts?.cwd);
    return { available: true, detail: "1.4.7" };
  });
  const commands = fakeCommands();
  setRunCommandForTest((cmd, args, opts) => {
    cwds.add(opts?.cwd);
    return commands(cmd, args);
  });
  setRunReviewForTest(async (args) => {
    cwds.add(args.cwd);
    const secret = path.join(os.homedir(), ".ssh", "id_rsa");
    decisions.read = hookDecision(args.cwd, { name: "read_file", args: { Path: secret } });
    decisions.files = hookDecision(args.cwd, { name: "read_file", args: { Path: path.join(args.cwd, "files") } });
    for (const name of ["run_command", "search_web", "read_url_content", "invoke_subagent", "write_to_file"]) {
      decisions[name] = hookDecision(args.cwd, { name, args: { CommandLine: "cat ~/.ssh/id_rsa" } });
    }
    return canaryOk(args);
  });
  const { exitCode } = await runSetup();
  assert.notEqual(exitCode, 1);
  assert.equal(cwds.size, 1, "the version check, models, quota and canary share one folder");
  const [cwd] = cwds;
  assert.equal(path.dirname(cwd), fs.realpathSync(os.tmpdir()));
  assert.match(path.basename(cwd), /^gemini-setup-cwd-/);
  assert.notEqual(cwd, process.cwd(), "not the user's folder");
  for (const [name, decision] of Object.entries(decisions)) assert.equal(decision, "deny", name);
  assert.equal(fs.existsSync(cwd), false, "the temp folder is removed afterwards");
});

test("setup removes its temp folder also when agy is missing", async () => {
  let cwd;
  setBinaryAvailableForTest((cmd, args, opts) => {
    cwd = opts?.cwd;
    return { available: false, detail: "agy not found on PATH" };
  });
  const { exitCode } = await runSetup();
  assert.equal(exitCode, 1);
  assert.match(path.basename(cwd), /^gemini-setup-cwd-/);
  assert.equal(fs.existsSync(cwd), false);
});

test("setup refuses --cwd, because agy runs only in its gated temp folder", async () => {
  await assert.rejects(() => handleSetup(["--cwd", os.tmpdir()]), (err) => err instanceof ConfigError && /--cwd/.test(err.message));
});

test("setup warns, and still runs, when agy is newer than the tested version", async () => {
  setRunReviewForTest(canaryOk);
  setBinaryAvailableForTest(() => ({ available: true, detail: "1.5.0" }));
  const { out, exitCode } = await runSetup();
  assert.match(out, /Warning: agy 1\.5\.0 is newer than 1\.4\.7, the version this plugin was tested on\. Run `node ".*smoke-agy\.mjs"`/);
  assert.match(out, /Ready\. Try/);
  assert.notEqual(exitCode, 1);
  const json = JSON.parse((await runSetup(["--json"])).out);
  assert.match(json.versionWarning, /newer than 1\.4\.7/);
  assert.equal(json.promptOk, true);
  const smoke = json.versionWarning.match(/node "(.*)"/)[1];
  assert.ok(fs.existsSync(smoke), "the warning names a smoke test that exists");
});

test("setup warns also when the canary fails on a newer agy", async () => {
  setBinaryAvailableForTest(() => ({ available: true, detail: "2.0.0" }));
  setRunReviewForTest(async () => {
    throw new AgyAuthError("agy is not signed in: unauthorized");
  });
  const { out, exitCode } = await runSetup();
  assert.match(out, /Warning: agy 2\.0\.0 is newer/);
  assert.equal(exitCode, 1);
});

test("setup does not warn on the tested version", async () => {
  setRunReviewForTest(canaryOk);
  setBinaryAvailableForTest(() => ({ available: true, detail: TESTED_AGY_VERSION.join(".") }));
  const { out } = await runSetup();
  assert.doesNotMatch(out, /Warning:/);
  assert.equal(JSON.parse((await runSetup(["--json"])).out).versionWarning, null);
});

test("setup fails before any agy call on an agy older than the hook minimum or with no version", async () => {
  setRunReviewForTest(async () => {
    throw new Error("should not be called");
  });
  setRunCommandForTest(() => {
    throw new Error("should not be called");
  });
  for (const detail of ["1.4.6", "agy ok"]) {
    setBinaryAvailableForTest(() => ({ available: true, detail }));
    const { out, exitCode } = await runSetup();
    assert.equal(exitCode, 1, detail);
    assert.match(out, /needs agy 1\.4\.7 or later.*agy update/, detail);
    const json = JSON.parse((await runSetup(["--json"])).out);
    assert.match(json.nextSteps[0], /needs agy 1\.4\.7 or later/, detail);
  }
});

test("setup --json has promptDetail and nextSteps when the canary reply is wrong", async () => {
  setBinaryAvailableForTest(() => ({ available: true, detail: "1.4.7" }));
  setRunReviewForTest(async (args) => ({ ...(await canaryOk(args)), text: "hello", response: "hello" }));
  const { out, exitCode } = await runSetup(["--json"]);
  assert.equal(exitCode, 1);
  const json = JSON.parse(out);
  assert.equal(json.promptOk, false);
  assert.match(json.promptDetail, /did not echo the canary; got: hello/);
  assert.match(json.nextSteps.join(" "), /command line has likely changed/);
});

test("setup --json prints JSON also when agy is missing or the canary fails", async () => {
  setBinaryAvailableForTest(() => ({ available: false, detail: "agy not found on PATH" }));
  let { out, exitCode } = await runSetup(["--json"]);
  assert.equal(exitCode, 1);
  assert.equal(JSON.parse(out).agy.available, false);

  setBinaryAvailableForTest(() => ({ available: true, detail: "1.4.7" }));
  setRunReviewForTest(async () => {
    throw new AgyAuthError("agy is not signed in: unauthorized");
  });
  ({ out, exitCode } = await runSetup(["--json"]));
  assert.equal(exitCode, 1);
  const json = JSON.parse(out);
  assert.equal(json.authOk, false);
  assert.match(json.nextSteps.join(" "), /agy -p hello/);
});

test("compareVersion compares x.y.z numbers, not strings", () => {
  assert.equal(compareVersion("1.4.3", [1, 4, 3]), 0);
  assert.equal(compareVersion("agy 1.10.0", [1, 4, 3]), 1);
  assert.equal(compareVersion("1.4.10", [1, 4, 3]), 1);
  assert.equal(compareVersion("1.4.2", [1, 4, 3]), -1);
  assert.equal(compareVersion("0.9.9", [1, 4, 3]), -1);
  assert.equal(compareVersion("agy not found on PATH", [1, 4, 3]), null);
});
