/**
 *
 * File Box
 * https://github.com/huan/file-box
 *
 * 2018 Huan LI <zixia@zixia.net>
 *
 */
import fs        from 'fs'
import type http      from 'http'
import nodePath  from 'path'
import nodeUrl   from 'url'

import mime  from 'mime'

import {
  PassThrough,
  Readable,
  Writable,
}                     from 'stream'
import {
  instanceToClass,
}                     from 'clone-class'

import {
  VERSION,
}                         from './config.js'
import {
  FileBoxJsonObject,
  FileBoxOptions,
  FileBoxOptionsBase64,
  FileBoxOptionsCommon,
  FileBoxOptionsQRCode,
  FileBoxOptionsUrl,
  FileBoxOptionsUuid,
  FileBoxType,
  Metadata,
  Pipeable,
  UuidResolver,
  UuidRegister,
}                         from './file-box.type.js'
import {
  dataUrlToBase64,
  httpHeaderToFileName,
  httpHeadHeader,
  httpStream,
  streamToBuffer,
}                         from './misc.js'
import {
  bufferToQrValue,
  qrValueToStream,
}                         from './qrcode.js'
import {
  sizedChunkTransformer,
}                         from './pure-functions/sized-chunk-transformer.js'

const EMPTY_META_DATA = Object.freeze({})

export class FileBox implements Pipeable {

  /**
   *
   * Static Properties
   *
   */
  static readonly version = VERSION

  /**
   * Alias for `FileBox.fromUrl()`
   *
   * @alias fromUrl()
   */
  static fromUrl (
    url      : string,
    name?    : string,
    headers? : http.OutgoingHttpHeaders,
  ): FileBox {
    if (!name) {
      const parsedUrl = new nodeUrl.URL(url)
      name = parsedUrl.pathname
    }
    const options: FileBoxOptions = {
      headers,
      name,
      type : FileBoxType.Url,
      url,
    }
    return new this(options)
  }

  /**
   * Alias for `FileBox.fromFile()`
   *
   * @alias fromFile
   */

  static fromFile (
    path:   string,
    name?:  string,
  ): FileBox {
    if (!name) {
      name = nodePath.parse(path).base
    }
    const options: FileBoxOptions = {
      name,
      path,
      type : FileBoxType.File,
    }

    return new this(options)
  }

  static fromStream (
    stream: Readable,
    name?:  string,
  ): FileBox {
    const options: FileBoxOptions = {
      name: name || 'stream.dat',
      stream,
      type: FileBoxType.Stream,
    }
    return new this(options)
  }

  static fromBuffer (
    buffer: Buffer,
    name?:   string,
  ): FileBox {
    const options: FileBoxOptions = {
      buffer,
      name: name || 'buffer.dat',
      type : FileBoxType.Buffer,
    }
    return new this(options)
  }

  /**
   * @param base64
   * @param name the file name of the base64 data
   */
  static fromBase64 (
    base64: string,
    name?:   string,
  ): FileBox {
    const options: FileBoxOptions = {
      base64,
      name: name || 'base64.dat',
      type : FileBoxType.Base64,
    }
    return new this(options)
  }

  /**
   * dataURL: `data:image/png;base64,${base64Text}`,
   */
  static fromDataURL (
    dataUrl : string,
    name?    : string,
  ): FileBox {
    return this.fromBase64(
      dataUrlToBase64(dataUrl),
      name || 'data-url.dat',
    )
  }

  /**
   *
   * @param qrCode the value of the QR Code. For example: `https://github.com`
   */
  static fromQRCode (
    qrCode: string,
  ): FileBox {
    const options: FileBoxOptions = {
      name: 'qrcode.png',
      qrCode,
      type: FileBoxType.QRCode,
    }
    return new this(options)
  }

  protected static uuidToStream?:    UuidResolver
  protected static uuidFromStream?:  UuidRegister

  /**
   * @param uuid the UUID of the file. For example: `6f88b03c-1237-4f46-8db2-98ef23200551`
   * @param name the name of the file. For example: `video.mp4`
   */
  static fromUuid (
    uuid: string,
    name?: string,
  ): FileBox {
    const options: FileBoxOptions = {
      name: name || `${uuid}.dat`,
      type: FileBoxType.Uuid,
      uuid,
    }
    return new this(options)
  }

  static setUuidResolver (
    resolver: UuidResolver,
  ): void {
    if (Object.prototype.hasOwnProperty.call(this, 'uuidToStream')) {
      throw new Error('this FileBox has been set resolver before, can not set twice')
    }
    this.uuidToStream = resolver
  }

  static setUuidRegister (
    register: UuidRegister,
  ): void {
    if (Object.prototype.hasOwnProperty.call(this, 'uuidFromStream')) {
      throw new Error('this FileBox has been set register before, can not set twice')
    }
    this.uuidFromStream = register
  }

