/** Verifies the browser runner propagates failed assertions to CI. */
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('deliberate browser assertion failure', () => {
  assert.fail('FileBox browser runner failure fixture')
})
