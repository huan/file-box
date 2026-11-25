/**
 * Unit tests for UUID to BigInt conversion.
 */
import { test } from 'node:test'
import * as assert from 'node:assert/strict'

import { uuidToBigInt } from './uuid-to-big-int.ts'

test('uuidToBigInt() Nil UUID', async () => {
  const uuid = '00000000-0000-0000-0000-000000000000'
  const bigInt = uuidToBigInt(uuid)
  assert.strictEqual(bigInt.toString(), '0', 'should get zero for a Nil UUID')
})

test('uuidToBigInt() Valid UUID', async () => {
  const UUID = '00bd7c03-a690-48d3-a1fe-1314574e4fc1'
  const EXPECTED = BigInt('0x00bd7c03a69048d3a1fe1314574e4fc1')

  const bigInt = uuidToBigInt(UUID)
  assert.strictEqual(bigInt, EXPECTED, 'should convert UUID right')
})
