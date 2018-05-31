/**
 *
 * File Box
 * https://github.com/zixia/node-file-box
 *
 * 2018 Huan LI <zixia@zixia.net>
 *
 */
import * as fs        from 'fs'
import * as http      from 'http'
import * as nodePath  from 'path'

import * as mime  from 'mime'

import {
  PassThrough,
}                     from 'stream'

import {
  VERSION,
}                         from './config'
import {
  FileBoxType,
  FileBoxOptions,
  FileBoxOptionsRemote,
  Pipeable,
}                         from './file-box.type'
import {
  dataUrlToBase64,
  httpHeaderToFileName,
  httpHeadHeader,
  httpStream,
  streamToBuffer,
}                         from './misc'

export class FileBox implements Pipeable {

  /**
   *
   * Static Properties
   *
   */

  /**
   * Alias for `FileBox.fromUrl()`
   *
   * @alias fromUrl()
   */
  public static fromRemote(
    url      : string,
    name?    : string,
    headers? : http.OutgoingHttpHeaders,
  ): FileBox {
    return this.fromUrl(url, name, headers)
  }

  public static fromUrl(
    url      : string,
    name?    : string,
    headers? : http.OutgoingHttpHeaders,
  ): FileBox {
    const type = FileBoxType.Remote

    if (!name) {
      const parsedUrl = nodePath.parse(url)
      name = parsedUrl.base
    }

    const options: FileBoxOptions = {
      type,

      name,
      url,
      headers,
    }

    const box = new FileBox(options)
    return box
  }

  /**
   * Alias for `FileBox.fromFile()`
   *
   * @alias fromFile
   */
  public static fromLocal(
    path  : string,
    name? : string,
  ): FileBox {
    return this.fromFile(path, name)
  }

