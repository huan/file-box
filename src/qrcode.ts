/**
 * QR Code encoding and decoding functionality for FileBox.
 *
 * This module owns isomorphic QR operations, supporting Browser, Node.js, and Deno
 * environments without relying on native Node C++ modules or legacy CommonJS libraries.
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
 * Converts image bytes into raw RGBA pixel data.
 *
 * In browser environments with canvas/createImageBitmap support, leverages standard Web APIs.
 * In serverless/Node.js/Deno environments, uses pure JavaScript PNG and JPEG parsers.
 *
 * @param bytes Encoded image bytes (PNG or JPEG)
 * @returns Object containing image width, height, and raw RGBA pixel data
 */
export async function imageBytesToRgba (
  bytes: Uint8Array,
): Promise<{ width: number; height: number; data: Uint8Array | Uint8ClampedArray }> {
  // Browser standard Web API fast-path
  if (typeof globalThis.createImageBitmap === 'function') {
    try {
      const blob = new Blob([bytes as any])
      const bitmap = await globalThis.createImageBitmap(blob)
      let canvas: OffscreenCanvas | HTMLCanvasElement | undefined
      let ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null

      if (typeof OffscreenCanvas !== 'undefined') {
        canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
        ctx = canvas.getContext('2d')
      } else if (
        typeof document !== 'undefined' &&
        typeof document.createElement === 'function'
      ) {
        canvas = document.createElement('canvas')
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        ctx = canvas.getContext('2d')
      }

      if (ctx) {
        ctx.drawImage(bitmap, 0, 0)
        const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
        return {
          data: imageData.data,
          height: bitmap.height,
          width: bitmap.width,
        }
      }
    } catch {
      // Fall through to pure JS parsers if createImageBitmap fails
    }
  }

  // Pure JavaScript isomorphic fallback
  if (isPng(bytes)) {
    const UPNGModule = await import('upng-js')
    const UPNG: any = (UPNGModule as any).default ?? UPNGModule
    const rawBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer
    const img = UPNG.decode(rawBuffer)
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
    const jpegModule = await import('jpeg-js')
    const jpeg: any = (jpegModule as any).default ?? jpegModule
    const raw = jpeg.decode(bytes, { useTArray: true })
    return {
      data: raw.data,
      height: raw.height,
      width: raw.width,
    }
  }

  throw new Error('Unsupported image format for QR decoding')
}

/**
 * Decodes a QR code string value from an image buffer or Uint8Array.
 *
 * @param buf Image buffer or Blob containing PNG, JPEG, or other supported format
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
    throw new Error('bufferToQrcode(buf) fail!')
  }
}

/**
 * Encodes a QR code text value into a Readable stream of PNG image bytes.
 *
 * @param value String payload to encode into QR code
 * @returns Readable stream emitting PNG image bytes
 */
export async function qrValueToStream (value: string): Promise<Readable> {
  const stream = new PassThrough()
  const qrcodeModule = await import('qrcode')
  const QRCode: any = (qrcodeModule as any).default ?? qrcodeModule
  const buf = await QRCode.toBuffer(value, { type: 'png' })
  stream.end(buf)
  return stream
}
