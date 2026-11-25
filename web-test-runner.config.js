/** Runs shared FileBox units in Chromium with Wechaty's test API adapters. */
import { esbuildPlugin } from '@web/dev-server-esbuild'
import { playwrightLauncher } from '@web/test-runner-playwright'

export default {
  files: [
    'tests/browser-shims/shims.test.ts',
    'src/**/*.test.ts',
    '!src/**/*.native.test.ts',
  ],
  nodeResolve: {
    exportConditions: ['browser', 'development'],
  },
  plugins: [
    {
      name: 'browser-test-adapters',
      resolveImport ({ source }) {
        if (source === 'node:test') {
          return '/tests/browser-shims/node-test.ts'
        }
        if (source === 'node:assert/strict' || source === 'node:assert') {
          return '/tests/browser-shims/assert.ts'
        }
        return undefined
      },
    },
    esbuildPlugin({ target: 'es2022', ts: true }),
  ],
  browsers: [playwrightLauncher({ product: 'chromium' })],
  testFramework: {
    config: { timeout: 15000, ui: 'bdd' },
  },
}
