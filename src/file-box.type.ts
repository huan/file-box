/**
 * Type definitions and type guards for FileBox.
 *
 * This module defines options, interfaces, and enum-like types that identify
 * and configure different FileBox representations across environments.
 * Standardized on WinterTC and standard Web APIs with zero native OS dependencies.
 */
import type { FileBox } from './file-box.ts'

interface Pipeable {
  pipeTo?(destination: WritableStream<Uint8Array>, options?: StreamPipeOptions): Promise<void>
  pipe?<T>(destination: T, options?: { end?: boolean }): T
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
 * Numeric enum-like type discriminator for FileBox instances and serialized payloads.
 * Must remain numerically stable across all versions for cross-process compatibility.
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
  path?: string
  blob?: Blob
}

interface FileBoxOptionsUrl {
  type: FileBoxType.Url
  url: string
  headers?: any
}

interface FileBoxOptionsBuffer {
  type: FileBoxType.Buffer
  buffer: Uint8Array
}

interface FileBoxOptionsStream {
  type: FileBoxType.Stream
  stream: ReadableStream<Uint8Array> | (() => ReadableStream<Uint8Array>) | any
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

type UuidLoader = (this: FileBox, uuid: string) => Promise<ReadableStream<Uint8Array> | any>
type UuidSaver = (this: FileBox, stream: ReadableStream<Uint8Array> | any) => Promise<string>

export type {
  FileBoxJsonObject,
  FileBoxOptions,
  FileBoxOptionsBase64,
  FileBoxOptionsBuffer,
  FileBoxOptionsCommon,
  FileBoxOptionsFile,
  FileBoxOptionsQRCode,
  FileBoxOptionsStream,
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
