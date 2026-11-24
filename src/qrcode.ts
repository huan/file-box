/**
 * QR Code encoding and decoding functionality for FileBox.
 *
 * This module owns isomorphic QR operations, supporting Browser, Node.js, and Deno
 * environments without relying on native Node C++ modules or legacy CommonJS libraries.
 *
 * Raster formats:
 * - Browser: any format `createImageBitmap` can decode (PNG, JPEG, GIF, BMP, and others).
 * - Node.js / Deno: PNG (`upng-js`), JPEG (`jpeg-js`), GIF (`omggif`), BMP (`bmp-ts`),
 *   and TIFF (`utif2`).
 */
import {
  PassThrough,
  type Readable,
} from 'node:stream'
import { decodeQR } from 'qr/decode.js'

/**
 * Checks if a byte buffer starts with standard PNG signature (0x89504E47).
 */
function isPng (bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
}

/**
 * Checks if a byte buffer starts with standard JPEG SOI marker (0xFFD8).
 */
function isJpeg (bytes: Uint8Array): boolean {
  return (
    bytes.length >= 2 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8
  )
}

/**
 * Checks if a byte buffer starts with a GIF87a or GIF89a header.
 */
function isGif (bytes: Uint8Array): boolean {
  return (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  )
}

/**
 * Checks if a byte buffer starts with a BMP "BM" header.
 */
function isBmp (bytes: Uint8Array): boolean {
  return (
    bytes.length >= 2 &&
    bytes[0] === 0x42 &&
    bytes[1] === 0x4d
  )
}

/**
 * Checks if a byte buffer starts with a little- or big-endian TIFF header.
 */
function isTiff (bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 && (
      (
        bytes[0] === 0x49 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x2a &&
        bytes[3] === 0x00
      ) || (
        bytes[0] === 0x4d &&
        bytes[1] === 0x4d &&
        bytes[2] === 0x00 &&
        bytes[3] === 0x2a
      )
    )
  )
}

function toArrayBuffer (bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
}

/**
 * Normalizes a dynamic import for Node CJS interop and for browser test
 * runners that expose a CommonJS module only through `__require()`.
 */
function moduleApi (loaded: any): any {
  let api = loaded
  if (api && typeof api.__require === 'function') {
    api = api.__require()
  }
  if (api && api.default) {
    return api.default
  }
  return api
}

/**
 * Converts image bytes into raw RGBA pixel data.
 *
 * In browser environments with canvas/createImageBitmap support, leverages standard Web APIs.
 * In serverless/Node.js/Deno environments, uses pure JavaScript image parsers.
 *
 * @param bytes Encoded image bytes (PNG, JPEG, GIF, BMP, or TIFF)
 * @returns Object containing image width, height, and raw RGBA pixel data
 */
