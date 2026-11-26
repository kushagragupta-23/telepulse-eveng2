// ---------------------------------------------------------------------------
// Renders G2 image containers (grey4 packed) onto a <canvas> and draws a
// sparkline into raw grey4 bytes for updateImageRawData — identical pipeline on
// hardware and in the browser preview.
// ---------------------------------------------------------------------------

const SPARK_W = 128
const SPARK_H = 40

/**
 * Encode a sparkline as raw RGBA8888 → the SDK/host converts to grey4.
 * We emit a compact byte buffer of 4-bit greyscale values (2 px per byte)
 * which the Even host accepts via `imageData` (grey4 raw path). For the
 * browser adapter we keep a parallel RGBA interpretation.
 */
export function renderSparklineGrey4(
  values: number[],
  opts: { w?: number; h?: number; rising: boolean },
): Uint8Array {
  const w = opts.w ?? SPARK_W
  const h = opts.h ?? SPARK_H
  const out = new Uint8Array((w * h) / 2) // 2 px per byte, hi/lo nibble

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(1e-9, max - min)

  // baseline brightness 0; line pixels ~level 12-15 of 0-15
  const lineLevel = 15
  const fillLevel = 6

  for (let x = 0; x < w; x++) {
    const i = Math.round((x / (w - 1)) * (values.length - 1))
    const v = values[Math.min(values.length - 1, Math.max(0, i))]
    const norm = (v - min) / range // 0..1
    const yLine = Math.round((1 - norm) * (h - 6)) + 2

    for (let y = 0; y < h; y++) {
      let g = 0
      if (y === yLine || y === yLine + 1) g = lineLevel
      else if (y > yLine + 1 && y < h - 2 && opts.rising) g = fillLevel
      else if (y === h - 3) g = 4 // axis
      const byteIdx = (y * w + x) >> 1
      if ((y * w + x) % 2 === 0) out[byteIdx] |= (g & 0x0f) << 4
      else out[byteIdx] |= g & 0x0f
    }
  }
  return out
}

/** Decode grey4 (2px/byte) into an RGBA ImageData for the canvas preview. */
export function grey4ToImageData(
  bytes: Uint8Array,
  w: number,
  h: number,
  green = true,
): ImageData {
  const img = new ImageData(w, h)
  const d = img.data
  for (let p = 0; p < w * h; p++) {
    const b = bytes[p >> 1]
    const g = p % 2 === 0 ? (b >> 4) & 0x0f : b & 0x0f
    const v = Math.round((g / 15) * 255)
    const o = p * 4
    if (green) {
      d[o] = Math.round(v * 0.35)
      d[o + 1] = v
      d[o + 2] = Math.round(v * 0.45)
    } else {
      d[o] = v
      d[o + 1] = v
      d[o + 2] = v
    }
    d[o + 3] = v > 8 ? 255 : 0
  }
  return img
}
