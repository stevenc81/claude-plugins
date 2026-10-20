import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  handleAsk,
  setRunReviewForTest,
  setAgySettingsPathForTest,
  setBinaryAvailableForTest,
  DEFAULT_ASK_MODEL,
  ASK_TOOL_RULE,
  ASK_DIR_TOOL_RULE,
  GATED_TOOLS
} from "../scripts/gemini-companion.mjs";
import { ConfigError, AgyModelError } from "../scripts/lib/errors.mjs";
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
  useAgyVersion("1.4.2");
});
afterEach(() => {
  setRunReviewForTest(null);
  setAgySettingsPathForTest(null);
  setBinaryAvailableForTest(null);
});

// Writes an agy settings.json with the given allow rules and points the
// companion at it. Returns the temp folder, which the caller removes.
function useAgySettings(allow) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gemini-ask-settings-"));
  const file = path.join(dir, "settings.json");
  fs.writeFileSync(file, JSON.stringify({ permissions: { allow } }));
  setAgySettingsPathForTest(file);
  return dir;
}

test("ask uses the default model, runs from a fresh temp folder and removes it", async () => {
  let seen;
  setRunReviewForTest(async (args) => {
    seen = args;
    assert.ok(fs.existsSync(args.cwd), "temp folder exists while agy runs");
    const hooks = JSON.parse(fs.readFileSync(path.join(args.cwd, ".agents", "hooks.json"), "utf8"));
    const [group] = hooks["gemini-plugin-command-gate"].PreToolUse;
    assert.equal(group.matcher, GATED_TOOLS);
    for (const tool of ["run_command", "invoke_subagent", "define_subagent", "manage_subagents", "browser_subagent", "schedule"]) {
      assert.match(tool, new RegExp(group.matcher), tool);
    }
    for (const tool of ["search_web", "read_file", "read_url_content", "send_command_input", "run_command_x"]) {
      assert.doesNotMatch(tool, new RegExp(group.matcher), tool);
    }
    assert.equal(group.hooks[0].command.split("' '").length, 3, "node, the gate and the log; commands allowed");
    assert.match(group.hooks[0].command, /\/scripts\/command-gate\.mjs' '.+\/\.agents\/denied\.jsonl'$/);
    return reply();
  });
  const out = await captureStdout(() => handleAsk([], { stdin: "Reply with PONG." }));
  assert.equal(out, "PONG\n\n[conversation] c-1\n");
  assert.equal(seen.model, DEFAULT_ASK_MODEL);
  assert.equal(DEFAULT_ASK_MODEL, "gemini-3.8-flash-medium");
  assert.equal(seen.prompt, `Reply with PONG.\n\n${ASK_TOOL_RULE}`);
  assert.equal(seen.addDirs, undefined);
  assert.equal(seen.jsonSchema, undefined);
  assert.equal(seen.conversationId, undefined);
  assert.equal(seen.denialLog, path.join(seen.cwd, ".agents", "denied.jsonl"), "the runner can read the hook's denials");
  assert.equal(path.dirname(seen.cwd), path.resolve(os.tmpdir()));
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
  assert.equal(prompt, `Summarize this:\n\nSome long text.\n\n${ASK_TOOL_RULE}`);
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
      copied = fs.readdirSync(args.cwd).filter((n) => n !== ".agents").sort().map((n) => [n, fs.readFileSync(path.join(args.cwd, n), "utf8")]);
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
      assert.ok(seen.prompt.includes(`- ${path.join(seen.cwd, name)}`), `prompt lists ${name}`);
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
      text: "",
      response: "",
      deniedActions: [{ action: "read_file", display_name: "ViewFile" }]
    })
  );
  const refused = await captureStdout(() => handleAsk([], { stdin: "read it" }));
  assert.match(refused, /\[note\] The model returned no text\./);
  assert.match(refused, /\[note\] agy refused these tools: ViewFile \(read_file\)\./);

  setRunReviewForTest(async () => reply({ text: "Half an ans", response: "Half an ans", timedOut: true }));
  const cut = await captureStdout(() => handleAsk([], { stdin: "essay" }));
  assert.equal(cut, "Half an ans\n\n[note] agy hit its time limit, so this answer was cut off.\n[conversation] c-1\n");
});

test("ask --json returns model, conversationId, response, tokens, deniedActions and timedOut", async () => {
  setRunReviewForTest(async () => reply());
  const out = await captureStdout(() => handleAsk(["--json"], { stdin: "Reply with PONG." }));
  assert.deepEqual(JSON.parse(out), {
    model: DEFAULT_ASK_MODEL,
    conversationId: "c-1",
    response: "PONG\n",
    tokens: { input_tokens: 11828, output_tokens: 2, total_tokens: 11830 },
    deniedActions: [],
    timedOut: false
  });
});

