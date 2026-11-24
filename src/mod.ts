/**
 * Main module entry point for FileBox.
 *
 * Exports FileBox class, FileBoxType, UniformResourceNameRegistry, and related types.
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
import type {
  FileBoxInterface,
  FileBoxConstructor,
} from './interface.ts'
import type {
  UuidSaver,
  UuidLoader,
} from './file-box.type.ts'
import {
  UniformResourceNameRegistry,
} from './urn-registry/uniform-resource-name-registry.ts'

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
