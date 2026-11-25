/**
 * Verifies the web-build registry stand-in fails loudly and names the fix.
 * Portable on purpose so it also runs in Chromium; the node implementation is
 * covered by `src/node/uniform-resource-name-registry.native.test.ts`.
 */
import * as assert from 'node:assert/strict'
import { test } from 'node:test'

import { UniformResourceNameRegistry } from './uniform-resource-name-registry.ts'

test('constructing the web-build registry throws a message naming the fix', () => {
  assert.throws(
    () => new UniformResourceNameRegistry(),
    /not supported in the web build.*Node\.js, Deno, or Bun.*file-box\/node/s,
  )
})

test('every public member of the web-build registry throws', () => {
  const stub = Object.create(UniformResourceNameRegistry.prototype)
  assert.throws(() => stub.getFileBox(), /not supported in the web build/)
  assert.throws(() => stub.init(), /not supported in the web build/)
  assert.throws(() => stub.destroy(), /not supported in the web build/)
})

test('async members of the web-build registry reject', async () => {
  const stub = Object.create(UniformResourceNameRegistry.prototype)
  await assert.rejects(() => stub.resolve('x'), /not supported in the web build/)
  await assert.rejects(() => stub.load('x'), /not supported in the web build/)
  await assert.rejects(() => stub.register({}), /not supported in the web build/)
  await assert.rejects(() => stub.save({}), /not supported in the web build/)
})
