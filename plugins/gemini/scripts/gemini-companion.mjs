#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { parseArgs, normalizeArgv } from "./lib/args.mjs";
import {
  binaryAvailable as realBinaryAvailable,
  runCommand as realRunCommand
} from "./lib/process.mjs";
import { renderPrompt, schemaPath } from "./lib/prompts.mjs";
import { runReview as realRunReview, DEFAULT_PROMPT_TIMEOUT_MS } from "./lib/agy-runner.mjs";
import { parseReviewOutput } from "./lib/output-parser.mjs";
import {
  renderReviewResult,
  renderSetupReport,
  renderAskResult,
  renderError,
  describeDeniedActions
} from "./lib/render.mjs";
import { resolveSources } from "./lib/source-resolver.mjs";
import { truncateOnLineBoundary, byteLength } from "./lib/text-utils.mjs";
import {
  ConfigError,
  AgyAuthError,
  AgyConnectionError,
  AgyTimeoutError
} from "./lib/errors.mjs";

const MAX_REVIEW_INPUT_BYTES = 40_000;
// The prompt travels in one argv entry; Linux caps a single argument at 128 KiB.
const MAX_ASK_PROMPT_BYTES = 100_000;
// The full prompt, with the file and folder lists and the tool rule, must stay
// under that 128 KiB limit with room for "--print=".
const MAX_PRINT_ARG_BYTES = 128 * 1024 - 1024;
// Below this, a fallback review run would be cut off before it could finish.
const MIN_FALLBACK_MS = 60_000;
// Headless agy cannot ask for permission, so one refused tool ends the run with
// no answer at all. Shell commands, file writes and subagents are refused.
// Page reads work only if the user allows read_url in their agy settings.
const NO_OTHER_TOOLS =
  "write files or start subagents: this run cannot ask for permission, and a refused tool ends it with no answer.";
export const ASK_TOOL_RULE = `Tools: use web search, and open web pages only if you need to. To read local files, use your file-reading tool with the paths given above. Never run shell commands, ${NO_OTHER_TOOLS}`;
// agy has no tool to list or search a folder. With --dir, the user's agy
// settings must allow `ls` and `grep`; agy refuses pipes, chains and redirects
// even then.
export const ASK_DIR_TOOL_RULE = `Tools: use web search, and open web pages only if you need to. To read local files, use your file-reading tool. Stay inside the folders and files given above. To list a folder, run \`ls <folder>\`. To search, run \`grep -rn <text> <folder>\`. Run each as one plain command, with no pipes, \`&&\`, \`;\`, redirects or \`$(...)\`. Never run other shell commands, ${NO_OTHER_TOOLS}`;
export const LIST_SEARCH_RULES = ["command(ls)", "command(grep)"];

let agySettingsPath = path.join(os.homedir(), ".gemini", "antigravity-cli", "settings.json");
/** Test-only hook: point the settings check at another file. */
export function setAgySettingsPathForTest(p) {
  agySettingsPath = p ?? path.join(os.homedir(), ".gemini", "antigravity-cli", "settings.json");
}

// True when the agy settings allow both `ls` and `grep`. A missing or broken
// file counts as no.
function allowsListAndSearch() {
  try {
    const allow = JSON.parse(fs.readFileSync(agySettingsPath, "utf8"))?.permissions?.allow;
    return Array.isArray(allow) && LIST_SEARCH_RULES.every((r) => allow.includes(r));
  } catch {
    return false;
  }
}

// Model policy for /gemini:review: run the --model the caller chose, or Gemini 4
// Argon by default. If that run fails for any reason other than sign-in or a
// hard timeout (most often Argon's own weekly quota is used up), retry once on
// Gemini 3.8 Flash, unless a Flash model was the one that failed. See the README FAQ.
//
// These are the slug IDs printed by `agy models`. The trailing effort tier
// (`-high`) is part of the slug; agy also has a separate `--effort` flag we do
// not use. Keep these in sync with `agy models`; `/gemini:setup` checks them.
export const PRIMARY_REVIEW_MODEL = "gemini-4-argon-high";
export const FALLBACK_REVIEW_MODEL = "gemini-3.8-flash-high";
export const DEFAULT_ASK_MODEL = "gemini-3.8-flash-medium";
// Every effort level of the fallback model uses the same quota, so a failed run
// on any of them is not retried on the fallback.
const FALLBACK_FAMILY = FALLBACK_REVIEW_MODEL.replace(/-(?:low|medium|high)$/, "");

