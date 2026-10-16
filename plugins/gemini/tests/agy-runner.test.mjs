import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { Readable, Writable } from "node:stream";
import { runReview } from "../scripts/lib/agy-runner.mjs";
import {
  AgyAuthError,
  AgyConnectionError,
  AgyModelError,
  AgyQuotaError,
  AgyTimeoutError
} from "../scripts/lib/errors.mjs";

function makeFakeProc({ stdoutChunks = [], stderrChunks = [], exitCode = 0, exitDelayMs = 5, captureStdin = null } = {}) {
  const proc = new EventEmitter();
  const stdinWrites = [];
  proc.stdin = new Writable({
    write(chunk, _enc, cb) {
      stdinWrites.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk));
      cb();
    },
    final(cb) {
      if (captureStdin) captureStdin(stdinWrites.join(""));
      cb();
    }
  });
  proc.stdout = Readable.from(stdoutChunks);
  proc.stderr = Readable.from(stderrChunks);
  proc.kill = (sig) => {
    proc._killedWith = sig;
    setTimeout(() => proc.emit("exit", null, sig ?? "SIGTERM"), 1);
    return true;
  };
  setTimeout(() => proc.emit("exit", exitCode, null), exitDelayMs);
  return { proc, getStdin: () => stdinWrites.join("") };
}

function agyJson(fields = {}) {
  return JSON.stringify({
    conversation_id: "c-1",
    status: "SUCCESS",
    response: "",
    duration_seconds: 1,
    num_turns: 1,
    usage: { input_tokens: 10, output_tokens: 2, thinking_tokens: 0, cache_read_tokens: 0, total_tokens: 12 },
    ...fields
  });
}

function captureArgs(proc) {
  const captured = {};
  const spawnFn = (cmd, args, opts) => {
    Object.assign(captured, { cmd, args, opts });
    return proc;
  };
  return { captured, spawnFn };
}

const UNKNOWN_MODEL_STDERR = [
  'error: invalid model selection (--model "gemini-9-fake" --effort ""): model gemini-9-fake is not recognized as a known model or custom model in settings',
  "Available models:",
  "  Gemini 3.8 Flash (High)",
  "  Gemini 3.1 Pro (High)",
  "  Claude Opus 5.5 (Low)",
  ""
].join("\n");

test("passes json output, slash-command guard and the prompt as --flag=value args", async () => {
  const { proc } = makeFakeProc({ stdoutChunks: [agyJson({ response: "hello back\n" })] });
  const { captured, spawnFn } = captureArgs(proc);
  const result = await runReview({ prompt: "ping", cwd: "/tmp/xyz", spawnFn, promptTimeoutMs: 60_000 });
  assert.equal(captured.cmd, "agy");
  assert.deepEqual(captured.args, [
    "--output-format=json",
    "--disable-slash-commands",
    "--print=ping",
    "--print-timeout=60s"
  ]);
  assert.equal(captured.opts.cwd, "/tmp/xyz");
  // The prompt travels in argv; agy ignores stdin in print mode.
  assert.equal(captured.opts.stdio[0], "ignore");
  assert.equal(result.text, "hello back\n");
  assert.equal(result.response, "hello back\n");
  assert.equal(result.stopReason, "end_turn");
  assert.equal(result.timedOut, false);
  assert.deepEqual(result.deniedActions, []);
  assert.equal(result.model, null);
  assert.equal(result.tokens.input_tokens, 10);
  assert.equal(result.tokens.total_tokens, 12);
});

test("passes --model and --json-schema before --print", async () => {
  const { proc } = makeFakeProc({ stdoutChunks: [agyJson({ response: "ok" })] });
  const { captured, spawnFn } = captureArgs(proc);
  const result = await runReview({
    prompt: "x",
    model: "gemini-3.8-flash-high",
    jsonSchema: "/abs/schema.json",
    promptTimeoutMs: 60_000,
    spawnFn
  });
  assert.deepEqual(captured.args, [
    "--model=gemini-3.8-flash-high",
    "--output-format=json",
    "--disable-slash-commands",
    "--json-schema=/abs/schema.json",
    "--print=x",
    "--print-timeout=60s"
  ]);
  assert.equal(result.model, "gemini-3.8-flash-high");
});

