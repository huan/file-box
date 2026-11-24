/**
 * Unit tests for UniformResourceNameRegistry lifecycle and expiring table.
 */
import * as assert from 'node:assert/strict'
import { mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { test, type TestContext } from 'node:test'

import { FileBox } from '../file-box.ts'
import { streamToBuffer } from '../misc.ts'
import { UniformResourceNameRegistry } from './uniform-resource-name-registry.ts'

/** Makes async file purges observable after the expiry timer fires. */
class TestRegistry extends UniformResourceNameRegistry {

  private readonly purges: Promise<void>[] = []

  protected override purge (uuid: string): Promise<void> {
    const purge = super.purge(uuid)
    this.purges.push(purge)
    return purge
  }

  async waitForPurges (): Promise<void> {
    await Promise.all(this.purges.splice(0))
  }

  /** Runs the scheduled purge at the time supplied by the test. */
  async purgeExpiredFiles (): Promise<void> {
    this.purgeExpiredUuid()
    await this.waitForPurges()
  }

}

/** Allocates an isolated directory and registers cleanup before opening it. */
function createRegistry (t: TestContext, expireMilliseconds?: number) {
  const storeDir = mkdtempSync(join(tmpdir(), 'file-box-urn-registry-test-'))
  const registry = new TestRegistry({ expireMilliseconds, storeDir })
  t.after(async () => {
    await registry.waitForPurges()
    registry.destroy()
  })
  registry.init()
  return { registry, storeDir }
}

test('UniformResourceNameRegistry class', async t => {
  const QRCODE = 'test qrcode'

  const { registry: urnRegistry } = createRegistry(t)

  const fileBox = FileBox.fromQRCode(QRCODE)
  const stream = await fileBox.toStream()

  const uuid = await urnRegistry.save(stream)

  const stream2 = await urnRegistry.load(uuid)
  assert.ok(stream2, 'should load stream')

  const fileBox2 = FileBox.fromStream(stream2!, 'test')
  const qrcode = await fileBox2.toQRCode()

  assert.strictEqual(qrcode, QRCODE, 'should get back the qrcode data')

  assert.ok((await streamToBuffer(await urnRegistry.load(uuid))).length > 0, 'can load a UUID again')
})

test('save returns only after the destination contains all bytes', async t => {
  const { registry } = createRegistry(t)
  const payload = Buffer.alloc(128 * 1024, 0x42)
  const uuid = await registry.save(Readable.from([payload]))
  assert.deepEqual(await streamToBuffer(await registry.load(uuid)), payload)
})

test('save rejects a failed stream and removes the partial file', async t => {
  const { registry, storeDir } = createRegistry(t)

  async function* brokenStream () {
    yield Buffer.from('partial payload')
    throw new Error('stream failed')
  }

  await assert.rejects(registry.save(Readable.from(brokenStream())), /stream failed/)
  assert.deepEqual(readdirSync(storeDir), [])
})

test('registry expires each UUID on its own deadline', async t => {
  let now = 0
  t.mock.method(Date, 'now', () => now)
  const expireMilliseconds = 10 * 60 * 1000 // 10 minute
  const { registry: urnRegistry } = createRegistry(t, expireMilliseconds)
  const read = async (uuid: string) => (await streamToBuffer(await urnRegistry.load(uuid))).toString()
  const uuid1 = await urnRegistry.save(Readable.from([Buffer.from('first')]))
  assert.equal(await read(uuid1), 'first')

  now = 5 * 60 * 1000
  const uuid2 = await urnRegistry.save(Readable.from([Buffer.from('second')]))
  assert.equal(await read(uuid1), 'first')
  assert.equal(await read(uuid2), 'second')

  now = 11 * 60 * 1000
  await urnRegistry.purgeExpiredFiles()
  await assert.rejects(urnRegistry.load(uuid1), { code: 'ENOENT' })
  assert.equal(await read(uuid2), 'second')

  now = 20 * 60 * 1000
  await urnRegistry.purgeExpiredFiles()
  await assert.rejects(urnRegistry.load(uuid2), { code: 'ENOENT' })
})

test('URN FileBox helper smoke testing', async t => {
  const QRCODE = 'test qrcode'

  const { registry: urnRegistry } = createRegistry(t)

  const UUIDFileBox = urnRegistry.getFileBox()

  const uuid = await UUIDFileBox
    .fromQRCode(QRCODE)
    .toUuid()

  const qrcode = await UUIDFileBox
    .fromUuid(uuid)
    .toQRCode()

  assert.strictEqual(qrcode, QRCODE, 'should get back the qrcode data')
})
