import http      from 'http'
import {
  Readable,
}                from 'stream'

export interface Pipeable {
  pipe: typeof Readable.prototype.pipe,
}

/**
 * Huan(202002):
 *  We need to keep this enum number to be consistent
 *  because of toJSON & fromJSON need the same type number across versoins.
 */
export enum FileBoxType {
  Unknown = 0,

  /**
   * Serializable by toJSON()
   */
  Base64  = 1,
  Url     = 2,
  QRCode  = 3,

  /**
   * Not serializable by toJSON()
   * Need to convert to FileBoxType.Base64 before call toJSON()
   */
  Buffer  = 4,
  File    = 5,
  Stream  = 6,
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
interface FileBoxOptionsCommon {
    /**
     * File base name: name + ext
     *  like: "file.txt"
     */
    name: string
}

interface FileBoxOptionsFile {
  type : FileBoxType.File
  path : string
}
interface FileBoxOptionsUrl {
  type     : FileBoxType.Url
  url      : string
  headers? : http.OutgoingHttpHeaders
}
interface FileBoxOptionsBuffer {
  type   : FileBoxType.Buffer
  buffer : Buffer
}
interface FileBoxOptionsStream {
  type   : FileBoxType.Stream
  stream : NodeJS.ReadableStream
}
interface FileBoxOptionsQRCode {
  type   : FileBoxType.QRCode,
  qrCode : string,
}
interface FileBoxOptionsBase64 {
  type   : FileBoxType.Base64,
  base64 : string,
}

export type FileBoxOptions = FileBoxOptionsCommon & (
    FileBoxOptionsBuffer
  | FileBoxOptionsFile
  | FileBoxOptionsStream
  | FileBoxOptionsUrl
  | FileBoxOptionsQRCode
  | FileBoxOptionsBase64
)

export interface FileBoxJsonObjectCommon {
  name     : string,
  metadata : Metadata,
}

export interface FileBoxJsonObjectBase64 {
  boxType : FileBoxType.Base64,
  base64  : string,
}

export interface FileBoxJsonObjectUrl {
  boxType   : FileBoxType.Url,
  remoteUrl : string,
  headers?  : http.OutgoingHttpHeaders
}

export interface FileBoxJsonObjectQRCode {
  boxType : FileBoxType.QRCode,
  qrCode : string,
}

export type FileBoxJsonObject =  FileBoxJsonObjectCommon
                              & (
                                    FileBoxJsonObjectBase64
                                  | FileBoxJsonObjectUrl
                                  | FileBoxJsonObjectQRCode
                                )

export interface Metadata {
  [key: string]: any,
}