test("ask adds the commands and subagents that the hook denied to deniedActions", async () => {
  setRunReviewForTest(async ({ cwd }) => {
    // Run the hook the way agy does, from the hooks.json in the temp folder.
    const hooks = JSON.parse(fs.readFileSync(path.join(cwd, ".agents", "hooks.json"), "utf8"));
    const { command } = hooks["gemini-plugin-command-gate"].PreToolUse[0].hooks[0];
    const calls = [
      { name: "run_command", args: { CommandLine: "ls /src" } },
      { name: "run_command", args: { CommandLine: "grep -rn x /src > /src/out.txt" } },
      { name: "invoke_subagent", args: { Prompt: "Reply HELLO", Role: "Greeter", TypeName: "self" } }
    ];
    for (const toolCall of calls) execFileSync("sh", ["-c", command], { input: JSON.stringify({ toolCall }) });
    return reply({ deniedActions: [{ action: "read_url", display_name: "ReadUrl" }] });
  });
  const out = await captureStdout(() => handleAsk(["--json"], { stdin: "Search /src." }));
  assert.deepEqual(JSON.parse(out).deniedActions, [
    { action: "read_url", display_name: "ReadUrl" },
    { action: "command", display_name: "grep -rn x /src > /src/out.txt" },
    { action: "invoke_subagent" }
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
    assert.ok(seen.prompt.endsWith(ASK_TOOL_RULE));
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
  assert.equal(seen.prompt, `That was all 2 parts of the input. Now do what it asks.\n\n${ASK_TOOL_RULE}`);
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
    assert.equal(prompt, `Summarize:\n\nLine one.\nIt's "quoted" and has $(no) expansion.\n\n${ASK_TOOL_RULE}`);
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
  const settings = useAgySettings(["read_url(*)", "command(ls)", "command(grep)"]);
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
    assert.ok(seen.prompt.endsWith(ASK_DIR_TOOL_RULE));
    assert.equal(fs.existsSync(seen.cwd), false, "the temp folder is removed");
    assert.equal(fs.existsSync(path.join(a, "main.cpp")), true, "the --dir folder is not removed");
  } finally {
    for (const d of [settings, a, b]) fs.rmSync(d, { recursive: true, force: true });
  }
});

test("ask --dir accepts / and the home folder, and folders that share only /", async () => {
  const settings = useAgySettings(["command(ls)", "command(grep)"]);
  try {
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
  } finally {
    fs.rmSync(settings, { recursive: true, force: true });
  }
});

test("ask --dir and --file work together", async () => {
  const settings = useAgySettings(["command(ls)", "command(grep)"]);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gemini-ask-dir-"));
  try {
    fs.writeFileSync(path.join(dir, "a.txt"), "A");
    let seen;
    let copied;
    setRunReviewForTest(async (args) => {
      seen = args;
      copied = fs.readdirSync(args.cwd).filter((n) => n !== ".agents");
      return reply();
    });
    await captureStdout(() => handleAsk(["--dir", dir, "--file", path.join(dir, "a.txt")], { stdin: "hi" }));
    assert.deepEqual(copied, ["1-a.txt"]);
    assert.deepEqual(seen.addDirs, [fs.realpathSync(dir)]);
    assert.ok(seen.prompt.includes("Files for this request (absolute paths):"));
    assert.ok(seen.prompt.includes("Folders for this request (absolute paths):"));
  } finally {
    fs.rmSync(settings, { recursive: true, force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("ask --dir fails before the run when agy does not allow ls and grep", async () => {
  setRunReviewForTest(async () => {
    throw new Error("should not be called");
  });
  const onlyLs = useAgySettings(["read_url(*)", "command(ls)"]);
  try {
    await assert.rejects(
      () => handleAsk(["--dir", os.tmpdir()], { stdin: "hi" }),
      (err) =>
        err instanceof ConfigError &&
        /needs agy to allow ls and grep/.test(err.message) &&
        /"command\(ls\)" and "command\(grep\)"/.test(err.suggestion)
    );
    setAgySettingsPathForTest(path.join(onlyLs, "missing.json"));
    await assert.rejects(() => handleAsk(["--dir", os.tmpdir()], { stdin: "hi" }), ConfigError);
    fs.writeFileSync(path.join(onlyLs, "broken.json"), "{ not json");
    setAgySettingsPathForTest(path.join(onlyLs, "broken.json"));
    await assert.rejects(() => handleAsk(["--dir", os.tmpdir()], { stdin: "hi" }), ConfigError);
  } finally {
    fs.rmSync(onlyLs, { recursive: true, force: true });
  }
});

test("ask --dir fails before the run on an agy older than 1.4.2 or with no version", async () => {
  setRunReviewForTest(async () => {
    throw new Error("should not be called");
  });
  const settings = useAgySettings(["command(ls)", "command(grep)"]);
  try {
    for (const detail of ["1.4.1", "1.3.6", "agy not found on PATH"]) {
      useAgyVersion(detail);
      await assert.rejects(
        () => handleAsk(["--dir", os.tmpdir()], { stdin: "hi" }),
        (err) => err instanceof ConfigError && /needs agy 1\.4\.2 or later/.test(err.message) && /agy update/.test(err.suggestion),
        detail
      );
    }
    for (const detail of ["1.4.2", "1.5.0", "2.0.0"]) {
      useAgyVersion(detail);
      setRunReviewForTest(async () => reply());
      await captureStdout(() => handleAsk(["--dir", os.tmpdir()], { stdin: "hi" }));
    }
  } finally {
    fs.rmSync(settings, { recursive: true, force: true });
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
  const settings = useAgySettings(["command(ls)", "command(grep)"]);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gemini-ask-dir-"));
  try {
    const dirs = Array.from({ length: 300 }, (_, i) => path.join(root, `${i}-${"x".repeat(240)}`));
    dirs.forEach((d) => fs.mkdirSync(d));
    let cwd;
    setRunReviewForTest(async () => {
      throw new Error("should not be called");
    });
    await assert.rejects(
      () => handleAsk(dirs.flatMap((d) => ["--dir", d]), { stdin: "x".repeat(700_000) }),
      (err) => err instanceof ConfigError && /folder lists/.test(err.message) && /720000/.test(err.message)
    );
    // The temp folder is still removed after the error.
    const left = fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith("gemini-ask-cwd-"));
    cwd = left.find((n) => fs.statSync(path.join(os.tmpdir(), n)).mtimeMs > Date.now() - 5000);
    assert.equal(cwd, undefined);
  } finally {
    fs.rmSync(settings, { recursive: true, force: true });
    fs.rmSync(root, { recursive: true, force: true });
  }
});
