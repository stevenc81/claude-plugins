import { spawn as nodeSpawn } from "node:child_process";
import fs from "node:fs";
import process from "node:process";
import {
  AgyAuthError,
  AgyConnectionError,
  AgyInterruptedError,
  AgyModelError,
  AgyQuotaError,
  AgyTimeoutError,
  ConfigError
} from "./errors.mjs";

export const DEFAULT_PROMPT_TIMEOUT_MS = 1_200_000;
// What a caller of the slash commands can do about a time limit: they run in
// the foreground with 9 minutes and in the background with the default 20.
export const TIMEOUT_HINT =
  "If it ran in the foreground (9 minutes), run it with --background (20 minutes). Otherwise split the job into smaller parts.";
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

// A usable `result` event payload: an object with a string response and a
// conversation ID. Anything else means agy changed its output.
function isValidResult(result) {
  return (
    result != null &&
    typeof result === "object" &&
    !Array.isArray(result) &&
    typeof result.response === "string" &&
    typeof result.conversation_id === "string" &&
    result.conversation_id !== ""
  );
}

// True when the hook has logged a denial. The log is new for each run, and
// agy does not list hook denials in the result.
function hookDenied(denialLog) {
  try {
    return Boolean(denialLog) && fs.statSync(denialLog).size > 0;
  } catch {
    return false;
  }
}

// The reply that each part of a long prompt asks for.
export const PART_ACK = "OK";
const ACK_PATTERN = new RegExp(String.raw`^${PART_ACK}\s*\.?$`, "i");
const COMPACTED_SUGGESTION = "Send less text: split the job into several asks, or attach the input with --file for lookups.";

// Why a part was not taken in, or null when it was: a plain success that says
// PART_ACK (in any case, with spaces or a final period), with no refused tool
// and nothing in the hook's log.
function partProblem(result, denialLog) {
  if (!isValidResult(result)) return `agy sent no valid result (got ${JSON.stringify(result ?? null).slice(0, 100)})`;
  if (result.status !== "SUCCESS") return `status ${result.status}`;
  const denied = Array.isArray(result.denied_actions) ? result.denied_actions.length : 0;
  if (denied > 0) return `agy refused ${denied} tools`;
  if (hookDenied(denialLog)) return "the hook denied a tool call";
  const reply = result.response.trim();
  if (!ACK_PATTERN.test(reply)) return `Gemini replied ${JSON.stringify(reply.slice(0, 100))} instead of ${PART_ACK}`;
  return null;
}

function quotaError(detail, model) {
  return new AgyQuotaError(`agy has no quota left for "${model ?? "(default)"}": ${detail}`, {
    suggestion: "Run `agy -p /usage` to see when the quota resets, or use another model."
  });
}

function errorForExit({ code, signal, result, plain, stderr, model }) {
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

  const resultError = typeof result?.error === "string" ? result.error : "";
  // Both stderr and the result's error, so that unrelated stderr, such as a
  // warning, cannot hide the error.
  const detail = [stderr.trim(), resultError].filter(Boolean).join("; ") || plain.trim() || `exit ${code ?? signal}`;
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
  return new AgyConnectionError(`agy failed (${code ?? signal}): ${detail}`, {
    suggestion:
      "Verify `agy --version` works and you are signed in. Rerun with GEMINI_PLUGIN_CC_DEBUG=1 for details."
  });
}

