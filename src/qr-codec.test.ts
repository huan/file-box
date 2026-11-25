/** Verifies the same ESM QR byte codec in Node.js, Deno, and Chromium. */
import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import { Format, decodeImage, encodeBmp, encodeGif, encodeJpg, encodeTiff } from 'image-in-browser'

import { bufferToQrValue, encodeQrPng } from './qr-codec.ts'

const knownQrPng = [
  'iVBORw0KGgoAAAANSUhEUgAAAMgAAADIAQMAAACXljzdAAAABlBMVEX///8AAABVwtN+AAAA',
  'CXBIWXMAAA7EAAAOxAGVKw4bAAAA7klEQVRYw+2WsQ3EIAxFjShSMgKjZLRktIzCCJQpIv7Z',
  'hCiXO/qzT/wCWXo0X3wbEw0NWVaEKM187KHW2QLZ+AhpXovfQ+J6skEWHELqBa5NEeCwR7iS',
  'V7BDzuzAiZ9eqn5IWjfWXHf7VCO5tPAM6U9AjSRideyHFn4FiuvDqV5CM9rZXuF2pZmIAjZy',
  'x4S0MDdBxEmu3TrliPf7iglPvuLlRydfU3P70UweCSK+ZYK0mUg1O4AVcv0/8itGkC7SdiTH',
  '0+Mz19oJZ4NkhhSPbIhQkQGI8u1HJzmzs7p7pzNAru2pJb6z8ykkQ0P/pheK6vjurjf7+wAA',
  'AABJRU5ErkJggg==',
].join('')

const payload = 'hello, world!'

/** Reads the versioned PNG fixture as bytes using the platform Base64 API. */
function fixtureBytes () {
  return Uint8Array.from(atob(knownQrPng), char => char.charCodeAt(0))
}

test('decodes an existing PNG QR image from a Blob', async () => {
  assert.equal(await bufferToQrValue(new Blob([fixtureBytes()], { type: 'image/png' })), payload)
})

test('renders a scannable PNG QR image with the ESM encoder', async () => {
  const encoded = await encodeQrPng(payload)
  assert.deepEqual(Array.from(encoded.subarray(0, 8)), [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const image = decodeImage({ data: encoded })
  assert.equal(image?.width, 116)
  assert.equal(image?.height, 116)
  assert.equal(await bufferToQrValue(encoded), payload)
})

test('decodes QR images from JPEG, GIF, BMP, and TIFF bytes', async () => {
  const image = decodeImage({ data: fixtureBytes() })
  assert.ok(image)
  const rgba = image.convert({ format: Format.uint8, numChannels: 4 })
  for (const encode of [encodeJpg, encodeGif, encodeBmp, encodeTiff]) {
    assert.equal(await bufferToQrValue(encode({ image: rgba })), payload)
  }
})

test('decodes an indexed TIFF QR image', async () => {
  const image = decodeImage({ data: fixtureBytes() })
  assert.ok(image)
  assert.equal(await bufferToQrValue(encodeTiff({ image })), payload)
})

test('preserves the underlying image decoder error', async () => {
  const truncated = fixtureBytes().subarray(0, 12)
  await assert.rejects(bufferToQrValue(truncated), (error: unknown) => {
    assert.ok(error instanceof Error)
    assert.equal(error.message, 'bufferToQrcode(buf) fail!')
    assert.ok(error.cause instanceof Error)
    return true
  })
})
