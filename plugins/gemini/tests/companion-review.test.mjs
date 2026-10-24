import { test, beforeEach, afterEach } from "node:test";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  handleReview,
  setRunReviewForTest,
  setBinaryAvailableForTest,
  PRIMARY_REVIEW_MODEL,
  ASK_TOOLS,
  REVIEW_TOOLS
} from "../scripts/gemini-companion.mjs";
import {
  ConfigError,
  AgyAuthError,
  AgyConnectionError,
  AgyContentFilterError,
  AgyModelError,
  AgyQuotaError,
  AgyTimeoutError,
  AgyInterruptedError
} from "../scripts/lib/errors.mjs";
import { renderError } from "../scripts/lib/render.mjs";

function captureStdout(fn) {
  const chunks = [];
  const orig = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk) => {
    chunks.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
    return true;
  };
  return fn().finally(() => {
    process.stdout.write = orig;
  }).then(() => chunks.join(""));
}

const okPayload = {
  stopReason: "end_turn",
  text: JSON.stringify({
    overall: "mixed",
    summary: "Mixed bag.",
    claims: [
      {
        claim: "Redis is AP per CAP theorem.",
        verdict: "contradicted",
        reasoning: "Redis is CP in common configs.",
        correction: "Redis defaults to CP with consistent replication.",
        sources: ["https://redis.io/docs/latest/operate/oss_and_stack/management/replication/"]
      },
      {
        claim: "JSON.parse throws SyntaxError.",
        verdict: "supported",
        reasoning: "Matches the language spec.",
        sources: ["https://tc39.es/ecma262/#sec-json.parse"]
      },
      {
        claim: "Node 25 ships a native HTTP/3 client.",
        verdict: "uncertain",
        reasoning: "Search returned nothing definitive."
      }
    ],
    reasoning_issues: []
  }),
  response: "",
  model: null,
  tokens: { input_tokens: 34702, output_tokens: 407, total_tokens: 35109 },
  deniedActions: [],
  timedOut: false,
  agentVersion: "1.0.0"
};

beforeEach(() => {
  setRunReviewForTest(null);
  setBinaryAvailableForTest(() => ({ available: true, detail: "1.4.3" }));
});
afterEach(() => {
  setRunReviewForTest(null);
  setBinaryAvailableForTest(null);
});

test("review fails before the run on an agy older than the hook minimum or with no version", async () => {
  setRunReviewForTest(async () => {
    throw new Error("should not be called");
  });
  for (const detail of ["1.4.2", "agy not found on PATH"]) {
    setBinaryAvailableForTest(() => ({ available: true, detail }));
    await assert.rejects(
      () => handleReview([], { stdin: "Claim." }),
      (err) => err instanceof ConfigError && /needs agy 1\.4\.3 or later/.test(err.message),
      detail
    );
  }
});

test("rejects empty stdin with a clear ConfigError", async () => {
  setRunReviewForTest(async () => {
    throw new Error("should not be called");
  });
  await assert.rejects(
    () => handleReview([], { stdin: "" }),
    (err) => err instanceof ConfigError && /no content received/i.test(err.message)
  );
});

test("rejects whitespace-only stdin", async () => {
  setRunReviewForTest(async () => {
    throw new Error("should not be called");
  });
  await assert.rejects(
    () => handleReview([], { stdin: "   \n\t  " }),
    ConfigError
  );
});

