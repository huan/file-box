import {
  Stream,
}                     from 'stream'

export interface Pipeable {
  pipe: typeof Stream.prototype.pipe,
}

export enum FileBoxType {
  Unknown = 0,
  Buffer,
  Local,
  Remote,
  Stream,
}

export interface FileBoxOptions {
    /**
     * File base name: name + ext
     *  like: "file.txt"
     */
    name: string

    /**
     * URI to the file
     * See:
     *  https://nodejs.org/api/fs.html#fs_url_object_support
     *  https://danielmiessler.com/study/url-uri/
     */
    url?      : string
    metadata? : { [idx: string]: string }
    buffer?   : Buffer
    stream?   : NodeJS.ReadableStream

    /**
     * FileType: LOCAL, REMOTE, BUFFER, STREAM
     */
    type: FileBoxType
}
