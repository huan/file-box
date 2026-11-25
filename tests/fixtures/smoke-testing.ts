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
