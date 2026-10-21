#!/usr/bin/env node
/**
 * Live smoke test for a new agy version. Requires agy on PATH and a working
 * sign-in. Runs three asks on gemini-3.8-flash-low and checks that:
 *   (a) media passed with --file reaches the model: a PNG, made at run time,
 *       that shows a random number;
 *   (b) the tool gate denies a read of a canary file outside the allowed
 *       folders, and the denial is listed in deniedActions;
 *   (c) a --schema answer fits the schema and is right.
 * It runs every check, exits 1 if any failed, and deletes its temp folder.
 * When all pass on a new agy, raise TESTED_AGY_VERSION in
 * scripts/gemini-companion.mjs.
 *
 * Usage: node tests/smoke-agy.mjs
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COMPANION = path.resolve(HERE, "..", "scripts", "gemini-companion.mjs");
const MODEL = "gemini-3.8-flash-low";

// 5 x 7 pixel digits, one string per row.
const DIGITS = {
  0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  2: ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  3: ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  5: ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  6: ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  9: ["01110", "10001", "10001", "01111", "00001", "00010", "01100"]
};

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// A grayscale PNG with `text` (digits) in black on white, each pixel 16 x 16.
function digitsPng(text, scale = 16) {
  const cols = text.length * 6 + 1;
  const rows = 9;
  const width = cols * scale;
  const height = rows * scale;
  const raw = Buffer.alloc((width + 1) * height, 255);
  for (let y = 0; y < height; y++) {
    raw[y * (width + 1)] = 0; // filter type: none
    const gy = Math.floor(y / scale) - 1;
    for (let x = 0; x < width; x++) {
      const gx = Math.floor(x / scale) - 1;
      const glyph = DIGITS[text[Math.floor(gx / 6)]];
      if (gx >= 0 && gy >= 0 && gy < 7 && gx % 6 < 5 && glyph?.[gy][gx % 6] === "1") raw[y * (width + 1) + 1 + x] = 0;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // grayscale
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

// Runs `ask --json` on the test model. Returns the parsed JSON, or an error.
function ask(args, prompt) {
  const r = spawnSync(process.execPath, [COMPANION, "ask", "--json", "--model", MODEL, "--timeout-ms", "240000", ...args, "--", prompt], {
    encoding: "utf8",
    timeout: 300_000,
    input: ""
  });
  if (r.status !== 0) return { error: `exit ${r.status}: ${(r.stderr || r.stdout || r.error?.message || "").trim().slice(0, 500)}` };
  try {
    return { out: JSON.parse(r.stdout) };
  } catch {
    return { error: `not JSON: ${r.stdout.slice(0, 300)}` };
  }
}

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${detail}`);
}

const version = spawnSync("agy", ["--version"], { encoding: "utf8" });
console.log(`=== agy smoke test: agy ${version.stdout?.trim() || "(no version)"}, ${MODEL} ===\n`);

const tmp = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "gemini-smoke-")));
try {
  // (a) Media: a PNG with a random 4-digit number.
  const number = String(crypto.randomInt(1000, 10000));
  const png = path.join(tmp, "number.png");
  fs.writeFileSync(png, digitsPng(number));
  const a = ask(["--file", png], "What number does the attached image show? Reply with only the digits.");
  check("media reaches the model", !a.error && a.out.response.replace(/\D/g, "") === number, a.error ?? `expected ${number}, got ${JSON.stringify(a.out.response.trim())}`);

  // (b) Gate: a canary file that is not attached and in no --dir folder.
  const secret = `canary-${crypto.randomBytes(6).toString("hex")}`;
  const canary = path.join(tmp, "canary.txt");
  fs.writeFileSync(canary, `${secret}\n`);
  const b = ask([], `Read the local file ${canary} with your file-reading tool, and reply with its exact content. If you cannot read it, reply DENIED.`);
  const denied = !b.error && b.out.deniedActions.some((d) => d.action === "read_file" && path.basename(String(d.display_name)) === "canary.txt");
  const leaked = !b.error && JSON.stringify(b.out).includes(secret);
  check(
    "gate denies a read outside the roots",
    denied && !leaked,
    b.error ?? `deniedActions ${JSON.stringify(b.out.deniedActions)}${leaked ? ", and the answer holds the canary" : ""}`
  );

  // (c) Schema: the plugin checks the answer against the schema and fails the ask when it does not fit.
  const schema = path.join(tmp, "schema.json");
  fs.writeFileSync(
    schema,
    JSON.stringify({
      type: "object",
      properties: { sum: { type: "integer" }, colour: { type: "string", enum: ["red", "green", "blue"] } },
      required: ["sum", "colour"],
      additionalProperties: false
    })
  );
  const c = ask(["--schema", schema], "What is 17 + 25? And which colour is a clear daytime sky: red, green or blue?");
  const so = c.out?.structuredOutput;
  check("schema answer fits", !c.error && so?.sum === 42 && so?.colour === "blue", c.error ?? `structuredOutput ${JSON.stringify(so)}`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

const failed = checks.filter((c) => !c.ok).length;
console.log(failed ? `\nSMOKE TEST FAILED (${failed} of ${checks.length})` : "\nSMOKE TEST PASSED");
process.exitCode = failed ? 1 : 0;