test("rounds prompt-timeout up to the nearest second for agy's Go duration", async () => {
  const { proc } = makeFakeProc({ stdoutChunks: [agyJson({ response: "k" })] });
  const { captured, spawnFn } = captureArgs(proc);
  await runReview({ prompt: "x", promptTimeoutMs: 1500, spawnFn });
  assert.equal(captured.args.at(-1), "--print-timeout=2s");
});

test("default prompt timeout is 20 minutes", async () => {
  const { proc } = makeFakeProc({ stdoutChunks: [agyJson({ response: "k" })] });
  const { captured, spawnFn } = captureArgs(proc);
  await runReview({ prompt: "x", spawnFn });
  assert.equal(captured.args.at(-1), "--print-timeout=1200s");
});

test("with a schema, text is the serialized structured_output, never the response", async () => {
  const structured = { overall: "mixed", summary: "s", claims: [], reasoning_issues: [] };
  const { proc } = makeFakeProc({
    stdoutChunks: [
      agyJson({
        response: JSON.stringify({ ...structured, toolAction: "Finishing", toolSummary: "done" }),
        structured_output: structured
      })
    ]
  });
  const result = await runReview({ prompt: "x", jsonSchema: "/s.json", spawnFn: () => proc });
  assert.deepEqual(JSON.parse(result.text), structured);
  assert.match(result.response, /toolAction/);
});

test("with a schema but no structured_output, text is empty and response is kept", async () => {
  const { proc } = makeFakeProc({ stdoutChunks: [agyJson({ response: "partial prose" })] });
  const result = await runReview({ prompt: "x", jsonSchema: "/s.json", spawnFn: () => proc });
  assert.equal(result.text, "");
  assert.equal(result.response, "partial prose");
});

test("returns denied_actions when agy refuses a tool", async () => {
  const denied = [{ action: "read_url", display_name: "ReadUrlContent" }];
  const { proc } = makeFakeProc({
    stdoutChunks: [agyJson({ response: "", denied_actions: denied })],
    stderrChunks: ['jetski: no output produced, a tool required the "read_url" permission\n']
  });
  const result = await runReview({ prompt: "x", spawnFn: () => proc });
  assert.equal(result.text, "");
  assert.deepEqual(result.deniedActions, denied);
});

test("detects agy's print timeout marker and drops all-zero usage", async () => {
  const { proc } = makeFakeProc({
    stdoutChunks: [
      agyJson({
        response: "partial essay",
        duration_seconds: 0,
        usage: { input_tokens: 0, output_tokens: 0, thinking_tokens: 0, cache_read_tokens: 0, total_tokens: 0 }
      })
    ],
    stderrChunks: ["[agy] print timeout after 3s with turn in progress; returning partial output\n"]
  });
  const result = await runReview({ prompt: "x", spawnFn: () => proc });
  assert.equal(result.timedOut, true);
  assert.equal(result.stopReason, "timeout");
  assert.equal(result.text, "partial essay");
  assert.equal(result.tokens, null);
});

test("falls back to raw stdout when it is not JSON", async () => {
  const { proc } = makeFakeProc({ stdoutChunks: ["part-1 ", "part-2"] });
  const result = await runReview({ prompt: "x", spawnFn: () => proc });
  assert.equal(result.text, "part-1 part-2");
  assert.equal(result.tokens, null);
});

test("nonzero exit throws AgyConnectionError with stderr in the message", async () => {
  const { proc } = makeFakeProc({
    stderrChunks: ["transient backend error: 503\n"],
    exitCode: 1
  });
  await assert.rejects(
    () => runReview({ prompt: "x", spawnFn: () => proc }),
    (err) => err instanceof AgyConnectionError && /503/.test(err.message)
  );
});

test("nonzero exit with auth-shaped stderr throws AgyAuthError", async () => {
  const { proc } = makeFakeProc({
    stderrChunks: ["fatal: not signed in\n"],
    exitCode: 1
  });
  await assert.rejects(
    () => runReview({ prompt: "x", spawnFn: () => proc }),
    (err) => err instanceof AgyAuthError && /not signed in/.test(err.message)
  );
});

