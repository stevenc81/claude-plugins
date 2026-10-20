#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parseArgs, normalizeArgv } from "./lib/args.mjs";
import {
  binaryAvailable as realBinaryAvailable,
  runCommand as realRunCommand
} from "./lib/process.mjs";
import { renderPrompt, schemaPath } from "./lib/prompts.mjs";
import { runReview as realRunReview, DEFAULT_PROMPT_TIMEOUT_MS } from "./lib/agy-runner.mjs";
import {
  parseReviewOutput,
  parseAgainstSchema,
  unsupportedSchemaKeywords,
  SUPPORTED_SCHEMA_KEYWORDS
} from "./lib/output-parser.mjs";
import {
  renderReviewResult,
  renderSetupReport,
  renderAskResult,
  renderError,
  describeDeniedActions
} from "./lib/render.mjs";
import { resolveSources } from "./lib/source-resolver.mjs";
import { truncateOnLineBoundary, byteLength, splitIntoParts } from "./lib/text-utils.mjs";
import {
  ConfigError,
  AgyAuthError,
  AgyConnectionError,
  AgyTimeoutError,
  AgyInterruptedError,
  OutputError
} from "./lib/errors.mjs";

const MAX_REVIEW_INPUT_BYTES = 40_000;
// agy 1.4.3 shows the model only the first 192,000 bytes of a message,
// counting its own wrapper of about 400 bytes, and drops the rest without an
// error. In October 2026 a 190,000-byte message arrived whole on
// gemini-3.8-flash-low, and a 1 MB one was cut. Argon cut a 250 KB one too.
const MAX_MESSAGE_BYTES = 190_000;
// A longer ask prompt goes as parts of at most this size, one per turn of a
// single agy session. The rest of MAX_MESSAGE_BYTES is room for the part header.
const PART_BYTES = 180_000;
// The whole ask prompt, with the file and folder lists and the tool rule, over
// all parts. It travels on stdin, so no argv limit applies. The cap is the
// largest size tested live: in October 2026 a 719 KB prompt in 4 parts reached
// gemini-3.8-flash-low and gemini-4-argon-low whole. At 1 MB, agy compacted the
// Flash conversation at part 5 of 6, so Gemini kept only a summary of the
// earlier parts.
const MAX_ASK_PROMPT_BYTES = 720_000;
// A --file media file over this size is refused before the run. In October
// 2026, on agy 1.4.3 with gemini-3.8-flash-low, a 24.4 MB video worked and a
// 28.0 MB one failed: agy compacted the conversation and the model lost the
// task. Measured for video only; other media and models are not tested.
export const MAX_MEDIA_BYTES = 24_000_000;
// The --file types that agy's file tool sends to the model as media.
const MEDIA_EXTENSIONS = new Set(
  "mp4 m4v webm mov mkv avi mpeg mpg wmv flv 3gp mp3 wav ogg opus m4a png jpg jpeg webp gif heic heif bmp tiff pdf"
    .split(" ")
    .map((e) => `.${e}`)
);
// agy 1.4.3 refuses some audio types by file extension, though the model
// decodes the same bytes. An .m4a file is an MP4 container, so its copy is
// named .mp4. AAC and FLAC need a conversion.
const COPY_EXTENSIONS = { ".m4a": ".mp4" };
const REFUSED_EXTENSIONS = new Set([".aac", ".flac"]);
// Below this, a fallback review run would be cut off before it could finish.
const MIN_FALLBACK_MS = 60_000;
// Headless agy cannot ask for permission, so one refused tool ends the run with
// no answer at all. agy refuses file writes, and commands that the user's agy
// rules do not allow. The hook denies every command, and every subagent but
// the image-generator of an --image-out run (see makeNeutralCwd). Page reads work only if the user allows read_url in their
// agy settings. agy's file tool cannot list or search a folder, so Gemini
// reads files in a --dir folder only by their full path. The media sentence
// stays because, in October 2026 on gemini-3.8-flash-low, it gave 16 of 16
// right audio answers on videos with sound against 14 of 16 without it, and
// no invented audio on 4 silent videos either way.
const TOOL_RULE_BASE =
  "Tools: use web search, and open web pages only if you need to. To read a local file, use your file-reading tool with its full path, for a file or a file inside a folder given above. Your file tool returns images and PDFs, and video frames that can include sound, as media. You cannot list or search a folder.";
