import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PassThrough, Readable, Writable } from "node:stream";
import { runReview } from "../scripts/lib/agy-runner.mjs";
import {
  AgyAuthError,
  AgyConnectionError,
  AgyModelError,
  AgyQuotaError,
  AgyTimeoutError,
  ConfigError
} from "../scripts/lib/errors.mjs";

// A fake agy child. It emits "exit" and then "close", as Node does once
// stdout and stderr are drained. `stdinError` makes every stdin write fail.
function makeFakeProc({ stdoutChunks = [], stderrChunks = [], exitCode = 0, exitDelayMs = 5, stdinError = null } = {}) {
  const proc = new EventEmitter();
  const stdinWrites = [];
  let stdinEnded = false;
  proc.stdin = new Writable({
    write(chunk, _enc, cb) {
      if (stdinError) return cb(stdinError);
      stdinWrites.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk));
      cb();
    },
    final(cb) {
      stdinEnded = true;
      cb();
    }
  });
  proc.stdout = Readable.from(stdoutChunks);
  proc.stderr = Readable.from(stderrChunks);
  const end = (code, signal) => {
    proc.emit("exit", code, signal);
    proc.emit("close", code, signal);
  };
  proc.kill = (sig) => {
    proc._killedWith = sig;
    setTimeout(() => end(null, sig ?? "SIGTERM"), 1);
    return true;
  };
  setTimeout(() => end(exitCode, null), exitDelayMs);
  return { proc, getStdin: () => stdinWrites.join(""), stdinEnded: () => stdinEnded };
}

const INIT_EVENT = JSON.stringify({
  event: "init",
  conversation_id: "c-1",
  init: { model: "gemini-3.8-flash-low", tools: ["run_command", "search_web"], permission_mode: "request-review" }
});

function resultEvent(fields = {}) {
  return JSON.stringify({
    event: "result",
    result: {
      conversation_id: "c-1",
      status: "SUCCESS",
      response: "",
      duration_seconds: 1,
      num_turns: 1,
      usage: { input_tokens: 10, output_tokens: 2, thinking_tokens: 0, cache_read_tokens: 0, total_tokens: 12 },
      ...fields
    }
  });
}

// agy's stream-json stdout: one event per line, the result event last.
const agyStream = (fields) => `${INIT_EVENT}\n${resultEvent(fields)}\n`;

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

test("passes stream-json in and out, the slash-command guard and the timeout as --flag=value args, never the prompt", async () => {
  const { proc } = makeFakeProc({ stdoutChunks: [agyStream({ response: "hello back\n" })] });
  const { captured, spawnFn } = captureArgs(proc);
  const result = await runReview({ prompt: "ping", cwd: "/tmp/xyz", spawnFn, promptTimeoutMs: 60_000 });
  assert.equal(captured.cmd, "agy");
  assert.deepEqual(captured.args, [
    "--input-format=stream-json",
    "--output-format=stream-json",
    "--disable-slash-commands",
    "--print-timeout=60s"
  ]);
  assert.equal(captured.opts.cwd, "/tmp/xyz");
  assert.equal(captured.opts.stdio[0], "pipe");
  assert.equal(result.text, "hello back\n");
  assert.equal(result.response, "hello back\n");
  assert.equal(result.stopReason, "end_turn");
  assert.equal(result.timedOut, false);
  assert.deepEqual(result.deniedActions, []);
  assert.equal(result.model, null);
  assert.equal(result.conversationId, "c-1");
  assert.equal(result.tokens.input_tokens, 10);
  assert.equal(result.tokens.total_tokens, 12);
});

