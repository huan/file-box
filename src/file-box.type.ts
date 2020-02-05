import http      from 'http'
import {
  // Stream,
  Readable,
}                from 'stream'

export interface Pipeable {
  pipe: typeof Readable.prototype.pipe,
}

export enum FileBoxType {
  Unknown = 0,
  Buffer,
  File,
  Stream,
  Url,
  QRCode,
}

/**
 * URI to the file
 * See:
 *  https://nodejs.org/api/fs.html#fs_url_object_support
 *  https://danielmiessler.com/study/url-uri/
 *
 * FileType: LOCAL, REMOTE, BUFFER, STREAM
 *
 */
export interface FileBoxOptionsBase {
    /**
     * File base name: name + ext
     *  like: "file.txt"
     */
    name: string
}

export interface FileBoxOptionsFile {
  type : FileBoxType.File
  path : string
}
export interface FileBoxOptionsUrl {
  type     : FileBoxType.Url
  url      : string
  headers? : http.OutgoingHttpHeaders
}
export interface FileBoxOptionsBuffer {
  type   : FileBoxType.Buffer
  buffer : Buffer
}
export interface FileBoxOptionsStream {
  type   : FileBoxType.Stream
  stream : NodeJS.ReadableStream
}
export interface FileBoxOptionsQRCode {
  type: FileBoxType.QRCode,
  qrCode: string,
}

export type FileBoxOptions = FileBoxOptionsBase & (
    FileBoxOptionsBuffer
  | FileBoxOptionsFile
  | FileBoxOptionsStream
  | FileBoxOptionsUrl
  | FileBoxOptionsQRCode
)
