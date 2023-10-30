#!/usr/bin/env -S node --no-warnings --loader ts-node/esm

import { createServer } from 'http'
import type { AddressInfo } from 'net'
import { setTimeout } from 'timers/promises'
import { sinon, test } from 'tstest'

import { HTTP_REQUEST_TIMEOUT, HTTP_RESPONSE_TIMEOUT } from '../src/config.js'
import { FileBox } from '../src/mod.js'

test('slow network stall HTTP_TIMEOUT', async (t) => {
  const sandbox = sinon.createSandbox()
  sandbox.useFakeTimers({
    now: Date.now(),
    shouldAdvanceTime: true,
    shouldClearNativeTimers: true,
    toFake: [ 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'nextTick' ],
  })
  t.jobs = 3
  const port = Math.floor(Math.random() * (65535 - 49152 + 1)) + 49152
  const URL = {
    NOT_TIMEOUT: '/not_timeout',
    READY: '/ready',
    TIMEOUT: '/timeout',
  }

  /* eslint @typescript-eslint/no-misused-promises:off */
  const server = createServer(async (req, res) => {
    res.write(Buffer.from('This is the first chunk of data.'))

    if (req.url === URL.NOT_TIMEOUT) {
      await setTimeout(HTTP_REQUEST_TIMEOUT * 0.5)
      res.write(Buffer.from('This is the second chunk of data.'))
    } else if (req.url === URL.READY) {
      await setTimeout(HTTP_REQUEST_TIMEOUT + 100)
    } else if (req.url === URL.TIMEOUT) {
      if (req.method === 'GET') {
        await setTimeout(HTTP_RESPONSE_TIMEOUT + 100)
      }
    }

    // console.debug(`${new Date().toLocaleTimeString()} call res.end "${req.url}"`)
    res.end(Buffer.from('All data end.'))
  })

  const host = await new Promise<string>((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo
      // console.debug(`Server is listening on port ${JSON.stringify(addr)}`)
      resolve(`http://127.0.0.1:${addr.port}`)
    })
  })

  t.teardown(() => {
    // console.debug('teardown')
    server.close()
    sandbox.restore()
  })

  /** eslint @typescript-eslint/no-floating-promises:off */
  t.test('should not timeout', async (t) => {
    const url = `${host}${URL.NOT_TIMEOUT}`
    const dataSpy = sandbox.spy()
    const errorSpy = sandbox.spy()

    // console.debug(`${new Date().toLocaleTimeString()} Start request "${url}" ...`)
    const start = Date.now()
    const stream = await FileBox.fromUrl(url).toStream()

    stream.once('error', errorSpy).on('data', dataSpy)

    await sandbox.clock.tickAsync(1)
    t.ok(dataSpy.calledOnce, `should get chunk 1 (${Date.now() - start} passed)`)
    t.ok(errorSpy.notCalled, `should not get error (${Date.now() - start} passed)`)

    // FIXME: tickAsync does not work on socket timeout
    await new Promise<void>((resolve) => {
      stream.once('error', resolve).on('close', resolve)
      // resolve(setTimeout(HTTP_REQUEST_TIMEOUT))
    })
    await sandbox.clock.tickAsync(1)
    // await sandbox.clock.tickAsync(HTTP_RESPONSE_TIMEOUT)

    t.comment('recv data count:', dataSpy.callCount)
    t.comment('recv error count:', errorSpy.callCount)
    t.ok(dataSpy.calledThrice, `should get chunk 3 after TIMEOUT ${HTTP_REQUEST_TIMEOUT} (${Date.now() - start} passed)`)
    t.ok(errorSpy.notCalled, `should not get error after TIMEOUT ${HTTP_REQUEST_TIMEOUT} (${Date.now() - start} passed)`)
    t.end()
  }).catch(t.threw)

  /** eslint @typescript-eslint/no-floating-promises:off */
  t.test('should timeout', async (t) => {
    const url = `${host}${URL.TIMEOUT}`
    const dataSpy = sandbox.spy()
    const errorSpy = sandbox.spy()

    // console.debug(`${new Date().toLocaleTimeString()} Start request "${url}" ...`)
    const start = Date.now()
    const stream = await FileBox.fromUrl(url).toStream()

    stream.once('error', errorSpy).once('data', dataSpy)
    // .on('error', (e) => {
    //   console.error(`on error for req "${url}":`, e.stack)
    // })
    // .on('data', (d: Buffer) => {
    //   console.error(`on data for req "${url}":`, d.toString())
    // })

    await sandbox.clock.tickAsync(1)

    // t.comment('recv data count:', dataSpy.callCount)
    // t.comment('recv error count:', errorSpy.callCount)
    t.ok(dataSpy.calledOnce, `should get chunk 1 (${Date.now() - start} passed)`)
    t.ok(errorSpy.notCalled, `should not get error (${Date.now() - start} passed)`)

    // FIXME: tickAsync does not work on socket timeout
    await new Promise<void>((resolve) => {
      stream.once('error', resolve).on('close', resolve)
      // resolve(setTimeout(HTTP_RESPONSE_TIMEOUT))
    })
    await sandbox.clock.tickAsync(1)
    // await sandbox.clock.tickAsync(HTTP_RESPONSE_TIMEOUT)

    // t.comment('recv data count:', dataSpy.callCount)
    // t.comment('recv error count:', errorSpy.callCount)
    t.ok(errorSpy.calledOnce, `should get error after TIMEOUT ${HTTP_RESPONSE_TIMEOUT} (${Date.now() - start} passed)`)
    t.end()
  }).catch(t.threw)

  /** eslint @typescript-eslint/no-floating-promises:off */
  t.test('ready should timeout', async (t) => {
    const url = `${host}${URL.READY}`
    const errorSpy = sandbox.spy()

    // console.debug(`${new Date().toLocaleTimeString()} Start request "${url}" ...`)
    const start = Date.now()
    const fileBox = FileBox.fromUrl(url)
    await fileBox.ready().catch(errorSpy)

    await sandbox.clock.tickAsync(1)
    // t.comment('recv error count:', errorSpy.callCount)
    t.ok(errorSpy.calledOnce, `should get error after TIMEOUT ${HTTP_REQUEST_TIMEOUT} (${Date.now() - start} passed)`)
    t.end()
  }).catch(t.threw)
})
