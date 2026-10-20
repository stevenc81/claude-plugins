import { test } from "node:test";
import assert from "node:assert/strict";
import { splitIntoParts } from "../scripts/lib/text-utils.mjs";

const bytes = (s) => Buffer.byteLength(s, "utf8");

test("splitIntoParts cuts after line ends, keeps each part under the size, and joins back to the text", () => {
  // 10 lines of exactly 100 bytes each.
  const text = Array.from({ length: 10 }, (_, i) => `${String(i).padStart(2, "0")} ${"x".repeat(96)}\n`).join("");
  const parts = splitIntoParts(text, 250);
  assert.equal(parts.length, 5, "two whole lines fit in 250 bytes, three do not");
  for (const part of parts) {
    assert.ok(bytes(part) <= 250);
    assert.ok(part.endsWith("\n"), "each part ends at a line end");
  }
  assert.equal(parts.join(""), text);
});

test("splitIntoParts counts bytes, not characters, and gives one part for a short text and none for an empty one", () => {
  assert.deepEqual(splitIntoParts("short\ntext", 100), ["short\ntext"]);
  assert.deepEqual(splitIntoParts("", 100), []);
  // 30 characters but 90 bytes per line.
  const text = `${"中".repeat(30)}\n${"中".repeat(30)}\n`;
  assert.deepEqual(splitIntoParts(text, 100), [`${"中".repeat(30)}\n`, `${"中".repeat(30)}\n`]);
});

test("splitIntoParts cuts a line longer than a part between characters, never inside a UTF-8 character", () => {
  // 1-, 2-, 3- and 4-byte characters with no line end, so every cut is inside the line.
  const line = "aé中😀".repeat(50);
  for (const max of [4, 5, 6, 7, 10, 33]) {
    const parts = splitIntoParts(line, max);
    for (const part of parts) {
      assert.ok(bytes(part) <= max, `${max}: part of ${bytes(part)} bytes`);
      assert.ok(!part.includes("�"), `${max}: a character was cut`);
      assert.equal(Buffer.from(part, "utf8").toString("utf8"), part);
    }
    assert.equal(parts.join(""), line, `${max}: parts join back`);
  }
});

test("splitIntoParts uses the line end when there is one, and the byte cut only for a too-long line", () => {
  const text = `short line\n${"é".repeat(100)}\nend\n`;
  const parts = splitIntoParts(text, 50);
  assert.equal(parts[0], "short line\n");
  assert.ok(parts.slice(1, -1).every((p) => bytes(p) <= 50 && !p.includes("�")));
  assert.equal(parts.join(""), text);
});