test("AGY_ERROR line is used before word matching", async () => {
  // "login" in the message would match the auth word list if checked first.
  const line = 'AGY_ERROR: {"status":"UNAVAILABLE","code":503,"retryable":true,"error_id":"e-1","message":"login service busy"}';
  const { proc } = makeFakeProc({ stderrChunks: [`some log\n${line}\n`], exitCode: 3 });
  await assert.rejects(
    () => runReview({ prompt: "x", spawnFn: () => proc }),
    (err) =>
      err instanceof AgyConnectionError &&
      !(err instanceof AgyAuthError) &&
      /exit 3/.test(err.message) &&
      /UNAVAILABLE/.test(err.message) &&
      /e-1/.test(err.message)
  );
});

test("AGY_ERROR with UNAUTHENTICATED status throws AgyAuthError", async () => {
  const { proc } = makeFakeProc({
    stderrChunks: ['AGY_ERROR: {"status":"UNAUTHENTICATED","code":401,"retryable":false}\n'],
    exitCode: 3
  });
  await assert.rejects(
    () => runReview({ prompt: "x", spawnFn: () => proc }),
    (err) => err instanceof AgyAuthError
  );
});

test("unknown model throws AgyModelError pointing at agy models, never an auth error", async () => {
  const { proc } = makeFakeProc({
    stdoutChunks: [agyJson({ status: "ERROR", error: UNKNOWN_MODEL_STDERR })],
    stderrChunks: [UNKNOWN_MODEL_STDERR],
    exitCode: 1
  });
  await assert.rejects(
    () => runReview({ prompt: "x", model: "gemini-9-fake", spawnFn: () => proc }),
    (err) =>
      err instanceof AgyModelError &&
      /gemini-9-fake/.test(err.message) &&
      /agy models/.test(err.suggestion)
  );
});

test("unknown model is detected from the JSON error when stderr is empty", async () => {
  const { proc } = makeFakeProc({
    stdoutChunks: [agyJson({ status: "ERROR", error: UNKNOWN_MODEL_STDERR })],
    exitCode: 1
  });
  await assert.rejects(
    () => runReview({ prompt: "x", model: "gemini-9-fake", spawnFn: () => proc }),
    AgyModelError
  );
});

test("AGY_ERROR with RESOURCE_EXHAUSTED throws AgyQuotaError naming the model", async () => {
  const { proc } = makeFakeProc({
    stderrChunks: ['AGY_ERROR: {"status":"RESOURCE_EXHAUSTED","code":429,"retryable":false,"message":"Individual quota reached"}\n'],
    exitCode: 3
  });
  await assert.rejects(
    () => runReview({ prompt: "x", model: "gemini-4-argon-high", spawnFn: () => proc }),
    (err) =>
      err instanceof AgyQuotaError &&
      /gemini-4-argon-high/.test(err.message) &&
      /agy -p \/usage/.test(err.suggestion)
  );
});

test("a quota message that says 'sign in' is a quota error, not a sign-in error", async () => {
  const text = "You have reached your Gemini 4 Argon quota. Sign in with an Ultra plan for more.";
  const { proc } = makeFakeProc({ stdoutChunks: [agyJson({ status: "ERROR", error: text })], stderrChunks: [text], exitCode: 1 });
  await assert.rejects(
    () => runReview({ prompt: "x", model: "gemini-4-argon-high", spawnFn: () => proc }),
    AgyQuotaError
  );
});

test("AGY_ERROR UNAUTHENTICATED stays a sign-in error even if it mentions a quota", async () => {
  const { proc } = makeFakeProc({
    stderrChunks: ['AGY_ERROR: {"status":"UNAUTHENTICATED","code":401,"message":"token expired; quota unknown"}\n'],
    exitCode: 3
  });
  await assert.rejects(() => runReview({ prompt: "x", spawnFn: () => proc }), AgyAuthError);
});

