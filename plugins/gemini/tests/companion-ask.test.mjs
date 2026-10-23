import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  handleAsk,
  setRunReviewForTest,
  setBinaryAvailableForTest,
  DEFAULT_ASK_MODEL,
  toolRule,
  MAX_MEDIA_BYTES,
  setAgyHomeForTest
} from "../scripts/gemini-companion.mjs";
import { ConfigError, AgyModelError, OutputError } from "../scripts/lib/errors.mjs";
import { splitIntoParts } from "../scripts/lib/text-utils.mjs";
import { execFileSync } from "node:child_process";

function captureStdout(fn) {
  const chunks = [];
  const orig = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk) => {
    chunks.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
    return true;
  };
  return fn()
    .finally(() => {
      process.stdout.write = orig;
    })
    .then(() => chunks.join(""));
}

// Runs the hook the way agy does, from the hooks.json in the temp folder, and
// returns its decision. agy names the conversation that makes the call.
function hookDecision(cwd, toolCall, conversationId = "parent-1") {
  const hooks = JSON.parse(fs.readFileSync(path.join(cwd, ".agents", "hooks.json"), "utf8"));
  const { command } = hooks["gemini-plugin-tool-gate"].PreToolUse[0].hooks[0];
  const input = JSON.stringify({ toolCall, conversationId });
  return JSON.parse(execFileSync("sh", ["-c", command], { input, encoding: "utf8" })).decision;
}

function reply(fields = {}) {
  return {
    stopReason: "end_turn",
    text: "PONG\n",
    response: "PONG\n",
    model: null,
    tokens: { input_tokens: 11828, output_tokens: 2, total_tokens: 11830 },
    deniedActions: [],
    timedOut: false,
    conversationId: "c-1",
    agentVersion: null,
    ...fields
  };
}

const useAgyVersion = (detail) => setBinaryAvailableForTest(() => ({ available: true, detail }));
beforeEach(() => {
  setRunReviewForTest(null);
  useAgyVersion("1.4.3");
});
afterEach(() => {
  setRunReviewForTest(null);
  setBinaryAvailableForTest(null);
});

