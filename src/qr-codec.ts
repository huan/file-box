/** Encodes and decodes QR image bytes using the same ESM codecs in all runtimes. */
import { encodeQR } from 'qr'
import { decodeQR } from 'qr/decode.js'

import { decodeTiffRgba, isTiff } from './tiff-raster.ts'

/** Renders a QR payload as PNG with a four-module quiet zone. */
export async function encodeQrPng (value: string): Promise<Uint8Array> {
  const modules = encodeQR(value, 'raw', { border: 4, scale: 4 })
  const size = modules.length
  const pixels = new Uint8Array(size * size)
  for (const [y, row] of modules.entries()) {
    for (const [x, dark] of row.entries()) {
      pixels[y * size + x] = dark ? 0 : 255
    }
  }

  const { MemoryImage, encodePng } = await import('image-in-browser')
  return encodePng({ image: MemoryImage.fromBytes({ bytes: pixels.buffer, height: size, numChannels: 1, width: size }) })
}

/** Decodes the first image frame and returns normalized 8-bit RGBA pixels. */
export async function imageBytesToRgba (bytes: Uint8Array): Promise<{ width: number, height: number, data: Uint8Array }> {
  const { ChannelOrder, Format, decodeImage } = await import('image-in-browser')
  try {
    const image = decodeImage({ data: bytes })
    if (!image) {
      throw new Error('Unsupported image format for QR decoding')
    }
    const rgba = image.convert({ format: Format.uint8, numChannels: 4 })
    return { data: rgba.getBytes({ order: ChannelOrder.rgba }), height: rgba.height, width: rgba.width }
  } catch (error) {
    if (!isTiff(bytes)) {
      throw error
    }
    // The general decoder rejects some indexed and low-bit TIFF images.
    return decodeTiffRgba(bytes)
  }
}

/** Decodes QR text from encoded image bytes or a Blob. */
export async function bufferToQrValue (input: Uint8Array | ArrayBuffer | Blob): Promise<string> {
  let bytes: Uint8Array
  if (input instanceof Blob) {
    bytes = new Uint8Array(await input.arrayBuffer())
  } else if (input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input)
  } else if (ArrayBuffer.isView(input)) {
    bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
  } else {
    throw new TypeError('Invalid buffer type provided to bufferToQrValue')
  }

  let result: string | undefined
  try {
    result = decodeQR(await imageBytesToRgba(bytes))
  } catch (error) {
    throw new Error('bufferToQrcode(buf) fail!', { cause: error })
  }
  if (!result) {
    throw new Error('bufferToQrcode(buf) fail!')
  }
  return result
}
