/**
 * Unit test verifying FileBox interface assignment and typing.
 */
import { test } from 'node:test'
import * as assert from 'node:assert/strict'

import type {
  FileBoxInterface,
} from './interface.ts'
import {
  FileBox,
} from './file-box.ts'

test('FileBoxInterface', async () => {
  const fileBox: FileBoxInterface = FileBox.fromQRCode('test')
  assert.ok(fileBox, 'should be ok with interface')
})