/**
 * Run a single prompt through the Antigravity CLI in print mode and return the
 * parsed result. The prompt travels on stdin as one stream-json `user`
 * message, so it is not in argv: `ps` cannot see it, and no argv size limit
 * applies. stdin is then closed, which ends the session after that one turn.
 * All flags use the `--flag=value` form so Go's flag parser can never consume
 * a neighbouring flag as a value.
 *
 * agy writes one JSON event per line. The last `result` event holds the
 * answer, usage, refused tools and the conversation ID. When `jsonSchema` is
 * set, `text` is the serialized `structured_output`; agy's `response` can
 * carry stray keys in that mode, so it is only returned as `response` for
 * display. `--disable-slash-commands` keeps a prompt that starts with `/` from
 * being run as a local agy command. Each `addDirs` entry becomes `--add-dir`,
 * which lets agy's file tool read that folder. `conversationId` continues an
 * earlier conversation with `--conversation`.
 *
 * `parts` are messages sent before the prompt, each in its own turn of the
 * same session, for a prompt too long for one message. Each part is sent
 * after the `result` of the one before it, and must come back as PART_ACK
 * (see partProblem), with nothing new in the hook's `denialLog`; otherwise
 * nothing more is sent and the run fails with an error that names the part.
 * stdin closes after the prompt. agy's usage in the last `result` covers the
 * whole session. agy applies `--json-schema` to every turn of a session, so a
 * part would come back as JSON, not PART_ACK. With `jsonSchema`, the parts
 * therefore go in a session without it, and the prompt then goes with it into
 * the same conversation (`--conversation`), in the time that is left. The
 * result's usage is then the second session's.
 * When the session grows past agy's compaction threshold, agy replaces the
 * earlier turns with a summary (a `checkpoint` step). Gemini then no longer
 * has the whole input, so a session with parts that compacts fails too. Any
 * run fails when an `error_message` step comes before the compaction, or when
 * a compacted run ends with an empty answer: in October 2026, a 28 MB video
 * gave an empty model turn, an error step and a compaction, and the model then
 * lost the task and answered "I am ready and listening". Other runs that
 * compact return `compacted: true`.
 *
 * `searches` counts the `search_web` tool steps once each: agy streams a step
 * as ACTIVE and then as DONE or ERROR, with the same step index.
 *
 * On SIGTERM or SIGINT, and at the hard time limit, the runner stops the agy
 * child and waits until it has exited (SIGKILL after a short grace time)
 * before it rejects, so the caller removes the temp folder only after agy is
 * gone.
 *
 * A run that hits agy's `--print-timeout` still exits 0 with partial output;
 * the stderr marker is the only reliable signal, surfaced as `timedOut`.
 */
export function runReview(options = {}) {
  if (!options.prompt) {
    throw new AgyConnectionError("runReview requires a non-empty prompt.");
  }
  return options.parts?.length > 0 && options.jsonSchema ? runPartsThenSchema(options) : runSession(options);
}

async function runPartsThenSchema({ parts, promptTimeoutMs = DEFAULT_PROMPT_TIMEOUT_MS, ...options }) {
  const deadline = Date.now() + promptTimeoutMs;
  const ingest = await runSession({
    ...options,
    prompt: parts.at(-1),
    parts: parts.slice(0, -1),
    jsonSchema: null,
    promptTimeoutMs,
    promptIsPart: true
  });
  const leftMs = deadline - Date.now();
  if (leftMs <= 0) {
    throw new AgyTimeoutError(`agy used its whole time limit (${secondsForGoDuration(promptTimeoutMs)}) on the parts, before the question.`, {
      suggestion: TIMEOUT_HINT
    });
  }
  const result = await runSession({ ...options, conversationId: ingest.conversationId, promptTimeoutMs: leftMs });
  if (result.conversationId !== ingest.conversationId) {
    throw new AgyConnectionError(
      `agy answered the question in conversation ${result.conversationId}, not in ${ingest.conversationId}, which holds the parts.`,
      { suggestion: "Rerun the ask." }
    );
  }
  if (result.compacted) {
    throw new ConfigError(`agy compacted the conversation at the question, after all ${parts.length} parts, so Gemini no longer had the whole input.`, {
      suggestion: COMPACTED_SUGGESTION
    });
  }
  return result;
}

