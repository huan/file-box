/**
 * Universal unit test suite for FileBox.
 *
 * Runs across all target environments: Chromium browser, Node.js, and Deno.
 * Tests WHATWG streams, blobs, byte buffers, base64, data URLs, QR codes, and JSON serialization.
 */
import { test } from 'node:test'
import * as assert from 'node:assert/strict'

import { FileBox } from './file-box.ts'
import { FileBoxType } from './file-box.type.ts'

test('FileBox.fromBytes() and toBytes()', async () => {
  const text = 'Hello, WinterTC World!'
  const bytes = new TextEncoder().encode(text)

  const fileBox = FileBox.fromBytes(bytes, 'hello.txt')
  assert.strictEqual(fileBox.name, 'hello.txt')
  assert.strictEqual(fileBox.size, bytes.byteLength)
  assert.strictEqual(fileBox.type, FileBoxType.Buffer)

  const recoveredBytes = await fileBox.toBytes()
  assert.deepStrictEqual(recoveredBytes, bytes)

  const recoveredText = new TextDecoder().decode(recoveredBytes)
  assert.strictEqual(recoveredText, text)
})

test('FileBox.fromBlob() and toBlob()', async () => {
  const content = 'Blob content for testing'
  const blob = new Blob([content], { type: 'text/plain' })

  const fileBox = FileBox.fromBlob(blob, 'sample.txt')
  assert.strictEqual(fileBox.name, 'sample.txt')
  assert.strictEqual(fileBox.size, blob.size)

  const outBlob = await fileBox.toBlob()
  assert.strictEqual(await outBlob.text(), content)
})

test('FileBox.toReadableStream() and pipeTo()', async () => {
  const content = 'Streaming byte verification'
  const bytes = new TextEncoder().encode(content)
  const fileBox = FileBox.fromBytes(bytes, 'stream.txt')

  const stream = await fileBox.toReadableStream()
  assert.ok(stream, 'should return a WHATWG ReadableStream')

  const chunks: Uint8Array[] = []
  const destination = new WritableStream<Uint8Array>({
    write (chunk) {
      chunks.push(chunk)
    },
  })

  await fileBox.pipeTo(destination)
  const totalLength = chunks.reduce((acc, c) => acc + c.byteLength, 0)
  const merged = new Uint8Array(totalLength)
  let offset = 0
  for (const c of chunks) {
    merged.set(c, offset)
    offset += c.byteLength
  }

  assert.strictEqual(new TextDecoder().decode(merged), content)
})

test('FileBox.fromStream() with one-shot and repeatable stream factory', async () => {
  const content = 'Stream payload'
  const encoder = new TextEncoder()

  // Repeatable stream factory
  const factory = () => new ReadableStream<Uint8Array>({
    start (controller) {
      controller.enqueue(encoder.encode(content))
      controller.close()
    },
  })

  const repeatableBox = FileBox.fromStream(factory, 'repeatable.txt')
  const bytes1 = await repeatableBox.toBytes()
  const bytes2 = await repeatableBox.toBytes()
  assert.strictEqual(new TextDecoder().decode(bytes1), content)
  assert.strictEqual(new TextDecoder().decode(bytes2), content)

  // One-shot stream consumed twice should throw
  const oneShotStream = factory()
  const oneShotBox = FileBox.fromStream(oneShotStream, 'oneshot.txt')
  await oneShotBox.toBytes()
  await assert.rejects(oneShotBox.toBytes(), /consumed|drained|readable/i)
})

test('FileBox.fromBase64() and toBase64()', async () => {
  const BASE64_ENCODED = 'RmlsZUJveEJhc2U2NAo='
  const fileBox = FileBox.fromBase64(BASE64_ENCODED, 'test.txt')

  assert.strictEqual(fileBox.type, FileBoxType.Base64)
  const base64 = await fileBox.toBase64()
  assert.strictEqual(base64, BASE64_ENCODED)

  const bytes = await fileBox.toBytes()
  const text = new TextDecoder().decode(bytes)
  assert.strictEqual(text, 'FileBoxBase64\n')
})

test('FileBox.fromDataURL() and toDataURL()', async () => {
  const dataUrl = 'data:text/plain;base64,dGVzdA=='
  const fileBox = FileBox.fromDataURL(dataUrl, 'data.txt')

  const outDataUrl = await fileBox.toDataURL()
  assert.strictEqual(outDataUrl, dataUrl)
})