test("writes the prompt to stdin as one stream-json user message with the event field, then closes stdin", async () => {
  // Quotes, new lines, a marker-like line and non-ASCII text must survive as one line.
  const prompt = 'Say "hi".\nLine two: {"event":"user"}\nGEMINI_EOF_X\né中\u{1F600} end';
  const fake = makeFakeProc({ stdoutChunks: [agyStream({ response: "hi" })] });
  await runReview({ prompt, spawnFn: () => fake.proc });
  const sent = fake.getStdin();
  assert.ok(sent.endsWith("\n"));
  assert.equal(sent.split("\n").length, 2, "exactly one line");
  assert.deepEqual(JSON.parse(sent), { event: "user", message: { role: "user", content: prompt } });
  assert.ok(fake.stdinEnded(), "stdin is closed, so agy ends after one turn");
});

test("passes --model, --add-dir, --conversation and --json-schema before the stream flags and the timeout", async () => {
  const { proc } = makeFakeProc({ stdoutChunks: [agyStream({ response: "ok" })] });
  const { captured, spawnFn } = captureArgs(proc);
  const result = await runReview({
    prompt: "x",
    model: "gemini-3.8-flash-high",
    addDirs: ["/repo/a", "/other b"],
    conversationId: "c-1",
    jsonSchema: "/abs/schema.json",
    promptTimeoutMs: 60_000,
    spawnFn
  });
  assert.deepEqual(captured.args, [
    "--model=gemini-3.8-flash-high",
    "--add-dir=/repo/a",
    "--add-dir=/other b",
    "--conversation=c-1",
    "--input-format=stream-json",
    "--output-format=stream-json",
    "--disable-slash-commands",
    "--json-schema=/abs/schema.json",
    "--print-timeout=60s"
  ]);
  assert.equal(result.model, "gemini-3.8-flash-high");
});

test("rounds prompt-timeout up to the nearest second for agy's Go duration", async () => {
  const { proc } = makeFakeProc({ stdoutChunks: [agyStream({ response: "k" })] });
  const { captured, spawnFn } = captureArgs(proc);
  await runReview({ prompt: "x", promptTimeoutMs: 1500, spawnFn });
  assert.equal(captured.args.at(-1), "--print-timeout=2s");
});

test("default prompt timeout is 20 minutes", async () => {
  const { proc } = makeFakeProc({ stdoutChunks: [agyStream({ response: "k" })] });
  const { captured, spawnFn } = captureArgs(proc);
  await runReview({ prompt: "x", spawnFn });
  assert.equal(captured.args.at(-1), "--print-timeout=1200s");
});

test("the answer is the last result event, not the step events before it", async () => {
  // Shape from agy 1.4.3 (T4): text deltas in step_update events, then the result.
  const step = (i, text) =>
    JSON.stringify({ event: "step_update", step_update: { conversation_id: "c-9", step_index: i, state: "DONE", step_type: "agent_response", text_delta: text } });
  const { proc } = makeFakeProc({
    stdoutChunks: [`${INIT_EVENT}\n${step(1, "KI")}\n${step(2, "WI\n")}\n${resultEvent({ conversation_id: "c-9", response: "KIWI\n" })}\n`]
  });
  const result = await runReview({ prompt: "x", spawnFn: () => proc });
  assert.equal(result.text, "KIWI\n");
  assert.equal(result.conversationId, "c-9");
});

test("parses events split across chunks, several events in one chunk, and a last line with no newline", async () => {
  const line = resultEvent({ response: "Sé" });
  const cut = Math.floor(line.length / 2);
  const { proc } = makeFakeProc({
    stdoutChunks: [`${INIT_EVENT}\n${INIT_EVENT}`, "\n", line.slice(0, cut), line.slice(cut)]
  });
  const result = await runReview({ prompt: "x", spawnFn: () => proc });
  assert.equal(result.text, "Sé");
});

test("waits for stdout to close, so a result that arrives after exit is kept", async () => {
  const proc = new EventEmitter();
  proc.stdin = new Writable({ write: (_c, _e, cb) => cb() });
  proc.stdout = new PassThrough();
  proc.stderr = Readable.from([]);
  proc.kill = () => true;
  setTimeout(() => proc.emit("exit", 0, null), 1);
  setTimeout(() => proc.stdout.end(agyStream({ response: "late" })), 10);
  proc.stdout.on("end", () => setTimeout(() => proc.emit("close", 0, null), 1));
  const result = await runReview({ prompt: "x", spawnFn: () => proc });
  assert.equal(result.text, "late");
});

