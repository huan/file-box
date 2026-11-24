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

type FileBoxType = typeof FileBoxTypeValues[keyof typeof FileBoxTypeValues]

/**
 * Type-only member aliases. The numeric const above has no runtime enum,
 * and these names keep `FileBoxType.QRCode` usable in type position.
 */
declare namespace FileBoxType {
  type Unknown = typeof FileBoxTypeValues.Unknown
  type Base64 = typeof FileBoxTypeValues.Base64
  type Url = typeof FileBoxTypeValues.Url
  type QRCode = typeof FileBoxTypeValues.QRCode
  type Buffer = typeof FileBoxTypeValues.Buffer
  type File = typeof FileBoxTypeValues.File
  type Stream = typeof FileBoxTypeValues.Stream
  type Uuid = typeof FileBoxTypeValues.Uuid
}

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
  type: FileBoxType.File
  path: string
}
interface FileBoxOptionsUrl {
  type: FileBoxType.Url
  url: string
  headers?: http.OutgoingHttpHeaders
}
interface FileBoxOptionsBuffer {
  type: FileBoxType.Buffer
  buffer: Buffer
}
interface FileBoxOptionsStream {
  type: FileBoxType.Stream
  stream: Readable
}
interface FileBoxOptionsQRCode {
  type: FileBoxType.QRCode
  qrCode: string
}
interface FileBoxOptionsBase64 {
  type: FileBoxType.Base64
  base64: string
}
interface FileBoxOptionsUuid {
  type: FileBoxType.Uuid
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