test("AGY_ERROR with code 429 throws AgyQuotaError", async () => {
  const { proc } = makeFakeProc({
    stderrChunks: ['AGY_ERROR: {"status":"UNKNOWN","code":429,"message":"Too many requests"}\n'],
    exitCode: 3
  });
  await assert.rejects(() => runReview({ prompt: "x", spawnFn: () => proc }), AgyQuotaError);
});

for (const text of [
  "Individual quota reached for Gemini 4 Argon.",
  "You have exceeded your weekly limit.",
  "Rate limit exceeded, retry later.",
  "Your quota has been exhausted.",
  "You ran out of quota for this week."
]) {
  test(`plain text that says the limit is used up is a quota error: ${text}`, async () => {
    const { proc } = makeFakeProc({ stderrChunks: [text], exitCode: 1 });
    await assert.rejects(() => runReview({ prompt: "x", spawnFn: () => proc }), AgyQuotaError);
  });
}

test("an error that only mentions quota is not a quota error: not signed in stays a sign-in error", async () => {
  const { proc } = makeFakeProc({ stderrChunks: ["fatal: not signed in; cannot check quota"], exitCode: 1 });
  await assert.rejects(() => runReview({ prompt: "x", spawnFn: () => proc }), AgyAuthError);
});

for (const message of ["quota service unavailable", "quota service could not be reached"]) {
  test(`AGY_ERROR UNAVAILABLE "${message}" is a connection error, not a quota error`, async () => {
    const { proc } = makeFakeProc({
      stderrChunks: [`AGY_ERROR: {"status":"UNAVAILABLE","code":503,"message":"${message}"}\n`],
      exitCode: 3
    });
    await assert.rejects(
      () => runReview({ prompt: "x", spawnFn: () => proc }),
      (err) => err instanceof AgyConnectionError && !(err instanceof AgyQuotaError)
    );
  });
}

test("plain 'not signed in; quota service could not be reached' stays a sign-in error", async () => {
  const { proc } = makeFakeProc({ stderrChunks: ["not signed in; quota service could not be reached"], exitCode: 1 });
  await assert.rejects(() => runReview({ prompt: "x", spawnFn: () => proc }), AgyAuthError);
});

test("ENOENT on spawn throws AgyConnectionError suggesting agy install", async () => {
  const proc = new EventEmitter();
  proc.stdin = new Writable({ write: (_c, _e, cb) => cb() });
  proc.stdout = Readable.from([]);
  proc.stderr = Readable.from([]);
  proc.kill = () => true;
  setTimeout(() => {
    const err = new Error("spawn agy ENOENT");
    err.code = "ENOENT";
    proc.emit("error", err);
  }, 1);
  await assert.rejects(
    () => runReview({ prompt: "x", spawnFn: () => proc }),
    (err) => err instanceof AgyConnectionError && /agy/i.test(err.message)
  );
});

test("wall-clock timer runs 30s past agy's --print-timeout, then kills", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const proc = new EventEmitter();
  let killed;
  proc.stdin = new Writable({ write: (_c, _e, cb) => cb() });
  proc.stdout = Readable.from([]);
  proc.stderr = Readable.from([]);
  proc.kill = (sig) => {
    killed = sig;
    return true;
  };
  let error;
  const pending = runReview({ prompt: "x", spawnFn: () => proc, promptTimeoutMs: 1000 }).catch(
    (err) => (error = err)
  );
  t.mock.timers.tick(30_999);
  await Promise.resolve();
  assert.equal(killed, undefined);
  t.mock.timers.tick(1);
  await pending;
  assert.ok(error instanceof AgyTimeoutError);
  assert.equal(killed, "SIGTERM");
});

test("agentVersion is passed through", async () => {
  const { proc } = makeFakeProc({ stdoutChunks: [agyJson({ response: "ok" })] });
  const result = await runReview({ prompt: "x", agentVersion: "1.3.3", spawnFn: () => proc });
  assert.equal(result.agentVersion, "1.3.3");
});

test("missing prompt throws synchronously", () => {
  assert.throws(() => runReview({ prompt: "", spawnFn: () => null }));
});
