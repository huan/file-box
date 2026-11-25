/**
 * Main module entry point for FileBox (Universal WinterTC root export).
 *
 * Exports universal FileBox class, FileBoxType, VERSION, and related types.
 * Fully compatible with browsers, edge runtimes, Node.js, and Deno with zero native OS dependencies.
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

export type {
  UuidSaver,
  UuidLoader,
  FileBoxInterface,
  FileBoxConstructor,
}
export {
  FileBox,
  FileBoxType,
  VERSION,
}
