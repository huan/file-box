/**
 * Node entry for FileBox: served for the `node` export condition (Node.js, Deno,
 * Bun), and as `file-box/node`.
 *
 * Exports exactly the same names as `../mod.ts`; here the native methods and the
 * URN registry really work. `src/entry-parity.native.test.ts` guards the match.
 */
import { FileBox } from './file-box-node.ts'
import { FileBoxType } from '../file-box.type.ts'
import { UniformResourceNameRegistry } from './uniform-resource-name-registry.ts'
import { VERSION } from '../config.ts'
import type {
  UuidSaver,
  UuidLoader,
} from '../file-box.type.ts'
import type {
  FileBoxInterface,
  FileBoxConstructor,
} from '../interface.ts'

export type {
  UuidSaver,
  UuidLoader,
  FileBoxInterface,
  FileBoxConstructor,
}
export {
  FileBox,
  FileBoxType,
  UniformResourceNameRegistry,
  VERSION,
}