test("happy path: renders structured output with claims and sources, passes the schema file to the runner", async () => {
  setRunReviewForTest(async (args) => {
    assert.match(args.prompt, /content_to_review/);
    assert.match(args.prompt, /Redis is AP/);
    assert.match(args.prompt, /search_web/);
    assert.match(args.jsonSchema, /schemas[\/\\]review-output\.schema\.json$/);
    // The runner must not receive any modelId, as agy 1.0.0 ignores model selection.
    assert.equal("modelId" in args, false);
    return okPayload;
  });
  const out = await captureStdout(() =>
    handleReview([], { stdin: "I believe Redis is AP per CAP theorem. Also JSON.parse throws SyntaxError." })
  );
  assert.match(out, /Gemini Review/);
  assert.match(out, /Overall: mixed/);
  assert.match(out, /\[contradicted\]/);
  assert.match(out, /\[supported\]/);
  assert.match(out, /\[uncertain\]/);
  assert.match(out, /sources:/);
  assert.match(out, /https:\/\/redis\.io/);
  assert.match(out, /\[grounding\] 2 source URLs cited/);
  assert.match(out, /tokens: 34702 in \/ 407 out/);
  assert.doesNotMatch(out, /refused/);
  // The hardcoded primary model is surfaced in the header.
  assert.match(out, /model: gemini-4-argon-high/);
});

test("grounding footer warns when no tool calls AND no claim sources", async () => {
  setRunReviewForTest(async () => ({
    ...okPayload,
    text: JSON.stringify({
      overall: "mixed",
      summary: "No sources.",
      claims: [
        { claim: "x", verdict: "uncertain", reasoning: "y" }
      ],
      reasoning_issues: []
    })
  }));
  const out = await captureStdout(() => handleReview([], { stdin: "claim body" }));
  assert.match(out, /No claim sources cited/);
  assert.match(out, /Treat results as ungrounded/);
});

test("a supported claim with no source becomes uncertain, in text and JSON, and the other claims stay", async () => {
  setRunReviewForTest(async () => ({
    ...okPayload,
    text: JSON.stringify({
      overall: "trustworthy",
      summary: "One source missing.",
      claims: [
        { claim: "a", verdict: "supported", reasoning: "r", sources: ["https://example.com/a"] },
        { claim: "b", verdict: "supported", reasoning: "r", sources: [""] },
        { claim: "c", verdict: "contradicted", reasoning: "r", sources: ["https://example.com/c"] }
      ],
      reasoning_issues: []
    })
  }));
  const json = JSON.parse(await captureStdout(() => handleReview(["--json"], { stdin: "claim body" })));
  assert.equal(json.parsed.overall, "mixed");
  assert.deepEqual(json.parsed.claims.map((c) => c.verdict), ["supported", "uncertain", "contradicted"]);
  assert.match(json.parsed.claims[1].reasoning, /changed this verdict from supported: no source URL was cited/);
  const out = await captureStdout(() => handleReview([], { stdin: "claim body" }));
  assert.match(out, /Overall: mixed/);
  assert.match(out, /\[uncertain\] b\n.*no source URL was cited/);
});

test("the grounding footer counts only http(s) URLs as cited sources", async () => {
  setRunReviewForTest(async () => ({
    ...okPayload,
    text: JSON.stringify({
      overall: "mixed",
      summary: "s",
      claims: [{ claim: "a", verdict: "uncertain", reasoning: "r", sources: [" ", "not a url", " https://example.com/a "] }],
      reasoning_issues: []
    })
  }));
  const out = await captureStdout(() => handleReview([], { stdin: "claim body" }));
  assert.match(out, /1 source URL cited\./);
});

test("a compacted review says so in --json and in the text report", async () => {
  setRunReviewForTest(async () => ({ ...okPayload, compacted: true }));
  const json = JSON.parse(await captureStdout(() => handleReview(["--json"], { stdin: "claim body" })));
  assert.equal(json.compacted, true);
  const out = await captureStdout(() => handleReview([], { stdin: "claim body" }));
  assert.match(out, /review \(\d+ bytes, degraded\)/);
  assert.match(out, /agy compacted the conversation during this review/);
  setRunReviewForTest(async () => okPayload);
  assert.equal(JSON.parse(await captureStdout(() => handleReview(["--json"], { stdin: "claim body" }))).compacted, false);
});

