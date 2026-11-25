/**
 * Server module entry point for FileBox (file-box/server).
 *
 * Exports native-extended FileBox subclass, UniformResourceNameRegistry, FileBoxType, and VERSION.
 */
import { FileBox } from './file-box-server.ts'
import { FileBoxType } from '../file-box.type.ts'
import { UniformResourceNameRegistry } from '../urn-registry/uniform-resource-name-registry.ts'
import { VERSION } from '../config.ts'

export {
  FileBox,
  FileBoxType,
  UniformResourceNameRegistry,
  VERSION,
}