  /**
   *
   * @static
   * @param {(FileBoxJsonObject | string)} obj
   * @returns {FileBox}
   */
  static fromJSON (obj: FileBoxJsonObject | string): FileBox {
    if (typeof obj === 'string') {
      obj = JSON.parse(obj) as FileBoxJsonObject
    }

    let fileBox: FileBox

    switch (obj.type) {
      case FileBoxType.Base64:
        fileBox = FileBox.fromBase64(
          obj.base64,
          obj.name,
        )
        break

      case FileBoxType.Url:
        fileBox = FileBox.fromUrl(
          obj.url,
          obj.name,
        )
        break

      case FileBoxType.QRCode:
        fileBox = FileBox.fromQRCode(
          obj.qrCode,
        )
        break

      case FileBoxType.Uuid:
        fileBox = FileBox.fromUuid(
          obj.uuid,
          obj.name,
        )
        break

      default:
        throw new Error(`unknown filebox json object{type}: ${JSON.stringify(obj)}`)
    }

    if (obj.metadata) {
      fileBox.metadata = obj.metadata
    }

    return fileBox
  }

  /**
   *
   * Instance Properties
   *
   */
  readonly version = VERSION

  // not readonly: need be update from the remote url(possible)
  readonly type: FileBoxType

  /**
   * The size of the fileBox payload.
   *  Warning: it's not the size of the boxed file.
   *
   * For example:
   *
   * ```ts
   * const fileBox = FileBox.fromUrl('http://example.com/image.png')
   * console.log(fileBox.size)
   * // > 20 <- this is the length of the URL string
   *
   * await fileBox.ready()
   * console.log(fileBox.remoteSize)
   * // > 102400 <- this is the size of the remote image.png
   * ```
   */
  get size (): number {
    switch (this.type) {
      case FileBoxType.Base64:
        return this.base64
          ? Buffer.byteLength(this.base64, 'base64')
          : -1
      case FileBoxType.Url:
        return this.remoteUrl
          ? this.remoteUrl.length
          : -1
      case FileBoxType.QRCode:
        return this.qrCode
          ? this.qrCode.length
          : -1
      case FileBoxType.Buffer:
        return this.buffer
          ? this.buffer.length
          : -1
      case FileBoxType.File:
        return this.localPath
          ? fs.statSync(this.localPath).size
          : -1
      case FileBoxType.Stream:
        // We never know the size of a stream before consume it
        return -1
      case FileBoxType.Uuid:
        return this.uuid
          ? this.uuid.length
          : -1
      default:
        throw new Error('unknown FileBoxType: ' + this.type)
    }
  }

  mimeType?   : string  // 'text/plain'
  name        : string
  remoteSize? : number

  #metadata?: Metadata

  get metadata (): Metadata {
    if (this.#metadata) {
      return this.#metadata
    }
    return EMPTY_META_DATA
  }