test("--json mode emits stable payload with model selection fields", async () => {
  setRunReviewForTest(async (args) => ({ ...okPayload, model: args.model }));
  const out = await captureStdout(() =>
    handleReview(["--json"], { stdin: "some text with a claim" })
  );
  const payload = JSON.parse(out);
  assert.equal(payload.target.mode, "review");
  assert.equal(payload.target.truncated, false);
  assert.ok(typeof payload.target.inputBytes === "number");
  assert.equal(payload.stopReason, "end_turn");
  assert.equal(payload.parsed.overall, "mixed");
  assert.equal(payload.parseError, null);
  assert.deepEqual(payload.deniedActions, []);
  assert.equal(payload.timedOut, false);
  assert.equal(payload.tokens.output_tokens, 407);
  assert.equal(Object.prototype.hasOwnProperty.call(payload, "toolCalls"), false);
  assert.equal(payload.model, "gemini-4-argon-high");
  for (const key of ["requestedModel", "fellBack", "fallbackReason"]) assert.equal(Object.hasOwn(payload, key), false, key);
  assert.equal(Object.prototype.hasOwnProperty.call(payload, "downgraded"), false);
});

test("parse failure (degraded, text mode): label tagged degraded, raw reasoning preserved, no error lede", async () => {
  setRunReviewForTest(async () => ({
    ...okPayload,
    text: "I will now emit the JSON, but I never did. The claim is contradicted by the 2023 paper."
  }));
  const out = await captureStdout(() => handleReview([], { stdin: "x" }));
  assert.match(out, /review \([^)]*degraded[^)]*\)/);
  assert.match(out, /Raw output:/);
  assert.match(out, /The claim is contradicted by the 2023 paper/);
  assert.doesNotMatch(out.split("\n").slice(0, 4).join("\n"), /Could not parse structured output/);
});

test("parse failure (degraded, --json): parsed null, parseError set, rawOutput preserved", async () => {
  const reasoning = "I will now emit the JSON, but I never did. Contradicted by the 2023 paper.";
  setRunReviewForTest(async () => ({
    ...okPayload,
    text: reasoning
  }));
  const out = await captureStdout(() =>
    handleReview(["--json"], { stdin: "claim body" })
  );
  const payload = JSON.parse(out);
  assert.equal(payload.parsed, null);
  assert.ok(typeof payload.parseError === "string" && payload.parseError.length > 0);
  assert.equal(payload.rawOutput, reasoning);
});

test("parse failure (empty output): rendered message calls out the empty case without Raw output heading", async () => {
  setRunReviewForTest(async () => ({
    ...okPayload,
    text: ""
  }));
  const out = await captureStdout(() => handleReview([], { stdin: "x" }));
  assert.match(out, /review \([^)]*degraded[^)]*\)/);
  assert.match(out, /no usable output/i);
  assert.doesNotMatch(out, /Raw output:/);
});

test("positional arguments become focus text", async () => {
  setRunReviewForTest(async ({ prompt }) => {
    assert.match(prompt, /focus on security claims/);
    return okPayload;
  });
  await captureStdout(() =>
    handleReview(["focus", "on", "security", "claims"], { stdin: "claim body" })
  );
});

test("truncation is surfaced in both json target and rendered footer", async () => {
  setRunReviewForTest(async () => okPayload);
  const big = Array(5000).fill("this is a line of content about AI and facts.").join("\n");
  const out = await captureStdout(() =>
    handleReview(["--json"], { stdin: big })
  );
  const payload = JSON.parse(out);
  assert.equal(payload.target.truncated, true);
  assert.ok(payload.target.omittedBytes > 0);
});

test("truncation footer shown in rendered mode", async () => {
  setRunReviewForTest(async () => okPayload);
  const big = Array(5000).fill("another content line for truncation test.").join("\n");
  const out = await captureStdout(() => handleReview([], { stdin: big }));
  assert.match(out, /Input was truncated by/);
});

