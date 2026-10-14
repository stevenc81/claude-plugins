import { test, beforeEach, afterEach } from "node:test";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { handleReview, setRunReviewForTest } from "../plugins/gemini/scripts/gemini-companion.mjs";
import {
  ConfigError,
  AgyConnectionError
} from "../plugins/gemini/scripts/lib/errors.mjs";

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
});
afterEach(() => {
  setRunReviewForTest(null);
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
  assert.match(out, /model: gemini-3\.8-flash-high/);
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
  assert.equal(payload.model, "gemini-3.8-flash-high");
  assert.equal(Object.prototype.hasOwnProperty.call(payload, "fellBack"), false);
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
  assert.match(out, /model: gemini-3\.8-flash-high/);
  assert.doesNotMatch(out, /downgraded from/i);
});

test("rejects --model flag (no longer supported)", async () => {
  setRunReviewForTest(async () => okPayload);
  await assert.rejects(
    () =>
      handleReview(["--model", "best"], { stdin: "claim body" }),
    (err) => err instanceof ConfigError && /unknown flag.*--model/i.test(err.message)
  );
});

test("uses gemini-3.8-flash-high and surfaces it in the header", async () => {
  let usedModel;
  setRunReviewForTest(async (args) => {
    usedModel = args.model;
    return { ...okPayload, model: args.model };
  });
  const out = await captureStdout(() => handleReview([], { stdin: "a claim to check" }));
  assert.equal(usedModel, "gemini-3.8-flash-high");
  assert.match(out, /model: gemini-3\.8-flash-high/);
});

test("a failed run is not retried on another model; the error surfaces as is", async () => {
  const calls = [];
  setRunReviewForTest(async (args) => {
    calls.push(args.model);
    throw new AgyConnectionError("service unavailable");
  });
  await assert.rejects(
    () => handleReview([], { stdin: "a claim to check" }),
    (err) => err instanceof AgyConnectionError && /service unavailable/.test(err.message)
  );
  assert.deepEqual(calls, ["gemini-3.8-flash-high"]);
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
    await captureStdout(() => handleReview(["--timeout-ms", "540000", "--wait"], { stdin: "x" }));
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
  await captureStdout(() => handleReview(["--timeout-ms", "540000", "--wait", TRICKY_FOCUS], { stdin: "x" }));
  assert.ok(prompt.includes(TRICKY_FOCUS));
});

test("review.md's single-quote rule hands the shell's argv over unchanged", () => {
  // Quote the way review.md tells Claude to: wrap in '...' and write ' as '\''.
  const quoted = `'${TRICKY_FOCUS.replace(/'/g, "'\\''")}'`;
  const out = execFileSync("/bin/sh", [
    "-c",
    `node -e 'console.log(JSON.stringify(process.argv.slice(1)))' -- --wait ${quoted}`
  ], { encoding: "utf8" });
  assert.deepEqual(JSON.parse(out), ["--wait", TRICKY_FOCUS]);
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