let runReviewImpl = realRunReview;
/** Test-only hook: swap the transport so unit tests don't spawn agy. */
export function setRunReviewForTest(fn) {
  runReviewImpl = fn ?? realRunReview;
}

let runCommandImpl = realRunCommand;
/** Test-only hook: swap the sync command runner used for `agy models` and `/usage`. */
export function setRunCommandForTest(fn) {
  runCommandImpl = fn ?? realRunCommand;
}

let binaryAvailableImpl = realBinaryAvailable;
/** Test-only hook: swap the binary probe so unit tests don't spawn agy. */
export function setBinaryAvailableForTest(fn) {
  binaryAvailableImpl = fn ?? realBinaryAvailable;
}

function resolveCwd(options) {
  return options.cwd ? path.resolve(process.cwd(), options.cwd) : process.cwd();
}

function envInt(name, fallback) {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** `--timeout-ms` wins over GEMINI_PLUGIN_CC_PROMPT_TIMEOUT_MS; undefined means the runner default. */
function promptTimeoutFrom(options) {
  if (options["timeout-ms"] == null) return envInt("GEMINI_PLUGIN_CC_PROMPT_TIMEOUT_MS", undefined);
  const n = Number(options["timeout-ms"]);
  if (!Number.isInteger(n) || n <= 0) {
    throw new ConfigError(`Invalid --timeout-ms: ${options["timeout-ms"]}`, {
      suggestion: "Pass a positive whole number of milliseconds, for example --timeout-ms 540000."
    });
  }
  return n;
}

function readAllStdinSync() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch (err) {
    if (err?.code === "EAGAIN") return "";
    throw err;
  }
}

function makeNeutralCwd(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function removeNeutralCwd(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore cleanup failures */
  }
}

/**
 * Validate the review result. With --json-schema, `text` is the serialized
 * `structured_output` or empty; when it is empty, keep agy's raw response for
 * the reader and say why there is nothing to parse.
 */
function parseReviewResult(result) {
  let out;
  if (String(result.text ?? "").trim()) {
    out = parseReviewOutput(result.text);
    if (out.parsed) return out;
  } else {
    const rawOutput = result.response ?? "";
    out = {
      parsed: null,
      parseError: rawOutput.trim() ? "Model did not return structured output." : "Empty output from model.",
      rawOutput
    };
  }
  const refused = describeDeniedActions(result.deniedActions ?? []);
  if (refused) out.parseError += ` agy refused these tools: ${refused}.`;
  return out;
}

