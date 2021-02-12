#!/usr/bin/env ts-node

import { test }  from 'tstest'

import { FileBox } from '../src/mod'

test('.amr mime support', async (t) => {
  const FILE_NAME = 'test.amr'
  const EXPECTED_MIME = 'audio/amr'

  const fileBox = FileBox.fromFile(FILE_NAME)

  t.equal(fileBox.mimeType, EXPECTED_MIME, 'should get the right mime type')
})
