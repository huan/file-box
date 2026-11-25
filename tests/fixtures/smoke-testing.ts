/** Exercises the packed native entry against a deterministic HTTP response. */
import * as assert from 'node:assert/strict'
import { createServer } from 'node:http'

import {
  FileBox,
  VERSION,
}             from 'file-box'

async function main () {
  const payload = Buffer.from('FileBox packed consumer fixture')
  const server = createServer((_request, response) => {
    response.setHeader('content-length', payload.length)
    response.setHeader('content-type', 'text/plain')
    response.end(payload)
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })

  try {
    const address = server.address()
    assert.ok(address && typeof address !== 'string')
    const box = FileBox.fromUrl(`http://127.0.0.1:${address.port}/fixture.txt`)
    await box.ready()
    assert.equal(box.size, payload.length)
    assert.deepEqual(await box.toBuffer(), payload)
    assert.notEqual(VERSION, '0.0.0', 'the pack workflow should stamp the release version')
    assert.equal(box.version, VERSION)

    // Verify subpath exports
    const { FileBox: ServerFileBox, UniformResourceNameRegistry } = await import('file-box/server')
    const { FileBox: BrowserFileBox } = await import('file-box/browser')

    const serverBox = ServerFileBox.fromBuffer(payload, 'server.txt')
    assert.ok(serverBox instanceof FileBox)
    assert.ok(serverBox instanceof ServerFileBox)
    assert.ok(typeof UniformResourceNameRegistry === 'function')

    const browserBox = BrowserFileBox.fromBytes(new Uint8Array(payload), 'browser.txt')
    assert.ok(browserBox instanceof FileBox)
    assert.strictEqual(browserBox.name, 'browser.txt')

    const promotedBox = ServerFileBox.fromBox(browserBox)
    assert.ok(promotedBox instanceof ServerFileBox)
    assert.strictEqual(promotedBox.name, 'browser.txt')

    console.log(`FileBox v${VERSION} smoke testing passed!`)
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve())
    })
  }
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