export async function handleReview(argv, { stdin = null } = {}) {
  // Plain argv: review.md passes each flag, and the focus text as one
  // single-quoted argument, so nothing is re-split here.
  const { options, positionals } = parseArgs(argv, {
    allowPositionals: true,
    valueFlags: ["--timeout-ms", "--model"]
  });
  const promptTimeoutMs = promptTimeoutFrom(options);
  const requestedModel = options.model || PRIMARY_REVIEW_MODEL;

  const rawInput = (stdin != null ? stdin : readAllStdinSync()) ?? "";
  if (!rawInput.trim()) {
    throw new ConfigError("No content received on stdin to review.", {
      suggestion: "/gemini:review reads the content to audit from stdin. Pipe in the text you want reviewed and rerun."
    });
  }

  const originalBytes = byteLength(rawInput);
  const truncationResult = truncateOnLineBoundary(rawInput, MAX_REVIEW_INPUT_BYTES);
  const content = truncationResult.content;
  const truncated = truncationResult.truncated;
  const omittedBytes = truncationResult.omittedBytes;

  const focus = positionals.join(" ").trim();

  const { text: prompt } = renderPrompt("review", {
    CONTENT: content,
    USER_FOCUS: focus || "No specific focus provided."
  });

  // Evaluate the text in isolation: create an empty temp directory and use
  // that as the working directory so the agent has no repo to wander into
  // when assessing claims. The --cwd option is accepted for testing overrides.
  const neutralCwd = options.cwd
    ? path.resolve(process.cwd(), options.cwd)
    : makeNeutralCwd("gemini-review-cwd-");
  const shouldCleanupCwd = !options.cwd;

  const agyVersion = binaryAvailableImpl("agy", ["--version"], { cwd: neutralCwd }).detail;

  // The timeout is the budget for both runs: the fallback gets only what is left.
  const budgetMs = promptTimeoutMs ?? DEFAULT_PROMPT_TIMEOUT_MS;
  const deadline = Date.now() + budgetMs;
  const runArgs = {
    prompt,
    cwd: neutralCwd,
    agentVersion: agyVersion,
    jsonSchema: schemaPath("review-output"),
    promptTimeoutMs: budgetMs
  };

  let result;
  let usedModel = requestedModel;
  let fallbackReason = null;
  try {
    try {
      result = await runReviewImpl({ ...runArgs, model: requestedModel });
    } catch (err) {
      // Flash cannot fix a sign-in problem, and a hard timeout used the whole budget.
      if (err instanceof AgyAuthError || err instanceof AgyTimeoutError) throw err;
      if (requestedModel === FALLBACK_FAMILY || requestedModel.startsWith(`${FALLBACK_FAMILY}-`)) throw err;
      const leftMs = deadline - Date.now();
      if (leftMs < MIN_FALLBACK_MS) {
        err.message += ` Skipped the fallback model '${FALLBACK_REVIEW_MODEL}': less than ${MIN_FALLBACK_MS / 1000} seconds of the time budget were left.`;
        throw err;
      }
      usedModel = FALLBACK_REVIEW_MODEL;
      fallbackReason = err.message;
      try {
        result = await runReviewImpl({ ...runArgs, model: FALLBACK_REVIEW_MODEL, promptTimeoutMs: leftMs });
      } catch (fallbackErr) {
        fallbackErr.message = `The requested model '${requestedModel}' failed: ${fallbackReason} The fallback model '${FALLBACK_REVIEW_MODEL}' also failed: ${fallbackErr.message}`;
        throw fallbackErr;
      }
    }
  } finally {
    if (shouldCleanupCwd) removeNeutralCwd(neutralCwd);
  }

  const parsed = parseReviewResult(result);
  if (parsed.parsed) {
    await resolveSources(parsed.parsed, {
      enabled: process.env.GEMINI_PLUGIN_CC_RESOLVE_SOURCES !== "0",
      timeoutMs: envInt("GEMINI_PLUGIN_CC_RESOLVE_SOURCES_TIMEOUT_MS", undefined)
    });
  }
  const target = { mode: "review", inputBytes: originalBytes, truncated, omittedBytes };
  const deniedActions = result.deniedActions ?? [];
  const timedOut = Boolean(result.timedOut);

  if (options.json) {
    process.stdout.write(
      JSON.stringify(
        {
          target,
          model: usedModel,
          requestedModel,
          fellBack: fallbackReason != null,
          fallbackReason,
          agentVersion: result.agentVersion,
          stopReason: result.stopReason,
          timedOut,
          tokens: result.tokens,
          deniedActions,
          parsed: parsed.parsed,
          parseError: parsed.parseError,
          rawOutput: parsed.rawOutput
        },
        null,
        2
      ) + "\n"
    );
    return;
  }

  const rendered = renderReviewResult({
    ...parsed,
    target,
    tokens: result.tokens,
    agentVersion: result.agentVersion,
    model: usedModel,
    requestedModel,
    fallbackReason,
    deniedActions,
    timedOut
  });
  process.stdout.write(rendered);
}

/** Model IDs from plain `agy models` (TSV: `id<TAB>display name`). Free, no model call. */
function listModels(cwd) {
  const r = runCommandImpl("agy", ["models"], { cwd, timeoutMs: 30_000 });
  if (r.error || r.status !== 0) {
    return { ids: null, error: (r.stderr || r.error?.message || `exit ${r.status}`).trim() };
  }
  const ids = new Set(
    r.stdout
      .split(/\r?\n/)
      .map((line) => line.split("\t")[0].trim())
      .filter(Boolean)
  );
  return { ids, error: null };
}

/**
 * Gemini quota from `agy --print=/usage --output-format=json`. Free; null on any failure.
 * agy reports "Gemini Models" (Flash) and "Gemini 4 Argon" as separate groups.
 * Both names contain "Gemini", so each group is matched by name, never by order.
 * Argon has a weekly limit only; `argon` is null when agy does not report it.
 */
