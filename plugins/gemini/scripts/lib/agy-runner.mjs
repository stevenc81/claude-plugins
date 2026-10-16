import { spawn as nodeSpawn } from "node:child_process";
import process from "node:process";
import { AgyAuthError, AgyConnectionError, AgyModelError, AgyQuotaError, AgyTimeoutError } from "./errors.mjs";

export const DEFAULT_PROMPT_TIMEOUT_MS = 1_200_000;
// agy's own --print-timeout returns partial output with exit 0. Our wall-clock
// timer runs a bit longer so that partial result can arrive before we kill.
const WALL_CLOCK_GRACE_MS = 30_000;
const SIGKILL_GRACE_MS = 1500;

const PRINT_TIMEOUT_MARKER = /\[agy\] print timeout after/;
const UNKNOWN_MODEL_MARKER = /is not recognized as a known model/;
// A used-up quota. Matched before the auth word list, because a quota message
// can say "sign in" (for example, to upgrade) and must not read as signed out.
// The words must say the limit is used up, as in "quota exceeded" or "reached
// your weekly limit". "cannot check quota" or "quota service could not be
// reached" are other errors.
const LIMIT = String.raw`(?:quota|rate limit|usage limit|weekly limit)`;
const USED_UP = String.raw`(?:exceeded|exhausted|reached|used up)`;
const QUOTA_MARKER = new RegExp(
  [
    "RESOURCE_EXHAUSTED",
    // "quota exceeded", "rate limit has been reached"
    String.raw`\b${LIMIT}\s+(?:has been\s+|was\s+|is\s+)?${USED_UP}\b`,
    // "reached your Gemini 4 Argon quota", "exceeded the weekly limit", "ran out of quota"
    String.raw`\b(?:${USED_UP}|ran out of)\s+(?:(?:your|the|its)\s+)?(?:[\w-]+\s+){0,4}${LIMIT}\b`
  ].join("|"),
  "i"
);

/**
 * True when an `AGY_ERROR` line reports a used-up quota. A JSON line is judged
 * only by its status and HTTP code, because its message can mention the quota
 * for other reasons. A line that is not JSON is judged by its words.
 */
function isQuotaAgyError(line) {
  let e;
  try {
    e = JSON.parse(line);
  } catch {
    return QUOTA_MARKER.test(line);
  }
  return e?.status === "RESOURCE_EXHAUSTED" || e?.code === 429;
}

function secondsForGoDuration(ms) {
  return `${Math.max(1, Math.ceil(ms / 1000))}s`;
}

function isAuthMessage(text) {
  const t = String(text ?? "").toLowerCase();
  return (
    t.includes("not signed in") ||
    t.includes("sign in") ||
    t.includes("unauthorized") ||
    t.includes("login") ||
    t.includes("authenticate")
  );
}

/** agy 1.2+ prints `AGY_ERROR: {...}` on stderr (exit 3) for model and agent errors. */
function findAgyErrorLine(stderr) {
  return String(stderr ?? "").match(/^AGY_ERROR:\s*(\{.*\})\s*$/m)?.[1] ?? null;
}

function parseJsonResult(stdout) {
  try {
    const parsed = JSON.parse(stdout.trim());
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    /* not JSON; fall through */
  }
  return { response: stdout };
}

function quotaError(detail, model) {
  return new AgyQuotaError(`agy has no quota left for "${model ?? "(default)"}": ${detail}`, {
    suggestion: "Run `agy -p /usage` to see when the quota resets, or use another model."
  });
}

function errorForExit({ code, signal, stdout, stderr, model }) {
  const agyError = findAgyErrorLine(stderr);
  if (agyError) {
    if (/UNAUTHENTICATED/.test(agyError)) {
      return new AgyAuthError(`agy is not signed in: ${agyError}`, {
        suggestion: "Run `agy -p hello` once interactively to complete OAuth, then retry."
      });
    }
    if (isQuotaAgyError(agyError)) return quotaError(agyError, model);
    return new AgyConnectionError(`agy reported an error (exit ${code ?? signal}): ${agyError}`, {
      suggestion: "Rerun with GEMINI_PLUGIN_CC_DEBUG=1 for details."
    });
  }

  const detail =
    stderr.trim() || parseJsonResult(stdout).error || stdout.trim() || `exit ${code ?? signal}`;
  // The unknown-model text lists display names such as "Gemini 3.1 Pro", so it
  // must be matched before the auth word list below.
  if (UNKNOWN_MODEL_MARKER.test(detail)) {
    return new AgyModelError(`agy does not know the model "${model ?? "(default)"}".`, {
      suggestion: "Run `agy models` to see the model IDs you can use."
    });
  }
  if (QUOTA_MARKER.test(detail)) return quotaError(detail, model);
  if (isAuthMessage(detail)) {
    return new AgyAuthError(`agy is not signed in: ${detail}`, {
      suggestion: "Run `agy -p hello` once interactively to complete OAuth, then retry."
    });
  }
  return new AgyConnectionError(`agy --print failed (${code ?? signal}): ${detail}`, {
    suggestion:
      "Verify `agy --version` works and you are signed in. Rerun with GEMINI_PLUGIN_CC_DEBUG=1 for details."
  });
}

