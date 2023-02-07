#!/usr/bin/env -S node --no-warnings --loader ts-node/esm

import { createServer } from 'http'
import type { AddressInfo } from 'net'
import { setTimeout } from 'timers/promises'
import { sinon, test } from 'tstest'

import { FileBox } from '../src/mod.js'

import { HTTP_TIMEOUT } from '../src/config.js'

test('slow network stall HTTP_TIMEOUT', async (t) => {
  const sandbox = sinon.createSandbox()
  sandbox.useFakeTimers(Date.now())
  const port = Math.floor(Math.random() * (65535 - 49152 + 1)) + 49152
  const URL = {
    NOT_TIMEOUT: '/not_timeout',
    TIMEOUT: '/timeout',
  }

  /* eslint @typescript-eslint/no-misused-promises:off */
  const server = createServer(async (req, res) => {
    res.write(Buffer.from('This is the first chunk of data.'))

    if (req.url === URL.TIMEOUT) {
      await setTimeout(HTTP_TIMEOUT + 1)
    } else {
      await setTimeout(HTTP_TIMEOUT - 1)
    }

    // console.debug(`${new Date().toLocaleTimeString()} call res.end`)
    res.end(Buffer.from('This is the second chunk of data after 10 seconds.'))
  })

  const host = await new Promise<string>((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo
      // console.debug(`Server is listening on port ${JSON.stringify(addr)}`)
      resolve(`http://127.0.0.1:${addr.port}`)
    })
  })

  await t.test('should not timeout', async (t) => {
    const url = `${host}${URL.NOT_TIMEOUT}`
    const dataSpy = sandbox.spy()
    const errorSpy = sandbox.spy()

    // console.debug(`${new Date().toLocaleTimeString()} Start request ...`)
    const stream = await FileBox.fromUrl(url).toStream()

    stream.once('error', errorSpy).on('data', dataSpy)

    const start = Date.now()

    await sandbox.clock.tickAsync(1)
    t.ok(dataSpy.calledOnce, `should get chunk 1 (${Date.now() - start} passed)`)
    t.ok(errorSpy.notCalled, `should not get error (${Date.now() - start} passed)`)

    // FIXME: tickAsync does not work on socket timeout
    await setTimeout(HTTP_TIMEOUT)
    // await sandbox.clock.tickAsync(HTTP_TIMEOUT)

    t.ok(dataSpy.calledTwice, `should get chunk 2 after TIMEOUT ${HTTP_TIMEOUT} (${Date.now() - start} passed)`)
    t.ok(errorSpy.notCalled, `should not get error after TIMEOUT ${HTTP_TIMEOUT} (${Date.now() - start} passed)`)
  })

  await t.test('should timeout', async (t) => {
    const url = `${host}${URL.TIMEOUT}`
    const dataSpy = sandbox.spy()
    const errorSpy = sandbox.spy()

    // console.debug(`${new Date().toLocaleTimeString()} Start request ...`)
    const stream = await FileBox.fromUrl(url).toStream()

    stream.once('error', errorSpy).on('data', dataSpy)

    const start = Date.now()

    await sandbox.clock.tickAsync(1)
    t.ok(dataSpy.calledOnce, `should get chunk 1 (${Date.now() - start} passed)`)
    t.ok(errorSpy.notCalled, `should not get error (${Date.now() - start} passed)`)

    // FIXME: tickAsync does not work on socket timeout
    await setTimeout(HTTP_TIMEOUT)
    // await sandbox.clock.tickAsync(HTTP_TIMEOUT)

    t.ok(dataSpy.calledOnce, `should not get chunk 2 after TIMEOUT ${HTTP_TIMEOUT} (${Date.now() - start} passed)`)
    t.ok(errorSpy.calledOnce, `should get error after TIMEOUT ${HTTP_TIMEOUT} (${Date.now() - start} passed)`)
  })

  await t.test('ready should timeout', async (t) => {
    const url = `${host}${URL.TIMEOUT}`
    const errorSpy = sandbox.spy()

    // console.debug(`${new Date().toLocaleTimeString()} Start request ...`)
    const start = Date.now()
    const fileBox = FileBox.fromUrl(url)
    await fileBox.ready().catch(errorSpy)

    await sandbox.clock.tickAsync(1)
    t.ok(errorSpy.calledOnce, `should not get error (${Date.now() - start} passed)`)
  })

  sandbox.restore()
  server.close()
})