test("exit 0 without a valid last result event is an error that shows the output", async () => {
  const bad = (payload) => `${JSON.stringify({ event: "result", result: payload })}\n`;
  for (const stdoutChunks of [
    ["not json at all\n"],
    [`${INIT_EVENT}\n`],
    [bad("oops")],
    [bad([])],
    [bad(null)],
    [bad({ conversation_id: "c-1", response: null })],
    [bad({ response: "no ID" })],
    [bad({ conversation_id: "", response: "empty ID" })],
    // A bad result after a good one must not leave the good one selected.
    [agyStream({ response: "good" }), bad([])]
  ]) {
    const { proc } = makeFakeProc({ stdoutChunks });
    await assert.rejects(
      () => runReview({ prompt: "x", spawnFn: () => proc }),
      (err) => err instanceof AgyConnectionError && /without a valid result/.test(err.message),
      JSON.stringify(stdoutChunks)
    );
  }
  const { proc } = makeFakeProc({ stdoutChunks: ["not json at all\n"] });
  await assert.rejects(() => runReview({ prompt: "x", spawnFn: () => proc }), /not json at all/);
  const arr = makeFakeProc({ stdoutChunks: [bad([])] });
  await assert.rejects(() => runReview({ prompt: "x", spawnFn: () => arr.proc }), /\(got \[\]\)/);
});

test("a stdin write that fails (EPIPE) does not crash: the exit code and stderr decide the error", async () => {
  const epipe = Object.assign(new Error("write EPIPE"), { code: "EPIPE" });
  const { proc } = makeFakeProc({ stderrChunks: [UNKNOWN_MODEL_STDERR], exitCode: 1, stdinError: epipe });
  await assert.rejects(() => runReview({ prompt: "x", model: "gemini-9-fake", spawnFn: () => proc }), AgyModelError);

  const quiet = makeFakeProc({ exitCode: 0, stdinError: epipe });
  await assert.rejects(
    () => runReview({ prompt: "x", spawnFn: () => quiet.proc }),
    (err) => err instanceof AgyConnectionError && /without a valid result/.test(err.message)
  );
});

