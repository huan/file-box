#!/usr/bin/env -S node --no-warnings --loader ts-node/esm

import { test }  from 'tstest'

import { FileBox } from '../src/mod.js'

test('.amr mime support', async t => {
  const FILE_NAME = 'test.amr'
  const EXPECTED_MIME = 'audio/amr'

  const fileBox = FileBox.fromFile(FILE_NAME)

  t.equal(fileBox.mimeType, EXPECTED_MIME, 'should get the right mime type')
})
