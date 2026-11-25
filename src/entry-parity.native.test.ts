/**
 * Guards the one-API rule: the web entry (`./mod.ts`, served for `browser` and
 * `default`) and the node entry (`./node/mod.ts`, served for `node`) must export
 * the same names, and every exported class must have the same static and
 * prototype members. Only behavior may differ: an unsupported call throws
 * instead of being missing.
 *
 * It lives in a `.native.test.ts` file because the node entry imports `node:*`
 * and cannot load in Chromium. It compares shape only; behavior of each build is
 * covered by the shared unit suite and the native tests.
 */
import * as assert from 'node:assert/strict'
import { test } from 'node:test'

import * as web from './mod.ts'
import * as node from './node/mod.ts'

const IGNORED = new Set(['length', 'name', 'prototype', 'constructor'])

/**
 * Protected helpers that only the node implementation needs. They are runtime
 * members but not public API, so the web stand-in does not mirror them. Adding a
 * public method to a node class without mirroring it must fail this test, so a
 * name belongs here only when it is `protected` or `private` in the node class.
 */
const NODE_INTERNALS: Record<string, readonly string[]> = {
  UniformResourceNameRegistry: [
    'processExitMap',
    'purgeExpiredUuid',
    'addProcessExitListener',
    'uuidFileName',
    'addToExpiringTable',
    'purge',
  ],
}

/** Collects own and inherited member names up to, but excluding, Object/Function. */
function members (target: object): string[] {
  const names = new Set<string>()
  for (
    let proto: object | null = target;
    proto && proto !== Object.prototype && proto !== Function.prototype;
    proto = Object.getPrototypeOf(proto)
  ) {
    for (const key of Reflect.ownKeys(proto)) {
      if (typeof key === 'string' && !IGNORED.has(key)) {
        names.add(key)
      }
    }
  }
  return [...names].sort()
}

test('web and node entries export the same names', () => {
  assert.deepEqual(Object.keys(node).sort(), Object.keys(web).sort())
})

test('web and node entries export the same kind of value for each name', () => {
  for (const name of Object.keys(web) as Array<keyof typeof web>) {
    assert.equal(typeof node[name as keyof typeof node], typeof web[name], name)
  }
})

test('every exported class has the same static and prototype members', () => {
  for (const [name, value] of Object.entries(web)) {
    if (typeof value !== 'function') continue
    const other = (node as Record<string, unknown>)[name] as typeof value
    const internals = NODE_INTERNALS[name] ?? []
    const nodeMembers = [...members(other), ...members(other.prototype)]
    for (const internal of internals) {
      assert.ok(nodeMembers.includes(internal), `${name}.${internal} is listed as a node internal but no longer exists`)
    }
    const publicOnly = (names: string[]) => names.filter(n => !internals.includes(n))
    assert.deepEqual(publicOnly(members(other)), members(value), `${name} statics`)
    assert.deepEqual(
      publicOnly(members(other.prototype)),
      members(value.prototype),
      `${name} prototype`,
    )
  }
})