/**
 * Run a single prompt through the Antigravity CLI in print mode and return the
 * parsed JSON result. The prompt travels as `--print=<prompt>` (agy ignores
 * stdin in print mode). All flags use the `--flag=value` form so Go's flag
 * parser can never consume a neighbouring flag as a value.
 *
 * `--output-format=json` gives us usage and refused tools. When `jsonSchema`
 * is set, `text` is the serialized `structured_output`; agy's `response` can
 * carry stray keys in that mode, so it is only returned as `response` for
 * display. `--disable-slash-commands` keeps a prompt that starts with `/` from
 * being run as a local agy command.
 *
 * A run that hits agy's `--print-timeout` still exits 0 with partial output;
 * the stderr marker is the only reliable signal, surfaced as `timedOut`.
 */
export function runReview({
  prompt,
  cwd = process.cwd(),
  promptTimeoutMs = DEFAULT_PROMPT_TIMEOUT_MS,
  agentVersion = null,
  model = null,
  jsonSchema = null,
  spawnFn = nodeSpawn
} = {}) {
  if (!prompt) {
    throw new AgyConnectionError("runReview requires a non-empty prompt.");
  }

  const args = [];
  if (model) args.push(`--model=${model}`);
  args.push("--output-format=json", "--disable-slash-commands");
  if (jsonSchema) args.push(`--json-schema=${jsonSchema}`);
  args.push(`--print=${prompt}`, `--print-timeout=${secondsForGoDuration(promptTimeoutMs)}`);
  const proc = spawnFn("agy", args, { cwd, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  const wallClockMs = promptTimeoutMs + WALL_CLOCK_GRACE_MS;

  return new Promise((resolve, reject) => {
    let settled = false;
    let stdout = "";
    let stderr = "";

    proc.stdout?.setEncoding?.("utf8");
    proc.stderr?.setEncoding?.("utf8");

    proc.stdout?.on("data", (chunk) => {
      stdout += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    });
    proc.stderr?.on("data", (chunk) => {
      stderr += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    });

    const finishWith = (cb) => {
      if (settled) return;
      settled = true;
      clearTimeout(wallTimer);
      cb();
    };

    const wallTimer = setTimeout(() => {
      finishWith(() => {
        try {
          proc.kill?.("SIGTERM");
        } catch {
          /* already gone */
        }
        const killTimer = setTimeout(() => {
          try {
            proc.kill?.("SIGKILL");
          } catch {
            /* already gone */
          }
        }, SIGKILL_GRACE_MS);
        killTimer.unref?.();
        reject(
          new AgyTimeoutError(
            `agy --print did not finish within ${wallClockMs}ms.`,
            {
              suggestion:
                "Retry. For consistently large prompts, raise GEMINI_PLUGIN_CC_PROMPT_TIMEOUT_MS."
            }
          )
        );
      });
    }, wallClockMs);
    wallTimer.unref?.();

    proc.on?.("error", (err) => {
      finishWith(() => {
        if (err?.code === "ENOENT") {
          reject(
            new AgyConnectionError(
              "agy binary not found on PATH.",
              {
                suggestion:
                  "Install Antigravity CLI from https://antigravity.google then run `agy --version`.",
                cause: err
              }
            )
          );
          return;
        }
        reject(
          new AgyConnectionError(`failed to spawn agy: ${err?.message ?? String(err)}`, {
            cause: err
          })
        );
      });
    });

    proc.on?.("exit", (code, signal) => {
      finishWith(() => {
        if (code !== 0) {
          reject(errorForExit({ code, signal, stdout, stderr, model }));
          return;
        }
        const result = parseJsonResult(stdout);
        const response = typeof result.response === "string" ? result.response : "";
        let text = response;
        if (result.structured_output != null) {
          text = JSON.stringify(result.structured_output);
        } else if (jsonSchema) {
          text = "";
        }
        const timedOut = PRINT_TIMEOUT_MARKER.test(stderr);
        const usage = result.usage ?? null;
        resolve({
          stopReason: timedOut ? "timeout" : "end_turn",
          text,
          response,
          model: model ?? null,
          // A timed-out run reports all-zero usage, which is not real data.
          tokens: usage && usage.total_tokens > 0 ? usage : null,
          deniedActions: Array.isArray(result.denied_actions) ? result.denied_actions : [],
          timedOut,
          agentVersion
        });
      });
    });
  });
}
