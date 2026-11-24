/**
 * Unit tests for QR code conversion utilities.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  bufferToQrValue,
  imageBytesToRgba,
  qrValueToStream,
} from './qrcode.ts'
import { encode as encodeBmp } from 'bmp-ts'

test('imageBase64ToQrCode()', async () => {
  const QRCODE_IMAGE_BASE64 = [
    'iVBORw0KGgoAAAANSUhEUgAAAMgAAADIAQMAAACXljzdAAAABlBMVEX///8AAABVwtN+AAAA',
    'CXBIWXMAAA7EAAAOxAGVKw4bAAAA7klEQVRYw+2WsQ3EIAxFjShSMgKjZLRktIzCCJQpIv7Z',
    'hCiXO/qzT/wCWXo0X3wbEw0NWVaEKM187KHW2QLZ+AhpXovfQ+J6skEWHELqBa5NEeCwR7iS',
    'V7BDzuzAiZ9eqn5IWjfWXHf7VCO5tPAM6U9AjSRideyHFn4FiuvDqV5CM9rZXuF2pZmIAjZy',
    'x4S0MDdBxEmu3TrliPf7iglPvuLlRydfU3P70UweCSK+ZYK0mUg1O4AVcv0/8itGkC7SdiTH',
    '0+Mz19oJZ4NkhhSPbIhQkQGI8u1HJzmzs7p7pzNAru2pJb6z8ykkQ0P/pheK6vjurjf7+wAA',
    'AABJRU5ErkJggg==',
  ].join('')
  const EXPECTED_QRCODE_TEXT = 'hello, world!'

  const buf = Buffer.from(QRCODE_IMAGE_BASE64, 'base64')
  const text = await bufferToQrValue(buf)
  assert.strictEqual(text, EXPECTED_QRCODE_TEXT, 'should decode qrcode image base64')
})

test('qrValueToStream()', async () => {
  const QRCODE_VALUE = 'hello, world!'
  const EXPECTED_QRCODE_IMAGE_BASE64 = [
    'iVBORw0KGgoAAAANSUhEUgAAAHQAAAB0CAYAAABUmhYnAAAAAklEQVR4AewaftIAAAKcSURBVO3BQY7',
    'cQAwEwSxC//9yeo88NSBIsx7TjIg/WGMUa5RijVKsUYo1SrFGKdYoxRqlWKMUa5RijVKsUYo1SrFGKd',
    'YoxRrl4qEk/CaVkyTcoXKShN+k8kSxRinWKMUa5eJlKm9Kwh0qn6TypiS8qVijFGuUYo1y8WFJuEPlj',
    'iR0Kl0SOpUuCZ3KHUm4Q+WTijVKsUYp1igXw6n8T4o1SrFGKdYoF8MloVOZrFijFGuUYo1y8WEq3yQJ',
    'ncoTKt+kWKMUa5RijXLxsiR8M5UuCZ3KSRK+WbFGKdYoxRrl4iGVf5nKicq/pFijFGuUYo0Sf/BAEjq',
    'VLglvUnkiCZ3KSRLepPJJxRqlWKMUa5SLlyXhROU3JaFT6ZJwonKShCeS0Kk8UaxRijVKsUaJP3hREj',
    'qVO5JwotIloVO5Iwl3qJwk4Q6VNxVrlGKNUqxRLv6yJJyodEl4Igl3qHRJ6FTuUPmkYo1SrFGKNcrFQ',
    '0k4ScITSehUuiScJKFT6ZLQqXRJuEPljiR0Kk8Ua5RijVKsUS4eUvkmSbhDpUvCHUk4UflNxRqlWKMU',
    'a5SLh5Lwm1Q6lS4JdyThCZWTJJyovKlYoxRrlGKNcvEylTcl4SQJnUqXhCdUuiScJOFvKtYoxRqlWKN',
    'cfFgS7lB5k0qXhDuS0Kl0SehUTpLQJaFTeaJYoxRrlGKNcjFcEjqVJ5JwkoROpVP5pGKNUqxRijXKxX',
    '8mCScqXRJOVE6S0Kl8UrFGKdYoxRrl4sNUPknlDpUuCV0SOpWTJHyTYo1SrFGKNcrFy5Lwm5LQqXQqX',
    'RI6lZMkdConKidJ6FTeVKxRijVKsUaJP1hjFGuUYo1SrFGKNUqxRinWKMUapVijFGuUYo1SrFGKNUqx',
    'RinWKMUa5Q8Ztu740xD9iQAAAABJRU5ErkJggg==',
  ].join('')

  const stream = await qrValueToStream(QRCODE_VALUE)

  const chunks = [] as Buffer[]
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer)
  }
  const buf = Buffer.concat(chunks)
  const base64Text = buf.toString('base64')

  assert.strictEqual(base64Text, EXPECTED_QRCODE_IMAGE_BASE64, 'should encode QR Code value to expected image')
})

test('bufferToQrValue preserves the decoder error cause', async () => {
  const bogusPng = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x00,
  ])

  await assert.rejects(
    bufferToQrValue(bogusPng),
    (err: unknown) => {
      assert.ok(err instanceof Error)
      assert.equal(err.message, 'bufferToQrcode(buf) fail!')
      assert.ok(err.cause instanceof Error)
      assert.notEqual(err.cause.message, 'bufferToQrcode(buf) fail!')
      return true
    },
  )
})

test('bufferToQrValue decodes GIF, BMP, and TIFF QR images', async () => {
  const value = 'hello, world!'
  const png = await readStream(await qrValueToStream(value))
  const raster = await imageBytesToRgba(png)
  const rgba = new Uint8Array(raster.data)

  const bmp = encodeBmp({
    bitPP: 32,
    data: rgbaToAbgr(rgba),
    height: raster.height,
    width: raster.width,
  })
  assert.equal(await bufferToQrValue(bmp.data), value, 'should decode a BMP QR image')

  const { default: UTIF } = await import('utif2')
  const tiff = Buffer.from(UTIF.encodeImage(rgba, raster.width, raster.height))
  assert.equal(await bufferToQrValue(tiff), value, 'should decode a TIFF QR image')

  const gif = await encodeGif(rgba, raster.width, raster.height)
  assert.equal(await bufferToQrValue(gif), value, 'should decode a GIF QR image')
})

async function readStream (stream: AsyncIterable<unknown>): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk as Uint8Array))
  }
  return Buffer.concat(chunks)
}

function rgbaToAbgr (rgba: Uint8Array): Buffer {
  const out = Buffer.alloc(rgba.byteLength)
  for (let i = 0; i < rgba.byteLength; i += 4) {
    out[i] = rgba[i + 3] ?? 255
    out[i + 1] = rgba[i + 2] ?? 0
    out[i + 2] = rgba[i + 1] ?? 0
    out[i + 3] = rgba[i] ?? 0
  }
  return out
}

async function encodeGif (rgba: Uint8Array, width: number, height: number): Promise<Buffer> {
  const indexed = new Uint8Array(width * height)
  for (let i = 0; i < width * height; i++) {
    const offset = i * 4
    const r = rgba[offset] ?? 0
    const g = rgba[offset + 1] ?? 0
    const b = rgba[offset + 2] ?? 0
    indexed[i] = (r + g + b) / 3 > 127 ? 1 : 0
  }

  const gifModule = await import('omggif')
  const GifWriter = gifModule.GifWriter
  const buf = Buffer.alloc(width * height * 2 + 1024)
  const writer = new GifWriter(buf, width, height, {
    palette: [ 0x000000, 0xffffff ],
  })
  writer.addFrame(0, 0, width, height, indexed)
  return buf.subarray(0, writer.end())
}