function readQuota(cwd) {
  const r = runCommandImpl("agy", ["--print=/usage", "--output-format=json"], { cwd, timeoutMs: 30_000 });
  if (r.error || r.status !== 0) return null;
  try {
    const groups = JSON.parse(r.stdout).command?.data?.groups ?? [];
    const names = (g) => String(g?.name ?? "");
    const gemini = groups.find((g) => /gemini/i.test(names(g)) && !/argon/i.test(names(g)));
    const argon = groups.find((g) => /argon/i.test(names(g)));
    if (!gemini) return null;
    const bucket = (group, window) => {
      const b = (group?.buckets ?? []).find((x) => x?.window === window);
      if (!b || typeof b.remaining_fraction !== "number") return null;
      return { remainingPercent: Math.round(b.remaining_fraction * 100), resetTime: b.reset_time ?? null };
    };
    return {
      weekly: bucket(gemini, "weekly"),
      fiveHour: bucket(gemini, "5h"),
      argon: argon ? { weekly: bucket(argon, "weekly") } : null
    };
  } catch {
    return null;
  }
}

function checkPinnedModels({ ids, error }) {
  if (!ids) {
    return {
      status: "unknown",
      detail: `could not run \`agy models\`: ${error}`,
      primaryOk: null,
      fallbackOk: null,
      askOk: null
    };
  }
  const primaryOk = ids.has(PRIMARY_REVIEW_MODEL);
  const fallbackOk = ids.has(FALLBACK_REVIEW_MODEL);
  const askOk = ids.has(DEFAULT_ASK_MODEL);
  let status;
  let detail;
  if (primaryOk && fallbackOk) {
    status = "ok";
    detail = `review model '${PRIMARY_REVIEW_MODEL}' and fallback '${FALLBACK_REVIEW_MODEL}' are listed`;
  } else if (!primaryOk && !fallbackOk) {
    status = "failed";
    detail = `neither review model is listed (primary '${PRIMARY_REVIEW_MODEL}', fallback '${FALLBACK_REVIEW_MODEL}')`;
  } else if (!primaryOk) {
    status = "degraded";
    detail = `review model '${PRIMARY_REVIEW_MODEL}' is not listed; reviews will fall back to '${FALLBACK_REVIEW_MODEL}'`;
  } else {
    status = "degraded";
    detail = `fallback '${FALLBACK_REVIEW_MODEL}' is not listed; reviews still run on '${PRIMARY_REVIEW_MODEL}'`;
  }
  // A missing ask default only affects /gemini:ask, so it degrades, never fails.
  if (!askOk) {
    if (status === "ok") status = "degraded";
    detail += `; /gemini:ask default '${DEFAULT_ASK_MODEL}' is not listed`;
  }
  return { status, detail, primaryOk, fallbackOk, askOk };
}