test("ask uses the default model, runs from a fresh temp folder and removes it", async () => {
  let seen;
  setRunReviewForTest(async (args) => {
    seen = args;
    assert.ok(fs.existsSync(args.cwd), "temp folder exists while agy runs");
    const hooks = JSON.parse(fs.readFileSync(path.join(args.cwd, ".agents", "hooks.json"), "utf8"));
    const [group] = hooks["gemini-plugin-tool-gate"].PreToolUse;
    assert.equal(group.matcher, "*", "the hook sees every tool call");
    assert.match(group.hooks[0].command, /\/scripts\/tool-gate\.mjs' '\{/);
    // Ask keeps web search, page reads and the schema answer.
    for (const name of ["search_web", "read_url_content", "finish"]) {
      assert.equal(hookDecision(args.cwd, { name, args: {} }), "allow", name);
    }
    // Every other tool is denied, also one that agy does not have yet.
    for (const name of ["run_command", "invoke_subagent", "schedule", "write_to_file", "call_mcp_tool", "browser_subagent", "list_dir", "generate_image", "send_message", "a_new_tool"]) {
      assert.equal(hookDecision(args.cwd, { name, args: { DirectoryPath: path.join(args.cwd, "files") } }), "deny", name);
    }
    // The file reader may read the copies, never the hook and its log.
    fs.writeFileSync(path.join(args.cwd, "files", "x.txt"), "x");
    assert.equal(hookDecision(args.cwd, { name: "read_file", args: { Path: path.join(args.cwd, "files", "x.txt") } }), "allow");
    assert.equal(hookDecision(args.cwd, { name: "view_file", args: { AbsolutePath: path.join(args.cwd, "files", "x.txt") } }), "allow");
    assert.equal(hookDecision(args.cwd, { name: "read_file", args: { Path: path.join(args.cwd, ".agents", "hooks.json") } }), "deny");
    fs.rmSync(path.join(args.cwd, ".agents", "denied.jsonl"));
    return reply();
  });
  const out = await captureStdout(() => handleAsk([], { stdin: "Reply with PONG." }));
  assert.equal(out, "PONG\n\n[conversation] c-1\n");
  assert.equal(seen.model, DEFAULT_ASK_MODEL);
  assert.equal(DEFAULT_ASK_MODEL, "gemini-3.8-flash-medium");
  assert.equal(seen.prompt, `Reply with PONG.\n\n${toolRule()}`);
  assert.equal(seen.addDirs, undefined);
  assert.equal(seen.jsonSchema, undefined);
  assert.equal(seen.conversationId, undefined);
  assert.equal(seen.denialLog, path.join(seen.cwd, ".agents", "denied.jsonl"), "the runner can read the hook's denials");
  assert.equal(path.dirname(seen.cwd), fs.realpathSync(os.tmpdir()), "a real path, as the hook resolves paths");
  assert.match(path.basename(seen.cwd), /^gemini-ask-cwd-/);
  assert.equal(fs.existsSync(seen.cwd), false, "temp folder is removed afterwards");
});

test("ask removes the temp folder when agy fails, and surfaces the unknown-model error", async () => {
  let cwd;
  setRunReviewForTest(async (args) => {
    cwd = args.cwd;
    throw new AgyModelError('agy does not know the model "gemini-9-fake".', {
      suggestion: "Run `agy models` to see the model IDs you can use."
    });
  });
  await assert.rejects(
    () => handleAsk(["--model", "gemini-9-fake"], { stdin: "hi" }),
    (err) => err instanceof AgyModelError && /agy models/.test(err.suggestion)
  );
  assert.equal(fs.existsSync(cwd), false);
});

test("ask passes any --model through to agy", async () => {
  let model;
  setRunReviewForTest(async (args) => {
    model = args.model;
    return reply();
  });
  await captureStdout(() => handleAsk(["--model", "claude-sonnet-5-5-low"], { stdin: "hi" }));
  assert.equal(model, "claude-sonnet-5-5-low");
});

test("ask joins the prompt from arguments and stdin", async () => {
  let prompt;
  setRunReviewForTest(async (args) => {
    prompt = args.prompt;
    return reply();
  });
  await captureStdout(() => handleAsk(["Summarize", "this:"], { stdin: "Some long text.\n" }));
  assert.equal(prompt, `Summarize this:\n\nSome long text.\n\n${toolRule()}`);
});

test("ask rejects an empty prompt without calling agy", async () => {
  setRunReviewForTest(async () => {
    throw new Error("should not be called");
  });
  await assert.rejects(() => handleAsk([], { stdin: "  \n" }), ConfigError);
});

test("ask --file copies each file into agy's temp folder and lists the copies in the prompt", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gemini-ask-test-"));
  try {
    fs.mkdirSync(path.join(dir, "sub"));
    fs.writeFileSync(path.join(dir, "a.txt"), "A");
    fs.writeFileSync(path.join(dir, "sub", "b.txt"), "B");
    fs.writeFileSync(path.join(dir, "sub", "c.txt"), "C");
    let seen;
    let copied;
    setRunReviewForTest(async (args) => {
      seen = args;
      const files = path.join(args.cwd, "files");
      copied = fs.readdirSync(files).sort().map((n) => [n, fs.readFileSync(path.join(files, n), "utf8")]);
      return reply();
    });
    await captureStdout(() =>
      handleAsk(
        ["--cwd", dir, "--file", "a.txt", "--file", "sub/b.txt", "--file", path.join(dir, "sub", "c.txt")],
        { stdin: "Compare these files." }
      )
    );
    // Only the named files are visible to agy: no --add-dir for their folders.
    assert.equal(seen.addDirs, undefined);
    assert.deepEqual(copied, [["1-a.txt", "A"], ["2-b.txt", "B"], ["3-c.txt", "C"]]);
    assert.match(seen.prompt, /^Compare these files\./);
    for (const name of ["1-a.txt", "2-b.txt", "3-c.txt"]) {
      assert.ok(seen.prompt.includes(`- ${path.join(seen.cwd, "files", name)}`), `prompt lists ${name}`);
    }
    assert.notEqual(seen.cwd, dir, "agy still runs from its own temp folder");
    assert.equal(fs.existsSync(seen.cwd), false, "the temp folder and its copies are removed");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("ask --file rejects a missing file without calling agy", async () => {
  setRunReviewForTest(async () => {
    throw new Error("should not be called");
  });
  await assert.rejects(
    () => handleAsk(["--file", "/definitely/not/here.txt"], { stdin: "hi" }),
    (err) => err instanceof ConfigError && /\/definitely\/not\/here\.txt/.test(err.message)
  );
});

test("ask returns the response verbatim and adds notes for refused tools and timeouts", async () => {
  setRunReviewForTest(async () =>
    reply({
      text: "Partly read.",
      response: "Partly read.",
      deniedActions: [{ action: "read_file", display_name: "ViewFile" }]
    })
  );
  const refused = await captureStdout(() => handleAsk([], { stdin: "read it" }));
  assert.match(refused, /^Partly read\.\n/);
  assert.match(refused, /\[note\] agy refused these tools: ViewFile \(read_file\)\./);

  setRunReviewForTest(async () => reply({ text: "Half an ans", response: "Half an ans", timedOut: true }));
  const cut = await captureStdout(() => handleAsk([], { stdin: "essay" }));
  assert.equal(cut, "Half an ans\n\n[note] agy hit its time limit, so this answer was cut off.\n[conversation] c-1\n");
});

test("ask without --schema fails on an empty or whitespace-only answer, and names refused tools", async () => {
  // agy 1.4.5 ended a run with status SUCCESS and an empty response (probe 2026-10-23).
  for (const response of ["", " \n\t"]) {
    setRunReviewForTest(async () => reply({ text: response, response }));
    for (const args of [[], ["--json"]]) {
      await assert.rejects(
        () => captureStdout(() => handleAsk(args, { stdin: "q" })),
        (err) => err instanceof OutputError && /empty answer/.test(err.message) && /--resume c-1/.test(err.suggestion),
        JSON.stringify([response, args])
      );
    }
  }
  setRunReviewForTest(async () => reply({ text: "", response: "", deniedActions: [{ action: "read_file", display_name: "ViewFile" }] }));
  await assert.rejects(
    () => handleAsk([], { stdin: "read it" }),
    (err) => err instanceof OutputError && /agy refused these tools: ViewFile \(read_file\)/.test(err.message)
  );
});

test("ask --json returns model, conversationId, response, structuredOutput, images, tokens, deniedActions, stopReason, timedOut and compacted", async () => {
  setRunReviewForTest(async () => reply());
  const out = await captureStdout(() => handleAsk(["--json"], { stdin: "Reply with PONG." }));
  assert.deepEqual(JSON.parse(out), {
    model: DEFAULT_ASK_MODEL,
    conversationId: "c-1",
    response: "PONG\n",
    structuredOutput: null,
    images: null,
    tokens: { input_tokens: 11828, output_tokens: 2, total_tokens: 11830 },
    deniedActions: [],
    stopReason: "end_turn",
    timedOut: false,
    compacted: false
  });
});

test("ask reports a compaction: compacted in --json, and a note after the answer", async () => {
  setRunReviewForTest(async () => reply({ compacted: true }));
  const json = JSON.parse(await captureStdout(() => handleAsk(["--json"], { stdin: "research" })));
  assert.equal(json.compacted, true);
  const text = await captureStdout(() => handleAsk([], { stdin: "research" }));
  assert.equal(text, "PONG\n\n[note] agy compacted the conversation during this run, so Gemini worked from a summary of the earlier steps.\n[conversation] c-1\n");
});

test("ask --file refuses a media file over the limit before the run, on the open file's size", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gemini-ask-media-"));
  try {
    for (const name of ["big.mp4", "big.PDF", "ok.mp4", "big.txt"]) {
      const fd = fs.openSync(path.join(dir, name), "w");
      fs.ftruncateSync(fd, name.startsWith("ok") ? MAX_MEDIA_BYTES : MAX_MEDIA_BYTES + 1);
      fs.closeSync(fd);
    }
    setRunReviewForTest(async () => reply());
    for (const name of ["big.mp4", "big.PDF"]) {
      await assert.rejects(
        () => handleAsk(["--file", path.join(dir, name)], { stdin: "describe" }),
        (err) => err instanceof ConfigError && /over the 24000000-byte limit/.test(err.message) && /ffmpeg/.test(err.suggestion),
        name
      );
    }
    // At the limit, and for text of any size, the file goes through.
    await captureStdout(() => handleAsk(["--file", path.join(dir, "ok.mp4"), "--file", path.join(dir, "big.txt")], { stdin: "describe" }));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("ask --file copies .m4a as .mp4, and refuses .aac and .flac with an ffmpeg hint", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gemini-ask-audio-"));
  try {
    for (const name of ["talk.m4a", "talk.aac", "talk.FLAC"]) fs.writeFileSync(path.join(dir, name), "audio");
    let copied;
    setRunReviewForTest(async (args) => {
      copied = fs.readdirSync(path.join(args.cwd, "files"));
      return reply();
    });
    await captureStdout(() => handleAsk(["--file", path.join(dir, "talk.m4a")], { stdin: "transcribe" }));
    assert.deepEqual(copied, ["1-talk.mp4"]);
    setRunReviewForTest(async () => {
      throw new Error("should not be called");
    });
    for (const name of ["talk.aac", "talk.FLAC"]) {
      await assert.rejects(
        () => handleAsk(["--file", path.join(dir, name)], { stdin: "transcribe" }),
        (err) => err instanceof ConfigError && /ffmpeg -i x\.flac x\.mp3/.test(err.suggestion),
        name
      );
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("ask --schema passes a copy of the schema to agy and prints the checked JSON", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gemini-ask-schema-"));
  try {
    const schema = {
      type: "object",
      required: ["number", "colour"],
      additionalProperties: false,
      properties: { number: { type: "integer" }, colour: { type: "string", enum: ["black", "red"] } }
    };
    fs.writeFileSync(path.join(dir, "s.json"), JSON.stringify(schema));
    let seen;
    let passed;
    setRunReviewForTest(async (args) => {
      seen = args;
      passed = JSON.parse(fs.readFileSync(args.jsonSchema, "utf8"));
      return reply({ text: '{"number":58213,"colour":"black"}', response: "58213, black" });
    });
    const text = await captureStdout(() => handleAsk(["--schema", path.join(dir, "s.json")], { stdin: "read the image" }));
    assert.equal(seen.jsonSchema, path.join(seen.cwd, ".agents", "schema.json"), "the copy is where no file tool may read");
    assert.deepEqual(passed, schema);
    assert.equal(text, '{\n  "number": 58213,\n  "colour": "black"\n}\n\n[conversation] c-1\n');
    const json = JSON.parse(await captureStdout(() => handleAsk(["--json", "--schema", path.join(dir, "s.json")], { stdin: "read" })));
    assert.deepEqual(json.structuredOutput, { number: 58213, colour: "black" });
    assert.equal(json.response, "58213, black");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("ask --schema fails when the answer is empty or does not fit the schema", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gemini-ask-schema-"));
  try {
    const file = path.join(dir, "s.json");
    fs.writeFileSync(file, JSON.stringify({ type: "object", required: ["n"], properties: { n: { type: "integer" } } }));
    for (const [text, why] of [["", /Empty output/], ['{"n":"5"}', /expected integer/], ["{}", /missing required property "n"/], ["not json", /JSON parse failed/]]) {
      setRunReviewForTest(async () => reply({ text, response: "prose" }));
      await assert.rejects(
        () => handleAsk(["--schema", file], { stdin: "q" }),
        (err) => err instanceof OutputError && why.test(err.message) && /prose/.test(err.message) && /"unknown" enum value/.test(err.suggestion),
        text
      );
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("ask --schema that times out before the JSON answer says what to do about the time limit", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gemini-ask-schema-"));
  try {
    const file = path.join(dir, "s.json");
    fs.writeFileSync(file, JSON.stringify({ type: "object" }));
    setRunReviewForTest(async () => reply({ text: "", response: "half", timedOut: true, stopReason: "timeout" }));
    await assert.rejects(
      () => handleAsk(["--schema", file], { stdin: "q" }),
      (err) => err instanceof OutputError && /time limit/.test(err.suggestion) && /--background/.test(err.suggestion)
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("ask --schema refuses a schema with keywords the plugin cannot check, or bad JSON, without calling agy", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gemini-ask-schema-"));
  setRunReviewForTest(async () => {
    throw new Error("should not be called");
  });
  try {
    for (const [body, why] of [
      [JSON.stringify({ type: "object", properties: { a: { anyOf: [{ type: "string" }] } } }), /anyOf/],
      [JSON.stringify({ type: "object", properties: { a: { type: ["string", "null"] } } }), /list of types/],
      [JSON.stringify({ properties: { a: { type: "string" } } }), /"type": "object"/],
      ["{not json", /not valid JSON/]
    ]) {
      const file = path.join(dir, "s.json");
      fs.writeFileSync(file, body);
      await assert.rejects(() => handleAsk(["--schema", file], { stdin: "q" }), (err) => err instanceof ConfigError && why.test(err.message), body);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("ask denies every command, also plain ls, every subagent and reads outside its roots, and adds them to deniedActions", async () => {
  setRunReviewForTest(async ({ cwd }) => {
    const calls = [
      { name: "run_command", args: { CommandLine: "ls /src" } },
      { name: "run_command", args: { CommandLine: "grep -rn x /src > /src/out.txt" } },
      { name: "invoke_subagent", args: { Prompt: "Reply HELLO", Role: "Greeter", TypeName: "self" } },
      { name: "read_file", args: { Path: "/etc/hosts" } }
    ];
    for (const toolCall of calls) assert.equal(hookDecision(cwd, toolCall), "deny", toolCall.name);
    return reply({ deniedActions: [{ action: "read_url", display_name: "ReadUrl" }] });
  });
  const out = await captureStdout(() => handleAsk(["--json"], { stdin: "Search /src." }));
  assert.deepEqual(JSON.parse(out).deniedActions, [
    { action: "read_url", display_name: "ReadUrl" },
    { action: "command", display_name: "ls /src" },
    { action: "command", display_name: "grep -rn x /src > /src/out.txt" },
    { action: "invoke_subagent" },
    { action: "read_file", display_name: "/etc/hosts" }
  ]);
});

test("ask --timeout-ms sets the prompt timeout", async () => {
  let seen;
  setRunReviewForTest(async (args) => {
    seen = args;
    return reply();
  });
  await captureStdout(() => handleAsk(["--timeout-ms", "540000", "--model", "gemini-3.8-flash-low"], { stdin: "hi" }));
  assert.equal(seen.promptTimeoutMs, 540000);
  assert.equal(seen.model, "gemini-3.8-flash-low");
  await assert.rejects(() => handleAsk(["--timeout-ms", "0"], { stdin: "hi" }), ConfigError);
});

test("ask sends a prompt of up to 190,000 bytes as one message, past the old 128 KiB argv limit", async () => {
  let seen;
  setRunReviewForTest(async (args) => {
    seen = args;
    return reply();
  });
  await captureStdout(() => handleAsk([], { stdin: "x".repeat(189_000) }));
  assert.ok(Buffer.byteLength(seen.prompt) > 189_000 && Buffer.byteLength(seen.prompt) <= 190_000);
  assert.equal(seen.parts, undefined);
});

// A document of numbered lines, `lines` long, about 100 bytes per line.
const doc = (lines) => Array.from({ length: lines }, (_, i) => `${String(i).padStart(6, "0")} ${"word ".repeat(18)}`).join("\n");

test("ask splits a longer prompt file into parts at line ends; the last message holds the question, the lists and the tool rule", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gemini-ask-parts-"));
  try {
    const body = doc(5000); // about 500 KB
    fs.writeFileSync(path.join(dir, "big.md"), body);
    fs.writeFileSync(path.join(dir, "a.txt"), "A");
    let seen;
    setRunReviewForTest(async (args) => {
      seen = args;
      return reply();
    });
    await captureStdout(() =>
      handleAsk(["--cwd", dir, "--prompt-file", "big.md", "--file", "a.txt", "--", "Add code 1 and the last code."], { stdin: "" })
    );
    const n = splitIntoParts(body, 180_000).length;
    assert.equal(n, 3);
    assert.equal(seen.parts.length, n);
    const pieces = seen.parts.map((part, i) => {
      assert.ok(Buffer.byteLength(part) <= 190_000, `part ${i + 1} fits one message`);
      const header = `Part ${i + 1} of ${n} of the input. Remember it, and do not act on it yet. Do not use tools. Reply with only OK.\n\n`;
      assert.ok(part.startsWith(header), `part ${i + 1} header`);
      return part.slice(header.length);
    });
    assert.ok(pieces.join("") === body.trim(), "the parts hold the whole file, trimmed, in order");
    assert.ok(pieces.slice(0, -1).every((p) => p.endsWith("\n")), "each part but the last ends at a line end");
    assert.ok(seen.prompt.startsWith(`That was all ${n} parts of the input.\n\nAdd code 1 and the last code.\n\nFiles for this request`));
    assert.ok(seen.prompt.endsWith(toolRule({ pages: false })));
    assert.ok(!seen.prompt.includes("word word"), "the document is not in the last message");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("with no question in the arguments, the last message tells Gemini to do what the input asks", async () => {
  let seen;
  setRunReviewForTest(async (args) => {
    seen = args;
    return reply();
  });
  await captureStdout(() => handleAsk([], { stdin: doc(2500) }));
  assert.equal(seen.parts.length, 2);
  assert.equal(seen.prompt, `That was all 2 parts of the input. Now do what it asks.\n\n${toolRule()}`);
});

test("ask --resume with a long prompt sends the parts into the resumed conversation", async () => {
  let seen;
  setRunReviewForTest(async (args) => {
    seen = args;
    return reply({ conversationId: "c-9" });
  });
  await captureStdout(() => handleAsk(["--resume", "c-9"], { stdin: doc(2500) }));
  assert.equal(seen.conversationId, "c-9");
  assert.equal(seen.parts.length, 2);
});

test("ask rejects a prompt over 720,000 bytes, and a question too long for the last message", async () => {
  setRunReviewForTest(async () => {
    throw new Error("should not be called");
  });
  await assert.rejects(
    () => handleAsk([], { stdin: "x".repeat(720_000) }),
    (err) => err instanceof ConfigError && /720000/.test(err.message) && /--file/.test(err.suggestion)
  );
  await assert.rejects(
    () => handleAsk(["--", "q".repeat(195_000)], { stdin: "short body" }),
    (err) => err instanceof ConfigError && /one message can hold 190000/.test(err.message)
  );
});

test("ask --prompt-file reads the prompt from a file, after any argument text, and does not read stdin", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gemini-ask-prompt-file-"));
  try {
    fs.writeFileSync(path.join(dir, "prompt.md"), "Line one.\nIt's \"quoted\" and has $(no) expansion.\n");
    let prompt;
    setRunReviewForTest(async (args) => {
      prompt = args.prompt;
      return reply();
    });
    await captureStdout(() =>
      handleAsk(["--cwd", dir, "--prompt-file", "prompt.md", "Summarize:"], { stdin: "stdin text is not read" })
    );
    assert.equal(prompt, `Summarize:\n\nLine one.\nIt's "quoted" and has $(no) expansion.\n\n${toolRule()}`);
    // After --, text that starts with -- is prompt text, not a flag.
    await captureStdout(() => handleAsk(["--prompt-file", path.join(dir, "prompt.md"), "--", "--help means what?"], { stdin: "" }));
    assert.ok(prompt.startsWith("--help means what?\n\nLine one."), prompt.slice(0, 40));

    setRunReviewForTest(async () => {
      throw new Error("should not be called");
    });
    await assert.rejects(
      () => handleAsk(["--prompt-file", path.join(dir, "missing.md")], { stdin: "hi" }),
      (err) => err instanceof ConfigError && /Prompt file not found/.test(err.message)
    );
    fs.writeFileSync(path.join(dir, "empty.md"), " \n");
    await assert.rejects(() => handleAsk(["--prompt-file", path.join(dir, "empty.md")], { stdin: "hi" }), ConfigError);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("ask --resume passes the conversation ID to agy and prints it", async () => {
  let seen;
  setRunReviewForTest(async (args) => {
    seen = args;
    return reply({ conversationId: "3c758fbe-ecb4-4d7b-a9f9-94bda6aad668", response: "PLUM\n" });
  });
  const out = await captureStdout(() =>
    handleAsk(["--resume", "3c758fbe-ecb4-4d7b-a9f9-94bda6aad668"], { stdin: "Which word?" })
  );
  assert.equal(seen.conversationId, "3c758fbe-ecb4-4d7b-a9f9-94bda6aad668");
  assert.equal(out, "PLUM\n\n[conversation] 3c758fbe-ecb4-4d7b-a9f9-94bda6aad668\n");
});

test("ask --resume fails, and drops the answer, when agy started a new conversation instead", async () => {
  // agy 1.4.3 only warns on stderr for an unknown ID and answers in a new conversation (build test b7).
  setRunReviewForTest(async () => reply({ conversationId: "0a4b54d6-0fa9-4430-bc69-5e3d806ab810", response: "OK.\n" }));
  await assert.rejects(
    () => handleAsk(["--resume", "00000000-0000-4000-8000-000000000000"], { stdin: "hi" }),
    (err) => err instanceof ConfigError && /no conversation "00000000-0000-4000-8000-000000000000"/.test(err.message)
  );
});

test("ask --dir adds each folder with --add-dir, lists the folders and runs from a fresh temp folder", async () => {
  const a = fs.mkdtempSync(path.join(os.tmpdir(), "gemini-ask-dir-a-"));
  const b = fs.mkdtempSync(path.join(os.tmpdir(), "gemini-ask-dir-b-"));
  try {
    fs.writeFileSync(path.join(a, "main.cpp"), "x");
    let seen;
    setRunReviewForTest(async (args) => {
      seen = args;
      return reply();
    });
    await captureStdout(() => handleAsk(["--dir", a, "--dir", b, "--dir", a], { stdin: "Where is isDuplicate?" }));
    const real = [fs.realpathSync(a), fs.realpathSync(b)];
    assert.deepEqual(seen.addDirs, real, "each folder once, as a real path");
    assert.match(path.basename(seen.cwd), /^gemini-ask-cwd-/);
    assert.ok(
      seen.prompt.startsWith(
        `Where is isDuplicate?\n\nFolders for this request (absolute paths):\n- ${real[0]}\n- ${real[1]}\n\n`
      )
    );
    assert.ok(seen.prompt.endsWith(toolRule({ pages: false })), "one tool rule, with no ls or grep");
    assert.equal(fs.existsSync(seen.cwd), false, "the temp folder is removed");
    assert.equal(fs.existsSync(path.join(a, "main.cpp")), true, "the --dir folder is not removed");
  } finally {
    for (const d of [a, b]) fs.rmSync(d, { recursive: true, force: true });
  }
});

test("ask --dir lets the file reader read inside each folder, by folder boundary, and not through a link out of it", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gemini-ask-roots-"));
  try {
    for (const d of ["src", "src-secret", "out"]) fs.mkdirSync(path.join(root, d));
    fs.writeFileSync(path.join(root, "src", "a.txt"), "a");
    fs.writeFileSync(path.join(root, "src-secret", "key.txt"), "k");
    fs.writeFileSync(path.join(root, "out", "secret.txt"), "s");
    fs.symlinkSync(path.join(root, "out", "secret.txt"), path.join(root, "src", "link.txt"));
    const decisions = {};
    setRunReviewForTest(async ({ cwd }) => {
      const read = (p) => hookDecision(cwd, { name: "read_file", args: { Path: p } });
      const real = fs.realpathSync(root);
      decisions.inside = read(path.join(real, "src", "a.txt"));
      decisions.viaLink = read(path.join(real, "src", "link.txt"));
      decisions.samePrefix = read(path.join(real, "src-secret", "key.txt"));
      decisions.dotdot = read(path.join(real, "src", "..", "out", "secret.txt"));
      decisions.missing = read(path.join(real, "src", "nope.txt"));
      decisions.relative = read("src/a.txt");
      decisions.noPath = hookDecision(cwd, { name: "read_file", args: {} });
      return reply();
    });
    await captureStdout(() => handleAsk(["--dir", path.join(root, "src")], { stdin: "read a.txt" }));
    assert.deepEqual(decisions, {
      inside: "allow",
      viaLink: "deny",
      samePrefix: "deny",
      dotdot: "deny",
      missing: "deny",
      relative: "deny",
      noPath: "deny"
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("ask --dir with the home folder still denies agy's own folder, with its sign-in token and saved conversations", async () => {
  const agyHome = path.join(os.homedir(), ".gemini", "antigravity-cli");
  let decision;
  setRunReviewForTest(async ({ cwd }) => {
    decision = hookDecision(cwd, { name: "read_file", args: { Path: agyHome } });
    return reply();
  });
  await captureStdout(() => handleAsk(["--dir", os.homedir()], { stdin: "hi" }));
  // A missing folder is denied too, so this holds on a machine without agy.
  assert.equal(decision, "deny");
});

test("ask --dir accepts / and the home folder, and folders that share only /", async () => {
  const seen = [];
  setRunReviewForTest(async (args) => {
    seen.push(args.addDirs);
    return reply();
  });
  await captureStdout(() => handleAsk(["--dir", "/"], { stdin: "hi" }));
  await captureStdout(() => handleAsk(["--dir", os.homedir()], { stdin: "hi" }));
  await captureStdout(() => handleAsk(["--dir", os.homedir(), "--dir", os.tmpdir()], { stdin: "hi" }));
  assert.deepEqual(seen, [
    ["/"],
    [fs.realpathSync(os.homedir())],
    [fs.realpathSync(os.homedir()), fs.realpathSync(os.tmpdir())]
  ]);
});

test("ask --dir and --file work together", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gemini-ask-dir-"));
  try {
    fs.writeFileSync(path.join(dir, "a.txt"), "A");
    let seen;
    let copied;
    setRunReviewForTest(async (args) => {
      seen = args;
      copied = fs.readdirSync(path.join(args.cwd, "files"));
      return reply();
    });
    await captureStdout(() => handleAsk(["--dir", dir, "--file", path.join(dir, "a.txt")], { stdin: "hi" }));
    assert.deepEqual(copied, ["1-a.txt"]);
    assert.deepEqual(seen.addDirs, [fs.realpathSync(dir)]);
    assert.ok(seen.prompt.includes("Files for this request (absolute paths):"));
    assert.ok(seen.prompt.includes("Folders for this request (absolute paths):"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("ask, with or without --dir, fails before the run on an agy older than 1.4.3 or with no version", async () => {
  setRunReviewForTest(async () => {
    throw new Error("should not be called");
  });
  for (const argv of [[], ["--dir", os.tmpdir()]]) {
    for (const detail of ["1.4.2", "1.3.6", "agy not found on PATH"]) {
      useAgyVersion(detail);
      await assert.rejects(
        () => handleAsk(argv, { stdin: "hi" }),
        (err) => err instanceof ConfigError && /needs agy 1\.4\.3 or later/.test(err.message) && /agy update/.test(err.suggestion),
        detail
      );
    }
  }
  for (const detail of ["1.4.3", "1.5.0", "2.0.0"]) {
    useAgyVersion(detail);
    setRunReviewForTest(async () => reply());
    await captureStdout(() => handleAsk(["--dir", os.tmpdir()], { stdin: "hi" }));
  }
});

test("ask --dir rejects a missing folder without calling agy", async () => {
  setRunReviewForTest(async () => {
    throw new Error("should not be called");
  });
  await assert.rejects(
    () => handleAsk(["--dir", "/definitely/not/here"], { stdin: "hi" }),
    (err) => err instanceof ConfigError && /Folder not found/.test(err.message)
  );
});

test("ask rejects a full prompt over the cap, also when only the folder list makes it too long", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gemini-ask-dir-"));
  try {
    const dirs = Array.from({ length: 300 }, (_, i) => path.join(root, `${i}-${"x".repeat(240)}`));
    dirs.forEach((d) => fs.mkdirSync(d));
    setRunReviewForTest(async () => {
      throw new Error("should not be called");
    });
    // The plugin makes its temp folder in a fresh TMPDIR of its own, so that
    // other processes that run asks at the same time do not show up here.
    const tmp = fs.mkdtempSync(path.join(root, "tmpdir-"));
    const before = process.env.TMPDIR;
    process.env.TMPDIR = tmp;
    try {
      await assert.rejects(
        () => handleAsk(dirs.flatMap((d) => ["--dir", d]), { stdin: "x".repeat(700_000) }),
        (err) => err instanceof ConfigError && /folder lists/.test(err.message) && /720000/.test(err.message)
      );
    } finally {
      if (before === undefined) delete process.env.TMPDIR;
      else process.env.TMPDIR = before;
    }
    // The temp folder is still removed after the error.
    assert.deepEqual(fs.readdirSync(tmp), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("ask --prompt-file and --file refuse a symlink as the last path part, and send nothing", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gemini-ask-links-"));
  try {
    fs.writeFileSync(path.join(dir, "secret.txt"), "TOKEN=abc");
    fs.symlinkSync(path.join(dir, "secret.txt"), path.join(dir, "prompt.md"));
    setRunReviewForTest(async () => {
      throw new Error("should not be called");
    });
    await assert.rejects(
      () => handleAsk(["--prompt-file", path.join(dir, "prompt.md")], { stdin: "" }),
      (err) => err instanceof ConfigError && /Prompt file is a symlink/.test(err.message)
    );
    await assert.rejects(
      () => handleAsk(["--file", path.join(dir, "prompt.md")], { stdin: "read it" }),
      (err) => err instanceof ConfigError && /File is a symlink/.test(err.message)
    );
    // A dangling link is refused the same way.
    fs.symlinkSync(path.join(dir, "gone.txt"), path.join(dir, "dangling.md"));
    await assert.rejects(() => handleAsk(["--prompt-file", path.join(dir, "dangling.md")], { stdin: "" }), /symlink/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("ask refuses a path through a symlinked folder that a user made, also in the middle of the path", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gemini-ask-links-"));
  try {
    // bundle/data -> secrets, as an attacker could ship `bundle/data -> ~/.aws`.
    fs.mkdirSync(path.join(dir, "secrets"));
    fs.writeFileSync(path.join(dir, "secrets", "credentials"), "TOKEN=abc");
    fs.mkdirSync(path.join(dir, "bundle"));
    fs.symlinkSync(path.join(dir, "secrets"), path.join(dir, "bundle", "data"));
    setRunReviewForTest(async () => {
      throw new Error("should not be called");
    });
    const viaLink = path.join(dir, "bundle", "data", "credentials");
    await assert.rejects(
      () => handleAsk(["--prompt-file", viaLink], { stdin: "" }),
      (err) => err instanceof ConfigError && /Prompt file path goes through a symlink/.test(err.message) && err.message.includes(path.join(dir, "bundle", "data"))
    );
    await assert.rejects(
      () => handleAsk(["--file", viaLink], { stdin: "read it" }),
      (err) => err instanceof ConfigError && /File path goes through a symlink/.test(err.message)
    );
    // A relative path through the link is refused too.
    await assert.rejects(() => handleAsk(["--cwd", dir, "--prompt-file", "bundle/data/credentials"], { stdin: "" }), /symlink/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("ask reads a path through a system link that root owns, such as /tmp on macOS", async () => {
  const dir = fs.mkdtempSync("/tmp/gemini-ask-root-link-");
  try {
    fs.writeFileSync(path.join(dir, "p.md"), "Prompt under /tmp.");
    fs.writeFileSync(path.join(dir, "a.txt"), "A");
    let seen;
    let copied;
    setRunReviewForTest(async (args) => {
      seen = args;
      copied = fs.readFileSync(path.join(args.cwd, "files", "1-a.txt"), "utf8");
      return reply();
    });
    await captureStdout(() => handleAsk(["--prompt-file", path.join(dir, "p.md"), "--file", path.join(dir, "a.txt")], { stdin: "" }));
    assert.ok(seen.prompt.startsWith("Prompt under /tmp."));
    assert.equal(copied, "A");
    if (process.platform === "darwin") assert.ok(fs.lstatSync("/tmp").isSymbolicLink(), "on macOS, /tmp is a root-owned link");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("ask refuses a --file or --prompt-file that is not a regular file, without blocking on a named pipe", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gemini-ask-special-"));
  try {
    execFileSync("mkfifo", [path.join(dir, "pipe")]);
    setRunReviewForTest(async () => {
      throw new Error("should not be called");
    });
    await assert.rejects(
      () => handleAsk(["--file", path.join(dir, "pipe")], { stdin: "hi" }),
      (err) => err instanceof ConfigError && /not a regular file/.test(err.message)
    );
    await assert.rejects(
      () => handleAsk(["--prompt-file", dir], { stdin: "" }),
      (err) => err instanceof ConfigError && /not a regular file/.test(err.message)
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const CONV = "9689f39d-883e-4bf0-a848-11e420bc9c7d";

// A fake agy home with a brain folder for CONV, and an empty --image-out folder.
function imageFixture() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "gemini-ask-image-")));
  const brain = path.join(root, "agy", "brain", CONV);
  fs.mkdirSync(brain, { recursive: true });
  fs.mkdirSync(path.join(root, "out"));
  setAgyHomeForTest(path.join(root, "agy"));
  return { root, brain, out: path.join(root, "out") };
}

test("ask --image-out allows only the image-generator subagent, checks reference images, and uses the image tool rule", async () => {
  const { root, out } = imageFixture();
  try {
    fs.writeFileSync(path.join(root, "outside.png"), "png");
    const decisions = {};
    let seen;
    setRunReviewForTest(async (args) => {
      seen = args;
      const d = (toolCall, conversationId) => hookDecision(args.cwd, toolCall, conversationId);
      fs.writeFileSync(path.join(args.cwd, "files", "ref.png"), "png");
      // The subagent may answer only the conversation that started it.
      decisions.answerBeforeStart = d({ name: "send_message", args: { Recipient: "parent-1", Message: "done" } }, "sub-1");
      decisions.imageGenerator = d({ name: "invoke_subagent", args: { Prompt: "a cube", Role: "r", TypeName: "image-generator" } });
      decisions.listForm = d({ name: "invoke_subagent", args: { Subagents: [{ Prompt: "a", TypeName: "image-generator" }] } });
      decisions.self = d({ name: "invoke_subagent", args: { Prompt: "a", TypeName: "self" } });
      decisions.mixed = d({ name: "invoke_subagent", args: { Subagents: [{ TypeName: "image-generator" }, { TypeName: "self" }] } });
      decisions.ownWorkspace = d({ name: "invoke_subagent", args: { TypeName: "image-generator", Workspace: "/" } });
      decisions.noReference = d({ name: "generate_image", args: { Prompt: "a cube", ImageName: "cube" } });
      decisions.refInside = d({ name: "generate_image", args: { Prompt: "a", ImagePaths: [path.join(args.cwd, "files", "ref.png")] } });
      decisions.refOutside = d({ name: "generate_image", args: { Prompt: "a", ImagePaths: [path.join(args.cwd, "files", "ref.png"), path.join(root, "outside.png")] } });
      decisions.answerParent = d({ name: "send_message", args: { Recipient: "parent-1", Message: "done" } }, "sub-1");
      decisions.answerOther = d({ name: "send_message", args: { Recipient: "00000000-0000-4000-8000-000000000000", Message: "x" } }, "sub-1");
      decisions.answerNoRecipient = d({ name: "send_message", args: { Message: "x" } }, "sub-1");
      decisions.command = d({ name: "run_command", args: { CommandLine: "ls" } });
      decisions.readOutside = d({ name: "view_file", args: { AbsolutePath: path.join(root, "outside.png") } });
      return reply({ conversationId: CONV });
    });
    // No image was saved, so the ask fails after the checks.
    await assert.rejects(() => handleAsk(["--image-out", out], { stdin: "draw a cube" }), (err) => err instanceof OutputError && /made no image/.test(err.message));
    assert.ok(seen.prompt.endsWith(toolRule({ image: true })));
    assert.deepEqual(decisions, {
      imageGenerator: "allow",
      listForm: "allow",
      self: "deny",
      mixed: "deny",
      ownWorkspace: "deny",
      noReference: "allow",
      refInside: "allow",
      refOutside: "deny",
      answerBeforeStart: "deny",
      answerParent: "allow",
      answerOther: "deny",
      answerNoRecipient: "deny",
      command: "deny",
      readOutside: "deny"
    });
  } finally {
    setAgyHomeForTest(null);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("ask --image-out copies only new regular image files of this conversation, and lists them", async () => {
  const { root, brain, out } = imageFixture();
  try {
    fs.writeFileSync(path.join(root, "secret.png"), "secret");
    fs.writeFileSync(path.join(brain, "old.png"), "old");
    const past = new Date(Date.now() - 3_600_000);
    fs.utimesSync(path.join(brain, "old.png"), past, past);
    setRunReviewForTest(async () => {
      fs.writeFileSync(path.join(brain, "cube_1.jpg"), "jpg");
      fs.writeFileSync(path.join(brain, "empty.png"), "");
      fs.writeFileSync(path.join(brain, "notes.md"), "md");
      fs.symlinkSync(path.join(root, "secret.png"), path.join(brain, "link.png"));
      return reply({ conversationId: CONV, response: "Made a cube." });
    });
    const json = JSON.parse(await captureStdout(() => handleAsk(["--json", "--resume", CONV, "--image-out", out], { stdin: "draw a cube" })));
    assert.deepEqual(json.images, [path.join(out, "cube_1.jpg")]);
    assert.deepEqual(fs.readdirSync(out), ["cube_1.jpg"]);
    assert.equal(fs.readFileSync(path.join(out, "cube_1.jpg"), "utf8"), "jpg");
    assert.ok(fs.existsSync(path.join(brain, "cube_1.jpg")), "agy's own folder is left alone");

    // Text output lists the copies; an existing file of the same name is never overwritten.
    setRunReviewForTest(async () => {
      fs.writeFileSync(path.join(brain, "cube_1.jpg"), "jpg 2");
      return reply({ conversationId: CONV, response: "Again." });
    });
    await assert.rejects(
      () => handleAsk(["--resume", CONV, "--image-out", out], { stdin: "draw" }),
      (err) => err instanceof ConfigError && /already has a file/.test(err.message)
    );
    assert.equal(fs.readFileSync(path.join(out, "cube_1.jpg"), "utf8"), "jpg");
    fs.rmSync(path.join(out, "cube_1.jpg"));
    setRunReviewForTest(async () => {
      fs.writeFileSync(path.join(brain, "cube_1.jpg"), "jpg 3");
      return reply({ conversationId: CONV, response: "Again." });
    });
    const text = await captureStdout(() => handleAsk(["--resume", CONV, "--image-out", out], { stdin: "draw" }));
    assert.equal(text, `Again.\n\n[image] ${path.join(out, "cube_1.jpg")}\n[conversation] ${CONV}\n`);
  } finally {
    setAgyHomeForTest(null);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("ask --image-out refuses a missing folder, a file, or a path through a user's symlink, without calling agy", async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "gemini-ask-image-")));
  setRunReviewForTest(async () => {
    throw new Error("should not be called");
  });
  try {
    fs.mkdirSync(path.join(root, "real"));
    fs.writeFileSync(path.join(root, "file"), "x");
    fs.symlinkSync(path.join(root, "real"), path.join(root, "link"));
    for (const p of [path.join(root, "missing"), path.join(root, "file"), path.join(root, "link")]) {
      await assert.rejects(() => handleAsk(["--image-out", p], { stdin: "draw" }), ConfigError, p);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("ask --image-out on a resumed conversation fails when the run made no image, also when an older one is a moment old", async () => {
  const { root, brain, out } = imageFixture();
  try {
    fs.writeFileSync(path.join(brain, "earlier.png"), "png");
    const halfSecondAgo = new Date(Date.now() - 500);
    fs.utimesSync(path.join(brain, "earlier.png"), halfSecondAgo, halfSecondAgo);
    setRunReviewForTest(async () => reply({ conversationId: CONV, response: "Here is your image." }));
    await assert.rejects(
      () => handleAsk(["--resume", CONV, "--image-out", out], { stdin: "again" }),
      (err) => err instanceof OutputError && /made no image/.test(err.message)
    );
    assert.deepEqual(fs.readdirSync(out), []);
    // A file that the run changed counts as made.
    setRunReviewForTest(async () => {
      fs.writeFileSync(path.join(brain, "earlier.png"), "a new png");
      return reply({ conversationId: CONV });
    });
    const json = JSON.parse(await captureStdout(() => handleAsk(["--json", "--resume", CONV, "--image-out", out], { stdin: "redo" })));
    assert.deepEqual(json.images, [path.join(out, "earlier.png")]);
  } finally {
    setAgyHomeForTest(null);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("ask --image-out that made an image passes with an empty answer", async () => {
  const { root, brain, out } = imageFixture();
  try {
    setRunReviewForTest(async () => {
      fs.writeFileSync(path.join(brain, "cube.png"), "png");
      return reply({ conversationId: CONV, text: "", response: "" });
    });
    const text = await captureStdout(() => handleAsk(["--resume", CONV, "--image-out", out], { stdin: "draw" }));
    assert.equal(text, `[note] The model returned no text.\n[image] ${path.join(out, "cube.png")}\n[conversation] ${CONV}\n`);
  } finally {
    setAgyHomeForTest(null);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("ask --dir denies agy's home and the run's .agents folder, also when the path is written in another case", async () => {
  const { root } = imageFixture(); // agy home is <root>/agy
  try {
    fs.writeFileSync(path.join(root, "agy", "brain", CONV, "t.png"), "png");
    const decisions = {};
    setRunReviewForTest(async ({ cwd }) => {
      const read = (p) => hookDecision(cwd, { name: "read_file", args: { Path: p } });
      decisions.agyHome = read(path.join(root, "AGY", "Brain", CONV, "t.png"));
      // The .agents folder sits inside the root when --dir is the temp folder's parent.
      decisions.agents = read(path.join(cwd, ".AGENTS", "hooks.json"));
      return reply();
    });
    await captureStdout(() => handleAsk(["--dir", root, "--dir", os.tmpdir()], { stdin: "hi" }));
    assert.deepEqual(decisions, { agyHome: "deny", agents: "deny" });
  } finally {
    setAgyHomeForTest(null);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("ask --schema accepts the answers false, 0, an empty string and null, and an enum of objects", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gemini-ask-schema-"));
  try {
    const file = path.join(dir, "s.json");
    for (const [schema, text, want] of [
      [{ type: "boolean" }, "false", false],
      [{ type: "integer" }, "0", 0],
      [{ type: "string" }, '""', ""],
      [{ type: "null" }, "null", null],
      [{ enum: [{ x: 1 }, [1, 2]] }, '{"x":1}', { x: 1 }],
      [{ enum: [{ x: 1 }, [1, 2]] }, "[1,2]", [1, 2]]
    ]) {
      fs.writeFileSync(file, JSON.stringify(schema));
      setRunReviewForTest(async () => reply({ text, response: text }));
      const json = JSON.parse(await captureStdout(() => handleAsk(["--json", "--schema", file], { stdin: "q" })));
      assert.deepEqual(json.structuredOutput, want, text);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("an ask with --file or --dir denies page reads and its tool rule says so; web search, finish and the file reader stay", async () => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "gemini-ask-local-")));
  try {
    fs.writeFileSync(path.join(dir, "a.txt"), "A");
    for (const flags of [["--file", path.join(dir, "a.txt")], ["--dir", dir]]) {
      let seen;
      const decisions = {};
      setRunReviewForTest(async (args) => {
        seen = args;
        for (const name of ["search_web", "finish", "read_url_content"]) decisions[name] = hookDecision(args.cwd, { name, args: {} });
        decisions.read = hookDecision(args.cwd, { name: "read_file", args: { Path: path.join(dir, "a.txt") } });
        fs.writeFileSync(path.join(args.cwd, "files", "x.txt"), "x");
        decisions.readCopy = hookDecision(args.cwd, { name: "read_file", args: { Path: path.join(args.cwd, "files", "x.txt") } });
        return reply();
      });
      await captureStdout(() => handleAsk(flags, { stdin: "Summarize it." }));
      assert.deepEqual(
        decisions,
        { search_web: "allow", finish: "allow", read_url_content: "deny", read: flags[0] === "--dir" ? "allow" : "deny", readCopy: "allow" },
        flags[0]
      );
      assert.ok(seen.prompt.endsWith(toolRule({ pages: false })), flags[0]);
      assert.match(seen.prompt, /This run cannot open web pages\./);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("every --resume ask denies page reads, also with no --file or --dir, and its tool rule says so", async () => {
  let seen;
  const decisions = {};
  setRunReviewForTest(async (args) => {
    seen = args;
    for (const name of ["search_web", "finish", "read_url_content"]) decisions[name] = hookDecision(args.cwd, { name, args: {} });
    return reply();
  });
  await captureStdout(() => handleAsk(["--resume", "c-1"], { stdin: "And the next step?" }));
  assert.deepEqual(decisions, { search_web: "allow", finish: "allow", read_url_content: "deny" });
  assert.ok(seen.prompt.endsWith(toolRule({ pages: false })));
});

test("--file copies the whole file through short writes, and fails on a write of zero bytes", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gemini-ask-short-"));
  const realWriteSync = fs.writeSync;
  try {
    fs.writeFileSync(path.join(dir, "a.txt"), "abcdef");
    let copied;
    setRunReviewForTest(async (args) => {
      copied = fs.readFileSync(path.join(args.cwd, "files", "1-a.txt"), "utf8");
      return reply();
    });
    // Each write takes at most 3 bytes, as a short write can.
    fs.writeSync = (fd, buf, off, len, pos) => realWriteSync(fd, buf, off, Math.min(len, 3), pos);
    await captureStdout(() => handleAsk(["--file", path.join(dir, "a.txt")], { stdin: "read it" }));
    assert.equal(copied, "abcdef");
    fs.writeSync = () => 0;
    await assert.rejects(() => handleAsk(["--file", path.join(dir, "a.txt")], { stdin: "read it" }), /wrote 0 bytes/);
  } finally {
    fs.writeSync = realWriteSync;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("an image copy that fails partway leaves no partial file in --image-out, and keeps its error", async () => {
  const { brain, out, root } = imageFixture();
  const realWriteSync = fs.writeSync;
  try {
    setRunReviewForTest(async () => {
      fs.writeFileSync(path.join(brain, "cube.png"), "abcdef");
      // The export writes 3 bytes, then nothing more.
      let calls = 0;
      fs.writeSync = (fd, buf, off, len, pos) => (calls++ === 0 ? realWriteSync(fd, buf, off, Math.min(len, 3), pos) : 0);
      return reply({ conversationId: CONV, response: "Made a cube." });
    });
    await assert.rejects(() => handleAsk(["--image-out", out], { stdin: "draw a cube" }), (err) => err instanceof ConfigError && /wrote 0 bytes/.test(err.message));
    fs.writeSync = realWriteSync;
    assert.deepEqual(fs.readdirSync(out), []);
  } finally {
    fs.writeSync = realWriteSync;
    setAgyHomeForTest(null);
    fs.rmSync(root, { recursive: true, force: true });
  }
});
