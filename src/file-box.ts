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
  // Stream,
}                     from 'stream'

import {
  VERSION,
}             from './config'

import {
  FileBoxType,
  FileBoxOptions,
  Pipeable,
}                   from './file-box.type'

export class FileBox implements Pipeable {

  /**
   *
   * Static Properties
   *
   */
  public static packRemote(
    url       : string,
    name?     : string,
    metadata? : { [idx: string]: string },
  ): FileBox {
    const type = FileBoxType.Remote

    if (!name) {
      name = nodePath.parse(url).base
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

  public static packLocal(
    path:   string,
    name?:  string,
  ): FileBox {
    const type = FileBoxType.Local

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

  public static packStream(
    stream: NodeJS.ReadableStream,
    name:   string,
  ): FileBox {
    const type = FileBoxType.Stream

    const options: FileBoxOptions = {
      type,

      stream,
      name,
    }

    const box = new FileBox(options)

    return box
  }

  public static packBuffer(
    buffer: Buffer,
    name:   string,
  ): FileBox {
    const type = FileBoxType.Buffer

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
  // need be update from the remote url(possible)
  public name: string

  public readonly lastModified: number
  public readonly size        : number
  public readonly type        : FileBoxType

  /**
   * Lazy load data:
   *  Do not read file to Buffer until there's a consumer.
   */
  private readonly buffer?: Buffer
  private readonly url?   : string
  private readonly stream?: NodeJS.ReadableStream

  private readonly metadata?: { [idx: string]: string }

  constructor(
    options: FileBoxOptions,
  ) {

    this.name = options.name
    this.type = options.type

    switch (options.type) {
      case FileBoxType.Buffer:
        if (!options.buffer) {
          throw new Error('no buffer')
        }
        this.buffer = options.buffer
        break

      case FileBoxType.Local:
      case FileBoxType.Remote:
        if (!options.url) {
          throw new Error('no url(path)')
        }
        this.url = options.url

        if (options.metadata) {
          this.metadata = options.metadata
        }

        break

      case FileBoxType.Stream:
        if (!options.stream) {
          throw new Error('no stream')
        }
        this.stream = options.stream
        break

      default:
        throw new Error('unknown type: ' + FileBoxType[options.type])
    }

  }

  public version() {
    return VERSION
  }

  public toJSON(): string {
    throw new Error('WIP')
  }

  public async syncRemoteName(): Promise<void> {
    /**
     * https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition
     *  > Content-Disposition: attachment; filename="cool.html"
     */

    // const headers = new Headers({
    //   // a: 'b',
    // })
    if (this.type !== FileBoxType.Remote) {
      throw new Error('type is not Remote')
    }
    if (!this.url) {
      throw new Error('no url')
    }

    const request = new Request(this.url, {
      method: 'HEAD',
      // headers,
      mode: 'cors',
      redirect: 'follow',
    })

    const name = await fetch(request)
      .then(resp => resp.headers.get('Content-Disposition'))
      .then(value => value!.match(/attachment; filename="(.+)"/))
      .then(matches => matches![1] || undefined)

    // TODO: check the ext for name, if not exist, use MimeType to set one.

    if (!name) {
      throw new Error('get remote name fail')
    }

    this.name = name
  }

  public pipe<T extends NodeJS.WritableStream>(
    destination: T,
  ): T {
    switch (this.type) {
      case FileBoxType.Buffer:
        this.pipeBuffer(destination)
        break

      case FileBoxType.Local:
        this.pipeLocal(destination)
        break

      case FileBoxType.Remote:
        this.pipeRemote(destination)
        break

      case FileBoxType.Stream:
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
    destination: NodeJS.WritableStream,
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
    if (!path) {
      throw new Error('no url(path)')
    }
    const readStream = fs.createReadStream(path)
    readStream.pipe(destination)
  }

  private pipeRemote(
    destination: NodeJS.WritableStream,
  ): void {
    if (!this.url) {
      throw new Error('no url')
    }

    let headerOptions = {
      //
    }
    if (this.metadata) {
      headerOptions = {
        ...headerOptions,
        ...this.metadata,
      }
    }
    const headers = new Headers(headerOptions)

    const request = new Request(this.url, {
      headers,
      mode: 'cors',
      redirect: 'follow',
    })

    fetch(request).then(response => {
      // https://groups.google.com/a/chromium.org/forum/#!topic/blink-dev/0EW0_vT_MOU
      // https://github.com/bitinn/node-fetch/issues/134
      (response.body as any as Pipeable).pipe(destination)
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
