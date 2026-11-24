/**
 * Browser adapter bridging `node:test` APIs to the in-page Mocha test harness
 * provided by `@web/test-runner`.
 *
 * This module allows unit tests written with standard `import { test } from 'node:test'`
 * to execute natively inside browser window contexts without test source modifications.
 */

import { Buffer } from 'buffer'

// Ensure environment globals expected by Node-targeted code exist in browser window
if (typeof (globalThis as any).global === 'undefined') {
  ;(globalThis as any).global = globalThis
}

if (typeof (globalThis as any).Buffer === 'undefined') {
  ;(globalThis as any).Buffer = Buffer
}

if (typeof (globalThis as any).setImmediate === 'undefined') {
  ;(globalThis as any).setImmediate = (fn: (...args: unknown[]) => void, ...args: unknown[]) =>
    setTimeout(fn, 0, ...args)
  ;(globalThis as any).clearImmediate = (id: number) => clearTimeout(id)
}

if (typeof (globalThis as any).process === 'undefined') {
  ;(globalThis as any).process = {
    env: { NODE_ENV: 'test' },
    nextTick: (cb: (...args: unknown[]) => void, ...args: unknown[]) => queueMicrotask(() => cb(...args)),
    stderr: { write: () => {} },
    stdout: { write: () => {} },
    version: 'v20.0.0',
  }
}

/**
 * Context passed to individual test executions and subtests.
 */
export interface TestContext {
  test: (name: string, fn: (t: TestContext) => Promise<void> | void) => Promise<void>
  after: (fn: () => Promise<void> | void) => void
  before: (fn: () => Promise<void> | void) => void
  diagnostic: (message: string) => void
  skip: (message?: string) => void
  todo: (message?: string) => void
}

/**
 * Creates an isolated subtest execution context.
 */
function createTestContext (): TestContext {
  const afterHooks: (() => Promise<void> | void)[] = []

  const context: TestContext = {
    after: (fn: () => Promise<void> | void) => {
      afterHooks.push(fn)
    },
    before: (_fn: () => Promise<void> | void) => {
      // Lifecycle hook for subtest initialization
    },
    diagnostic: (message: string) => {
      console.log(`[test:diagnostic] ${message}`)
    },
    skip: (message?: string) => {
      console.log(`[test:skip] ${message || ''}`)
    },
    test: async (_subName: string, subFn: (t: TestContext) => Promise<void> | void) => {
      const subContext = createTestContext()
      try {
        await subFn(subContext)
      } finally {
        const hooks = (subContext as any)._afterHooks || []
        for (const hook of hooks) {
          await hook()
        }
      }
    },
    todo: (message?: string) => {
      console.log(`[test:todo] ${message || ''}`)
    },
  }

  Object.defineProperty(context, '_afterHooks', {
    configurable: true,
    enumerable: false,
    value: afterHooks,
    writable: true,
  })

  return context
}

type TestFunction = (t: TestContext) => Promise<void> | void

/**
 * Defines a test case compatible with node:test.
 */
export function test (name: string, fn?: TestFunction): void {
  const runner = (globalThis as any).it || (globalThis as any).test
  if (!runner) {
    throw new Error('No in-browser test runner (it/test) found on globalThis')
  }

  if (!fn) {
    runner.skip(name)
    return
  }

  runner(name, async function (this: unknown) {
    const context = createTestContext()
    try {
      await fn(context)
    } finally {
      const hooks = (context as any)._afterHooks || []
      for (const hook of hooks) {
        await hook()
      }
    }
  })
}

/**
 * Marks a test case as skipped.
 */
test.skip = (name: string, _fn?: TestFunction): void => {
  const runner = (globalThis as any).it || (globalThis as any).test
  if (runner?.skip) {
    runner.skip(name, () => {})
  } else {
    console.log(`Skipped: ${name}`)
  }
}

/**
 * Marks a test case as the only one to run.
 */
test.only = (name: string, fn: TestFunction): void => {
  const runner = (globalThis as any).it || (globalThis as any).test
  if (runner?.only) {
    runner.only(name, async () => fn(createTestContext()))
  } else {
    test(name, fn)
  }
}

/**
 * Marks a test case as a todo item.
 */
test.todo = (name: string): void => {
  test.skip(`[TODO] ${name}`)
}

export const it = test
export const describe = (globalThis as any).describe || ((_name: string, fn: () => void) => fn())
export const before = (globalThis as any).before || (globalThis as any).beforeAll
export const after = (globalThis as any).after || (globalThis as any).afterAll
export const beforeEach = (globalThis as any).beforeEach
export const afterEach = (globalThis as any).afterEach

export default test
