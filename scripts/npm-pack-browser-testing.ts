/**
 * Verifies the packed tarball in a real Chromium page.
 *
 * Why it exists: the unit suite imports from `src/`, so only an installed package
 * proves that a browser bundler resolves `file-box` to the web build through the
 * published `exports` map. It owns the browser half of `npm-pack-testing.sh`.
 * Boundary: it needs the installed package directory as its only argument and
 * borrows esbuild and Playwright from this repository.
 */
import * as assert from 'node:assert/strict'

import { build } from 'esbuild'
import { chromium } from 'playwright'

const directory = process.argv[2]
assert.ok(directory, 'usage: npm-pack-browser-testing.ts <installed package directory>')

// esbuild with platform=browser activates the `browser` condition, as Vite,
// webpack, and Cloudflare Workers tooling do.
const bundle = await build({
  absWorkingDir: directory,
  stdin: {
    contents: `
      import * as root from 'file-box'
      import * as web from 'file-box/browser'
      window.api = { root, web }
    `,
    resolveDir: directory,
  },
  bundle: true,
  platform: 'browser',
  format: 'iife',
  write: false,
  logLevel: 'silent',
})
const code = bundle.outputFiles[0]?.text
assert.ok(code, 'esbuild produced no output')

const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  await page.goto('about:blank')
  await page.addScriptTag({ content: code })
  const result = await page.evaluate(async () => {
    const { root, web } = (window as any).api
    const bytes = new Uint8Array([1, 2, 3])
    const box = root.FileBox.fromBytes(bytes, 'pack.bin')
    const errors: Record<string, string> = {}
    try { await box.toFile('/tmp/x') } catch (e) { errors['toFile'] = String(e) }
    try { await box.toStream() } catch (e) { errors['toStream'] = String(e) }
    try { new root.UniformResourceNameRegistry() } catch (e) { errors['registry'] = String(e) }
    return {
      names: Object.keys(root).sort(),
      sameAsBrowserSubpath: root.FileBox === web.FileBox,
      roundTrip: Array.from(await box.toBytes()),
      version: root.VERSION,
      errors,
      nodeGlobals: ['process', 'Buffer'].filter(name => name in window),
    }
  })

  assert.deepEqual(result.names, ['FileBox', 'FileBoxType', 'UniformResourceNameRegistry', 'VERSION'])
  assert.ok(result.sameAsBrowserSubpath, 'the root should resolve to file-box/browser in a browser bundle')
  assert.deepEqual(result.roundTrip, [1, 2, 3])
  assert.notEqual(result.version, '0.0.0', 'the pack workflow should stamp the release version')
  assert.deepEqual(result.nodeGlobals, [], 'the web build must not need Node globals')
  for (const key of ['toFile', 'toStream', 'registry']) {
    assert.match(result.errors[key] ?? '', /not supported in the web build/, key)
  }
  console.log('Chromium: packed web build verified')
} finally {
  await browser.close()
}
