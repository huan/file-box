#!/usr/bin/env ts-node

// tslint:disable:no-shadowed-variable
import * as test  from 'blue-tape'

import {
  dataUrlToBase64,
}                   from './misc'

test('dataUrl to base64', async t => {
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

  t.equal(base64, dataUrlToBase64(dataUrl), 'should get base64 from dataUrl')
})
