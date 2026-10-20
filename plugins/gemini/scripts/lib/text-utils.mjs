export function byteLength(str) {
  return Buffer.byteLength(str, "utf8");
}

/**
 * Truncate content to at most maxBytes UTF-8 bytes, breaking only on line
 * boundaries. Appends a marker indicating how many bytes were elided.
 *
 * Returns { content, truncated, omittedBytes }.
 */
export function truncateOnLineBoundary(content, maxBytes) {
  if (byteLength(content) <= maxBytes) {
    return { content, truncated: false, omittedBytes: 0 };
  }
  const lines = content.split(/\r?\n/);
  let used = 0;
  const kept = [];
  for (const line of lines) {
    const size = byteLength(line) + 1;
    if (used + size > maxBytes) break;
    used += size;
    kept.push(line);
  }
  const truncated = kept.join("\n");
  const omittedBytes = byteLength(content) - byteLength(truncated);
  return {
    content: `${truncated}\n[truncated: ${omittedBytes} additional bytes elided]`,
    truncated: true,
    omittedBytes
  };
}

/**
 * Split text into parts of at most maxBytes UTF-8 bytes. Joined in order, the
 * parts give back the text. A part ends after a line end when it can. A line
 * longer than maxBytes is cut between two characters, never inside one.
 */
export function splitIntoParts(text, maxBytes) {
  const buf = Buffer.from(text, "utf8");
  const parts = [];
  let start = 0;
  while (start < buf.length) {
    let end = Math.min(start + maxBytes, buf.length);
    if (end < buf.length) {
      const newline = buf.lastIndexOf(0x0a, end - 1);
      if (newline >= start) end = newline + 1;
      // A byte 10xxxxxx continues a character, so the cut moves back before it.
      else while ((buf[end] & 0xc0) === 0x80) end -= 1;
    }
    parts.push(buf.toString("utf8", start, end));
    start = end;
  }
  return parts;
}
