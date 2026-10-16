// Pure helpers, kept apart so the tests can check them without a terminal.

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]

// Bytes from hex text such as `xxd -p` prints; spaces and newlines are skipped.
export function hexBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, '')
  return Uint8Array.from({ length: Math.floor(clean.length / 2) }, (_, i) => parseInt(clean.slice(i * 2, i * 2 + 2), 16))
}

// The pixel size of a PNG, read from its IHDR chunk; undefined when not a PNG.
export function pngSize(bytes: Uint8Array): { width: number; height: number } | undefined {
  if (bytes.length < 24 || PNG_SIGNATURE.some((b, i) => bytes[i] !== b)) return undefined
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const width = view.getUint32(16)
  const height = view.getUint32(20)
  return width > 0 && height > 0 ? { width, height } : undefined
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)))

// The box of cells that keeps the picture's shape. cellAspect is a cell's
// height divided by its width, in pixels.
export function fitBox(
  width: number,
  height: number,
  maxColumns: number,
  maxRows: number,
  cellAspect: number,
): { columns: number; rows: number } {
  let columns = clamp(maxColumns, 1, 255)
  let rows = (columns * height) / width / cellAspect
  if (rows > maxRows) {
    rows = maxRows
    columns = (rows * cellAspect * width) / height
  }
  return { columns: clamp(columns, 1, 255), rows: clamp(rows, 1, 255) }
}

// Which frame to show after elapsedMs, counted from 0.
export function frameAt(elapsedMs: number, fps: number, count: number): number {
  return Math.min(count - 1, Math.max(0, Math.floor((elapsedMs * fps) / 1000)))
}

// ffmpeg numbers its frames from 1: f00001.png.
export function framePath(dir: string, index: number): string {
  return `${dir}/f${String(index + 1).padStart(5, '0')}.png`
}
