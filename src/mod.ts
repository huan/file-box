/**
 * Web-platform entry for FileBox: served for the `browser` and `default` export
 * conditions, and as `file-box/browser`.
 *
 * Exports the same names as `./node/mod.ts` (FileBox, FileBoxType,
 * UniformResourceNameRegistry, VERSION, and types). Methods that need native OS
 * capabilities exist here too but throw an error naming the supported route.
 * It must not import `node:*`, native addons, or `process`.
 */
import {
  FileBoxType,
} from './file-box.type.ts'
import {
  VERSION,
} from './config.ts'
import {
  FileBox,
} from './file-box.ts'
import {
  UniformResourceNameRegistry,
} from './urn-registry/uniform-resource-name-registry.ts'
import type {
  FileBoxInterface,
  FileBoxConstructor,
} from './interface.ts'
import type {
  UuidSaver,
  UuidLoader,
} from './file-box.type.ts'

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