export async function imageBytesToRgba (
  bytes: Uint8Array,
): Promise<{ width: number; height: number; data: Uint8Array | Uint8ClampedArray }> {
  // Browser standard Web API fast-path
  if (typeof globalThis.createImageBitmap === 'function') {
    let bitmap: ImageBitmap | undefined
    try {
      const blob = new Blob([ bytes as BlobPart ])
      bitmap = await globalThis.createImageBitmap(blob)
      const width = bitmap.width
      const height = bitmap.height
      let canvas: OffscreenCanvas | HTMLCanvasElement | undefined
      let ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null

      if (typeof OffscreenCanvas !== 'undefined') {
        canvas = new OffscreenCanvas(width, height)
        ctx = canvas.getContext('2d')
      } else if (
        typeof document !== 'undefined' &&
        typeof document.createElement === 'function'
      ) {
        const element = document.createElement('canvas')
        element.width = width
        element.height = height
        canvas = element
        ctx = element.getContext('2d')
      }

      if (ctx) {
        ctx.drawImage(bitmap, 0, 0)
        const imageData = ctx.getImageData(0, 0, width, height)
        return {
          data: imageData.data,
          height,
          width,
        }
      }
    } catch {
      // Fall through to pure JS parsers if createImageBitmap fails
    } finally {
      bitmap?.close()
    }
  }

  // Pure JavaScript isomorphic fallback
  if (isPng(bytes)) {
    const UPNG: any = moduleApi(await import('upng-js'))
    const img = UPNG.decode(toArrayBuffer(bytes))
    const rgba = UPNG.toRGBA8(img)[0]
    if (!rgba) {
      throw new Error('Failed to decode PNG to RGBA')
    }
    return {
      data: new Uint8Array(rgba),
      height: img.height,
      width: img.width,
    }
  }

  if (isJpeg(bytes)) {
    const jpeg: any = moduleApi(await import('jpeg-js'))
    const raw = jpeg.decode(bytes, { useTArray: true })
    return {
      data: raw.data,
      height: raw.height,
      width: raw.width,
    }
  }

  if (isGif(bytes)) {
    const GifReader: any = moduleApi(await import('omggif')).GifReader
    const reader = new GifReader(bytes)
    const data = new Uint8Array(reader.width * reader.height * 4)
    reader.decodeAndBlitFrameRGBA(0, data)
    return {
      data,
      height: reader.height,
      width: reader.width,
    }
  }

  if (isBmp(bytes)) {
    const bmp: any = moduleApi(await import('bmp-ts'))
    const raw = bmp.decode(Buffer.from(bytes), { toRGBA: true })
    return {
      data: raw.data,
      height: raw.height,
      width: raw.width,
    }
  }

  if (isTiff(bytes)) {
    const UTIF: any = moduleApi(await import('utif2'))
    const rawBuffer = toArrayBuffer(bytes)
    const ifds = UTIF.decode(rawBuffer)
    const ifd = ifds[0]
    if (!ifd) {
      throw new Error('Failed to decode TIFF')
    }
    UTIF.decodeImage(rawBuffer, ifd)
    const rgba = UTIF.toRGBA8(ifd)
    return {
      data: rgba,
      height: ifd.height,
      width: ifd.width,
    }
  }

  throw new Error('Unsupported image format for QR decoding')
}

/**
 * Decodes a QR code string value from an image buffer or Uint8Array.
 *
 * @param buf Image buffer or Blob containing PNG, JPEG, GIF, BMP, TIFF, or another supported format
 * @returns Decoded QR code text content
 * @throws Error if QR code decoding fails or no QR pattern is recognized
 */
export async function bufferToQrValue (
  buf: Buffer | Uint8Array | ArrayBuffer | Blob,
): Promise<string> {
  let bytes: Uint8Array
  if (typeof Blob !== 'undefined' && buf instanceof Blob) {
    const arrayBuf = await buf.arrayBuffer()
    bytes = new Uint8Array(arrayBuf)
  } else if (buf instanceof ArrayBuffer) {
    bytes = new Uint8Array(buf)
  } else if (ArrayBuffer.isView(buf)) {
    bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
  } else {
    throw new TypeError('Invalid buffer type provided to bufferToQrValue')
  }

  try {
    const { width, height, data } = await imageBytesToRgba(bytes)
    const result = decodeQR({
      data,
      height,
      width,
    })

    if (typeof result === 'string' && result.length > 0) {
      return result
    }
    throw new Error('bufferToQrcode(buf) fail!')
  } catch (err) {
    if (err instanceof Error && err.message === 'bufferToQrcode(buf) fail!') {
      throw err
    }
    throw new Error('bufferToQrcode(buf) fail!', { cause: err })
  }
}

/**
 * Decodes a PNG data URL into raw PNG bytes.
 */
function pngDataUrlToBytes (dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) {
    throw new Error('QR encoder returned a data URL without a payload')
  }
  const base64 = dataUrl.slice(comma + 1)
  return Buffer.from(base64, 'base64')
}

/**
 * Encodes a QR code text value into a Readable stream of PNG image bytes.
 *
 * Node's `qrcode` entry exposes `toBuffer`. The browser entry does not, so
 * that environment renders through `toDataURL` and decodes the PNG payload.
 *
 * @param value String payload to encode into QR code
 * @returns Readable stream emitting PNG image bytes
 */
export async function qrValueToStream (value: string): Promise<Readable> {
  const stream = new PassThrough()
  const QRCode: any = moduleApi(await import('qrcode'))

  let buf: Uint8Array
  if (typeof QRCode.toBuffer === 'function') {
    buf = await QRCode.toBuffer(value, { type: 'png' })
  } else if (typeof QRCode.toDataURL === 'function') {
    const dataUrl: string = await QRCode.toDataURL(value, { type: 'image/png' })
    buf = pngDataUrlToBytes(dataUrl)
  } else {
    throw new Error('QR encoder cannot render PNG in this environment')
  }

  stream.end(buf)
  return stream
}
