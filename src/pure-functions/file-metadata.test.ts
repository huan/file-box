/** Exercises the shared Data URL and download filename parsing contracts. */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { dataUrlToBase64, httpHeaderToFileName } from './file-metadata.ts'

test('extracts the Base64 payload from a Data URL', () => {
  assert.equal(dataUrlToBase64('data:text/plain;base64,dGVzdA=='), 'dGVzdA==')
})

test('reads quoted and unquoted attachment filenames', () => {
  assert.equal(httpHeaderToFileName({ 'content-disposition': 'attachment; filename="db.zip"' }), 'db.zip')
  assert.equal(httpHeaderToFileName({ 'content-disposition': 'attachment; filename=db.zip' }), 'db.zip')
  assert.equal(httpHeaderToFileName({}), null)
})
