import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  handleAsk,
  setRunReviewForTest,
  DEFAULT_ASK_MODEL,
  ASK_TOOL_RULE
} from "../plugins/gemini/scripts/gemini-companion.mjs";
import { ConfigError, AgyModelError } from "../plugins/gemini/scripts/lib/errors.mjs";

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

beforeEach(() => setRunReviewForTest(null));
afterEach(() => setRunReviewForTest(null));

test("ask uses the default model, runs from a fresh temp folder and removes it", async () => {
  let seen;
  setRunReviewForTest(async (args) => {
    seen = args;
    assert.ok(fs.existsSync(args.cwd), "temp folder exists while agy runs");
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
      copied = fs.readdirSync(args.cwd).sort().map((n) => [n, fs.readFileSync(path.join(args.cwd, n), "utf8")]);
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

test("ask --dir runs agy inside the folder, lists its files and leaves the folder in place", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gemini-ask-dir-"));
  try {
    fs.mkdirSync(path.join(dir, "core"));
    fs.mkdirSync(path.join(dir, ".git"));
    fs.mkdirSync(path.join(dir, "node_modules"));
    fs.writeFileSync(path.join(dir, "core", "dupes.cpp"), "x");
    fs.writeFileSync(path.join(dir, "main.cpp"), "x");
    fs.writeFileSync(path.join(dir, ".git", "HEAD"), "x");
    fs.writeFileSync(path.join(dir, "node_modules", "pkg.js"), "x");
    fs.symlinkSync("/etc/hosts", path.join(dir, "hosts-link"));
    let seen;
    setRunReviewForTest(async (args) => {
      seen = args;
      return reply();
    });
    await captureStdout(() => handleAsk(["--dir", dir], { stdin: "Where is isDuplicate?" }));
    assert.equal(seen.cwd, dir);
    assert.ok(
      seen.prompt.includes("Files in the current folder (relative paths):\n- core/dupes.cpp\n- main.cpp\n\n"),
      "lists only regular files outside dot folders and node_modules"
    );
    assert.ok(!/HEAD|pkg\.js|hosts-link/.test(seen.prompt), "skips .git, node_modules and symlinks");
    assert.ok(seen.prompt.endsWith(ASK_TOOL_RULE));
    assert.equal(fs.existsSync(path.join(dir, "main.cpp")), true, "the folder is not removed");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("ask --dir rejects a missing folder, --file together with --dir, and a file list that is too long", async () => {
  setRunReviewForTest(async () => {
    throw new Error("should not be called");
  });
  await assert.rejects(
    () => handleAsk(["--dir", "/definitely/not/here"], { stdin: "hi" }),
    (err) => err instanceof ConfigError && /Folder not found/.test(err.message)
  );
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gemini-ask-dir-"));
  try {
    fs.writeFileSync(path.join(dir, "a.txt"), "A");
    await assert.rejects(
      () => handleAsk(["--dir", dir, "--file", path.join(dir, "a.txt")], { stdin: "hi" }),
      (err) => err instanceof ConfigError && /not both/.test(err.message)
    );
    for (let i = 0; i < 1500; i++) fs.writeFileSync(path.join(dir, `file-with-a-long-name-${i}.txt`), "");
    await assert.rejects(
      () => handleAsk(["--dir", dir], { stdin: "hi" }),
      (err) => err instanceof ConfigError && /20000 bytes/.test(err.message) && /subfolders/.test(err.suggestion)
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("ask --dir can repeat: agy runs in the common parent and the list covers only the given folders", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gemini-ask-dir-"));
  try {
    for (const d of ["core/libs/imgqsort", "core/libs/haar", "core/ui"]) fs.mkdirSync(path.join(root, d), { recursive: true });
    fs.writeFileSync(path.join(root, "core/libs/imgqsort", "blur.cpp"), "x");
    fs.writeFileSync(path.join(root, "core/libs/haar", "haar.cpp"), "x");
    fs.writeFileSync(path.join(root, "core/ui", "button.cpp"), "x");
    let seen;
    setRunReviewForTest(async (args) => {
      seen = args;
      return reply();
    });
    await captureStdout(() =>
      handleAsk(["--dir", path.join(root, "core/libs/imgqsort"), "--dir", path.join(root, "core/libs/haar")], {
        stdin: "Compare."
      })
    );
    assert.equal(seen.cwd, path.join(root, "core/libs"));
    assert.ok(seen.prompt.includes("- imgqsort/blur.cpp\n- haar/haar.cpp"));
    assert.ok(!seen.prompt.includes("button.cpp"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("ask --dir refuses folders whose only common parent is the home folder", async () => {
  setRunReviewForTest(async () => {
    throw new Error("should not be called");
  });
  const a = fs.mkdtempSync(path.join(os.homedir(), ".gemini-ask-test-a-"));
  const b = fs.mkdtempSync(path.join(os.homedir(), ".gemini-ask-test-b-"));
  try {
    await assert.rejects(
      () => handleAsk(["--dir", a, "--dir", b], { stdin: "hi" }),
      (err) => err instanceof ConfigError && /read everything/.test(err.message)
    );
  } finally {
    fs.rmSync(a, { recursive: true, force: true });
    fs.rmSync(b, { recursive: true, force: true });
  }
});
