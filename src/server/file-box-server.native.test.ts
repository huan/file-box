/**
 * Native server integration tests for FileBox and UniformResourceNameRegistry.
 */
import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { Writable } from 'node:stream'

import { FileBox as UniversalFileBox } from '../file-box.ts'
import { FileBox } from './file-box-server.ts'
import { UniformResourceNameRegistry } from '../urn-registry/uniform-resource-name-registry.ts'

test('Server FileBox subclasses Universal FileBox and preserves identity', () => {
  const box = FileBox.fromBytes(new Uint8Array([1, 2, 3]), 'test.dat')
  assert.ok(box instanceof FileBox, 'should be instance of server FileBox')
  assert.ok(box instanceof UniversalFileBox, 'should be instance of universal FileBox')
})

test('Server FileBox.fromFile() and toFile()', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-box-server-test-'))
  try {
    const filePath = path.join(tmpDir, 'source.txt')
    const content = 'Server filesystem file content'
    fs.writeFileSync(filePath, content, 'utf8')

    const fileBox = FileBox.fromFile(filePath)
    assert.strictEqual(fileBox.name, 'source.txt')
    assert.strictEqual(fileBox.size, Buffer.byteLength(content))

    const targetPath = path.join(tmpDir, 'destination.txt')
    await fileBox.toFile(targetPath)
    assert.ok(fs.existsSync(targetPath))
    assert.strictEqual(fs.readFileSync(targetPath, 'utf8'), content)

    const stream = await fileBox.toStream()
    assert.ok(stream, 'should return a Node Readable stream')

    const buf = await fileBox.toBuffer()
    assert.ok(Buffer.isBuffer(buf))
    assert.strictEqual(buf.toString('utf8'), content)
  } finally {
    fs.rmSync(tmpDir, { force: true, recursive: true })
  }
})

test('Server FileBox pipe() to Node Writable stream', async () => {
  const content = 'Node pipe test payload'
  const fileBox = FileBox.fromBuffer(Buffer.from(content), 'pipe.txt')

  const chunks: Buffer[] = []
  const writable = new Writable({
    write (chunk, _encoding, callback) {
      chunks.push(chunk)
      callback()
    },
  })

  await new Promise<void>((resolve, reject) => {
    writable.once('finish', resolve)
    writable.once('error', reject)
    fileBox.pipe(writable)
  })

  const merged = Buffer.concat(chunks).toString('utf8')
  assert.strictEqual(merged, content)
})

test('UniformResourceNameRegistry with Server FileBox', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'urn-registry-test-'))
  try {
    const registry = new UniformResourceNameRegistry({ storeDir: tmpDir })
    registry.init()

    const URNFileBox = registry.getFileBox()
    const content = 'URN registry payload'
    const box = URNFileBox.fromBuffer(Buffer.from(content), 'urn.txt')

    const uuid = await box.toUuid()
    assert.ok(uuid, 'should save file and return UUID')

    const restoredBox = URNFileBox.fromUuid(uuid)
    const restoredBuf = await restoredBox.toBuffer()
    assert.strictEqual(restoredBuf.toString('utf8'), content)

    registry.destroy()
  } finally {
    fs.rmSync(tmpDir, { force: true, recursive: true })
  }
})
