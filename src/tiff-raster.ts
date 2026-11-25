/** Converts TIFF images the general raster decoder cannot read to QR-ready RGBA. */

/** Recognizes the little- and big-endian TIFF file signatures. */
export function isTiff (bytes: Uint8Array): boolean {
  if (bytes.length < 4) {
    return false
  }
  return (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 42 && bytes[3] === 0)
      || (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0 && bytes[3] === 42)
}

/** Reads the first TIFF page and expands palette indices or samples to RGBA. */
export async function decodeTiffRgba (bytes: Uint8Array): Promise<{ width: number, height: number, data: Uint8Array }> {
  const { decode } = await import('tiff')
  const [page] = decode(bytes, { pages: [0] })
  if (!page?.data) {
    throw new Error('TIFF contains no image data')
  }

  const { width, height, data: samples, palette, components } = page
  const rgba = new Uint8Array(width * height * 4)
  const floatingPoint = samples instanceof Float32Array || samples instanceof Float64Array
  const bits = typeof page.bitsPerSample === 'number'
    ? page.bitsPerSample
    : Array.isArray(page.bitsPerSample)
      ? page.bitsPerSample[0] ?? 8
      : 8
  const sampleMax = floatingPoint ? 1 : 2 ** bits - 1
  const toByte = (sample: number | undefined) => Math.round((sample ?? 0) * 255 / sampleMax)

  for (let pixel = 0; pixel < width * height; pixel++) {
    const offset = pixel * components
    const target = pixel * 4
    const red = samples[offset]
    const color = palette?.[red ?? 0]
    if (color) {
      // TIFF color maps always store 16-bit channel values.
      rgba[target] = Math.round(color[0] / 257)
      rgba[target + 1] = Math.round(color[1] / 257)
      rgba[target + 2] = Math.round(color[2] / 257)
    } else {
      rgba[target] = toByte(red)
      rgba[target + 1] = toByte(components < 3 ? red : samples[offset + 1])
      rgba[target + 2] = toByte(components < 3 ? red : samples[offset + 2])
    }
    rgba[target + 3] = page.alpha ? toByte(samples[offset + components - 1]) : 255
  }
  return { data: rgba, height, width }
}