test("header shows the agy version and the model", async () => {
  setRunReviewForTest(async () => okPayload);
  const out = await captureStdout(() => handleReview([], { stdin: "claim body" }));
  assert.match(out, /agy 1\.0\.0/);
  // The plugin now selects the model, so the header names it.
  assert.match(out, /model: gemini-4-argon-high/);
  assert.doesNotMatch(out, /downgraded from/i);
});

test("--model picks the review model", async () => {
  const calls = [];
  setRunReviewForTest(async (args) => {
    calls.push(args.model);
    return { ...okPayload, model: args.model };
  });
  const json = JSON.parse(
    await captureStdout(() => handleReview(["--model", "gemini-4-argon-medium", "--json"], { stdin: "claim body" }))
  );
  assert.deepEqual(calls, ["gemini-4-argon-medium"]);
  assert.equal(json.model, "gemini-4-argon-medium");
});

test("--model needs a value", async () => {
  setRunReviewForTest(async () => okPayload);
  await assert.rejects(() => handleReview(["--model"], { stdin: "x" }), ConfigError);
});

test("the review model is Gemini 4 Argon", () => {
  assert.equal(PRIMARY_REVIEW_MODEL, "gemini-4-argon-high");
});

test("uses the primary model only when it succeeds", async () => {
  const calls = [];
  setRunReviewForTest(async (args) => {
    calls.push(args.model);
    return { ...okPayload, model: args.model };
  });
  const out = await captureStdout(() => handleReview([], { stdin: "a claim to check" }));
  assert.deepEqual(calls, ["gemini-4-argon-high"]);
  assert.match(out, /model: gemini-4-argon-high/);
});

test("a failed run reports its error and is not retried on another model", async () => {
  for (const [argv, err] of [
    [[], new AgyModelError('agy does not know the model "gemini-4-argon-high".')],
    [[], new AgyConnectionError("agy --print failed (1): service unavailable")],
    [[], new AgyAuthError("agy is not signed in")],
    [[], new AgyQuotaError('agy has no quota left for "gemini-4-argon-high": RESOURCE_EXHAUSTED')],
    [[], new AgyTimeoutError("agy --print did not finish within 1230000ms.")],
    [[], new AgyInterruptedError("Stopped by SIGTERM.")],
    [["--model", "gemini-3.8-flash-high"], new AgyConnectionError("flash service unavailable")]
  ]) {
    const calls = [];
    setRunReviewForTest(async (args) => {
      calls.push(args.model);
      throw err;
    });
    await assert.rejects(() => handleReview(argv, { stdin: "a claim to check" }), (e) => e === err);
    assert.deepEqual(calls, [argv[1] ?? PRIMARY_REVIEW_MODEL], err.name);
  }
});

test("the footer counts the web searches agy ran, and --json has them", async () => {
  setRunReviewForTest(async () => ({ ...okPayload, searches: { attempted: 3, succeeded: 2 } }));
  const out = await captureStdout(() => handleReview([], { stdin: "claim body" }));
  assert.match(out, /\[grounding\] 3 web searches run, 2 succeeded\. 2 source URLs cited\./);
  const json = JSON.parse(await captureStdout(() => handleReview(["--json"], { stdin: "claim body" })));
  assert.deepEqual(json.searches, { attempted: 3, succeeded: 2 });
});

test("a content-safety block fails the review, and the error names the block", async () => {
  const calls = [];
  setRunReviewForTest(async (args) => {
    calls.push(args.model);
    throw new AgyContentFilterError("Content safety filters blocked Gemini's response, so agy stopped the run: x", {
      suggestion: "Rephrase the request, then rerun."
    });
  });
  let error;
  await assert.rejects(
    () => handleReview([], { stdin: "a claim to check" }),
    (err) => (error = err) instanceof AgyContentFilterError
  );
  assert.deepEqual(calls, [PRIMARY_REVIEW_MODEL]);
  // main() writes renderError(err) to stderr and sets exit code 1.
  const out = renderError(error);
  assert.match(out, /Content safety filters blocked/);
  assert.match(out, /Rephrase the request/);
  assert.doesNotMatch(out, /sign|version|fallback/i);
});