  public static fromFile(
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

  public static fromStream(
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

  public static fromBuffer(
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

  public static fromBase64(
    base64: string,
    name:   string,
  ): FileBox {
    const buffer = Buffer.from(base64, 'base64')
    const type   = FileBoxType.Buffer

    const options: FileBoxOptions = {
      type,
      name,
      buffer,
    }

    const box = new FileBox(options)

    return box
  }

  /**
   * dataURL: `data:image/png;base64,${base64Text}`,
   */
  public static fromDataURL(
    dataUrl : string,
    name    : string,
  ): FileBox {
    const base64 = dataUrlToBase64(dataUrl)

    const box = this.fromBase64(
      base64,
      name,
    )
    return box
  }

  public static version() {
    return VERSION
  }

  /**
   *
   * Instance Properties
   *
   */
  // not readonly: need be update from the remote url(possible)
  public name: string

  public readonly lastModified : number
  public readonly size         : number
  public readonly boxType      : FileBoxType

  /**
   * Lazy load data:
   *  Do not read file to Buffer until there's a consumer.
   */
  private readonly buffer?: Buffer
  private readonly url?   : string  // local file store as file:///path...
  private readonly stream?: NodeJS.ReadableStream

  public mimeType? : string

  private readonly headers?: http.OutgoingHttpHeaders

  constructor(
    fileOrOptions: string | FileBoxOptions,
  ) {
    let options: FileBoxOptions

    if (typeof fileOrOptions === 'string') {
      /**
       * Default to Local File
       */
      options = {
        type: FileBoxType.Local,
        name: nodePath.basename(fileOrOptions),
        url: nodePath.resolve(fileOrOptions),
      }
    } else {
      options = fileOrOptions
    }

    this.name    = options.name
    this.boxType = options.type

    this.mimeType = mime.getType(this.name) || undefined

    switch (options.type) {
      case FileBoxType.Buffer:
        if (!options.buffer) {
          throw new Error('no buffer')
        }
        this.buffer = options.buffer
        break

      case FileBoxType.Remote:
      case FileBoxType.Local:
        if (!options.url) {
          throw new Error('no url(path)')
        }
        this.url = options.url

        const headers = (options as FileBoxOptionsRemote).headers
        if (headers) {
          this.headers = headers
        }
        break

      case FileBoxType.Stream:
        if (!options.stream) {
          throw new Error('no stream')
        }
        this.stream = options.stream
        break

      default:
        throw new Error('unknown type')
    }

  }

  public version() {
    return VERSION
  }

  public toJSON(): string {
    throw new Error('WIP')
  }

  public async ready(): Promise<void> {
    if (this.boxType === FileBoxType.Remote) {
      await this.syncRemoteName()
    }
  }

  /**
   * @todo use http.get/gets instead of Request
   */
  public async syncRemoteName(): Promise<void> {
    /**
     * https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition
     *  > Content-Disposition: attachment; filename="cool.html"
     */

    if (this.boxType !== FileBoxType.Remote) {
      throw new Error('type is not Remote')
    }
    if (!this.url) {
      throw new Error('no url')
    }

    const headers = await httpHeadHeader(this.url)
    const filename = httpHeaderToFileName(headers)

    if (filename) {
      this.name = filename
    }

    if (!this.name) {
      throw new Error('no name')
    }

    this.mimeType = headers['content-type'] || mime.getType(this.name) || undefined
  }

  public pipe<T extends NodeJS.WritableStream>(
    destination: T,
  ): T {
    this.toStream().then(
      stream => stream.pipe(destination),
    )
    return destination
  }

  public async toStream(): Promise<NodeJS.ReadableStream> {
    let stream: NodeJS.ReadableStream

    switch (this.boxType) {
      case FileBoxType.Buffer:
        stream = this.streamBuffer()
        break

      case FileBoxType.Local:
        stream = this.streamLocal()
        break

      case FileBoxType.Remote:
        stream = await this.streamRemote()
        break

      case FileBoxType.Stream:
        if (!this.stream) {
          throw new Error('no stream')
        }
        stream = this.stream
        break

      default:
        throw new Error('not supported FileBoxType: ' + FileBoxType[this.boxType])
    }

    return stream
  }

  /**
   * https://stackoverflow.com/a/16044400/1123955
   */
  private streamBuffer(): NodeJS.ReadableStream {
    const bufferStream = new PassThrough()
    bufferStream.end(this.buffer)
    return bufferStream
  }

  private streamLocal(): NodeJS.ReadableStream {
    const filePath = this.url
    if (!filePath) {
      throw new Error('no url(path)')
    }
    return fs.createReadStream(filePath)
  }

  private async streamRemote(): Promise<NodeJS.ReadableStream> {
    return new Promise<NodeJS.ReadableStream>((resolve, reject) => {
      if (this.url) {
        httpStream(this.url, this.headers)
        .then(resolve)
      } else {
        reject(new Error('no url'))
      }
    })
  }

  /**
   * save file
   *
   * @param filePath save file
   */
  public async toFile(
    filePath?: string,
    overwrite = false,
  ): Promise<void> {
    if (this.boxType === FileBoxType.Remote) {
      if (!this.mimeType || !this.name) {
        await this.syncRemoteName()
      }
    }
    const fullFilePath = nodePath.resolve(filePath || this.name)

    const exist = await new Promise<boolean>(resolve => fs.exists(fullFilePath, resolve))

    if (!overwrite && exist) {
      throw new Error(`save(${fullFilePath}) file is already exist!`)
    }

    const writeStream = fs.createWriteStream(fullFilePath)
    await new Promise((resolve, reject) => {
      this.pipe(writeStream)
      writeStream
        .once('end'   , resolve)
        .once('error' , reject)
    })
  }

  public async toBase64(): Promise<string> {
    if (this.boxType === FileBoxType.Buffer) {
      if (!this.buffer) {
        throw new Error('no buffer!')
      }
      return this.buffer.toString('base64')
    }

    const stream = new PassThrough()
    this.pipe(stream)

    const buffer = await streamToBuffer(stream)
    return buffer.toString('base64')
  }

  /**
   * dataUrl: `data:image/png;base64,${base64Text}',
   */
  public async toDataURL(): Promise<string> {
    const base64 = await this.toBase64()

    if (!this.mimeType) {
      throw new Error('no mimeType')
    }

    const dataUrl = [
      'data:',
      this.mimeType,
      ';base64,',
      base64,
    ].join('')

    return dataUrl
  }
}

export default FileBox
