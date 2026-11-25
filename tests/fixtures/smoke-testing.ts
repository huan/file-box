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
    const { FileBox: NodeFileBox, UniformResourceNameRegistry } = await import('file-box/node')
    const { FileBox: BrowserFileBox } = await import('file-box/browser')

    // On Node the `node` export condition makes the root the node build.
    assert.strictEqual(FileBox, NodeFileBox, 'root should resolve to the node build on Node.js')
    assert.notStrictEqual(BrowserFileBox, NodeFileBox, 'file-box/browser should stay the web build')

    const nodeBox = NodeFileBox.fromBuffer(payload, 'node.txt')
    assert.ok(nodeBox instanceof FileBox)
    assert.ok(nodeBox instanceof NodeFileBox)
    assert.ok(typeof UniformResourceNameRegistry === 'function')

    const browserBox = BrowserFileBox.fromBytes(new Uint8Array(payload), 'browser.txt')
    assert.ok(browserBox instanceof BrowserFileBox)
    // The node class is strict about instanceof so a web box is never mistaken
    // for one that can use the filesystem; the interface check and fromBox()
    // are the supported ways to accept boxes made by the other build.
    assert.ok(!(browserBox instanceof FileBox), 'a web box is not an instance of the node class')
    assert.ok(FileBox.validInterface(browserBox), 'a web box still satisfies the FileBox interface')
    assert.strictEqual(browserBox.name, 'browser.txt')

    const promotedBox = NodeFileBox.fromBox(browserBox)
    assert.ok(promotedBox instanceof NodeFileBox)
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