const NO_PERMISSION = "this run cannot ask for permission, and a refused tool ends it with no answer.";
export const ASK_TOOL_RULE = `${TOOL_RULE_BASE} Never run shell commands, write files or start subagents: ${NO_PERMISSION}`;
// With --image-out, one subagent type is allowed: agy makes images only
// through its image-generator subagent (Nano Banana 2), not with a tool of
// the main model.
export const IMAGE_TOOL_RULE = `${TOOL_RULE_BASE} To make an image, start one subagent of type image-generator, with no workspace, and give it the whole image request. It saves the image. Never run shell commands, write files or start any other subagent: ${NO_PERMISSION}`;
// The oldest agy on which the hook, with the matcher "*" and its path checks, was tested.
export const MIN_DIR_AGY_VERSION = [1, 4, 3];

// True when `version` holds x.y.z at or above `min`. No version counts as no.
function isAtLeast(version, min) {
  const m = String(version).match(/(\d+)\.(\d+)\.(\d+)/);
  if (!m) return false;
  for (let i = 0; i < 3; i++) {
    if (Number(m[i + 1]) !== min[i]) return Number(m[i + 1]) > min[i];
  }
  return true;
}

// Opens a regular file, given as an absolute path, to read. A symlink can pass
// off another file, such as a secret, as an input: `bundle/data -> ~/.aws`. So
// a folder in the path may be a link only when root owns it, as the system
// links /tmp, /var and /etc on macOS. O_NOFOLLOW refuses a link as the last
// part. A folder could still be swapped for a link between the walk and the
// open, but that needs an attacker who can change the folders while the plugin
// runs. O_NONBLOCK keeps a named pipe from blocking the open. The check and the
// read use the same descriptor, so the file cannot be swapped in between.
function refuseUserSymlinks(folders, label) {
  let folder = path.parse(folders).root;
  for (const part of folders.split(path.sep).filter(Boolean)) {
    folder = path.join(folder, part);
    let st;
    try {
      st = fs.lstatSync(folder);
    } catch {
      break; // a missing folder: the open below says so
    }
    if (st.isSymbolicLink() && st.uid !== 0) {
      throw new ConfigError(`${label} path goes through a symlink: ${folder}`, {
        suggestion: "Pass the real path, with no links that a user made."
      });
    }
  }
}

function openRegularFile(file, label) {
  refuseUserSymlinks(path.dirname(file), label);
  let fd;
  try {
    fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  } catch (err) {
    if (err.code === "ELOOP") {
      throw new ConfigError(`${label} is a symlink: ${file}`, { suggestion: "Pass the real file, not a link to it." });
    }
    const why = err.code === "ENOENT" ? "not found" : `cannot be opened (${err.code})`;
    throw new ConfigError(`${label} ${why}: ${file}`, { suggestion: "Check the path and rerun /gemini:ask." });
  }
  if (!fs.fstatSync(fd).isFile()) {
    fs.closeSync(fd);
    throw new ConfigError(`${label} is not a regular file: ${file}`, { suggestion: "Pass a regular file." });
  }
  return fd;
}

function readRegularFile(file, label) {
  const fd = openRegularFile(file, label);
  try {
    return fs.readFileSync(fd, "utf8");
  } finally {
    fs.closeSync(fd);
  }
}