test("a primary run that agy cut off (exit 0, timedOut) is returned, not retried", async () => {
  const calls = [];
  setRunReviewForTest(async (args) => {
    calls.push(args.model);
    return { ...okPayload, model: args.model, timedOut: true, stopReason: "timeout" };
  });
  const json = JSON.parse(await captureStdout(() => handleReview(["--json"], { stdin: "x" })));
  assert.deepEqual(calls, [PRIMARY_REVIEW_MODEL]);
  assert.equal(json.timedOut, true);
});

test("empty output with refused tools names the tools instead of a bare empty-output message", async () => {
  const deniedActions = [{ action: "read_url", display_name: "ReadUrlContent" }];
  setRunReviewForTest(async () => ({ ...okPayload, text: "", response: "", deniedActions }));
  const out = await captureStdout(() => handleReview([], { stdin: "x" }));
  assert.match(out, /review \([^)]*degraded[^)]*\)/);
  assert.match(out, /agy refused these tools: ReadUrlContent \(read_url\)/);

  const json = JSON.parse(await captureStdout(() => handleReview(["--json"], { stdin: "x" })));
  assert.equal(json.parsed, null);
  assert.match(json.parseError, /ReadUrlContent \(read_url\)/);
  assert.deepEqual(json.deniedActions, deniedActions);
});

test("refused tools appear in the grounding footer of a successful review", async () => {
  const deniedActions = [{ action: "command", display_name: "RunCommand" }];
  setRunReviewForTest(async () => ({ ...okPayload, deniedActions }));
  const out = await captureStdout(() => handleReview([], { stdin: "x" }));
  assert.match(out, /Overall: mixed/);
  assert.match(out, /\[grounding\] agy refused these tools: RunCommand \(command\)\./);
});

test("a schema run without structured output keeps agy's raw response as rawOutput", async () => {
  setRunReviewForTest(async () => ({ ...okPayload, text: "", response: "I searched but ran out of time." }));
  const json = JSON.parse(await captureStdout(() => handleReview(["--json"], { stdin: "x" })));
  assert.equal(json.parsed, null);
  assert.equal(json.parseError, "Model did not return structured output.");
  assert.equal(json.rawOutput, "I searched but ran out of time.");
});

test("a timed-out review is degraded and says it was cut off", async () => {
  setRunReviewForTest(async () => ({
    ...okPayload,
    text: "",
    response: "partial",
    timedOut: true,
    stopReason: "timeout",
    tokens: null
  }));
  const out = await captureStdout(() => handleReview([], { stdin: "x" }));
  assert.match(out, /review \([^)]*degraded[^)]*\)/);
  assert.match(out, /cut the review off/);

  const json = JSON.parse(await captureStdout(() => handleReview(["--json"], { stdin: "x" })));
  assert.equal(json.timedOut, true);
  assert.equal(json.stopReason, "timeout");
});

