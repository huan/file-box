/** Adapts the shared QR byte codec to FileBox's native Node stream API. */
import { PassThrough, type Readable } from 'node:stream'

import { encodeQrPng } from './qr-codec.ts'

export { bufferToQrValue, imageBytesToRgba } from './qr-codec.ts'

/** Renders a QR payload as a readable stream of PNG image bytes. */
export async function qrValueToStream (value: string): Promise<Readable> {
  const bytes = await encodeQrPng(value)
  const stream = new PassThrough()
  stream.end(bytes)
  return stream
}
