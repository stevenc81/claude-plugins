import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadTemplate, loadSchemaText, renderPrompt, schemaPath } from "../scripts/lib/prompts.mjs";
import { ConfigError } from "../scripts/lib/errors.mjs";

test("loadTemplate reads review.md", () => {
  const t = loadTemplate("review");
  assert.match(t, /analytical reviewer/);
  assert.match(t, /\{\{CONTENT\}\}/);
  assert.match(t, /\{\{USER_FOCUS\}\}/);
});

test("review template limits grounding to search_web and asks for full page URLs", () => {
  // Headless agy refuses read_url_content, and a refused tool ends the run with
  // an empty response, so the prompt must keep the model on search only.
  const t = loadTemplate("review");
  assert.match(t, /Use only the `search_web` tool/);
  assert.match(t, /Do not fetch or open pages, read files, or run commands/);
  assert.match(t, /full page URL/);
  assert.doesNotMatch(t, /web_fetch|google_web_search/);
  assert.match(t, /sources/);
});

test("schemaPath points at the review schema file", () => {
  const p = schemaPath("review-output");
  assert.ok(path.isAbsolute(p));
  assert.deepEqual(JSON.parse(fs.readFileSync(p, "utf8")), JSON.parse(loadSchemaText("review-output")));
});

test("loadSchemaText returns raw JSON schema by default", () => {
  const s = loadSchemaText();
  const parsed = JSON.parse(s);
  assert.equal(parsed.type, "object");
  assert.ok(parsed.required.includes("overall"));
  assert.ok(parsed.required.includes("claims"));
});

test("loadSchemaText supports explicit review-output name", () => {
  const s = loadSchemaText("review-output");
  const parsed = JSON.parse(s);
  assert.ok(parsed.required.includes("overall"));
});

test("schema advertises optional sources per claim", () => {
  const s = loadSchemaText("review-output");
  assert.match(s, /"sources":/);
});

test("renderPrompt('review') substitutes CONTENT and USER_FOCUS", () => {
  const { text } = renderPrompt("review", {
    CONTENT: "Claude said Redis is AP.",
    USER_FOCUS: "verify database claims"
  });
  assert.match(text, /Redis is AP/);
  assert.match(text, /verify database claims/);
  assert.doesNotMatch(text, /\{\{CONTENT\}\}/);
  assert.doesNotMatch(text, /\{\{USER_FOCUS\}\}/);
});

test("renderPrompt('review') auto-embeds review schema", () => {
  const { text } = renderPrompt("review", {
    CONTENT: "c",
    USER_FOCUS: "f"
  });
  assert.match(text, /"overall":/);
  assert.match(text, /trustworthy/);
  assert.match(text, /problematic/);
  assert.doesNotMatch(text, /\{\{SCHEMA\}\}/);
});

test("renderPrompt throws ConfigError for missing placeholder", () => {
  assert.throws(
    () => renderPrompt("review", { CONTENT: "c" /* missing USER_FOCUS */ }),
    ConfigError
  );
});

test("renderPrompt accepts SCHEMA override", () => {
  const { text } = renderPrompt("review", {
    CONTENT: "c",
    USER_FOCUS: "f",
    SCHEMA: "CUSTOM-SCHEMA-MARKER"
  });
  assert.match(text, /CUSTOM-SCHEMA-MARKER/);
});

test("renderPrompt throws ConfigError for prompt with no schema binding", () => {
  assert.throws(
    () => renderPrompt("nonexistent-template-name", {}),
    Error
  );
});

test("review template is well-formed: every closing tag has a matching opening tag", () => {
  // Guards against orphan/mismatched section delimiters (e.g. an <output_contract>
  // block accidentally closed with </output>). Operates on the raw template so the
  // {{CONTENT}}/{{USER_FOCUS}}/{{SCHEMA}} placeholders carry no angle brackets.
  const t = loadTemplate("review");
  const open = [];
  const unmatched = [];
  const tagRe = /<(\/?)([a-z_]+)>/g;
  let m;
  while ((m = tagRe.exec(t)) !== null) {
    const [, slash, name] = m;
    if (slash) {
      const idx = open.lastIndexOf(name);
      if (idx === -1) unmatched.push(name);
      else open.splice(idx, 1);
    } else {
      open.push(name);
    }
  }
  assert.deepEqual(unmatched, [], `orphan closing tag(s): ${unmatched.map((n) => `</${n}>`).join(", ")}`);
  assert.deepEqual(open, [], `unclosed opening tag(s): ${open.map((n) => `<${n}>`).join(", ")}`);
});

const commandsDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "commands");

test("the ask foreground flow caps the model run at 9 minutes, under the 10-minute Bash limit", () => {
  for (const name of ["ask.md"]) {
    const text = fs.readFileSync(path.join(commandsDir, name), "utf8");
    const foreground = text.slice(text.indexOf("Foreground flow:"), text.indexOf("Background flow:"));
    const background = text.slice(text.indexOf("Background flow:")).match(/command: `([^\n]*)/)[1];
    // Every command starts with `node` so it matches the `allowed-tools` rule.
    assert.match(foreground, /\n(node "\$\{CLAUDE_PLUGIN_ROOT\}[^\n]*--timeout-ms 540000[^\n]*)\n/, name);
    assert.doesNotMatch(text, /PROMPT_TIMEOUT_MS=/, name);
    assert.match(foreground, /600000/, name);
    assert.doesNotMatch(background, /timeout-ms/, name);
  }
});

test("the review command always runs in the background with the full time budget", () => {
  const text = fs.readFileSync(path.join(commandsDir, "review.md"), "utf8");
  assert.doesNotMatch(text, /Foreground flow:/);
  const command = text.match(/command: `([^\n]*)/)[1];
  // The command starts with `node` so it matches the `allowed-tools` rule.
  assert.match(command, /^node "\$\{CLAUDE_PLUGIN_ROOT\}/);
  assert.doesNotMatch(command, /timeout-ms/);
  assert.match(text, /run_in_background: true/);
});

test("background flows tell a subagent to hold its one final report until the task finishes", () => {
  for (const name of ["review.md", "ask.md"]) {
    const text = fs.readFileSync(path.join(commandsDir, name), "utf8");
    assert.match(text, /If you are a subagent, do not send your final report yet/, name);
  }
});

test("commands pre-approve only the companion script and never paste raw arguments into the shell", () => {
  for (const name of ["ask.md", "review.md", "setup.md"]) {
    const text = fs.readFileSync(path.join(commandsDir, name), "utf8");
    assert.match(text, /^allowed-tools: Bash\(node "\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/gemini-companion\.mjs" \*\)$/m, name);
    assert.doesNotMatch(text, /"\$ARGUMENTS"/, name);
  }
  for (const name of ["ask.md", "review.md"]) {
    const text = fs.readFileSync(path.join(commandsDir, name), "utf8");
    assert.match(text, /Make a new heredoc end marker for each call/, name);
  }
});