test("grounding redirect sources are resolved to the publisher URL", async () => {
  const redirect = "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AAA";
  setRunReviewForTest(async () => ({
    ...okPayload,
    text: JSON.stringify({
      overall: "trustworthy",
      summary: "s",
      claims: [{ claim: "c", verdict: "supported", reasoning: "r", sources: [redirect] }],
      reasoning_issues: []
    })
  }));
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, redirect);
    assert.equal(init.redirect, "manual");
    return { status: 302, headers: new Headers({ location: "https://nodejs.org/en/about/previous-releases" }) };
  };
  try {
    const out = await captureStdout(() => handleReview([], { stdin: "x" }));
    assert.match(out, /https:\/\/nodejs\.org\/en\/about\/previous-releases/);
    assert.doesNotMatch(out, /vertexaisearch/);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("--timeout-ms beats the env var, and a bad value is rejected", async () => {
  let seen;
  setRunReviewForTest(async (args) => {
    seen = args;
    return okPayload;
  });
  const prev = process.env.GEMINI_PLUGIN_CC_PROMPT_TIMEOUT_MS;
  process.env.GEMINI_PLUGIN_CC_PROMPT_TIMEOUT_MS = "90000";
  try {
    await captureStdout(() => handleReview(["--timeout-ms", "540000"], { stdin: "x" }));
    assert.equal(seen.promptTimeoutMs, 540000);
    await captureStdout(() => handleReview([], { stdin: "x" }));
    assert.equal(seen.promptTimeoutMs, 90000);
  } finally {
    if (prev == null) delete process.env.GEMINI_PLUGIN_CC_PROMPT_TIMEOUT_MS;
    else process.env.GEMINI_PLUGIN_CC_PROMPT_TIMEOUT_MS = prev;
  }
  await assert.rejects(() => handleReview(["--timeout-ms", "soon"], { stdin: "x" }), ConfigError);
});

// Focus text with every shell-special character review.md must survive.
const TRICKY_FOCUS = `check Node's "LTS" date, $HOME and \`uname\` stay literal`;

test("focus text arrives as one plain argument and is never re-split", async () => {
  let prompt;
  setRunReviewForTest(async (args) => {
    prompt = args.prompt;
    return okPayload;
  });
  // Alone (the case the old re-splitting mangled) and after flags.
  await captureStdout(() => handleReview([TRICKY_FOCUS], { stdin: "x" }));
  assert.ok(prompt.includes(TRICKY_FOCUS));
  await captureStdout(() => handleReview(["--timeout-ms", "540000", TRICKY_FOCUS], { stdin: "x" }));
  assert.ok(prompt.includes(TRICKY_FOCUS));
});

test("review.md's single-quote rule hands the shell's argv over unchanged", () => {
  // Quote the way review.md tells Claude to: wrap in '...' and write ' as '\''.
  const quoted = `'${TRICKY_FOCUS.replace(/'/g, "'\\''")}'`;
  const out = execFileSync("/bin/sh", [
    "-c",
    `node -e 'console.log(JSON.stringify(process.argv.slice(1)))' -- --json ${quoted}`
  ], { encoding: "utf8" });
  assert.deepEqual(JSON.parse(out), ["--json", TRICKY_FOCUS]);
});

test("the run gets the whole --timeout-ms budget", async () => {
  const timeouts = [];
  setRunReviewForTest(async (args) => {
    timeouts.push(args.promptTimeoutMs);
    return { ...okPayload, model: args.model };
  });
  await captureStdout(() => handleReview(["--timeout-ms", "600000"], { stdin: "x" }));
  assert.deepEqual(timeouts, [600000]);
});

test("review runs agy with a hook that allows only web search, page reads and the schema answer", async () => {
  let cwd;
  setRunReviewForTest(async (args) => {
    cwd = args.cwd;
    // Run the hook the way agy does, from the hooks.json in the temp folder.
    const hooks = JSON.parse(fs.readFileSync(path.join(cwd, ".agents", "hooks.json"), "utf8"));
    const [group] = hooks["gemini-plugin-tool-gate"].PreToolUse;
    assert.equal(group.matcher, "*");
    const decide = (toolCall) =>
      JSON.parse(execFileSync("sh", ["-c", group.hooks[0].command], { input: JSON.stringify({ toolCall }), encoding: "utf8" })).decision;
    for (const name of ["search_web", "read_url_content", "finish"]) assert.equal(decide({ name, args: {} }), "allow", name);
    const calls = [
      { name: "run_command", args: { CommandLine: "ls /tmp" } },
      { name: "run_command", args: { CommandLine: "grep -rn token /Users" } },
      { name: "invoke_subagent", args: { Prompt: "x", TypeName: "image-generator" } },
      { name: "open_browser_url", args: { Url: "https://attacker.example/" } },
      { name: "read_file", args: { Path: path.join(cwd, "files") } }
    ];
    for (const toolCall of calls) assert.equal(decide(toolCall), "deny", toolCall.name);
    return okPayload;
  });
  const out = await captureStdout(() => handleReview(["--json"], { stdin: "claim body" }));
  assert.deepEqual(JSON.parse(out).deniedActions, [
    { action: "command", display_name: "ls /tmp" },
    { action: "command", display_name: "grep -rn token /Users" },
    { action: "invoke_subagent" },
    { action: "open_browser_url" },
    { action: "read_file" }
  ]);
  assert.equal(fs.existsSync(cwd), false, "the temp folder is removed");
  // A review and an ask both open pages; only an ask reads files.
  assert.deepEqual(REVIEW_TOOLS, ["search_web", "read_url_content", "finish"]);
  assert.ok(ASK_TOOLS.includes("read_url_content"));
});

test("review refuses --cwd, which would skip the gated temp folder, without calling agy", async () => {
  setRunReviewForTest(async () => {
    throw new Error("should not be called");
  });
  for (const argv of [["--cwd", "/tmp"], ["--cwd=/tmp"], ["--cwd=/tmp", "check dates"]]) {
    await assert.rejects(
      () => handleReview(argv, { stdin: "claim body" }),
      (err) => err instanceof ConfigError && /--cwd/.test(err.message),
      JSON.stringify(argv)
    );
  }
});

test("focus text after -- is focus text, also when it starts with --cwd=, and the run stays gated", async () => {
  let seen;
  setRunReviewForTest(async (args) => {
    seen = args;
    const hooks = JSON.parse(fs.readFileSync(path.join(args.cwd, ".agents", "hooks.json"), "utf8"));
    assert.equal(hooks["gemini-plugin-tool-gate"].PreToolUse[0].matcher, "*");
    return okPayload;
  });
  await captureStdout(() => handleReview(["--json", "--", "--cwd=/tmp check dates"], { stdin: "claim body" }));
  assert.match(seen.prompt, /<user_focus>\n--cwd=\/tmp check dates\n<\/user_focus>/);
  assert.match(path.basename(seen.cwd), /^gemini-review-cwd-/);
});

test("a review with claims and no successful search is ungrounded: never trustworthy, with a warning", async () => {
  const review = (claims) =>
    JSON.stringify({ overall: "trustworthy", summary: "s", claims, reasoning_issues: [] });
  const claim = { claim: "a", verdict: "supported", reasoning: "r", sources: ["https://example.com/made-up"] };
  for (const searches of [{ attempted: 0, succeeded: 0 }, { attempted: 3, succeeded: 0 }]) {
    setRunReviewForTest(async () => ({ ...okPayload, text: review([claim]), searches }));
    const json = JSON.parse(await captureStdout(() => handleReview(["--json"], { stdin: "claim body" })));
    assert.equal(json.ungrounded, true, JSON.stringify(searches));
    assert.equal(json.parsed.overall, "mixed", JSON.stringify(searches));
    const out = await captureStdout(() => handleReview([], { stdin: "claim body" }));
    assert.match(out, /degraded/);
    assert.match(out, /No web search succeeded/);
    assert.match(out, /Overall: mixed/);
  }
  // One successful search, or no claims, is not ungrounded.
  for (const [claims, searches] of [[[claim], { attempted: 1, succeeded: 1 }], [[], { attempted: 0, succeeded: 0 }]]) {
    setRunReviewForTest(async () => ({ ...okPayload, text: review(claims), searches }));
    const json = JSON.parse(await captureStdout(() => handleReview(["--json"], { stdin: "claim body" })));
    assert.equal(json.ungrounded, false);
    assert.equal(json.parsed.overall, "trustworthy");
  }
});
