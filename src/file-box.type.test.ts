/** Locks the numeric FileBox discriminator values used on the wire. */
import * as assert from 'node:assert/strict'
import { test } from 'node:test'

import { FileBoxType } from './file-box.type.ts'

test('FileBoxType member types stay addressable', () => {
  const qr: FileBoxType.QRCode = FileBoxType.QRCode
  const file: FileBoxType.File = FileBoxType.File
  const uuid: FileBoxType.Uuid = FileBoxType.Uuid
  assert.equal(qr, 3)
  assert.equal(file, 5)
  assert.equal(uuid, 7)
  assert.equal(FileBoxType[FileBoxType.QRCode], 'QRCode')
})
