/**
 * Type definitions and type guards for FileBox.
 *
 * This module defines options, interfaces, and enum-like types that identify
 * and configure different FileBox representations across environments.
 */
import type http from 'node:http'
import type {
  Readable,
  Writable,
} from 'node:stream'

import type {
  FileBox,
} from './file-box.ts'

interface Pipeable {
  pipe<T extends Writable>(destination: T, options?: { end?: boolean }): T
}

const FileBoxTypeValues = {
  Unknown: 0,
  Base64: 1,
  Url: 2,
  QRCode: 3,
  Buffer: 4,
  File: 5,
  Stream: 6,
  Uuid: 7,
} as const

type FileBoxType = typeof FileBoxTypeValues[keyof typeof FileBoxTypeValues]

/**
 * Huan(202002):
 * We need to keep this enum number to be consistent
 * because of toJSON & fromJSON need the same type number across versions.
 * and gRPC maybe will use those numbers in the future as well.
 */
const FileBoxType = {
  ...FileBoxTypeValues,
  0: 'Unknown',
  1: 'Base64',
  2: 'Url',
  3: 'QRCode',
  4: 'Buffer',
  5: 'File',
  6: 'Stream',
  7: 'Uuid',
} as const

interface Metadata {
  [key: string]: any
}

interface FileBoxOptionsCommon {
  name: string
  metadata?: Metadata
  size?: number
  md5?: string
}

interface FileBoxOptionsFile {
  type: typeof FileBoxType.File
  path: string
}
interface FileBoxOptionsUrl {
  type: typeof FileBoxType.Url
  url: string
  headers?: http.OutgoingHttpHeaders
}
interface FileBoxOptionsBuffer {
  type: typeof FileBoxType.Buffer
  buffer: Buffer
}
interface FileBoxOptionsStream {
  type: typeof FileBoxType.Stream
  stream: Readable
}
interface FileBoxOptionsQRCode {
  type: typeof FileBoxType.QRCode
  qrCode: string
}
interface FileBoxOptionsBase64 {
  type: typeof FileBoxType.Base64
  base64: string
}
interface FileBoxOptionsUuid {
  type: typeof FileBoxType.Uuid
  uuid: string
}

type FileBoxOptions = FileBoxOptionsCommon & (
  | FileBoxOptionsBase64
  | FileBoxOptionsBuffer
  | FileBoxOptionsFile
  | FileBoxOptionsQRCode
  | FileBoxOptionsStream
  | FileBoxOptionsUrl
  | FileBoxOptionsUuid
)

type FileBoxJsonObject = FileBoxOptionsCommon & (
  | FileBoxOptionsBase64
  | FileBoxOptionsUrl
  | FileBoxOptionsQRCode
  | FileBoxOptionsUuid
)

type UuidLoader = (this: FileBox, uuid: string) => Promise<Readable>
type UuidSaver = (this: FileBox, stream: Readable) => Promise<string>

export type {
  FileBoxJsonObject,
  FileBoxOptions,
  FileBoxOptionsBase64,
  FileBoxOptionsCommon,
  FileBoxOptionsQRCode,
  FileBoxOptionsUrl,
  FileBoxOptionsUuid,
  Metadata,
  Pipeable,
  UuidSaver,
  UuidLoader,
}
export {
  FileBoxType,
}