function copyRegularFile(file, dest, label) {
  const fd = openRegularFile(file, label);
  try {
    const { size } = fs.fstatSync(fd);
    if (size > MAX_MEDIA_BYTES && MEDIA_EXTENSIONS.has(path.extname(file).toLowerCase())) {
      throw new ConfigError(
        `${label} is ${size} bytes, over the ${MAX_MEDIA_BYTES}-byte limit for media: ${file}`,
        {
          suggestion:
            "Over this size, the model lost the task in a test (video on gemini-3.8-flash-low, agy 1.4.3). " +
            "Cut the file: `ffmpeg -i in.mp4 -ss 0 -t 60 -c copy part1.mp4`. Or make it smaller: `ffmpeg -i in.mp4 -vf scale=-2:480 -crf 32 small.mp4`."
        }
      );
    }
    const out = fs.openSync(dest, "wx");
    try {
      const buf = Buffer.allocUnsafe(1 << 20);
      let n;
      while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) fs.writeSync(out, buf, 0, n);
    } finally {
      fs.closeSync(out);
    }
  } finally {
    fs.closeSync(fd);
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

const TOOL_GATE = fileURLToPath(new URL("./tool-gate.mjs", import.meta.url));
const shellQuote = (s) => `'${s.replaceAll("'", `'\\''`)}'`;
const realOrResolved = (p) => {
  try {
    return fs.realpathSync.native(p);
  } catch {
    return path.resolve(p);
  }
};

const hookDenialLog = (cwd) => path.join(cwd, ".agents", "denied.jsonl");
// The tools each run allows. The hook denies every other tool (see
// tool-gate.mjs). `finish` returns the --json-schema answer. Both runs may
// search and open pages; the user's agy rules decide whether a page opens
// (read_url). A page can hold instructions for the model, but search results
// already can, and a search query can already carry data out. So the guard is
// that no run can read a secret: a review reads no local file, and an ask
// reads only inside its roots.
export const REVIEW_TOOLS = ["search_web", "read_url_content", "finish"];
export const ASK_TOOLS = ["search_web", "read_url_content", "finish"];
// agy 1.4.3 lists the file reader as view_file, and streams and gates it as
// read_file. Its init event also lists list_dir, grep_search and find_by_name,
// but a headless model does not get them (live test, October 2026).
export const ASK_FILE_TOOLS = ["read_file", "view_file"];
// With --image-out, the image-generator subagent calls generate_image, whose
// reference images pass the path check, and send_message to answer the
// conversation that started it (see tool-gate.mjs).
export const IMAGE_TOOLS = ["generate_image"];
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
// agy keeps its sign-in token, settings and every saved conversation here.
// No file tool may read it, also when a --dir folder holds it.
let agyHome = path.join(os.homedir(), ".gemini", "antigravity-cli");
/** Test-only hook: point the plugin at another agy home folder. */
export function setAgyHomeForTest(dir) {
  agyHome = dir ?? path.join(os.homedir(), ".gemini", "antigravity-cli");
}

// agy loads .agents/hooks.json from its working folder. The hook sees every
// tool call (matcher "*") and allows only `tools`, and `fileTools` on paths
// inside the run's files/ folder or a `dirs` folder. The .agents folder, with
// the hook and its log, is never readable. Returns the real path of the folder,
// so that the paths in the prompt match the ones that the hook resolves.
function makeNeutralCwd(prefix, { tools, fileTools = [], imageTools = [], subagents = [], dirs = [] }) {
  const dir = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  fs.mkdirSync(path.join(dir, ".agents"));
  fs.mkdirSync(path.join(dir, "files"));
  const policy = {
    log: hookDenialLog(dir),
    ...(subagents.length > 0 ? { parents: path.join(dir, ".agents", "parents.txt") } : {}),
    tools,
    fileTools,
    imageTools,
    subagents,
    roots: fileTools.length > 0 ? [path.join(dir, "files"), ...dirs] : [],
    denied: [path.join(dir, ".agents"), realOrResolved(agyHome)]
  };
  const command = [process.execPath, TOOL_GATE, JSON.stringify(policy)].map(shellQuote).join(" ");
  const hook = { type: "command", command, timeout: 10 };
  fs.writeFileSync(
    path.join(dir, ".agents", "hooks.json"),
    JSON.stringify({ "gemini-plugin-tool-gate": { PreToolUse: [{ matcher: "*", hooks: [hook] }] } })
  );
  return dir;
}

// Runs agy in a folder that makeNeutralCwd made, and adds the tool calls that
// the hook denied in this run to deniedActions, so callers see them next to
// agy's own refusals. The runner also reads the log to stop a prompt in parts.
async function runAgy(args) {
  const log = hookDenialLog(args.cwd);
  fs.rmSync(log, { force: true });
  const result = await runReviewImpl({ ...args, denialLog: log });
  let lines = [];
  try {
    lines = fs.readFileSync(log, "utf8").split("\n").filter(Boolean);
  } catch {
    return result;
  }
  const denials = lines.flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
  return { ...result, deniedActions: [...(result.deniedActions ?? []), ...denials] };
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
  // Plain argv: review.md passes each flag, then `--` and the focus text as
  // one single-quoted argument, so nothing is re-split here.
  const { options, positionals } = parseArgs(argv, {
    allowPositionals: true,
    valueFlags: ["--timeout-ms", "--model"],
    booleanFlags: ["--no-fallback"]
  });
  // parseArgs knows --cwd for every command, but review must always run in its
  // gated temp folder, so it refuses --cwd.
  if (options.cwd != null) {
    throw new ConfigError("Unknown flag: --cwd", {
      suggestion: "/gemini:review takes only --model, --no-fallback, --json and --timeout-ms. Put focus text after --."
    });
  }
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
  // when assessing claims. Its hook allows only web search and page reads,
  // and denies every file read, command and subagent.
  const neutralCwd = makeNeutralCwd("gemini-review-cwd-", { tools: REVIEW_TOOLS });

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
      result = await runAgy({ ...runArgs, model: requestedModel });
    } catch (err) {
      // Flash cannot fix a sign-in problem, a hard timeout used the whole
      // budget, and a stopped run must not start another. A caller that would
      // discard a Flash result turns the fallback off.
      if (
        err instanceof AgyAuthError ||
        err instanceof AgyTimeoutError ||
        err instanceof AgyInterruptedError ||
        options["no-fallback"]
      ) {
        throw err;
      }
      if (requestedModel === FALLBACK_FAMILY || requestedModel.startsWith(`${FALLBACK_FAMILY}-`)) throw err;
      const leftMs = deadline - Date.now();
      if (leftMs < MIN_FALLBACK_MS) {
        err.message += ` Skipped the fallback model '${FALLBACK_REVIEW_MODEL}': less than ${MIN_FALLBACK_MS / 1000} seconds of the time budget were left.`;
        throw err;
      }
      usedModel = FALLBACK_REVIEW_MODEL;
      fallbackReason = err.message;
      try {
        result = await runAgy({ ...runArgs, model: FALLBACK_REVIEW_MODEL, promptTimeoutMs: leftMs });
      } catch (fallbackErr) {
        fallbackErr.message = `The requested model '${requestedModel}' failed: ${fallbackReason} The fallback model '${FALLBACK_REVIEW_MODEL}' also failed: ${fallbackErr.message}`;
        throw fallbackErr;
      }
    }
  } finally {
    removeNeutralCwd(neutralCwd);
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
          searches: result.searches ?? null,
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
    timedOut,
    searches: result.searches ?? null
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
    valueFlags: ["--model", "--timeout-ms", "--prompt-file", "--resume", "--schema", "--image-out"],
    listFlags: ["--file", "--dir"]
  });
  const promptTimeoutMs = promptTimeoutFrom(options);
  const baseDir = resolveCwd(options);

  // The prompt comes from the arguments, plus --prompt-file or stdin (quoted
  // heredoc). With --prompt-file, stdin is not read.
  let bodyText;
  if (options["prompt-file"] != null) {
    bodyText = readRegularFile(path.resolve(baseDir, options["prompt-file"]), "Prompt file");
  } else {
    bodyText = stdin != null ? stdin : process.stdin.isTTY ? "" : readAllStdinSync();
  }
  const question = positionals.join(" ").trim();
  const body = String(bodyText ?? "").trim();
  if (!question && !body) {
    throw new ConfigError("No prompt given.", {
      suggestion: "Pass the prompt as arguments, in a file with --prompt-file, or on stdin, then rerun /gemini:ask."
    });
  }

  const files = (options.file ?? []).map((f) => path.resolve(baseDir, f));
  for (const f of files) {
    if (REFUSED_EXTENSIONS.has(path.extname(f).toLowerCase())) {
      throw new ConfigError(`agy cannot read ${path.extname(f)} audio: ${f}`, {
        suggestion: "Convert it to MP3 first, for example `ffmpeg -i x.flac x.mp3`, then attach the MP3."
      });
    }
  }
  // --image-out: the folder that gets the images. It must exist, and no part
  // of its path may be a link that a user made.
  let imageOut = null;
  if (options["image-out"] != null) {
    imageOut = path.resolve(baseDir, options["image-out"]);
    refuseUserSymlinks(imageOut, "--image-out");
    if (!fs.statSync(imageOut, { throwIfNoEntry: false })?.isDirectory()) {
      throw new ConfigError(`--image-out is not a folder: ${imageOut}`, { suggestion: "Make the folder first, then rerun." });
    }
  }
  // --schema: agy returns the answer as JSON for this schema, and the plugin
  // checks it. The schema may use only the keywords the check knows.
  let schema = null;
  if (options.schema != null) {
    const schemaFile = path.resolve(baseDir, options.schema);
    try {
      schema = JSON.parse(readRegularFile(schemaFile, "Schema file"));
    } catch (err) {
      if (err instanceof ConfigError) throw err;
      throw new ConfigError(`Schema file is not valid JSON: ${schemaFile} (${err.message})`, {
        suggestion: "Pass a JSON Schema file."
      });
    }
    const unknown = unsupportedSchemaKeywords(schema);
    if (unknown.length > 0) {
      throw new ConfigError(`The schema uses keywords that the plugin cannot check: ${unknown.join(", ")}.`, {
        suggestion: `Use only ${SUPPORTED_SCHEMA_KEYWORDS.join(", ")}, with one type name per "type".`
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
  // With --dir, the hook is the only thing that stops a command that the
  // user's agy rules allow, such as `grep x > file`, from writing into the
  // user's folders, and a read of agy's own folder when --dir holds it. An agy
  // that ignores the hook would not say so.
  if (dirs.length > 0) {
    const version = binaryAvailableImpl("agy", ["--version"]).detail;
    if (!isAtLeast(version, MIN_DIR_AGY_VERSION)) {
      throw new ConfigError(`--dir needs agy ${MIN_DIR_AGY_VERSION.join(".")} or later, and agy reports "${version}".`, {
        suggestion: "Run `agy update`, then rerun."
      });
    }
  }
  // The caller chooses the folders, so any folder is allowed, also / or the
  // home folder. agy's file tool reads only these folders.
  const realDirs = [...new Set(dirs.map((d) => fs.realpathSync.native(d)))];
  const model = options.model || DEFAULT_ASK_MODEL;

  // agy runs from an empty temp folder. Each --file is copied in, so agy sees
  // that file and nothing else from its folder. Each --dir is added with
  // --add-dir and read in place. agy keeps its own conversation history
  // elsewhere; only the temp folder is removed. So a --resume turn must attach
  // its files and folders again.
  const cwd = makeNeutralCwd("gemini-ask-cwd-", {
    tools: ASK_TOOLS,
    fileTools: ASK_FILE_TOOLS,
    ...(imageOut ? { imageTools: IMAGE_TOOLS, subagents: ["image-generator"] } : {}),
    dirs: realDirs
  });
  // A new conversation has no images yet. A --resume one may have some from
  // earlier turns, which are not this run's.
  const imagesBefore = imageOut && options.resume ? imageFiles(options.resume) : new Map();
  let result;
  try {
    const copies = files.map((f, i) => {
      const ext = path.extname(f);
      const name = path.basename(f, ext) + (COPY_EXTENSIONS[ext.toLowerCase()] ?? ext);
      return path.join(cwd, "files", `${i + 1}-${name}`);
    });
    files.forEach((f, i) => copyRegularFile(f, copies[i], "File"));
    let suffix = "";
    if (copies.length > 0) {
      suffix += `\n\nFiles for this request (absolute paths):\n${copies.map((f) => `- ${f}`).join("\n")}`;
    }
    if (realDirs.length > 0) {
      suffix += `\n\nFolders for this request (absolute paths):\n${realDirs.map((d) => `- ${d}`).join("\n")}`;
    }
    suffix += `\n\n${imageOut ? IMAGE_TOOL_RULE : ASK_TOOL_RULE}`;
    let prompt = [question, body].filter(Boolean).join("\n\n") + suffix;
    if (byteLength(prompt) > MAX_ASK_PROMPT_BYTES) {
      throw new ConfigError(
        `The prompt with its file and folder lists is ${byteLength(prompt)} bytes; the limit is ${MAX_ASK_PROMPT_BYTES}.`,
        { suggestion: "That is the largest size tested. Split the input over several asks, or attach it with --file: Gemini then reads only the pages it looks for." }
      );
    }
    // A prompt too long for one message goes as parts, split at line ends. The
    // last message holds the question, the file and folder lists and the tool rule.
    let parts = [];
    if (byteLength(prompt) > MAX_MESSAGE_BYTES) {
      const pieces = splitIntoParts(body, PART_BYTES);
      const n = pieces.length;
      parts = pieces.map(
        (piece, i) => `Part ${i + 1} of ${n} of the input. Remember it, and do not act on it yet. Do not use tools. Reply with only OK.\n\n${piece}`
      );
      const done = `That was all ${n} parts of the input.`;
      prompt = (question ? `${done}\n\n${question}` : `${done} Now do what it asks.`) + suffix;
      if (byteLength(prompt) > MAX_MESSAGE_BYTES) {
        throw new ConfigError(
          `The question with its file and folder lists is ${byteLength(prompt)} bytes; one message can hold ${MAX_MESSAGE_BYTES}.`,
          { suggestion: "Put long text in the --prompt-file, and pass fewer --file or --dir paths." }
        );
      }
    }
    // agy reads the schema from a copy in .agents, which no file tool may read.
    let jsonSchema;
    if (schema) {
      jsonSchema = path.join(cwd, ".agents", "schema.json");
      fs.writeFileSync(jsonSchema, JSON.stringify(schema));
    }
    result = await runAgy({
      prompt,
      cwd,
      model,
      promptTimeoutMs,
      ...(jsonSchema ? { jsonSchema } : {}),
      ...(parts.length > 0 ? { parts } : {}),
      ...(realDirs.length > 0 ? { addDirs: realDirs } : {}),
      ...(options.resume ? { conversationId: options.resume } : {})
    });
  } finally {
    removeNeutralCwd(cwd);
  }

  // agy only warns when it has no such conversation, and answers in a new
  // one without the earlier turns. That answer would mislead, so it is dropped.
  if (options.resume && result.conversationId !== options.resume) {
    throw new ConfigError(`agy has no conversation "${options.resume}", so it started a new one. Its answer is not shown.`, {
      suggestion: "Pass the ID from the [conversation] line of an earlier /gemini:ask answer, or ask without --resume."
    });
  }
  const conversationId = result.conversationId ?? null;
  const deniedActions = result.deniedActions ?? [];
  const timedOut = Boolean(result.timedOut);
  const compacted = Boolean(result.compacted);
  // With --schema, the answer is agy's structured_output, checked against the
  // schema. agy can report success with none (agy issue #1065), so an empty
  // or invalid one fails the ask.
  let structuredOutput = null;
  if (schema) {
    const checked = parseAgainstSchema(result.text, schema);
    if (checked.parseError) {
      const refused = describeDeniedActions(deniedActions);
      throw new OutputError(
        `Gemini did not return JSON that fits the schema: ${checked.parseError}${refused ? ` agy refused these tools: ${refused}.` : ""} Its text answer: ${JSON.stringify(String(result.response ?? "")).slice(0, 300)}`,
        { suggestion: `Rerun the ask${conversationId ? `, or continue it with --resume ${conversationId}` : ""}.` }
      );
    }
    structuredOutput = checked.parsed;
  }
  let images = null;
  if (imageOut) {
    images = exportImages(conversationId, imagesBefore, imageOut);
    if (images.length === 0) {
      throw new OutputError(`Gemini made no image. Its answer: ${JSON.stringify(String(result.response ?? "")).slice(0, 300)}`, {
        suggestion: "Rerun the ask. agy's image tool fails on some plans (agy issue #1202)."
      });
    }
  }
  if (options.json) {
    process.stdout.write(
      JSON.stringify(
        {
          model,
          conversationId,
          response: result.response,
          structuredOutput,
          images,
          tokens: result.tokens,
          deniedActions,
          timedOut,
          compacted
        },
        null,
        2
      ) + "\n"
    );
    return;
  }
  const response = schema ? `${JSON.stringify(structuredOutput, null, 2)}\n` : result.response;
  process.stdout.write(renderAskResult({ response, deniedActions, timedOut, compacted, conversationId, images: images ?? [] }));
}

// agy's image-generator saves each image at the top of the parent
// conversation's folder in agy's brain folder. The regular image files there,
// each with its size, change time and inode, so that a file the run did not
// make or change can be told apart.
function imageFiles(conversationId) {
  const files = new Map();
  if (!/^[0-9a-f-]{36}$/i.test(String(conversationId))) return files;
  const brain = path.join(agyHome, "brain", conversationId);
  let entries = [];
  try {
    entries = fs.readdirSync(brain, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const e of entries) {
    if (!e.isFile() || !IMAGE_EXTENSIONS.has(path.extname(e.name).toLowerCase())) continue;
    const st = fs.lstatSync(path.join(brain, e.name));
    if (st.size > 0) files.set(path.join(brain, e.name), `${st.size}:${st.mtimeMs}:${st.ino}`);
  }
  return files;
}

// Copies the image files that are new or changed since `before` to
// `outDir`, through copyRegularFile (O_NOFOLLOW, the same descriptor, no
// overwrite), and returns the copies. Nothing in agy's folder is changed.
function exportImages(conversationId, before, outDir) {
  const made = [...imageFiles(conversationId)].filter(([f, stamp]) => before.get(f) !== stamp).map(([f]) => f);
  const taken = made.map((f) => path.join(outDir, path.basename(f))).filter((d) => fs.lstatSync(d, { throwIfNoEntry: false }));
  if (taken.length > 0) {
    throw new ConfigError(`--image-out already has a file named like a new image: ${taken.join(", ")}`, {
      suggestion: `The images stay in ${path.dirname(made[0])}. Pass an empty folder, or move the files, and copy them from there.`
    });
  }
  return made.map((f) => {
    const dest = path.join(outDir, path.basename(f));
    copyRegularFile(f, dest, "Image");
    return dest;
  });
}

function printUsage() {
  process.stdout.write(
    [
      "Usage:",
      "  node scripts/gemini-companion.mjs setup [--json]",
      "  node scripts/gemini-companion.mjs review [--model <id>] [--no-fallback] [--json] [--timeout-ms <n>] [focus text...]  (content to review read from stdin)",
      "  node scripts/gemini-companion.mjs ask [--model <id>] [--file <path>]... [--dir <folder>]... [--prompt-file <path>] [--schema <file>] [--image-out <folder>] [--resume <conversation-id>] [--timeout-ms <n>] [--json] [prompt...]  (prompt from arguments, plus --prompt-file or stdin)",
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