test('FileBox.fromQRCode() and toQRCode()', async () => {
  const value = 'https://wechaty.js.org'
  const fileBox = FileBox.fromQRCode(value)

  assert.strictEqual(fileBox.type, FileBoxType.QRCode)
  assert.strictEqual(await fileBox.toQRCode(), value)

  const pngBytes = await fileBox.toBytes()
  assert.ok(pngBytes.byteLength > 8, 'should render PNG bytes')
  assert.strictEqual(pngBytes[0], 0x89, 'should start with PNG signature')
})

test('FileBox.fromJSON() and toJSON() round-trip', async () => {
  const BASE64_ENCODED = 'RmlsZUJveEJhc2U2NAo='
  const fileBox = FileBox.fromBase64(BASE64_ENCODED, 'test.txt')
  fileBox.metadata = { testKey: 'testValue' }

  const jsonString = JSON.stringify(fileBox)
  const restored = FileBox.fromJSON(jsonString)

  assert.strictEqual(restored.name, 'test.txt')
  assert.strictEqual(restored.type, FileBoxType.Base64)
  assert.strictEqual(await restored.toBase64(), BASE64_ENCODED)
  assert.deepStrictEqual(restored.metadata, { testKey: 'testValue' })
})

test('Universal FileBox raises descriptive errors on native-only methods', async () => {
  assert.throws(
    () => FileBox.fromFile('/path/to/file.txt'),
    /requires filesystem access.*file-box\/server/i,
  )

  const box = FileBox.fromBytes(new Uint8Array([1, 2, 3]), 'sample.dat')

  await assert.rejects(
    box.toFile('/tmp/file.dat'),
    /requires native filesystem access.*file-box\/server/i,
  )

  await assert.rejects(
    box.toStream(),
    /requires Node\.js streams.*file-box\/server/i,
  )

  assert.throws(
    () => box.pipe({} as any),
    /requires Node\.js streams.*file-box\/server/i,
  )
})

test('FileBox preserves literal hash and question mark in filenames', () => {
  const box1 = FileBox.fromBytes(new Uint8Array([1]), 'report#1.txt')
  assert.strictEqual(box1.name, 'report#1.txt')

  const box2 = FileBox.fromBytes(new Uint8Array([1]), 'query?v=2.dat')
  assert.strictEqual(box2.name, 'query?v=2.dat')
})

test('FileBox.validInterface() and instanceof check', () => {
  const fileBox = FileBox.fromBytes(new Uint8Array([1, 2, 3]), 'test.dat')
  assert.ok(fileBox instanceof FileBox)
  assert.ok(FileBox.validInstance(fileBox))
  assert.ok(FileBox.validInterface(fileBox))
  assert.ok(FileBox.valid(fileBox))
})

test('FileBox.fromBox() preserves metadata, mediaType and bytes', async () => {
  const original = FileBox.fromBytes(new TextEncoder().encode('Box payload'), 'payload.txt')
  original.metadata = { custom: 'value' }

  const converted = FileBox.fromBox(original)
  assert.strictEqual(converted, original, 'same class instance should return itself')

  // Create an object conforming to FileBoxInterface
  const customBox = {
    name: 'custom.txt',
    size: 6,
    md5: 'dummy-md5',
    mediaType: 'text/custom',
    metadata: { key: 'val' },
    type: FileBoxType.Stream,
    toReadableStream: async () => new ReadableStream<Uint8Array>({
      start (controller) {
        controller.enqueue(new TextEncoder().encode('custom'))
        controller.close()
      },
    }),
  } as any

  const boxed = FileBox.fromBox(customBox)
  assert.strictEqual(boxed.name, 'custom.txt')
  assert.strictEqual(boxed.size, 6)
  assert.strictEqual(boxed.md5, 'dummy-md5')
  assert.strictEqual(boxed.mediaType, 'text/custom')
  assert.deepStrictEqual(boxed.metadata, { key: 'val' })
  assert.strictEqual(new TextDecoder().decode(await boxed.toBytes()), 'custom')
})

test('FileBox.fromJSON() preserves headers for Url box', () => {
  const urlBox = FileBox.fromUrl('https://example.com/file.txt', {
    headers: { Authorization: 'Bearer token-123' },
  })
  const json = urlBox.toJSON()
  const restored = FileBox.fromJSON(json)
  assert.strictEqual(restored.type, FileBoxType.Url)
  assert.deepStrictEqual((restored as any).headers, { Authorization: 'Bearer token-123' })
})
