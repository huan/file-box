/**
 * Unit tests for FileBox creation, conversion, serialization, and QR code operations.
 */
import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { fileURLToPath } from 'node:url'
import { PassThrough, type Readable } from 'node:stream'
import { instanceToClass } from 'clone-class'

import { FileBox } from './file-box.ts'
import { FileBox as ServerFileBox } from './node/file-box-node.ts'
import { FileBoxType } from './file-box.type.ts'

test('File smoke testing', async () => {
  assert.throws(() => FileBox.fromFile('non-existent-file-xyz.txt'), 'should throw for a non-existing file')
})

test('toBase64()', async () => {
  const BASE64_DECODED = 'FileBoxBase64\n'
  const BASE64_ENCODED = 'RmlsZUJveEJhc2U2NAo='

  const fileBox = FileBox.fromBase64(BASE64_ENCODED, 'test.txt')
  const base64 = await fileBox.toBase64()

  assert.strictEqual(base64, BASE64_ENCODED, 'should get base64 back')

  const text = Buffer.from(base64, 'base64').toString()
  assert.strictEqual(text, BASE64_DECODED, 'should get the text right')
})

test('fromBuffer() & toBase64()', async () => {
  const BASE64_ENCODED = 'RmlsZUJveEJhc2U2NAo='

  const buffer = Buffer.from(BASE64_ENCODED, 'base64')
  const fileBox = FileBox.fromBuffer(buffer, 'test.txt')
  const base64 = await fileBox.toBase64()

  assert.strictEqual(base64, BASE64_ENCODED, 'should get base64 back from buffer')
})

test('fromURL() deal with url with querystring', async () => {
  const URL = 'https://zixia.net/a.jpg?name=value&t=1324'
  const EXPECTED_NAME = 'a.jpg'

  const fileBox = FileBox.fromUrl(URL)
  assert.strictEqual(fileBox.name, EXPECTED_NAME, 'should get basename from url with querystring')
})

test('toDataURL()', async () => {
  const FILE_PATH = 'tests/fixtures/data.bin'
  const EXPECTED_DATA_URL = 'data:application/octet-stream;base64,dGVzdA=='

  const fileBox = ServerFileBox.fromFile(FILE_PATH)
  const dataUrl = await fileBox.toDataURL()
  assert.strictEqual(dataUrl, EXPECTED_DATA_URL, 'should get expected dataUrl')
})

test('toString()', async () => {
  const fileBox = FileBox.fromBuffer(Buffer.from('test'), 'test.txt')
  const str = fileBox.toString()
  assert.strictEqual(str, 'FileBox#Buffer<test.txt>', 'should serialize correctly via toString()')
})

test('toBuffer()', async () => {
  const content = 'hello world'
  const fileBox = FileBox.fromBuffer(Buffer.from(content), 'test.txt')
  const buf = await fileBox.toBuffer()
  assert.strictEqual(buf.toString(), content, 'should recover buffer content')
})

test('toFile() with long name', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-box-test-'))
  try {
    const longName = 'very-long-file-name-for-testing-filebox-saving-behavior.txt'
    const targetPath = path.join(tmpDir, longName)
    const content = 'test file content'

    const fileBox = ServerFileBox.fromBuffer(Buffer.from(content), longName)
    await fileBox.toFile(targetPath)

    assert.ok(fs.existsSync(targetPath), 'file should exist on disk')
    assert.strictEqual(fs.readFileSync(targetPath, 'utf8'), content, 'file content should match')
  } finally {
    fs.rmSync(tmpDir, { force: true, recursive: true })
  }
})

test('metadata', async () => {
  const metadata = { author: 'Huan', verified: true, count: 42 }
  const fileBox = FileBox.fromBuffer(Buffer.from('data'), 'test.txt')
  fileBox.metadata = metadata

  assert.deepStrictEqual(fileBox.metadata, metadata, 'metadata should be set and retrieved accurately')
})

test('fromQRCode() produces a PNG with the supplied payload', async () => {
  const value = 'hello, world!'
  const fileBox = FileBox.fromQRCode(value)
  const image = await fileBox.toBuffer()
  assert.equal(image.subarray(1, 4).toString('ascii'), 'PNG')
  assert.equal(await FileBox.fromBuffer(image, 'qrcode.png').toQRCode(), value)
})

test('toQRCode()', async () => {
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

  const fileBox = FileBox.fromBase64(QRCODE_IMAGE_BASE64, 'qrcode.png')
  const qrCodeValue = await fileBox.toQRCode()

  assert.strictEqual(qrCodeValue, EXPECTED_QRCODE_TEXT, 'should decode qrcode image base64 to qr code value')
})

