/**
 *
 * File Box
 * https://github.com/zixia/node-file-box
 *
 * 2018 Huan LI <zixia@zixia.net>
 *
 */
import * as fs        from 'fs'
import * as nodePath  from 'path'
// import * as nodeUrl   from 'url'

import * as fetch     from 'isomorphic-fetch'

import {
  PassThrough,
  // Readable,
  Stream,
}                     from 'stream'

import {
  VERSION,
}             from './config'

export interface Pipeable {
  pipe: typeof Stream.prototype.pipe,
}

export enum FileBoxType {
  UNKNOWN = 0,
  BUFFER,
  LOCAL,
  REMOTE,
  STREAM,
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
    metadata? : Object  // FIXME
    buffer?   : Buffer
    stream?   : NodeJS.ReadableStream

    /**
     * FileType: LOCAL, REMOTE, BUFFER, STREAM
     */
    type: FileBoxType
}

export class FileBox implements Pipeable {

  /**
   *
   * Static Properties
   *
   */
  public static async fromRemote(
    url:    string,
    name?:  string,
    metadata?:  Object,
  ): Promise<FileBox> {
    const type = FileBoxType.REMOTE

    if (!name) {
      name = await this.fetchRemoteFilename(url)
    }

    const options: FileBoxOptions = {
      type,

      name,
      url,
      metadata,
    }

    const box = new FileBox(options)

    return box
  }

  private static async fetchRemoteFilename(
    url: string,
  ): Promise<string> {
    /**
     * https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition
     *  > Content-Disposition: attachment; filename="cool.html"
     */

    // const headers = new Headers({
    //   // a: 'b',
    // })

    const request = new Request(url, {
      method: 'HEAD',
      // headers,
      mode: 'cors',
      redirect: 'follow',
    })

    const name = await fetch(request)
      .then(resp => resp.headers.get('Content-Disposition'))
      .then(value => value!.match(/attachment; filename="(.+)"/))
      .then(matches => matches![1])

    // TODO: check the ext for name, if not exist, use MimeType to set one.

    return name
  }

  public static fromLocal(
    path:   string,
    name?:  string,
  ): FileBox {
    const type = FileBoxType.LOCAL

    if (!name) {
      name = nodePath.parse(path).base
    }

    const options: FileBoxOptions = {
      type,
      name,
      url: path,
    }

    const box = new this(options)
    return box
  }

  public static fromStream(
    stream: NodeJS.ReadableStream,
    name:   string,
  ): FileBox {
    const type = FileBoxType.STREAM

    const options: FileBoxOptions = {
      type,

      stream,
      name,
    }

    const box = new FileBox(options)

    return box
  }

  public static fromBuffer(
    buffer: Buffer,
    name:   string,
  ): FileBox {
    const type = FileBoxType.BUFFER

    const options: FileBoxOptions = {
      type,
      name,
      buffer,
    }

    const box = new FileBox(options)

    return box
  }

  public static version() {
    return VERSION
  }

  /**
   *
   *
   * Instance Properties
   *
   *
   */
  public readonly lastModified: number
  public readonly name        : string
  public readonly size        : number
  public readonly type        : FileBoxType


  /**
   * Lazy load data:
   *  Do not read file to Buffer until there's a consumer.
   */
  private readonly buffer?: Buffer
  private readonly url        : string
  private readonly stream?: NodeJS.ReadableStream

  private readonly metadata?: { [idx: string]: string }

  constructor(
    options: FileBoxOptions,
  ) {

    this.name = options.name
    // Contents = stream, buffer, or null if not read
    this.contents = options.contents || null

  }

  public version() {
    return VERSION
  }

  public toJSON(): string {
    return ''
  }

  public pipe<T extends NodeJS.WritableStream>(
    destination: T,
  ): T {
    switch (this.type) {
      case FileBoxType.BUFFER:
        this.pipeBuffer(destination)
        break

      case FileBoxType.LOCAL:
        this.pipeLocal(destination)
        break

      case FileBoxType.REMOTE:
        this.pipeRemote(destination)
        break

      case FileBoxType.STREAM:
        this.pipeStream(destination)
        break

      default:
        throw new Error('not supported FileBoxType: ' + FileBoxType[this.type])
    }

    return destination
  }

  /**
   * https://stackoverflow.com/a/16044400/1123955
   */
  private pipeBuffer(
    destination: NodeJS.WritableStream
  ): void {
    const buffer = this.buffer

    const bufferStream = new PassThrough()
    bufferStream.pipe(destination)
    bufferStream.end(buffer)
  }

  private pipeLocal(
    destination: NodeJS.WritableStream,
  ): void {
    const path = this.url

    const readStream = fs.createReadStream(path)
    readStream.pipe(destination)
  }

  private pipeRemote(
    destination: NodeJS.WritableStream,
  ): void {
    const url = this.url
    // const metadata = this.metadata

    const headers = new Headers({
      a: 'b',
    })

    const request = new Request(url, {
      headers,
      mode: 'cors',
      redirect: 'follow',
    })

    fetch(request).then(response => {
      // https://groups.google.com/a/chromium.org/forum/#!topic/blink-dev/0EW0_vT_MOU
      (response.body as any).pipeThrough(destination)
    })
  }

  private pipeStream(
    destination: NodeJS.WritableStream,
  ): void {
    if (!this.stream) {
      throw new Error('no stream!')
    }
    this.stream.pipe(destination)
  }

}

export default FileBox
