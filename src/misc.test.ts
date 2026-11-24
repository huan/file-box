/**
 * Unit tests for miscellaneous HTTP and stream helpers.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  dataUrlToBase64,
  httpHeaderToFileName,
  httpHeadHeader,
  httpStream,
  streamToBuffer,
} from './misc.ts'

test('dataUrl to base64', async () => {
  const base64 = [
    'R0lGODlhEAAQAMQAAORHHOVSKudfOulrSOp3WOyDZu6QdvCchPGolfO0o/XBs/fNwfjZ0frl',
    '3/zy7////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    'ACH5BAkAABAALAAAAAAQABAAAAVVICSOZGlCQAosJ6mu7fiyZeKqNKToQGDsM8hBADgUXoGA',
    'iqhSvp5QAnQKGIgUhwFUYLCVDFCrKUE1lBavAViFIDlTImbKC5Gm2hB0SlBCBMQiB0UjIQA7',
  ].join('')
  const dataUrl = [
    'data:image/png;base64,',
    base64,
  ].join('')

  assert.strictEqual(dataUrlToBase64(dataUrl), base64, 'should get base64 from dataUrl')
})

test('httpHeadHeader', async () => {
  const URL = 'https://github.com/huan/file-box/archive/v0.6.tar.gz'

  const EXPECTED_HEADERS_KEY = 'content-disposition'
  const EXPECTED_HEADERS_VALUE = 'attachment; filename=file-box-0.6.tar.gz'

  const headers = await httpHeadHeader(URL)
  assert.strictEqual(headers[EXPECTED_HEADERS_KEY], EXPECTED_HEADERS_VALUE, 'should get the headers right')
})

test('httpHeaderToFileName', async () => {
  const HEADERS_QUOTATION_MARK: any = {
    'content-disposition': 'attachment; filename="db-0.0.19.zip"',
  }
  const HEADERS_NO_QUOTATION_MARK: any = {
    'content-disposition': 'attachment; filename=db-0.0.19.zip',
  }
  const EXPECTED_FILE_NAME = 'db-0.0.19.zip'

  let filename = httpHeaderToFileName(HEADERS_QUOTATION_MARK)
  assert.strictEqual(filename, EXPECTED_FILE_NAME, 'should get filename with quotation mark')

  filename = httpHeaderToFileName(HEADERS_NO_QUOTATION_MARK)
  assert.strictEqual(filename, EXPECTED_FILE_NAME, 'should get filename with no quotation mark')
})

test('httpStream', async () => {
  const URL = 'https://httpbin.org/headers'

  const MOL_KEY = 'mol'
  const MOL_VAL = '42'

  const headers = {} as { [idx: string]: string }
  headers[MOL_KEY] = MOL_VAL

  const res = await httpStream(URL, headers)

  const buffer = await streamToBuffer(res)
  const obj = JSON.parse(buffer.toString())
  assert.strictEqual(obj.headers?.Mol ?? obj.headers?.mol, MOL_VAL, 'should send the header right')
})