  set metadata (data: Metadata) {
    if (this.#metadata) {
      throw new Error('metadata can not be modified after set')
    }
    this.#metadata = { ...data }
    Object.freeze(this.#metadata)
  }

  /**
   * Lazy load data: (can be serialized to JSON)
   *  Do not read file to Buffer until there's a consumer.
   */
  private readonly base64?    : string
  private readonly remoteUrl? : string
  private readonly qrCode?    : string
  private readonly uuid?      : string

  /**
   * Can not be serialized to JSON
   */
  private readonly buffer?    : Buffer
  private readonly localPath? : string
  private readonly stream?    : Readable

  private readonly headers?: http.OutgoingHttpHeaders

  protected constructor (
    options: FileBoxOptions,
  ) {
    // Only keep `basename` in this.name
    this.name = nodePath.basename(options.name)
    this.type = options.type

    this.mimeType = mime.getType(this.name) || undefined

    switch (options.type) {
      case FileBoxType.Buffer:
        if (!options.buffer) {
          throw new Error('no buffer')
        }
        this.buffer = options.buffer
        break

      case FileBoxType.File:
        if (!options.path) {
          throw new Error('no path')
        }
        this.localPath = options.path
        break

      case FileBoxType.Url:
        if (!options.url) {
          throw new Error('no url')
        }
        this.remoteUrl = options.url

        if (options.headers) {
          this.headers = options.headers
        }
        break

      case FileBoxType.Stream:
        if (!options.stream) {
          throw new Error('no stream')
        }
        this.stream = options.stream
        break

      case FileBoxType.QRCode:
        if (!options.qrCode) {
          throw new Error('no QR Code')
        }
        this.qrCode = options.qrCode
        break

      case FileBoxType.Base64:
        if (!options.base64) {
          throw new Error('no Base64 data')
        }
        this.base64 = options.base64
        break

      case FileBoxType.Uuid:
        if (!options.uuid) {
          throw new Error('no UUID data')
        }
        this.uuid = options.uuid
        break

      default:
        throw new Error(`unknown options(type): ${JSON.stringify(options)}`)
    }

  }

  async ready (): Promise<void> {
    if (this.type === FileBoxType.Url) {
      await this.syncRemote()
    }
  }

  /**
   * @todo use http.get/gets instead of Request
   */
  protected async syncRemote (): Promise<void> {
    /**
     * https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition
     *  > Content-Disposition: attachment; filename="cool.html"
     */

    if (this.type !== FileBoxType.Url) {
      throw new Error('type is not Remote')
    }
    if (!this.remoteUrl) {
      throw new Error('no url')
    }

    const headers = await httpHeadHeader(this.remoteUrl)

    const filename = httpHeaderToFileName(headers)
    if (filename) {
      this.name = filename
    }

    if (!this.name) {
      throw new Error('NONAME')
    }

    this.mimeType   = headers['content-type'] || mime.getType(this.name) || undefined
    this.remoteSize = Number(headers['content-length'] ?? -1)
  }

  /**
   *
   * toXXX methods
   *
   */
  toString () {
    return [
      'FileBox#',
      FileBoxType[this.type],
      '<',
      this.name,
      '>',
    ].join('')
  }

  toJSON (): FileBoxJsonObject {
    const objCommon: FileBoxOptionsCommon = {
      metadata : this.metadata,
      name     : this.name,
    }

    let obj: FileBoxJsonObject

    switch (this.type) {
      case FileBoxType.Url: {
        if (!this.remoteUrl) {
          throw new Error('no url')
        }
        const objUrl: FileBoxOptionsUrl = {
          headers : this.headers,
          type    : FileBoxType.Url,
          url     : this.remoteUrl,
        }
        obj = {
          ...objCommon,
          ...objUrl,
        }
        break
      }

      case FileBoxType.QRCode: {
        if (!this.qrCode) {
          throw new Error('no qr code')
        }
        const objQRCode: FileBoxOptionsQRCode = {
          qrCode : this.qrCode,
          type   : FileBoxType.QRCode,
        }
        obj = {
          ...objCommon,
          ...objQRCode,
        }
        break
      }

      case FileBoxType.Base64: {
        if (!this.base64) {
          throw new Error('no base64 data')
        }
        const objBase64: FileBoxOptionsBase64 = {
          base64 : this.base64,
          type   : FileBoxType.Base64,
        }
        obj = {
          ...objCommon,
          ...objBase64,
        }
        break
      }

      case FileBoxType.Uuid: {
        if (!this.uuid) {
          throw new Error('no uuid data')
        }
        const objUuid: FileBoxOptionsUuid = {
          type : FileBoxType.Uuid,
          uuid : this.uuid,
        }
        obj = {
          ...objCommon,
          ...objUuid,
        }
        break
      }

      default:
        void this.type
        throw new Error('FileBox.toJSON() can only work on limited FileBoxType(s). See: <https://github.com/huan/file-box/issues/25>')
    }

    return obj
  }

  async toStream (): Promise<Readable> {
    let stream: Readable

    switch (this.type) {
      case FileBoxType.Buffer:
        stream = this.transformBufferToStream()
        break

      case FileBoxType.File:
        stream = this.transformFileToStream()
        break

      case FileBoxType.Url:
        stream = await this.transformUrlToStream()
        break

      case FileBoxType.Stream:
        if (!this.stream) {
          throw new Error('no stream')
        }

        /**
          * Huan(202109): the stream.destroyed will not be `true`
          *   when we have read all the data
          *   after we change some code.
          * The reason is unbase64 : this.base64,
          type   : FileBoxType.Base64,known... so we change to check `readable`
          */
        if (!this.stream.readable) {
          throw new Error('The stream is not readable. Maybe has already been consumed, and now it was drained. See: https://github.com/huan/file-box/issues/50')
        }

        stream = this.stream
        break

      case FileBoxType.QRCode:
        if (!this.qrCode) {
          throw new Error('no QR Code')
        }
        stream = await this.transformQRCodeToStream()
        break

      case FileBoxType.Base64:
        if (!this.base64) {
          throw new Error('no base64 data')
        }
        stream = this.transformBase64ToStream()
        break

      case FileBoxType.Uuid: {
        if (!this.uuid) {
          throw new Error('no uuid data')
        }
        const FileBoxKlass = instanceToClass(this, FileBox)

        if (typeof FileBoxKlass.uuidToStream !== 'function') {
          throw new Error('need to call FileBox.setUuidLoader() to set UUID loader first.')
        }

        stream = await FileBoxKlass.uuidToStream.call(this, this.uuid)
        break
      }

      default:
        throw new Error('not supported FileBoxType: ' + FileBoxType[this.type])
    }

    return stream
  }

  /**
   * https://stackoverflow.com/a/16044400/1123955
   */
  private transformBufferToStream (buffer?: Buffer): Readable {
    const bufferStream = new PassThrough()
    bufferStream.end(buffer || this.buffer)

    /**
     * Use small `chunks` with `toStream()` #44
     * https://github.com/huan/file-box/issues/44
     */
    return bufferStream.pipe(sizedChunkTransformer())
  }

  private transformBase64ToStream (): Readable {
    if (!this.base64) {
      throw new Error('no base64 data')
    }
    const buffer = Buffer.from(this.base64, 'base64')
    return this.transformBufferToStream(buffer)
  }

  private transformFileToStream (): Readable {
    if (!this.localPath) {
      throw new Error('no url(path)')
    }
    return fs.createReadStream(this.localPath)
  }

  private async transformUrlToStream (): Promise<Readable> {
    return new Promise<Readable>((resolve, reject) => {
      if (this.remoteUrl) {
        httpStream(this.remoteUrl, this.headers)
          .then(resolve)
          .catch(reject)
      } else {
        reject(new Error('no url'))
      }
    })
  }

  private async transformQRCodeToStream (): Promise<Readable> {
    if (!this.qrCode) {
      throw new Error('no QR Code Value found')
    }
    const stream = qrValueToStream(this.qrCode)
    return stream
  }

  /**
   * save file
   *
   * @param filePath save file
   */
  async toFile (
    filePath?: string,
    overwrite = false,
  ): Promise<void> {
    if (this.type === FileBoxType.Url) {
      if (!this.mimeType || !this.name) {
        await this.syncRemote()
      }
    }
    const fullFilePath = nodePath.resolve(filePath || this.name)

    const exist = fs.existsSync(fullFilePath)

    if (exist && !overwrite) {
      throw new Error(`FileBox.toFile(${fullFilePath}): file exist. use FileBox.toFile(${fullFilePath}, true) to force overwrite.`)
    }

    const writeStream = fs.createWriteStream(fullFilePath)

    /**
      * Huan(202109): make sure the file can be opened for writting
      *   before we pipe the stream to it
      */
    await new Promise((resolve, reject) => writeStream
      .once('open', resolve)
      .once('error', reject)
    )
    /**
      * Start pipe
      */
    await new Promise((resolve, reject) => {
      writeStream
        .once('close', resolve)
        .once('error', reject)

      this.pipe(writeStream)
    })
  }

  async toBase64 (): Promise<string> {
    if (this.type === FileBoxType.Base64) {
      if (!this.base64) {
        throw new Error('no base64 data')
      }
      return this.base64
    }

    const buffer = await this.toBuffer()
    return buffer.toString('base64')
  }

  /**
   * dataUrl: `data:image/png;base64,${base64Text}',
   */
  async toDataURL (): Promise<string> {
    const base64Text = await this.toBase64()

    if (!this.mimeType) {
      throw new Error('no mimeType')
    }

    const dataUrl = [
      'data:',
      this.mimeType,
      ';base64,',
      base64Text,
    ].join('')

    return dataUrl
  }

  async toBuffer (): Promise<Buffer> {
    if (this.type === FileBoxType.Buffer) {
      if (!this.buffer) {
        throw new Error('no buffer!')
      }
      return this.buffer
    }

    const stream = new PassThrough()
    this.pipe(stream)

    const buffer: Buffer = await streamToBuffer(stream)
    return buffer
  }

  async toQRCode (): Promise<string> {
    if (this.type === FileBoxType.QRCode) {
      if (!this.qrCode) {
        throw new Error('no QR Code!')
      }
      return this.qrCode
    }

    const buf = await this.toBuffer()
    const qrValue = await bufferToQrValue(buf)

    return qrValue
  }

  async toUuid (): Promise<string> {
    if (this.type === FileBoxType.Uuid) {
      if (!this.uuid) {
        throw new Error('no uuid found for a UUID type file box!')
      }
      return this.uuid
    }

    const FileBoxKlass = instanceToClass(this, FileBox)

    if (typeof FileBoxKlass.uuidFromStream !== 'function') {
      throw new Error('need to use FileBox.setUuidSaver() before dealing with UUID')
    }

    const stream = new PassThrough()
    this.pipe(stream)

    return FileBoxKlass.uuidFromStream.call(this, stream)
  }

  /**
   *
   * toXXX methods END
   *
   */

  pipe<T extends Writable> (
    destination: T,
  ): T {
    this.toStream().then(stream => {
      stream.on('error', e => {
        console.info('error:', e)

        destination.emit('error', e)
      })
      return stream.pipe(destination)
    }).catch(e => destination.emit('error', e))
    return destination
  }

}

export default FileBox
