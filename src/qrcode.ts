/**
 * Adapts the shared QR byte codec to WHATWG stream representations.
 *
 * Fully browser and WinterTC compatible with zero native OS dependencies.
 */
import { encodeQrPng } from './qr-codec.ts'

export { bufferToQrValue, imageBytesToRgba } from './qr-codec.ts'

/**
 * Renders a QR payload as a WHATWG ReadableStream of PNG image bytes.
 *
 * @param value String payload to encode into QR code
 * @returns Readable stream of PNG image bytes
 */
export async function qrValueToReadableStream (value: string): Promise<ReadableStream<Uint8Array>> {
  const bytes = await encodeQrPng(value)
  return new ReadableStream<Uint8Array>({
    start (controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
}

/**
 * Renders a QR payload as a readable stream of PNG image bytes.
 *
 * @alias qrValueToReadableStream
 */
export const qrValueToStream = qrValueToReadableStream
