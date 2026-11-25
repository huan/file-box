/**
 * Web-build stand-in for the node `UniformResourceNameRegistry`.
 *
 * Why it exists: the package exposes one API on every platform. The real
 * registry stores streams on the local filesystem (`src/node/`), which the web
 * build cannot do, so this class keeps the same name and public members and
 * throws a clear error on use. Callers that import `file-box` on Node.js, Deno,
 * or Bun get the real implementation through the `node` export condition.
 *
 * Boundary: it must not import `node:*`. Keep its public members in sync with
 * the node class; `src/entry-parity.native.test.ts` enforces that.
 */
import type { FileBox } from '../file-box.ts'

interface UniformResourceNameRegistryOptions {
  expireMilliseconds? : number,
  storeDir?           : string,
}

/** Throws the error shared by every member of the web-build registry. */
function unsupported (member: string): never {
  throw new Error(
    `UniformResourceNameRegistry${member} is not supported in the web build `
    + '(it keeps streams on the local filesystem). Run on Node.js, Deno, or Bun, '
    + 'where importing "file-box" supports it '
    + '(or import "file-box/node" explicitly).',
  )
}

class UniformResourceNameRegistry {

  constructor (_options: UniformResourceNameRegistryOptions = {}) {
    unsupported('')
  }

  getFileBox (): typeof FileBox {
    return unsupported('.getFileBox()')
  }

  init (): void {
    unsupported('.init()')
  }

  async resolve (_uuid: string): Promise<any> {
    return unsupported('.resolve()')
  }

  async load (_uuid: string): Promise<any> {
    return unsupported('.load()')
  }

  async register (_stream: any): Promise<string> {
    return unsupported('.register()')
  }

  async save (_stream: any): Promise<string> {
    return unsupported('.save()')
  }

  destroy (): void {
    unsupported('.destroy()')
  }

}

export { UniformResourceNameRegistry }
