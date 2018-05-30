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
import * as nodeUrl   from 'url'
import * as http      from 'http'
import * as https     from 'https'

import * as fetch     from 'isomorphic-fetch'

import {
  PassThrough,
}                     from 'stream'

import {
  VERSION,
}             from './config'

import {
  FileBoxType,
  FileBoxOptions,
  FileBoxOptionsRemote,
  Pipeable,
}                         from './file-box.type'

export class FileBox implements Pipeable {

  /**
   *
   * Static Properties
   *
   */
  public static packRemote(
    url      : string,
    name?    : string,
    headers? : http.OutgoingHttpHeaders,
  ): FileBox {
    const type = FileBoxType.Remote

    if (!name) {
      name = nodePath.parse(url).base
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
   * Instance Properties
   *
   */
  // not readonly: need be update from the remote url(possible)
  public name: string

  public readonly lastModified: number
  public readonly size        : number
  public readonly boxType     : FileBoxType

  /**
   * Lazy load data:
   *  Do not read file to Buffer until there's a consumer.
   */
  private readonly buffer?: Buffer
  private readonly url?   : string  // local file store as file:///path...
  private readonly stream?: NodeJS.ReadableStream

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

    this.name = options.name
    this.boxType = options.type

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

  public async syncRemoteName(): Promise<void> {
    /**
     * https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition
     *  > Content-Disposition: attachment; filename="cool.html"
     */

    // const headers = new Headers({
    //   // a: 'b',
    // })
    if (this.boxType !== FileBoxType.Remote) {
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
    switch (this.boxType) {
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
        throw new Error('not supported FileBoxType: ' + FileBoxType[this.boxType])
    }

    return destination
  }

  /**
   * https://stackoverflow.com/a/16044400/1123955
   */
  private pipeBuffer(
    destination: NodeJS.WritableStream,
  ): void {
    const bufferStream = new PassThrough()
    bufferStream.pipe(destination)
    bufferStream.end(this.buffer)
  }

  private pipeLocal(
    destination: NodeJS.WritableStream,
  ): void {
    const filePath = this.url
    if (!filePath) {
      throw new Error('no url(path)')
    }
    fs.createReadStream(filePath)
      .pipe(destination)
  }

  private pipeRemote(
    destination: NodeJS.WritableStream,
  ): void {
    if (!this.url) {
      throw new Error('no url')
    }

    const parsedUrl = nodeUrl.parse(this.url)
    const protocol  = parsedUrl.protocol as 'http:' | 'https:'

    let options: http.RequestOptions | https.RequestOptions
    // let request
    let get: typeof https.get

    if (protocol === 'https:') {
      // request       = https.request.bind(https)
      get           = https.get
      options       = parsedUrl as any as https.RequestOptions
      options.agent = https.globalAgent
    } else if (protocol === 'http:') {
      // request       = http.request.bind(http)
      get           = http.get
      options       = parsedUrl as any as http.RequestOptions
      options.agent = http.globalAgent
    } else {
      throw new Error('protocol unknown: ' + protocol)
    }

    options.headers = this.headers || {}

    get(options, res => res.pipe(destination))
  }

  private pipeStream(
    destination: NodeJS.WritableStream,
  ): void {
    if (!this.stream) {
      throw new Error('no stream!')
    }
    this.stream.pipe(destination)
  }

  /**
   * save file
   *
   * @todo use async operations instead of async, i.e. fs.exists() instead of fs.existsSync
   * @param filePath save file
   */
  public async toFile(
    filePath?: string,
    overwrite = false,
  ): Promise<void> {
    const fullFilePath = nodePath.resolve(filePath || this.name)

    if (!overwrite && fs.existsSync(fullFilePath)) {
      throw new Error(`save(${fullFilePath}) file is already exist!`)
    }

    const writeStream = fs.createWriteStream(fullFilePath)
    try {
      await new Promise((resolve, reject) => {
        this.pipe(writeStream)
        writeStream
          .once('end'   , resolve)
          .once('error' , reject)
      })
    } catch (e) {
      // log.error('PuppeteerMessage', `saveFile() call readyStream() error: ${e.message}`)
      throw new Error(`save() exception: ${e.message}`)
    }
  }

}

export default FileBox
