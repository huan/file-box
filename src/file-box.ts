/**
 *
 * File Box
 * https://github.com/huan/file-box
 *
 * 2018 Huan LI <zixia@zixia.net>
 *
 */
import fs        from 'fs'
import http      from 'http'
import nodePath  from 'path'
import nodeUrl   from 'url'

import mime  from 'mime'

import {
  PassThrough,
}                     from 'stream'

import {
  VERSION,
}                         from './config'
import {
  FileBoxOptions,
  FileBoxType,
  FileBoxJsonObject,
  Metadata,
  Pipeable,
  FileBoxJsonObjectCommon,
  FileBoxJsonObjectUrl,
  FileBoxJsonObjectQRCode,
  FileBoxJsonObjectBase64,
}                         from './file-box.type'
import {
  dataUrlToBase64,
  httpHeaderToFileName,
  httpHeadHeader,
  httpStream,
  streamToBuffer,
}                         from './misc'
import {
  bufferToQrValue,
  qrValueToStream,
}                         from './qrcode'

const EMPTY_META_DATA = Object.freeze({})

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
  public static fromUrl (
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

  public static fromFile (
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

  public static fromStream (
    stream: NodeJS.ReadableStream,
    name:   string,
  ): FileBox {
    const options: FileBoxOptions = {
      name,
      stream,
      type: FileBoxType.Stream,
    }
    return new this(options)
  }

  public static fromBuffer (
    buffer: Buffer,
    name:   string,
  ): FileBox {
    const options: FileBoxOptions = {
      buffer,
      name,
      type : FileBoxType.Buffer,
    }
    return new this(options)
  }

  /**
   * @param base64
   * @param name the file name of the base64 data
   */
  public static fromBase64 (
    base64: string,
    name:   string,
  ): FileBox {
    const options: FileBoxOptions = {
      base64,
      name,
      type : FileBoxType.Base64,
    }
    return new this(options)
  }

  /**
   * dataURL: `data:image/png;base64,${base64Text}`,
   */
  public static fromDataURL (
    dataUrl : string,
    name    : string,
  ): FileBox {
    return this.fromBase64(
      dataUrlToBase64(dataUrl),
      name,
    )
  }

  /**
   *
   * @param qrCode the value of the QR Code. For example: `https://github.com`
   */
  public static fromQRCode (
    qrCode: string,
  ): FileBox {
    const options: FileBoxOptions = {
      name: 'qrcode.png',
      qrCode,
      type: FileBoxType.QRCode,
    }
    return new this(options)
  }

  /**
   *
   * @static
   * @param {(FileBoxJsonObject | string)} obj
   * @returns {FileBox}
   */
  public static fromJSON (obj: FileBoxJsonObject | string): FileBox {
    if (typeof obj === 'string') {
      obj = JSON.parse(obj) as FileBoxJsonObject
    }

    let fileBox: FileBox

    switch (obj.boxType) {
      case FileBoxType.Base64:
        fileBox = FileBox.fromBase64(
          obj.base64,
          obj.name,
        )
        break

      case FileBoxType.Url:
        fileBox = FileBox.fromUrl(
          obj.remoteUrl,
          obj.name,
        )
        break

      case FileBoxType.QRCode:
        fileBox = FileBox.fromQRCode(
          obj.qrCode,
        )
        break

      default:
        throw new Error(`unknown filebox json object{type}: ${JSON.stringify(obj)}`)
    }

    fileBox.metadata = obj.metadata
    return fileBox
  }

  public static version () {
    return VERSION
  }

  /**
   *
   * Instance Properties
   *
   */
  // not readonly: need be update from the remote url(possible)
  public boxType: FileBoxType

  // huan 20190604: it seems that lastMdified & size both not used at all?
  // public lastModified : number
  // public size         : number

  public mimeType? : string    // 'text/plain'
  public name      : string

  private _metadata?: Metadata

  public get metadata (): Metadata {
    if (this._metadata) {
      return this._metadata
    }
    return EMPTY_META_DATA
  }
  public set metadata (data: Metadata) {
    if (this._metadata) {
      throw new Error('metadata can not be modified after set')
    }
    this._metadata = { ...data }
    Object.freeze(this._metadata)
  }

  /**
   * Lazy load data:
   *  Do not read file to Buffer until there's a consumer.
   */
  private readonly base64?    : string
  private readonly remoteUrl? : string
  private readonly qrCode?    : string

  private readonly buffer?    : Buffer
  private readonly localPath? : string
  private readonly stream?    : NodeJS.ReadableStream

  private readonly headers?: http.OutgoingHttpHeaders

  private constructor (
    options: FileBoxOptions,
  ) {
    // Only keep `basename` in this.name
    this.name    = nodePath.basename(options.name)
    this.boxType = options.type

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

      default:
        throw new Error(`unknown options(type): ${JSON.stringify(options)}`)
    }

  }

  public version () {
    return VERSION
  }

  public type (): FileBoxType {
    return this.boxType
  }

  public async ready (): Promise<void> {
    if (this.boxType === FileBoxType.Url) {
      await this.syncRemoteName()
    }
  }

  /**
   * @todo use http.get/gets instead of Request
   */
  protected async syncRemoteName (): Promise<void> {
    /**
     * https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition
     *  > Content-Disposition: attachment; filename="cool.html"
     */

    if (this.boxType !== FileBoxType.Url) {
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
      throw new Error('no name')
    }

    this.mimeType = headers['content-type'] || mime.getType(this.name) || undefined
  }

  /**
   *
   * toXXX methods
   *
   */
  public toString () {
    return [
      'FileBox#',
      FileBoxType[this.boxType],
      '<',
      this.name,
      '>',
    ].join('')
  }

  public toJSON (): FileBoxJsonObject {
    const objCommon: FileBoxJsonObjectCommon = {
      metadata : this.metadata,
      name     : this.name,
    }

    let obj: FileBoxJsonObject

    switch (this.boxType) {
      case FileBoxType.Url:
        if (!this.remoteUrl) {
          throw new Error('no url')
        }
        const objUrl: FileBoxJsonObjectUrl = {
          boxType   : FileBoxType.Url,
          headers   : this.headers,
          remoteUrl : this.remoteUrl,
        }
        obj = {
          ...objCommon,
          ...objUrl,
        }
        break

      case FileBoxType.QRCode:
        if (!this.qrCode) {
          throw new Error('no qr code')
        }
        const objQRCode: FileBoxJsonObjectQRCode = {
          boxType : FileBoxType.QRCode,
          qrCode : this.qrCode,
        }
        obj = {
          ...objCommon,
          ...objQRCode,
        }
        break

      case FileBoxType.Base64:
        if (!this.base64) {
          throw new Error('no base64 data')
        }
        const objBase64: FileBoxJsonObjectBase64 = {
          base64  : this.base64,
          boxType : FileBoxType.Base64,
        }
        obj = {
          ...objCommon,
          ...objBase64,
        }
        break

      default:
        throw new Error('FileBox.toJSON() can only work on limited FileBoxType(s). See: <https://github.com/huan/file-box/issues/25>')
    }

    return obj
  }

  public async toStream (): Promise<NodeJS.ReadableStream> {
    let stream: NodeJS.ReadableStream

    switch (this.boxType) {
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

      default:
        throw new Error('not supported FileBoxType: ' + FileBoxType[this.boxType])
    }

    return stream
  }

  /**
   * https://stackoverflow.com/a/16044400/1123955
   */
  private transformBufferToStream (buffer?: Buffer): NodeJS.ReadableStream {
    const bufferStream = new PassThrough()
    bufferStream.end(buffer || this.buffer)
    return bufferStream
  }

  private transformBase64ToStream (): NodeJS.ReadableStream {
    if (!this.base64) {
      throw new Error('no base64 data')
    }
    const buffer = Buffer.from(this.base64, 'base64')
    return this.transformBufferToStream(buffer)
  }

  private transformFileToStream (): NodeJS.ReadableStream {
    if (!this.localPath) {
      throw new Error('no url(path)')
    }
    return fs.createReadStream(this.localPath)
  }

  private async transformUrlToStream (): Promise<NodeJS.ReadableStream> {
    return new Promise<NodeJS.ReadableStream>((resolve, reject) => {
      if (this.remoteUrl) {
        httpStream(this.remoteUrl, this.headers)
          .then(resolve)
          .catch(reject)
      } else {
        reject(new Error('no url'))
      }
    })
  }

  private async transformQRCodeToStream (): Promise<NodeJS.ReadableStream> {
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
  public async toFile (
    filePath?: string,
    overwrite = false,
  ): Promise<void> {
    if (this.boxType === FileBoxType.Url) {
      if (!this.mimeType || !this.name) {
        await this.syncRemoteName()
      }
    }
    const fullFilePath = nodePath.resolve(filePath || this.name)

    const exist = fs.existsSync(fullFilePath)

    if (exist && !overwrite) {
      throw new Error(`FileBox.toFile(${fullFilePath}): file exist. use FileBox.toFile(${fullFilePath}, true) to force overwrite.`)
    }

    const writeStream = fs.createWriteStream(fullFilePath)
    await new Promise((resolve, reject) => {
      writeStream
        .once('close', resolve)
        .once('error', reject)

      this.pipe(writeStream)
    })
  }

  public async toBase64 (): Promise<string> {
    if (this.boxType === FileBoxType.Base64) {
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
  public async toDataURL (): Promise<string> {
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

  public async toBuffer (): Promise<Buffer> {
    if (this.boxType === FileBoxType.Buffer) {
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

  public async toQRCode (): Promise<string> {
    if (this.boxType === FileBoxType.QRCode) {
      if (!this.qrCode) {
        throw new Error('no QR Code!')
      }
      return this.qrCode
    }

    const buf = await this.toBuffer()
    const qrValue = await bufferToQrValue(buf)

    return qrValue
  }

  /**
   *
   * toXXX methods END
   *
   */

  public pipe<T extends NodeJS.WritableStream> (
    destination: T,
  ): T {
    this.toStream().then(
      stream => stream.pipe(destination),
    ).catch(e => destination.emit('error', e))
    return destination
  }

}

export default FileBox
