import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isGroundingRedirectUrl,
  resolveSources
} from "../plugins/gemini/scripts/lib/source-resolver.mjs";

const REDIRECT_A = "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AAA";
const REDIRECT_B = "https://vertexaisearch.cloud.google.com/grounding-api-redirect/BBB";
const DIRECT_URL = "https://redis.io/docs/latest/";

function redirectTo(location) {
  return { status: 302, headers: new Headers(location ? { location } : {}) };
}

test("isGroundingRedirectUrl identifies vertex grounding URLs", () => {
  assert.equal(isGroundingRedirectUrl(REDIRECT_A), true);
  assert.equal(isGroundingRedirectUrl(DIRECT_URL), false);
  assert.equal(isGroundingRedirectUrl(""), false);
  assert.equal(isGroundingRedirectUrl(null), false);
  assert.equal(isGroundingRedirectUrl("not a url"), false);
});

test("isGroundingRedirectUrl rejects unrelated google hosts", () => {
  assert.equal(
    isGroundingRedirectUrl("https://www.google.com/search?q=foo"),
    false
  );
});

test("resolveSources replaces redirect URLs with the Location header, without following it", async () => {
  const fetchCalls = [];
  const fakeFetch = async (url, init) => {
    fetchCalls.push(url);
    assert.equal(init.method, "HEAD");
    assert.equal(init.redirect, "manual");
    if (url === REDIRECT_A) return redirectTo("https://redis.io/docs/latest/replication/");
    if (url === REDIRECT_B) return redirectTo("https://tc39.es/ecma262/#sec-json.parse");
    throw new Error(`unexpected fetch: ${url}`);
  };

  const parsed = {
    claims: [
      {
        claim: "redis cap",
        verdict: "contradicted",
        reasoning: "r",
        sources: [REDIRECT_A, DIRECT_URL]
      },
      {
        claim: "json.parse",
        verdict: "supported",
        reasoning: "r",
        sources: [REDIRECT_B]
      }
    ]
  };

  await resolveSources(parsed, { fetchFn: fakeFetch, timeoutMs: 500 });

  assert.deepEqual(parsed.claims[0].sources, [
    "https://redis.io/docs/latest/replication/",
    DIRECT_URL
  ]);
  assert.deepEqual(parsed.claims[1].sources, [
    "https://tc39.es/ecma262/#sec-json.parse"
  ]);
  assert.equal(fetchCalls.length, 2);
});

test("resolveSources leaves original URL when fetch throws", async () => {
  const fakeFetch = async () => {
    throw new Error("network down");
  };
  const parsed = {
    claims: [
      { claim: "x", verdict: "supported", reasoning: "r", sources: [REDIRECT_A] }
    ]
  };
  await resolveSources(parsed, { fetchFn: fakeFetch, timeoutMs: 500 });
  assert.deepEqual(parsed.claims[0].sources, [REDIRECT_A]);
});

test("resolveSources leaves original URL when Location points back at the redirect host", async () => {
  // Defensive: if the resolver would end up back on a grounding host, keep original.
  const fakeFetch = async () => redirectTo(REDIRECT_B);
  const parsed = {
    claims: [
      { claim: "x", verdict: "supported", reasoning: "r", sources: [REDIRECT_A] }
    ]
  };
  await resolveSources(parsed, { fetchFn: fakeFetch, timeoutMs: 500 });
  assert.deepEqual(parsed.claims[0].sources, [REDIRECT_A]);
});

test("resolveSources keeps the original URL when there is no Location or it is not http(s)", async () => {
  const parsed = {
    claims: [
      { claim: "x", verdict: "supported", reasoning: "r", sources: [REDIRECT_A, REDIRECT_B] }
    ]
  };
  const fakeFetch = async (url) =>
    url === REDIRECT_A ? { status: 200, headers: new Headers() } : redirectTo("javascript:alert(1)");
  await resolveSources(parsed, { fetchFn: fakeFetch, timeoutMs: 500 });
  assert.deepEqual(parsed.claims[0].sources, [REDIRECT_A, REDIRECT_B]);
});

test("resolveSources resolves a relative Location against the redirect URL", async () => {
  const parsed = {
    claims: [{ claim: "x", verdict: "supported", reasoning: "r", sources: [REDIRECT_A] }]
  };
  await resolveSources(parsed, { fetchFn: async () => redirectTo("/other/page"), timeoutMs: 500 });
  assert.deepEqual(parsed.claims[0].sources, ["https://vertexaisearch.cloud.google.com/other/page"]);
});

test("resolveSources is a no-op when disabled", async () => {
  let called = false;
  const fakeFetch = async () => {
    called = true;
    return redirectTo("https://example.com/final");
  };
  const parsed = {
    claims: [
      { claim: "x", verdict: "supported", reasoning: "r", sources: [REDIRECT_A] }
    ]
  };
  await resolveSources(parsed, { fetchFn: fakeFetch, enabled: false });
  assert.equal(called, false);
  assert.deepEqual(parsed.claims[0].sources, [REDIRECT_A]);
});

test("resolveSources handles claims with no sources", async () => {
  let called = false;
  const fakeFetch = async () => {
    called = true;
    return redirectTo("https://example.com");
  };
  const parsed = {
    claims: [
      { claim: "x", verdict: "uncertain", reasoning: "r" },
      { claim: "y", verdict: "supported", reasoning: "r", sources: [] }
    ]
  };
  await resolveSources(parsed, { fetchFn: fakeFetch });
  assert.equal(called, false);
});

test("resolveSources handles parsed without claims array", async () => {
  const fakeFetch = async () => redirectTo("https://example.com");
  await resolveSources({ overall: "mixed" }, { fetchFn: fakeFetch });
  await resolveSources(null, { fetchFn: fakeFetch });
  // No throw = pass.
});

test("resolveSources aborts on timeout and keeps original URL", async () => {
  const fakeFetch = (_url, { signal }) =>
    new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => {
        const err = new Error("aborted");
        err.name = "AbortError";
        reject(err);
      });
    });
  const parsed = {
    claims: [
      { claim: "x", verdict: "supported", reasoning: "r", sources: [REDIRECT_A] }
    ]
  };
  await resolveSources(parsed, { fetchFn: fakeFetch, timeoutMs: 50 });
  assert.deepEqual(parsed.claims[0].sources, [REDIRECT_A]);
});

test("resolveSources runs the lookups in parallel", async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const fakeFetch = async () => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 10));
    inFlight -= 1;
    return redirectTo("https://example.com/final");
  };
  const parsed = {
    claims: [
      { claim: "x", verdict: "supported", reasoning: "r", sources: [REDIRECT_A] },
      { claim: "y", verdict: "supported", reasoning: "r", sources: [REDIRECT_B] }
    ]
  };
  await resolveSources(parsed, { fetchFn: fakeFetch, timeoutMs: 500 });
  assert.equal(maxInFlight, 2);
});