export async function handleSetup(argv) {
  const { options } = parseArgs(normalizeArgv(argv));
  const cwd = resolveCwd(options);

  const agy = binaryAvailableImpl("agy", ["--version"], { cwd });
  if (!agy.available) {
    const report = renderSetupReport({
      agy,
      nextSteps: [
        "Install Antigravity CLI. See https://antigravity.google for instructions."
      ]
    });
    process.stdout.write(report);
    process.exitCode = 1;
    return;
  }

  // Both checks are free (no model call), so run them before the canary. The
  // quota also explains a canary that fails because the quota is used up.
  const quota = readQuota(cwd);
  const modelCheck = checkPinnedModels(listModels(cwd));

  const started = Date.now();
  try {
    // The only model call: the reply must echo the canary, which proves the prompt arrived.
    const CANARY = "OK";
    const canaryPrompt = `Reply with the single word ${CANARY} and nothing else.`;
    const result = await runReviewImpl({
      prompt: canaryPrompt,
      cwd,
      promptTimeoutMs: 60_000,
      agentVersion: agy.detail
    });
    const roundTripMs = Date.now() - started;
    const version = result.agentVersion ?? agy.detail;
    const replyText = String(result.text ?? "").trim();
    const promptOk = new RegExp(`\\b${CANARY}\\b`, "i").test(replyText);
    const replyExcerpt = replyText ? replyText.slice(0, 120) : "(empty reply)";
    const promptDetail = promptOk
      ? "canary reply matched"
      : `reply did not echo the canary; got: ${replyExcerpt}`;

    const setupOk = promptOk && modelCheck.status !== "failed";

    const nextSteps = [];
    if (!promptOk) {
      nextSteps.push(
        "agy ran but did not act on the prompt this plugin sent. The agy command line has likely changed. Compare `agy --help` with the flags in scripts/lib/agy-runner.mjs and update the plugin."
      );
    } else if (modelCheck.status === "failed") {
      nextSteps.push(
        "Neither review model is listed. Run `agy models` and update PRIMARY_REVIEW_MODEL and FALLBACK_REVIEW_MODEL in scripts/gemini-companion.mjs to current IDs."
      );
    } else if (modelCheck.status === "degraded") {
      nextSteps.push(
        `${modelCheck.detail}. Run \`agy models\` and update the affected model ID in scripts/gemini-companion.mjs.`
      );
    } else if (modelCheck.status === "unknown") {
      nextSteps.push("Run `agy models` to check that the review and ask models are still listed.");
    } else if (!options.json) {
      nextSteps.push("Ready. Try `/gemini:review` or `/gemini:ask`.");
    }

    if (options.json) {
      process.stdout.write(
        JSON.stringify(
          {
            agy,
            version,
            transportOk: true,
            authOk: true,
            promptOk,
            modelStatus: modelCheck.status,
            models: {
              primary: { model: PRIMARY_REVIEW_MODEL, ok: modelCheck.primaryOk },
              fallback: { model: FALLBACK_REVIEW_MODEL, ok: modelCheck.fallbackOk },
              ask: { model: DEFAULT_ASK_MODEL, ok: modelCheck.askOk }
            },
            quota,
            roundTripMs
          },
          null,
          2
        ) + "\n"
      );
    } else {
      process.stdout.write(
        renderSetupReport({
          agy,
          version,
          transportOk: true,
          authOk: true,
          authDetail: `round-trip ${promptOk ? "ok" : "completed"} (agy ${version}, default model)`,
          promptOk,
          promptDetail,
          modelStatus: modelCheck.status,
          modelDetail: modelCheck.detail,
          quota,
          roundTripMs,
          nextSteps
        })
      );
    }
    if (!setupOk) process.exitCode = 1;
  } catch (err) {
    const transportOk = !(err instanceof AgyConnectionError);
    const authOk = !(err instanceof AgyAuthError);
    const nextSteps = [];
    if (err instanceof AgyAuthError) {
      nextSteps.push(
        "Run `agy -p hello` once interactively to complete OAuth, then retry `/gemini:setup`."
      );
    } else if (err instanceof AgyConnectionError) {
      nextSteps.push(
        "Verify `agy --version` works. If install is missing, see https://antigravity.google."
      );
    } else {
      nextSteps.push(
        `Unexpected error during setup: ${err.message}. Retry; rerun with GEMINI_PLUGIN_CC_DEBUG=1 for details.`
      );
    }
    const report = renderSetupReport({
      agy,
      transportOk,
      authOk,
      authDetail: err.message,
      modelStatus: modelCheck.status,
      modelDetail: modelCheck.detail,
      quota,
      nextSteps
    });
    process.stdout.write(report);
    process.exitCode = 1;
  }
}