// One agy session: the parts, then the prompt. With `promptIsPart`, the prompt
// is the last part, and must come back as PART_ACK too.
function runSession({
  prompt,
  cwd = process.cwd(),
  promptTimeoutMs = DEFAULT_PROMPT_TIMEOUT_MS,
  agentVersion = null,
  model = null,
  jsonSchema = null,
  addDirs = [],
  conversationId = null,
  parts = [],
  denialLog = null,
  promptIsPart = false,
  spawnFn = nodeSpawn
}) {
  const args = [];
  if (model) args.push(`--model=${model}`);
  for (const dir of addDirs) args.push(`--add-dir=${dir}`);
  if (conversationId) args.push(`--conversation=${conversationId}`);
  args.push("--input-format=stream-json", "--output-format=stream-json", "--disable-slash-commands");
  if (jsonSchema) args.push(`--json-schema=${jsonSchema}`);
  args.push(`--print-timeout=${secondsForGoDuration(promptTimeoutMs)}`);
  const proc = spawnFn("agy", args, { cwd, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  const wallClockMs = promptTimeoutMs + WALL_CLOCK_GRACE_MS;

  return new Promise((resolve, reject) => {
    let settled = false;
    let result; // the payload of the last `result` event, not yet checked
    let plain = ""; // stdout lines that are not JSON, for error messages
    let partLine = ""; // the end of stdout that has no newline yet
    let stderr = "";
    const messages = [...parts, prompt];
    const acks = promptIsPart ? messages.length : parts.length; // messages that must come back as PART_ACK
    let sent = 0;
    let answered = 0; // result events so far, one per message
    let compacted = false;
    let errorStep = false; // an error_message step so far
    let lostTask = false; // an error_message step came before a compaction
    const searchSteps = new Map(); // step key -> last state of a search_web step

    // stdin closes after the last message, which ends the session after its turn.
    const sendNext = () => {
      const line = JSON.stringify({ event: "user", message: { role: "user", content: messages[sent] } }) + "\n";
      sent += 1;
      if (sent === messages.length) proc.stdin?.end?.(line);
      else proc.stdin?.write?.(line);
    };

    const readLine = (line) => {
      if (!line.trim()) return;
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        plain += `${line}\n`;
        return;
      }
      const step = event?.event === "step_update" ? event.step_update : null;
      if (step?.step_type === "error_message") errorStep = true;
      if (step?.step_type === "checkpoint") {
        compacted = true;
        if (errorStep) lostTask = true;
      }
      if (step?.step_type === "tool" && step.tool_name === "search_web") {
        searchSteps.set(`${step.conversation_id}:${step.step_index}`, step.state);
      }
      if (event?.event !== "result") return;
      result = event.result;
      answered += 1;
      if (answered < messages.length) {
        if (!partProblem(result, denialLog) && !compacted) sendNext();
        else proc.stdin?.end?.();
      }
    };

    proc.stdout?.setEncoding?.("utf8");
    proc.stderr?.setEncoding?.("utf8");

    // A chunk can end inside an event, or hold several events.
    proc.stdout?.on("data", (chunk) => {
      const lines = (partLine + (typeof chunk === "string" ? chunk : chunk.toString("utf8"))).split("\n");
      partLine = lines.pop();
      lines.forEach(readLine);
    });
    proc.stderr?.on("data", (chunk) => {
      stderr += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    });

    let stopError = null; // set once the run is being stopped
    let killTimer;
    let giveUpTimer;
    const onSignal = (sig) => stop(new AgyInterruptedError(`Stopped by ${sig}.`), sig);
    const signals = ["SIGTERM", "SIGINT"];

    const finishWith = (cb) => {
      if (settled) return;
      settled = true;
      clearTimeout(wallTimer);
      clearTimeout(killTimer);
      clearTimeout(giveUpTimer);
      for (const sig of signals) process.off(sig, onSignal);
      cb();
    };

    // Ends the run with `err` once the child has exited. SIGKILL follows after
    // SIGKILL_GRACE_MS, and the run rejects anyway after twice that, in case
    // no close event ever comes.
    const stop = (err, sig = "SIGTERM") => {
      if (settled || stopError) return;
      stopError = err;
      clearTimeout(wallTimer);
      try {
        proc.kill?.(sig);
      } catch {
        /* already gone */
      }
      killTimer = setTimeout(() => {
        try {
          proc.kill?.("SIGKILL");
        } catch {
          /* already gone */
        }
      }, SIGKILL_GRACE_MS);
      giveUpTimer = setTimeout(() => finishWith(() => reject(err)), 2 * SIGKILL_GRACE_MS);
    };
    for (const sig of signals) process.once(sig, onSignal);

    const wallTimer = setTimeout(() => {
      stop(
        new AgyTimeoutError(`agy did not finish within ${wallClockMs}ms.`, {
          suggestion: "Retry. For consistently large prompts, raise GEMINI_PLUGIN_CC_PROMPT_TIMEOUT_MS."
        })
      );
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

    // "close" comes after stdout and stderr are drained; "exit" can come before.
    proc.on?.("close", (code, signal) => {
      finishWith(() => {
        if (stopError) {
          reject(stopError);
          return;
        }
        readLine(partLine);
        if (code !== 0) {
          reject(errorForExit({ code, signal, result, plain, stderr, model }));
          return;
        }
        if (compacted && acks > 0) {
          reject(
            new ConfigError(
              `agy compacted the conversation by message ${answered} of ${messages.length}, so Gemini no longer had the whole input.`,
              { suggestion: COMPACTED_SUGGESTION }
            )
          );
          return;
        }
        // A turn that ended with status ERROR fails also on exit 0, so that a
        // quota or model error keeps its class. agy 1.4.3 ends a timed-out turn
        // with status SUCCESS; only the stderr marker tells (timedOut below).
        if (result?.status === "ERROR") {
          reject(errorForExit({ code, signal, result, plain, stderr, model }));
          return;
        }
        // The last result is a part's: it was not taken in, or agy stopped
        // before the next message.
        if (answered > 0 && (answered < messages.length || promptIsPart)) {
          const problem = partProblem(result, denialLog);
          const err = stderr.trim() ? ` (stderr: ${stderr.trim()})` : "";
          const next = answered < acks ? "the next part" : "the question";
          if (problem || answered < messages.length) {
            reject(
              new AgyConnectionError(
                problem
                  ? `Part ${answered} of ${acks} was not taken in: ${problem}${err}.`
                  : `agy stopped after part ${answered} of ${acks}, before ${next}${err}.`,
                { suggestion: `Rerun the ask. Each part must come back as ${PART_ACK} before the next message is sent.` }
              )
            );
            return;
          }
        }
        if (!isValidResult(result)) {
          const got = result === undefined ? "" : ` (got ${JSON.stringify(result).slice(0, 200)})`;
          const detail = stderr.trim() || plain.trim() || "no output";
          reject(
            new AgyConnectionError(`agy exited without a valid result${got}: ${detail}`, {
              suggestion:
                "The agy command line may have changed. Compare `agy --help` with the flags in scripts/lib/agy-runner.mjs."
            })
          );
          return;
        }
        const response = result.response;
        // With a schema, the answer is structured_output, and the response may be empty.
        const hasAnswer = jsonSchema ? Object.hasOwn(result, "structured_output") : response.trim() !== "";
        const timedOut = PRINT_TIMEOUT_MARKER.test(stderr);
        const limit = timedOut ? ` agy also hit its time limit (${secondsForGoDuration(promptTimeoutMs)}).` : "";
        // Checked before the timeout below: a lost task is the likelier cause.
        if (compacted && (lostTask || !hasAnswer)) {
          reject(
            new AgyConnectionError(
              `agy compacted the conversation after ${lostTask ? "an error step" : "a turn"}, and the answer ${response.trim() ? `may not fit the task: ${JSON.stringify(response).slice(0, 120)}` : "is empty"}.${limit}`,
              {
                suggestion:
                  "The model most likely lost the task. A media file that is too large does this: pass a smaller or shorter file, or less text."
              }
            )
          );
          return;
        }
        // A partial answer comes back with timedOut; no text at all is an error.
        if (timedOut && response.trim() === "" && !Object.hasOwn(result, "structured_output")) {
          reject(
            new AgyTimeoutError(`agy hit its time limit (${secondsForGoDuration(promptTimeoutMs)}) before Gemini wrote any answer.`, {
              suggestion: TIMEOUT_HINT
            })
          );
          return;
        }
        let text = response;
        // JSON null, false, 0 and "" are answers too; only a missing field is none.
        if (Object.hasOwn(result, "structured_output")) {
          text = JSON.stringify(result.structured_output);
        } else if (jsonSchema) {
          text = "";
        }
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
          conversationId: result.conversation_id,
          compacted,
          searches: {
            attempted: searchSteps.size,
            succeeded: [...searchSteps.values()].filter((state) => state === "DONE").length
          },
          agentVersion
        });
      });
    });

    // A child that exits before it reads its input (a failed start) closes the
    // pipe, and the write fails with EPIPE. The exit code and stderr explain
    // that failure, so the write error itself is ignored.
    proc.stdin?.on?.("error", () => {});
    sendNext();
  });
}
