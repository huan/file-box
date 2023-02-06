#!/usr/bin/env -S node --no-warnings --loader ts-node/esm

import { sinon, test }  from 'tstest'

import { FileBox } from '../src/mod.js'

import { HTTP_TIMEOUT } from '../src/config.js'

test('slow network stall HTTP_TIMEOUT', async t => {
  const sandbox = sinon.createSandbox()
  sandbox.useFakeTimers(Date.now())

  const spy = sandbox.spy()

  const stream = await FileBox
    .fromUrl('https://www.google.com')
    .toStream()

  stream.on('error', spy)

  const start = Date.now()

  await sandbox.clock.tickAsync(HTTP_TIMEOUT - 1)
  t.ok(spy.notCalled, `should not get error after TIMEOUT ${HTTP_TIMEOUT} - 1 (${Date.now() - start} passed)`)

  await sandbox.clock.tickAsync(10)
  t.ok(spy.calledOnce, `should get error after TIMEOUT ${HTTP_TIMEOUT} (${Date.now() - start} passed)`)

  sandbox.restore()
})