test("with a schema, text is the serialized structured_output, never the response", async () => {
  const structured = { overall: "mixed", summary: "s", claims: [], reasoning_issues: [] };
  const { proc } = makeFakeProc({
    stdoutChunks: [
      agyStream({
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
  const { proc } = makeFakeProc({ stdoutChunks: [agyStream({ response: "partial prose" })] });
  const result = await runReview({ prompt: "x", jsonSchema: "/s.json", spawnFn: () => proc });
  assert.equal(result.text, "");
  assert.equal(result.response, "partial prose");
});

test("returns denied_actions from the result event when agy refuses a tool", async () => {
  // Shape from agy 1.4.3 in stream mode (build test b3).
  const denied = [{ action: "read_file", display_name: "ReadFile" }];
  const { proc } = makeFakeProc({
    stdoutChunks: [agyStream({ response: "", denied_actions: denied })],
    stderrChunks: ['jetski: no output produced — a tool required the "read_file" permission\n']
  });
  const result = await runReview({ prompt: "x", spawnFn: () => proc });
  assert.equal(result.text, "");
  assert.deepEqual(result.deniedActions, denied);
});

test("detects agy's print timeout marker and drops all-zero usage", async () => {
  const { proc } = makeFakeProc({
    stdoutChunks: [
      agyStream({
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
    stdoutChunks: [agyStream({ status: "ERROR", error: UNKNOWN_MODEL_STDERR })],
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

test("unknown model is detected from the result event's error when stderr is empty", async () => {
  const { proc } = makeFakeProc({
    stdoutChunks: [agyStream({ status: "ERROR", error: UNKNOWN_MODEL_STDERR })],
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
  const { proc } = makeFakeProc({ stdoutChunks: [agyStream({ status: "ERROR", error: text })], stderrChunks: [text], exitCode: 1 });
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
  const { proc } = makeFakeProc({ stdoutChunks: [agyStream({ response: "ok" })] });
  const result = await runReview({ prompt: "x", agentVersion: "1.3.3", spawnFn: () => proc });
  assert.equal(result.agentVersion, "1.3.3");
});

test("missing prompt throws synchronously", () => {
  assert.throws(() => runReview({ prompt: "", spawnFn: () => null }));
});

// A fake agy session: it answers each stdin message with the next reply as a
// result event, and closes once stdin is closed. `whenReplying` records how
// many messages it had when it answered each one. A message number in
// `compactAt` gets a checkpoint step before its result, as agy writes when it
// compacts the conversation.
function makeSessionProc(replies, { exitCode = 0, compactAt = null, onMessage = null } = {}) {
  const proc = new EventEmitter();
  const received = [];
  const whenReplying = [];
  let pending = "";
  proc.stdout = new PassThrough();
  proc.stderr = Readable.from([]);
  proc.stdin = new Writable({
    write(chunk, _enc, cb) {
      pending += chunk.toString("utf8");
      let n;
      while ((n = pending.indexOf("\n")) >= 0) {
        received.push(JSON.parse(pending.slice(0, n)).message.content);
        pending = pending.slice(n + 1);
        onMessage?.(received.length);
        const reply = replies[received.length - 1];
        if (reply !== undefined) {
          setTimeout(() => {
            whenReplying.push(received.length);
            if (received.length === compactAt) {
              // Shape from agy 1.4.3 (build test b10, a manual /compact).
              const step = { conversation_id: "c-1", step_index: 9, state: "DONE", step_type: "checkpoint", duration_seconds: 4.8 };
              proc.stdout.write(`${JSON.stringify({ event: "step_update", step_update: step })}\n`);
            }
            proc.stdout.write(`${JSON.stringify({ event: "result", result: reply })}\n`);
          }, 2);
        }
      }
      cb();
    },
    final(cb) {
      setTimeout(() => proc.stdout.end(), 10);
      cb();
    }
  });
  proc.stdout.on("end", () => setTimeout(() => proc.emit("close", exitCode, null), 1));
  proc.kill = () => true;
  return { proc, received, whenReplying };
}

const okReply = (fields = {}) => ({ conversation_id: "c-1", status: "SUCCESS", response: "OK\n", ...fields });

test("parts go one per turn, each after the result of the one before, then the prompt, in one process", async () => {
  const session = makeSessionProc([
    okReply(),
    okReply({ response: "Ok." }),
    okReply({ response: "ALPHA, BRAVO\n", usage: { input_tokens: 900, output_tokens: 5, total_tokens: 905 } })
  ]);
  let spawns = 0;
  const result = await runReview({
    prompt: "question",
    parts: ["part one", "part two"],
    spawnFn: () => {
      spawns += 1;
      return session.proc;
    }
  });
  assert.equal(spawns, 1);
  assert.deepEqual(session.received, ["part one", "part two", "question"]);
  assert.deepEqual(session.whenReplying, [1, 2, 3], "the next message waits for the result before it");
  assert.equal(result.text, "ALPHA, BRAVO\n");
  assert.equal(result.tokens.input_tokens, 900, "usage comes from the last result");
});

test("a part that does not come back as a plain success stops the run: nothing more is sent", async () => {
  for (const [name, bad] of [
    ["empty response", okReply({ response: "" })],
    ["refused tool", okReply({ response: "OK", denied_actions: [{ action: "read_file" }] })],
    ["no conversation ID", { status: "SUCCESS", response: "OK" }]
  ]) {
    const session = makeSessionProc([okReply(), bad, okReply(), okReply()]);
    await assert.rejects(
      () => runReview({ prompt: "q", parts: ["p1", "p2", "p3"], spawnFn: () => session.proc }),
      (err) => err instanceof AgyConnectionError && /stopped after message 2 of 4/.test(err.message),
      name
    );
    assert.deepEqual(session.received, ["p1", "p2"], name);
  }
});

test("an error result in the middle of the parts keeps its quota classification", async () => {
  const session = makeSessionProc([
    okReply(),
    { conversation_id: "c-1", status: "ERROR", response: "", error: "Individual quota reached for Gemini 4 Argon." }
  ]);
  await assert.rejects(
    () => runReview({ prompt: "q", parts: ["p1", "p2", "p3"], model: "gemini-4-argon-low", spawnFn: () => session.proc }),
    AgyQuotaError
  );
  assert.deepEqual(session.received, ["p1", "p2"]);
});

test("agy that closes after the parts without answering the prompt is an error", async () => {
  const session = makeSessionProc([okReply(), okReply()]);
  await assert.rejects(
    () => runReview({ prompt: "q", parts: ["p1", "p2"], spawnFn: () => session.proc }),
    /stopped after message 2 of 3/
  );
});

test("with a conversation ID, the parts and the prompt go into that conversation", async () => {
  const session = makeSessionProc([okReply({ conversation_id: "c-7" }), okReply({ conversation_id: "c-7", response: "done" })]);
  const { captured, spawnFn } = captureArgs(session.proc);
  const result = await runReview({ prompt: "q", parts: ["p1"], conversationId: "c-7", spawnFn });
  assert.ok(captured.args.includes("--conversation=c-7"));
  assert.deepEqual(session.received, ["p1", "q"]);
  assert.equal(result.conversationId, "c-7");
  assert.equal(result.text, "done");
});

test("a session with parts that agy compacts fails, and nothing more is sent", async () => {
  const session = makeSessionProc([okReply(), okReply(), okReply(), okReply()], { compactAt: 2 });
  await assert.rejects(
    () => runReview({ prompt: "q", parts: ["p1", "p2", "p3"], spawnFn: () => session.proc }),
    (err) => err instanceof ConfigError && /compacted the conversation by message 2 of 4/.test(err.message)
  );
  assert.deepEqual(session.received, ["p1", "p2"]);
});

test("a single message whose turn compacts still returns its answer", async () => {
  const session = makeSessionProc([okReply({ response: "answer after a long research turn" })], { compactAt: 1 });
  const result = await runReview({ prompt: "q", spawnFn: () => session.proc });
  assert.equal(result.text, "answer after a long research turn");
});

test("a part whose turn the hook denied a tool in stops the run, though agy reports success", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agy-runner-denials-"));
  const denialLog = path.join(dir, "denied.jsonl");
  try {
    // The hook writes the log during the turn; agy's result still says SUCCESS
    // with no denied_actions (build test b5).
    const session = makeSessionProc([okReply(), okReply(), okReply()], {
      onMessage: (n) => n === 1 && fs.appendFileSync(denialLog, '{"action":"invoke_subagent"}\n')
    });
    await assert.rejects(
      () => runReview({ prompt: "q", parts: ["p1", "p2"], denialLog, spawnFn: () => session.proc }),
      (err) => err instanceof AgyConnectionError && /stopped after message 1 of 3/.test(err.message) && /hook denied/.test(err.message)
    );
    assert.deepEqual(session.received, ["p1"]);

    // With an empty log, the same parts go through.
    fs.rmSync(denialLog);
    const clean = makeSessionProc([okReply(), okReply(), okReply({ response: "done" })]);
    const result = await runReview({ prompt: "q", parts: ["p1", "p2"], denialLog, spawnFn: () => clean.proc });
    assert.equal(result.text, "done");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
