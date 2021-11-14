#!/usr/bin/env -S node --no-warnings --loader ts-node/esm

import { test }  from 'tstest'

test('integration test', async t => {
  t.pass('tbw')
})