test('toJSON()', async () => {
  const BASE64_ENCODED = 'RmlsZUJveEJhc2U2NAo='
  const BASE64_FILENAME = 'test.txt'

  const EXPECTED_JSON_TEXT = '{"metadata":{},"name":"test.txt","size":14,"base64":"RmlsZUJveEJhc2U2NAo=","type":1,"boxType":1}'

  const fileBox = FileBox.fromBase64(BASE64_ENCODED, BASE64_FILENAME)
  const jsonText = JSON.stringify(fileBox)

  assert.strictEqual(jsonText, EXPECTED_JSON_TEXT, 'should get expected json text')

  const newFileBox = FileBox.fromJSON(jsonText)
  const newBase64 = await newFileBox.toBase64()

  assert.strictEqual(newBase64, BASE64_ENCODED, 'should get base64 back')
})

test('toJSON() for not supported type', async () => {
  const BASE64_ENCODED = 'RmlsZUJveEJhc2U2NAo='

  const buffer = Buffer.from(BASE64_ENCODED, 'base64')
  const fileBox = FileBox.fromBuffer(buffer, 'test.txt')

  assert.strictEqual(fileBox.type, FileBoxType.Buffer, 'should get type() as Buffer')
  assert.throws(() => JSON.stringify(fileBox), 'should throw for buffer type of FileBox')
})

test('toStream() twice for a stream', async () => {
  const stream = new PassThrough()
  const box = FileBox.fromStream(stream, 'hello.dat')

  stream.end('hello, world!')

  await assert.doesNotReject(box.toBase64(), 'should succeed reading the stream for the first time')
  await assert.rejects(box.toBuffer(), 'should throw when stream FileBox is consumed twice')
})

test('toUuid()', async () => {
  const BASE64_ENCODED = 'RmlsZUJveEJhc2U2NAo='
  const UUID = '12345678-1234-1234-1234-123456789012'

  class FileBoxTest extends FileBox {}

  const buffer = Buffer.from(BASE64_ENCODED, 'base64')
  const fileBox = FileBoxTest.fromBuffer(buffer, 'test.txt')

  await assert.rejects(fileBox.toUuid(), 'should reject without `FileBox.setUuidSaver()` call')

  FileBoxTest.setUuidSaver(() => Promise.resolve(UUID))
  assert.strictEqual(await fileBox.toUuid(), UUID, `should get UUID: ${UUID}`)
})

test('fromUuid()', async () => {
  const UUID = '12345678-1234-1234-1234-123456789012'
  const TEXT = 'hello, world!'

  class FileBoxTest extends FileBox {}

  const stream = new PassThrough()
  stream.end(TEXT)

  const uuidBox = FileBoxTest.fromUuid(UUID, { name: 'test.txt' })

  await assert.rejects(uuidBox.toBase64(), 'should reject without `FileBox.setUuidLoader()` call')

  FileBoxTest.setUuidLoader((_: string) => Promise.resolve(stream))
  assert.strictEqual((await uuidBox.toBuffer()).toString(), TEXT, `should get BASE64: ${TEXT}`)
})

test('setUuidLoader()', async () => {
  class FileBoxTest1 extends FileBox {}
  class FileBoxTest2 extends FileBox {}

  assert.doesNotThrow(() => FileBoxTest1.setUuidLoader((_: string) => ({} as any)), 'should not throw for set loader for the first time')
  assert.throws(() => FileBoxTest1.setUuidLoader((_: string) => ({} as any)), 'should throw for set loader twice')

  assert.doesNotThrow(() => FileBoxTest2.setUuidLoader((_: string) => ({} as any)), 'should not throw for set loader for the first time')
  assert.throws(() => FileBoxTest2.setUuidLoader((_: string) => ({} as any)), 'should throw for set loader twice')
})

test('setUuidSaver()', async () => {
  class FileBoxTest1 extends FileBox {}
  class FileBoxTest2 extends FileBox {}

  assert.doesNotThrow(() => FileBoxTest1.setUuidSaver((_: Readable) => Promise.resolve('uuid')), 'should not throw for set loader for the first time')
  assert.throws(() => FileBoxTest1.setUuidSaver((_: Readable) => Promise.resolve('uuid')), 'should throw for set loader twice')

  assert.doesNotThrow(() => FileBoxTest2.setUuidSaver((_: Readable) => Promise.resolve('uuid')), 'should not throw for set loader for the first time')
  assert.throws(() => FileBoxTest2.setUuidSaver((_: Readable) => Promise.resolve('uuid')), 'should throw for set loader twice')
})