export async function handleAsk(argv, { stdin = null } = {}) {
  const { options, positionals } = parseArgs(argv, {
    allowPositionals: true,
    valueFlags: ["--model", "--timeout-ms"],
    listFlags: ["--file", "--dir"]
  });
  const promptTimeoutMs = promptTimeoutFrom(options);

  // The prompt comes from the arguments, stdin (quoted heredoc), or both.
  const stdinText = stdin != null ? stdin : process.stdin.isTTY ? "" : readAllStdinSync();
  let prompt = [positionals.join(" ").trim(), String(stdinText ?? "").trim()]
    .filter(Boolean)
    .join("\n\n");
  if (!prompt) {
    throw new ConfigError("No prompt given.", {
      suggestion: "Pass the prompt as arguments or pipe it in on stdin, then rerun /gemini:ask."
    });
  }

  const baseDir = resolveCwd(options);
  const files = (options.file ?? []).map((f) => path.resolve(baseDir, f));
  for (const file of files) {
    if (!fs.statSync(file, { throwIfNoEntry: false })?.isFile()) {
      throw new ConfigError(`File not found: ${file}`, {
        suggestion: "Check the --file path and rerun /gemini:ask."
      });
    }
  }
  const dirs = (options.dir ?? []).map((d) => path.resolve(baseDir, d));
  for (const d of dirs) {
    if (!fs.statSync(d, { throwIfNoEntry: false })?.isDirectory()) {
      throw new ConfigError(`Folder not found: ${d}`, {
        suggestion: "Check the --dir path and rerun /gemini:ask."
      });
    }
  }
  // Without ls and grep, Gemini cannot find files in a folder, and a refused
  // command ends the run with no answer. So fail before the run.
  if (dirs.length > 0 && !allowsListAndSearch()) {
    throw new ConfigError(`--dir needs agy to allow ls and grep, and ${agySettingsPath} does not.`, {
      suggestion: `Add ${LIST_SEARCH_RULES.map((r) => `"${r}"`).join(" and ")} to "permissions": { "allow": [...] } in that file, then rerun.`
    });
  }
  // The caller chooses the folders, so any folder is allowed, also / or the
  // home folder. agy's file tool reads only these folders.
  const realDirs = [...new Set(dirs.map((d) => fs.realpathSync(d)))];
  // The cap is on the user's text. The full prompt is checked again below.
  if (byteLength(prompt) > MAX_ASK_PROMPT_BYTES) {
    throw new ConfigError(
      `The prompt is ${byteLength(prompt)} bytes; the limit is ${MAX_ASK_PROMPT_BYTES}.`,
      { suggestion: "Save large input to a file and pass it with --file <path> instead." }
    );
  }
  const model = options.model || DEFAULT_ASK_MODEL;

  // agy runs from an empty temp folder. Each --file is copied in, so agy sees
  // that file and nothing else from its folder. Each --dir is added with
  // --add-dir and read in place. agy keeps its own conversation history
  // elsewhere; only the temp folder is removed.
  const cwd = makeNeutralCwd("gemini-ask-cwd-");
  let result;
  try {
    const copies = files.map((f, i) => path.join(cwd, `${i + 1}-${path.basename(f)}`));
    files.forEach((f, i) => fs.copyFileSync(f, copies[i], fs.constants.COPYFILE_FICLONE));
    if (copies.length > 0) {
      prompt += `\n\nFiles for this request (absolute paths):\n${copies.map((f) => `- ${f}`).join("\n")}`;
    }
    if (realDirs.length > 0) {
      prompt += `\n\nFolders for this request (absolute paths):\n${realDirs.map((d) => `- ${d}`).join("\n")}`;
    }
    prompt += `\n\n${realDirs.length > 0 ? ASK_DIR_TOOL_RULE : ASK_TOOL_RULE}`;
    if (byteLength(prompt) > MAX_PRINT_ARG_BYTES) {
      throw new ConfigError(
        `The prompt with its file and folder lists is ${byteLength(prompt)} bytes; the limit is ${MAX_PRINT_ARG_BYTES}.`,
        { suggestion: "Pass fewer --file or --dir paths, or a shorter prompt." }
      );
    }
    result = await runReviewImpl({
      prompt,
      cwd,
      model,
      promptTimeoutMs,
      ...(realDirs.length > 0 ? { addDirs: realDirs } : {})
    });
  } finally {
    removeNeutralCwd(cwd);
  }

  const deniedActions = result.deniedActions ?? [];
  const timedOut = Boolean(result.timedOut);
  if (options.json) {
    process.stdout.write(
      JSON.stringify(
        { model, response: result.response, tokens: result.tokens, deniedActions, timedOut },
        null,
        2
      ) + "\n"
    );
    return;
  }
  process.stdout.write(renderAskResult({ response: result.response, deniedActions, timedOut }));
}

function printUsage() {
  process.stdout.write(
    [
      "Usage:",
      "  node scripts/gemini-companion.mjs setup [--json]",
      "  node scripts/gemini-companion.mjs review [--model <id>] [--json] [--timeout-ms <n>] [focus text...]  (content to review read from stdin)",
      "  node scripts/gemini-companion.mjs ask [--model <id>] [--file <path>]... [--dir <folder>]... [--timeout-ms <n>] [--json] [prompt...]  (prompt from arguments and/or stdin)",
      ""
    ].join("\n")
  );
}

async function main() {
  const [subcommand, ...rest] = process.argv.slice(2);
  if (!subcommand || subcommand === "help" || subcommand === "--help") {
    printUsage();
    return;
  }
  switch (subcommand) {
    case "setup":
      await handleSetup(rest);
      return;
    case "review":
      await handleReview(rest);
      return;
    case "ask":
      await handleAsk(rest);
      return;
    default:
      throw new ConfigError(`Unknown subcommand: ${subcommand}`, {
        suggestion: "Valid subcommands: setup, review, ask."
      });
  }
}

const invokedDirectly = (() => {
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(new URL(import.meta.url).pathname);
  } catch {
    return false;
  }
})();
if (invokedDirectly) {
  main().catch((err) => {
    process.stderr.write(renderError(err));
    process.exitCode = 1;
  });
}
