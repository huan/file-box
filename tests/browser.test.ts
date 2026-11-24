/**
 * In-browser unit tests verifying FileBox and QR code operations inside browser contexts.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FileBox, FileBoxType } from '../src/mod.ts'
import { bufferToQrValue } from '../src/qrcode.ts'

test('In-browser: bufferToQrValue decodes QR image', async () => {
  const QRCODE_IMAGE_BASE64 = [
    'iVBORw0KGgoAAAANSUhEUgAAAMgAAADIAQMAAACXljzdAAAABlBMVEX///8AAABVwtN+AAAA',
    'CXBIWXMAAA7EAAAOxAGVKw4bAAAA7klEQVRYw+2WsQ3EIAxFjShSMgKjZLRktIzCCJQpIv7Z',
    'hCiXO/qzT/wCWXo0X3wbEw0NWVaEKM187KHW2QLZ+AhpXovfQ+J6skEWHELqBa5NEeCwR7iS',
    'V7BDzuzAiZ9eqn5IWjfWXHf7VCO5tPAM6U9AjSRideyHFn4FiuvDqV5CM9rZXuF2pZmIAjZy',
    'x4S0MDdBxEmu3TrliPf7iglPvuLlRydfU3P70UweCSK+ZYK0mUg1O4AVcv0/8itGkC7SdiTH',
    '0+Mz19oJZ4NkhhSPbIhQkQGI8u1HJzmzs7p7pzNAru2pJb6z8ykkQ0P/pheK6vjurjf7+wAA',
    'AABJRU5ErkJggg==',
  ].join('')
  const EXPECTED = 'hello, world!'

  const binary = atob(QRCODE_IMAGE_BASE64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  const result = await bufferToQrValue(bytes)
  assert.strictEqual(result, EXPECTED, 'should decode QR code in browser via createImageBitmap or canvas')
})

test('In-browser: FileBox.fromBase64 -> toQRCode', async () => {
  const QRCODE_IMAGE_BASE64 = [
    'iVBORw0KGgoAAAANSUhEUgAAAMgAAADIAQMAAACXljzdAAAABlBMVEX///8AAABVwtN+AAAA',
    'CXBIWXMAAA7EAAAOxAGVKw4bAAAA7klEQVRYw+2WsQ3EIAxFjShSMgKjZLRktIzCCJQpIv7Z',
    'hCiXO/qzT/wCWXo0X3wbEw0NWVaEKM187KHW2QLZ+AhpXovfQ+J6skEWHELqBa5NEeCwR7iS',
    'V7BDzuzAiZ9eqn5IWjfWXHf7VCO5tPAM6U9AjSRideyHFn4FiuvDqV5CM9rZXuF2pZmIAjZy',
    'x4S0MDdBxEmu3TrliPf7iglPvuLlRydfU3P70UweCSK+ZYK0mUg1O4AVcv0/8itGkC7SdiTH',
    '0+Mz19oJZ4NkhhSPbIhQkQGI8u1HJzmzs7p7pzNAru2pJb6z8ykkQ0P/pheK6vjurjf7+wAA',
    'AABJRU5ErkJggg==',
  ].join('')

  const fileBox = FileBox.fromBase64(QRCODE_IMAGE_BASE64, 'qrcode.png')
  const qrCode = await fileBox.toQRCode()
  assert.strictEqual(qrCode, 'hello, world!', 'should decode QR code from base64 FileBox in browser')
})

test('In-browser: FileBox.fromQRCode -> toQRCode', async () => {
  const value = 'https://wechaty.js.org'
  const fileBox = FileBox.fromQRCode(value)
  assert.strictEqual(fileBox.type, FileBoxType.QRCode)
  const qrCode = await fileBox.toQRCode()
  assert.strictEqual(qrCode, value, 'should get QR code value')

  const png = await fileBox.toBuffer()
  assert.ok(png.byteLength > 8, 'should render QR payload to PNG bytes')
  assert.strictEqual(png[0], 0x89, 'should render a PNG signature')
  assert.strictEqual(await bufferToQrValue(png), value, 'should round-trip generated PNG bytes')
})

test('In-browser: FileBox.fromBuffer -> toBase64', async () => {
  const content = 'Browser FileBox Test'
  const buffer = Buffer.from(content)
  const fileBox = FileBox.fromBuffer(buffer, 'test.txt')
  const base64 = await fileBox.toBase64()
  const recovered = Buffer.from(base64, 'base64').toString()
  assert.strictEqual(recovered, content, 'should serialize and deserialize buffer in browser')
})

test('In-browser: FileBox.fromJSON and toJSON', async () => {
  const BASE64_ENCODED = 'RmlsZUJveEJhc2U2NAo='
  const fileBox = FileBox.fromBase64(BASE64_ENCODED, 'test.txt')
  const jsonText = JSON.stringify(fileBox)
  const restored = FileBox.fromJSON(jsonText)
  assert.strictEqual(await restored.toBase64(), BASE64_ENCODED, 'should round-trip through JSON in browser')
})
