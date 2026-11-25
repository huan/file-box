/** Checks that the native Node stream adapter delivers the shared PNG bytes. */
import * as assert from 'node:assert/strict'
import { test } from 'node:test'

import { encodeQrPng } from './qr-codec.ts'
import { qrValueToStream } from './qrcode.ts'
import { streamToBuffer } from './misc.ts'

test('qrValueToStream delivers the encoded PNG bytes', async () => {
  const value = 'hello, world!'
  const bytes = await streamToBuffer(await qrValueToStream(value))
  assert.deepEqual(bytes, Buffer.from(await encodeQrPng(value)))
})
