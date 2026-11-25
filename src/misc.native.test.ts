/** Runs the native HTTP and stream helpers against isolated loopback servers. */
import * as assert from 'node:assert/strict'
import { createServer, type RequestListener } from 'node:http'
import { test, type TestContext } from 'node:test'

import { httpHeadHeader, httpStream, streamToBuffer } from './misc.ts'

/** Binds an ephemeral loopback port and closes it when the test finishes. */
async function serve (t: TestContext, handler: RequestListener): Promise<string> {
  const server = createServer(handler)
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve())
  }))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  return `http://127.0.0.1:${address.port}`
}

test('httpHeadHeader follows a redirect with a HEAD request', async t => {
  const requests: Array<string | undefined> = []
  const url = await serve(t, (request, response) => {
    requests.push(request.method)
    if (request.url === '/start') {
      response.writeHead(302, { location: `${url}/download` }).end()
      return
    }
    response.writeHead(200, { 'content-disposition': 'attachment; filename=file-box.tar.gz' }).end()
  })

  const headers = await httpHeadHeader(`${url}/start`)
  assert.equal(headers['content-disposition'], 'attachment; filename=file-box.tar.gz')
  assert.deepEqual(requests, ['HEAD', 'HEAD'])
})

test('httpStream forwards headers and reads the response bytes', async t => {
  const url = await serve(t, (request, response) => {
    response.end(request.headers['x-file-box-test'])
  })

  const stream = await httpStream(url, { 'x-file-box-test': '42' })
  const bytes = await streamToBuffer(stream)
  assert.equal(bytes.toString(), '42')
})

test('httpStream normalizes credentials in URL and sends authorization header', async t => {
  let authHeader: string | undefined
  const url = await serve(t, (request, response) => {
    authHeader = request.headers.authorization
    response.end('authenticated')
  })

  const authUrl = url.replace('http://', 'http://user:pass@')
  const stream = await httpStream(authUrl)
  const bytes = await streamToBuffer(stream)
  assert.equal(bytes.toString(), 'authenticated')
  assert.equal(authHeader, `Basic ${btoa('user:pass')}`)
})