test('setUuidLoader() & setUuidSaver() on the FileBox class', () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  // This fixture checks the Node entry in a fresh process even under Deno.
  const node = process.versions['deno'] ? 'node' : process.execPath
  const result = spawnSync(node, [
    '--input-type=module',
    '--eval',
    `
      import { FileBox } from './src/file-box.ts'
      import { PassThrough } from 'node:stream'

      const loader = () => Promise.resolve(new PassThrough())
      const saver = () => Promise.resolve('uuid')

      if (Object.hasOwn(FileBox, 'uuidToStream') && FileBox.uuidToStream) {
        throw new Error('uuidToStream should not be registered before the first call')
      }
      FileBox.setUuidLoader(loader)
      FileBox.setUuidSaver(saver)

      let loaderThrew = false
      try {
        FileBox.setUuidLoader(loader)
      } catch (err) {
        loaderThrew = true
        if (!(err instanceof Error) || !err.message.includes('set resolver before')) {
          throw err
        }
      }
      if (!loaderThrew) {
        throw new Error('second FileBox.setUuidLoader() should throw')
      }

      let saverThrew = false
      try {
        FileBox.setUuidSaver(saver)
      } catch (err) {
        saverThrew = true
        if (!(err instanceof Error) || !err.message.includes('set register before')) {
          throw err
        }
      }
      if (!saverThrew) {
        throw new Error('second FileBox.setUuidSaver() should throw')
      }
    `,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
  })

  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`)
})

test('setUuidLoader() & setUuidSaver() with `this`', async t => {
  const stream = await ServerFileBox.fromQRCode('qr').toStream()
  const loader = t.mock.fn(async () => stream)
  const saver = t.mock.fn(async () => 'uuid')

  class FileBoxTest extends FileBox {}

  FileBoxTest.setUuidLoader(loader)
  FileBoxTest.setUuidSaver(saver)

  const fileBox = FileBoxTest.fromUuid('uuid', { name: 'test.txt' })
  await fileBox.toBuffer()
  assert.strictEqual(loader.mock.calls[0]?.this, fileBox, 'should call loader with `this`')

  const fileBox2 = FileBoxTest.fromBuffer(Buffer.from('test'), 'test.txt')
  await fileBox2.toUuid()
  assert.strictEqual(saver.mock.calls[0]?.this, fileBox2, 'should call saver with `this`')
})

test('FileBox.validInterface()', async () => {
  const fileBox = FileBox.fromQRCode('test')

  assert.ok(FileBox.validInstance(fileBox), 'should satisfy instance validation for a FileBox instance')
  assert.ok(FileBox.validInterface(fileBox), 'should satisfy interface validation for a FileBox instance')
  assert.ok(FileBox.valid(fileBox), 'should satisfy interface validation')
  assert.ok(fileBox instanceof FileBox, 'should be instance of FileBox')

  const copy = {} as any
  Object.getOwnPropertyNames(
    Object.getPrototypeOf(fileBox),
  ).forEach(prop => {
    copy[prop] = (fileBox as FileBox)[prop as keyof FileBox]
  })

  function NOT_FILE_BOX_CONSTRUCTOR () {}
  const target = {
    ...copy,
    constructor: NOT_FILE_BOX_CONSTRUCTOR,
  }

  assert.ok(FileBox.validInstance(target), 'should pass instance validation instance test')
  assert.ok(FileBox.validInterface(target), 'should pass interface validation for an object with FileBox properties')
  assert.ok(FileBox.valid(target), 'should satisfy interface validation')
  assert.ok(target instanceof FileBox, 'should be instance of FileBox')

  delete (target as any).size
  assert.ok(!FileBox.validInterface(target), 'should not be a valid interface if it lacks any property')
  assert.ok(!FileBox.valid(target), 'should not satisfy interface validation')
})

test('fromJSON() should keep class', async () => {
  const JSON_TEXT = '{"metadata":{},"name":"smoke-testing.ts","size":735,"type":7,"uuid":"82f461b9-e654-422d-aade-222d05cb02ad","boxType":7}'

  class FileBoxUuid extends FileBox {}
  FileBoxUuid.setUuidLoader(() => ({} as any))
  FileBoxUuid.setUuidSaver(() => ({} as any))

  const fileBoxUuid = FileBoxUuid.fromJSON(JSON_TEXT)
  const FromJsonKlass = instanceToClass(fileBoxUuid, FileBox)
  assert.strictEqual(FromJsonKlass, FileBoxUuid, 'should get back FileBoxUuid class')
})
