/**
 * Unit test validating fresh VERSION identifier in source code.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { VERSION } from './version.ts'

test('Make sure the VERSION is fresh in source code', async () => {
  assert.strictEqual(VERSION, '0.0.0', 'version should be 0.0.0 in source code, only updated before publish to NPM')
})
