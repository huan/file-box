import * as http      from 'http'
import {
  // Stream,
  Readable,
}                     from 'stream'

export interface Pipeable {
  pipe: typeof Readable.prototype.pipe,
}

export enum FileBoxType {
  Unknown = 0,
  Buffer,
  Local,
  Remote,
  Stream,
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

export interface FileBoxOptionsLocal {
  type : FileBoxType.Local
  url  : string
}
export interface FileBoxOptionsRemote {
  type     : FileBoxType.Remote
  url      : string
  headers? : http.OutgoingHttpHeaders
}
export interface FileBoxOptionsBuffer {
  type   : FileBoxType.Buffer
  buffer : Buffer
}
export interface FileBoxOptionsStream {
  type    : FileBoxType.Stream
  stream? : NodeJS.ReadableStream
}

export type FileBoxOptions = FileBoxOptionsBase & (
    FileBoxOptionsLocal
  | FileBoxOptionsRemote
  | FileBoxOptionsBuffer
  | FileBoxOptionsStream
)

// export interface RemoteOptions {
//   url      : string,
//   name?    : string,
//   headers? : { [idx: string]: string },
// }

// export interface LocalOptions {
//   path  : string,
//   name? : string,
// }

// export interface StreamOptions {
//   stream : NodeJS.ReadableStream,
//   name   : string,
// }

// export interface BufferOptions {
//   buffer : Buffer,
//   name   : string,
// }
