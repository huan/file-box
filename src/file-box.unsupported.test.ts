/**
 * Pins what the web build does with calls it cannot support: it keeps the same
 * API as the node build, and each native-only method throws an error that names
 * the supported route. It imports the web entry directly, so it checks the web
 * build whichever build `#file-box` resolves to, and runs in Chromium too.
 */
import { test } from 'node:test'
import * as assert from 'node:assert/strict'

import { FileBox } from './mod.ts'

test('web-build FileBox raises descriptive errors on native-only methods', async () => {
  assert.throws(
    () => FileBox.fromFile('/path/to/file.txt'),
    /fromFile.*not supported in the web build.*file-box\/node/i,
  )

  const box = FileBox.fromBytes(new Uint8Array([1, 2, 3]), 'sample.dat')

  await assert.rejects(
    box.toFile('/tmp/file.dat'),
    /toFile.*not supported in the web build.*file-box\/node/i,
  )

  await assert.rejects(
    box.toStream(),
    /not supported in the web build.*Node\.js streams.*file-box\/node/i,
  )

  assert.throws(
    () => box.pipe({} as any),
    /not supported in the web build.*Node\.js streams.*file-box\/node/i,
  )
})
