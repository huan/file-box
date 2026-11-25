/**
 * Native server integration tests for FileBox and UniformResourceNameRegistry.
 */
import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { createServer } from 'node:http'
import { PassThrough, Readable, Writable } from 'node:stream'

import { FileBox as UniversalFileBox } from '../file-box.ts'
import { FileBox } from './file-box-node.ts'
import { UniformResourceNameRegistry } from './uniform-resource-name-registry.ts'

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

test('Server FileBox pipe() forwards source errors to destination', async () => {
  const errorSource = new Readable({
    read () {
      this.destroy(new Error('source stream failure'))
    },
  })
  const fileBox = FileBox.fromStream(errorSource, 'error.txt')

  const writable = new Writable({
    write (_chunk, _encoding, callback) {
      callback()
    },
  })

  await new Promise<void>((resolve, reject) => {
    writable.once('error', err => {
      try {
        assert.match(err.message, /source stream failure/)
        resolve()
      } catch (e) {
        reject(e)
      }
    })
    fileBox.pipe(writable)
  })
})

test('Canceling Web stream stops and destroys Node source', async () => {
  const source = new PassThrough()
  const fileBox = FileBox.fromStream(source, 'cancel.txt')
  const webStream = await fileBox.toReadableStream()
  const reader = webStream.getReader()

  await reader.cancel('cancel stream')
  assert.ok(source.destroyed, 'Node stream source should be destroyed on Web stream cancel')
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

test('ServerFileBox.fromBox promotes UniversalFileBox to ServerFileBox', async () => {
  const universalBox = UniversalFileBox.fromBytes(new TextEncoder().encode('Universal data'), 'universal.txt')
  assert.ok(!(universalBox instanceof FileBox), 'should not initially be a ServerFileBox')

  const serverBox = FileBox.fromBox(universalBox)
  assert.ok(serverBox instanceof FileBox, 'promoted box should be instance of ServerFileBox')
  assert.ok(serverBox instanceof UniversalFileBox)

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'from-box-test-'))
  try {
    const target = path.join(tmpDir, 'saved.txt')
    await serverBox.toFile(target)
    assert.strictEqual(fs.readFileSync(target, 'utf8'), 'Universal data')
  } finally {
    fs.rmSync(tmpDir, { force: true, recursive: true })
  }
})

test('ServerFileBox.toFile removes partial file on stream failure', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'to-file-fail-test-'))
  try {
    const errorStream = new ReadableStream<Uint8Array>({
      start (controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]))
        controller.error(new Error('intentional stream failure'))
      },
    })
    const box = FileBox.fromStream(errorStream, 'failing.dat')
    const target = path.join(tmpDir, 'partial.dat')

    await assert.rejects(
      box.toFile(target),
      /intentional stream failure/,
    )
    assert.strictEqual(fs.existsSync(target), false, 'partial file must be cleaned up on failure')
  } finally {
    fs.rmSync(tmpDir, { force: true, recursive: true })
  }
})

test('nodeStreamToWebStream handles string chunks safely', async () => {
  const nodeReadable = new Readable({
    read () {
      this.push('text chunk 1, ')
      this.push('text chunk 2')
      this.push(null)
    },
  })
  nodeReadable.setEncoding('utf8')

  const box = FileBox.fromStream(nodeReadable, 'strings.txt')
  const bytes = await box.toBytes()
  assert.strictEqual(new TextDecoder().decode(bytes), 'text chunk 1, text chunk 2')
})

test('Server FileBox toFile syncs URL metadata when filename is determined by header', async t => {
  const payload = 'URL content for toFile'
  const server = createServer((_req, res) => {
    res.setHeader('Content-Disposition', 'attachment; filename=remote-resolved.txt')
    res.setHeader('Content-Type', 'text/plain')
    res.end(payload)
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve())
  }))

  const addr = server.address()
  assert.ok(addr && typeof addr !== 'string')
  const box = FileBox.fromUrl(`http://127.0.0.1:${addr.port}/endpoint`)

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'url-to-file-test-'))
  try {
    const dest = path.join(tmpDir, 'custom-target.txt')
    await box.toFile(dest)
    assert.strictEqual(box.name, 'remote-resolved.txt')
    assert.strictEqual(fs.readFileSync(dest, 'utf8'), payload)
  } finally {
    fs.rmSync(tmpDir, { force: true, recursive: true })
  }
})
