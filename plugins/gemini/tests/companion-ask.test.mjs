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
  ASK_DIR_TOOL_RULE
} from "../scripts/gemini-companion.mjs";
import { ConfigError, AgyModelError } from "../scripts/lib/errors.mjs";
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
    assert.equal(group.matcher, "run_command");
    assert.equal(group.hooks[0].command.split("' '").length, 3, "node, the gate and the log");
    assert.match(group.hooks[0].command, /\/scripts\/command-gate\.mjs' '.+\/\.agents\/denied\.jsonl'$/);
    return reply();
  });
  const out = await captureStdout(() => handleAsk([], { stdin: "Reply with PONG." }));
  assert.equal(out, "PONG\n");
  assert.equal(seen.model, DEFAULT_ASK_MODEL);
  assert.equal(DEFAULT_ASK_MODEL, "gemini-3.8-flash-medium");
  assert.equal(seen.prompt, `Reply with PONG.\n\n${ASK_TOOL_RULE}`);
  assert.equal(seen.addDirs, undefined);
  assert.equal(seen.jsonSchema, undefined);
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
  assert.equal(cut, "Half an ans\n\n[note] agy hit its time limit, so this answer was cut off.\n");
});

test("ask --json returns model, response, tokens, deniedActions and timedOut", async () => {
  setRunReviewForTest(async () => reply());
  const out = await captureStdout(() => handleAsk(["--json"], { stdin: "Reply with PONG." }));
  assert.deepEqual(JSON.parse(out), {
    model: DEFAULT_ASK_MODEL,
    response: "PONG\n",
    tokens: { input_tokens: 11828, output_tokens: 2, total_tokens: 11830 },
    deniedActions: [],
    timedOut: false
  });
});

test("ask adds the commands that the hook denied to deniedActions", async () => {
  setRunReviewForTest(async ({ cwd }) => {
    // Run the hook the way agy does, from the hooks.json in the temp folder.
    const hooks = JSON.parse(fs.readFileSync(path.join(cwd, ".agents", "hooks.json"), "utf8"));
    const { command } = hooks["gemini-plugin-command-gate"].PreToolUse[0].hooks[0];
    for (const CommandLine of ["ls /src", "grep -rn x /src > /src/out.txt"]) {
      execFileSync("sh", ["-c", command], { input: JSON.stringify({ toolCall: { name: "run_command", args: { CommandLine } } }) });
    }
    return reply({ deniedActions: [{ action: "read_url", display_name: "ReadUrl" }] });
  });
  const out = await captureStdout(() => handleAsk(["--json"], { stdin: "Search /src." }));
  assert.deepEqual(JSON.parse(out).deniedActions, [
    { action: "read_url", display_name: "ReadUrl" },
    { action: "command", display_name: "grep -rn x /src > /src/out.txt" }
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

test("ask rejects a prompt over 100,000 bytes and points at --file", async () => {
  setRunReviewForTest(async () => {
    throw new Error("should not be called");
  });
  await assert.rejects(
    () => handleAsk([], { stdin: "x".repeat(100_001) }),
    (err) => err instanceof ConfigError && /100000/.test(err.message) && /--file/.test(err.suggestion)
  );
  setRunReviewForTest(async () => reply());
  await captureStdout(() => handleAsk([], { stdin: "x".repeat(100_000) }));
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

test("ask rejects a full prompt over the argv limit, also when only the folder list makes it too long", async () => {
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
      () => handleAsk(dirs.flatMap((d) => ["--dir", d]), { stdin: "x".repeat(60_000) }),
      (err) => err instanceof ConfigError && /folder lists/.test(err.message) && /fewer/.test(err.suggestion)
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
