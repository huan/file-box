/**
 * Comprehensive verification suite for browser testing shims.
 *
 * Exercises the browser test adapters shared with Wechaty.
 * Source: https://github.com/wechaty/wechaty/tree/4f361b1/tests/browser-shims
 */
import { test, mock } from 'node:test'
import {
  deepEqual,
  deepStrictEqual,
  doesNotReject,
  doesNotThrow,
  equal,
  notDeepStrictEqual,
  notEqual,
  notStrictEqual,
  ok,
  rejects,
  strictEqual,
  throws,
} from 'node:assert/strict'

test('Chromium runs without injected Node globals', () => {
  equal(typeof globalThis.Buffer, 'undefined')
  equal(typeof globalThis.process, 'undefined')
  equal(typeof globalThis.global, 'undefined')
})

test('assert shim equality operations enforce strict semantics', () => {
  ok(true, 'truthy assertion')
  strictEqual(42, 42)
  equal('hello', 'hello')
  notStrictEqual(1, 2)
  notEqual('a', 'b')
  deepStrictEqual({ a: 1, b: [2] }, { a: 1, b: [2] })
  deepEqual({ a: 1 }, { a: 1 })
  notDeepStrictEqual({ a: 1 }, { a: 2 })
})

test('assert shim throws and doesNotThrow support expected patterns', () => {
  throws(() => {
    throw new Error('boom error')
  }, /boom/)

  throws(() => {
    const err = new Error('custom')
    ;(err as any).code = 'ERR_CUSTOM'
    throw err
  }, { code: 'ERR_CUSTOM' })

  throws(() => {
    throw new TypeError('type error')
  }, TypeError)

  doesNotThrow(() => 1 + 1)
})

test('assert shim rejects and doesNotReject handle async operations', async () => {
  await rejects(async () => {
    throw new Error('async error')
  }, /async error/)

  await rejects(
    Promise.reject(new Error('promise error')),
    /promise error/,
  )

  await doesNotReject(async () => 'success')
  await doesNotReject(Promise.resolve('success'))
})

test('mock.fn records invocations and arguments conforming to node:test', () => {
  const spy = mock.fn((a: number, b: number) => a + b)
  const result = spy(10, 20)

  strictEqual(result, 30)
  strictEqual(spy.mock.callCount(), 1)
  strictEqual(spy.mock.calls.length, 1)
  deepStrictEqual(spy.mock.calls[0]?.arguments, [10, 20])
  strictEqual(spy.mock.calls[0]?.result, 30)
})

test('mock.method spies on and restores object properties', () => {
  const target = {
    compute (val: number) {
      return val * 2
    },
  }

  const mockedMethod = mock.method(target, 'compute', (val: number) => val * 10)
  strictEqual(target.compute(3), 30)
  strictEqual(mockedMethod.mock.calls.length, 1)
  deepStrictEqual(mockedMethod.mock.calls[0]?.arguments, [3])

  mockedMethod.mock.restore()
  strictEqual(target.compute(3), 6)
})

test('TestContext provides scoped mocks and runs after hooks', async t => {
  let afterHookCalls = 0
  await t.test('scoped mock and cleanup', child => {
    child.after(() => { afterHookCalls++ })
    ok(typeof child.mock?.fn === 'function', 'mock is available on the subtest context')
    const fn = child.mock.fn(() => 'ok')
    strictEqual(fn(), 'ok')
    strictEqual(fn.mock.callCount(), 1)
  })
  strictEqual(afterHookCalls, 1)
})

test('test() accepts options in test(name, options, fn) signature', { timeout: 15000 }, (t) => {
  ok(t, 'options overload accepted')
})

test('TestContext before hook executes once before sibling subtests', async (t) => {
  let beforeHookCalls = 0
  t.before(async () => {
    await Promise.resolve()
    beforeHookCalls++
  })

  await t.test('first child', () => {
    strictEqual(beforeHookCalls, 1)
  })
  await t.test('second child', () => {
    strictEqual(beforeHookCalls, 1)
  })
  strictEqual(beforeHookCalls, 1)
})

test('unsupported mock timer operations fail explicitly', () => {
  throws(() => mock.timers.enable(), /mock\.timers is not supported/)
  throws(() => mock.timers.tick(1), /mock\.timers is not supported/)
  throws(() => mock.timers.reset(), /mock\.timers is not supported/)
})

test('subtest skip does not abort sibling subtests in the parent', async (t) => {
  let siblingExecuted = false

  await t.test('first child skips', (subT) => {
    subT.skip('skipping first child')
  })

  await t.test('second child runs', () => {
    siblingExecuted = true
  })

  ok(siblingExecuted, 'sibling subtest executed successfully despite first child skip')
})

test('t.mock.method isolates and restores mocked methods after execution', async (t) => {
  const service = {
    getValue () {
      return 'original'
    },
  }

  await t.test('subtest modifies service', (subT) => {
    subT.mock.method(service, 'getValue', () => 'mocked')
    strictEqual(service.getValue(), 'mocked')
  })

  // After subtest completes, subtest-scoped mock is restored
  strictEqual(service.getValue(), 'original', 'scoped mock was restored after subtest')
})

test('mock.fn restores original implementation when restore is called', () => {
  const original = (val: number) => val * 2
  const spy = mock.fn(original)
  strictEqual(spy(5), 10)

  spy.mock.mockImplementation((val: number) => val * 10)
  strictEqual(spy(5), 50)

  spy.mock.restore()
  strictEqual(spy(5), 10)
})

test('t.mock.fn isolates and restores mocked functions after execution', async (t) => {
  let fnInstance: any
  await t.test('subtest overrides mock.fn implementation', (subT) => {
    fnInstance = subT.mock.fn(() => 'initial')
    strictEqual(fnInstance(), 'initial')
    fnInstance.mock.mockImplementation(() => 'overridden')
    strictEqual(fnInstance(), 'overridden')
  })
  strictEqual(fnInstance(), 'initial', 'scoped mock.fn was restored upon teardown')
})

test('test() skips execution when options.todo is true without failing', { todo: true }, () => {
  throw new Error('This todo test failure should not fail the suite')
})

test('test() skips execution when options.todo is a description string', { todo: 'unimplemented feature' }, () => {
  throw new Error('This todo test failure should not fail the suite')
})

test('TestContext subtest skips execution when options.todo is true', async (t) => {
  let executed = false
  await t.test('subtest with todo', { todo: true }, () => {
    executed = true
    throw new Error('should not execute or fail')
  })
  strictEqual(executed, false, 'subtest was skipped because todo was set')
})
