/**
 * Universal WinterTC FileBox implementation.
 *
 * Core file container fully compatible with browsers, edge workers, Node.js,
 * and Deno runtimes. Uses standard WHATWG Streams and Web APIs with zero native OS imports.
 */
import mime from 'mime'
import {
  instanceToClass,
  looseInstanceOfClass,
  interfaceOfClass,
} from 'clone-class'

import { VERSION } from './config.ts'
import { FileBoxType } from './file-box.type.ts'
import type {
  FileBoxJsonObject,
  FileBoxOptions,
  FileBoxOptionsBase64,
  FileBoxOptionsCommon,
  FileBoxOptionsQRCode,
  FileBoxOptionsUrl,
  FileBoxOptionsUuid,
  Metadata,
  Pipeable,
  UuidLoader,
  UuidSaver,
} from './file-box.type.ts'
import {
  base64ToBytes,
  basename,
  bytesToBase64,
  dataUrlToBase64,
  fetchHeadHeader,
  fetchStream,
  httpHeaderToFileName,
  streamToBytes,
} from './misc.ts'
import {
  bufferToQrValue,
  qrValueToReadableStream,
} from './qrcode.ts'
import type { FileBoxInterface } from './interface.ts'

const EMPTY_META_DATA = Object.freeze({})
const UNKNOWN_SIZE = -1

let interfaceOfFileBox = (_: any): _ is FileBoxInterface => false
let looseInstanceOfFileBox = (_: any): _ is FileBox => false

/**
 * Converts a Node.js Readable stream into a WHATWG ReadableStream with full teardown
 * and cancellation support across environments.
 */
function nodeStreamToWebStream (stream: any): ReadableStream<Uint8Array> {
  let onData: ((chunk: any) => void) | undefined
  let onEnd: (() => void) | undefined
  let onError: ((err: any) => void) | undefined

  const cleanup = () => {
    if (onData) stream.removeListener?.('data', onData)
    if (onEnd) stream.removeListener?.('end', onEnd)
    if (onError) stream.removeListener?.('error', onError)
    onData = undefined
    onEnd = undefined
    onError = undefined
  }

  return new ReadableStream<Uint8Array>({
    start (controller) {
      onData = (chunk: any) => {
        try {
          const u8 = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk)
          controller.enqueue(u8)
        } catch {
          cleanup()
          if (typeof stream.destroy === 'function') {
            stream.destroy()
          }
        }
      }
      onEnd = () => {
        cleanup()
        try { controller.close() } catch {}
      }
      onError = (err: any) => {
        cleanup()
        try { controller.error(err) } catch {}
      }

      stream.on('data', onData)
      stream.once('end', onEnd)
      stream.once('error', onError)
    },
    cancel (reason) {
      cleanup()
      if (typeof stream.destroy === 'function') {
        const error = reason instanceof Error ? reason : undefined
        stream.destroy(error)
      }
    },
  })
}

export class FileBox implements Pipeable, FileBoxInterface {

  static readonly version = VERSION

  static [Symbol.hasInstance] (lho: any): lho is FileBoxInterface {
    return this.validInterface(lho)
  }

  static valid (target: any): target is FileBoxInterface {
    return this.validInstance(target) || this.validInterface(target)
  }

  static validInterface (target: any): target is FileBoxInterface {
    return interfaceOfFileBox(target)
  }

  static validInstance (target: any): target is FileBox {
    return looseInstanceOfFileBox(target)
  }

  static fromUrl (
    url: string,
    options?: {
      headers?: any
      name?: string
      size?: number
      md5?: string
    },
  ): FileBox

  /**
   * @deprecated use `fromUrl(url, options)` instead
   */
  static fromUrl (
    url: string,
    name?: string,
    headers?: any,
  ): FileBox

  static fromUrl (
    url: string,
    nameOrOptions?: string | {
      headers?: any
      name?: string
      size?: number
      md5?: string
    },
    headers?: any,
  ): FileBox {
    let name: undefined | string
    let size: undefined | number
    let md5: undefined | string

    if (typeof nameOrOptions === 'object') {
      headers = nameOrOptions.headers
      name = nameOrOptions.name
      size = nameOrOptions.size
      md5 = nameOrOptions.md5
    } else {
      name = nameOrOptions
    }

    if (!name) {
      try {
        const parsedUrl = new URL(url)
        name = basename(parsedUrl.pathname)
      } catch {
        name = basename(url)
      }
    }
    const options: FileBoxOptions = {
      headers,
      md5,
      name,
      size,
      type: FileBoxType.Url,
      url,
    }
    return new this(options)
  }

  /**
   * Creates a FileBox from a Web Blob or File.
   * String paths require native filesystem access and must be loaded via `file-box/server`.
   */
  static fromFile (
    fileOrPath: Blob | string,
    name?: string,
    md5?: string,
  ): FileBox {
    if (fileOrPath instanceof Blob) {
      const fileName = name || (fileOrPath as any).name || 'file.dat'
      return new this({
        blob: fileOrPath,
        md5,
        name: fileName,
        size: fileOrPath.size,
        type: FileBoxType.File,
      })
    }
    if (typeof fileOrPath === 'string') {
      throw new Error(`FileBox.fromFile("${fileOrPath}") requires filesystem access. Use import { FileBox } from "file-box/server" or pass a Web File/Blob.`)
    }
    throw new TypeError('FileBox.fromFile() argument must be a Blob/File or a path string.')
  }

  /**
   * Creates a FileBox from a byte buffer (Uint8Array or ArrayBuffer).
   */
  static fromBuffer (
    buffer: Uint8Array | ArrayBuffer,
    name?: string,
    md5?: string,
  ): FileBox {
    const uint8 = buffer instanceof Uint8Array
      ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
      : new Uint8Array(buffer)
    return new this({
      buffer: uint8,
      md5,
      name: name || 'buffer.dat',
      size: uint8.byteLength,
      type: FileBoxType.Buffer,
    })
  }

  /**
   * Symmetrical alias for fromBuffer accepting standard Uint8Array or ArrayBuffer bytes.
   */
  static fromBytes (
    bytes: Uint8Array | ArrayBuffer,
    name?: string,
    md5?: string,
  ): FileBox {
    return this.fromBuffer(bytes, name || 'bytes.dat', md5)
  }

  /**
   * Creates a FileBox from a Web Blob.
   */
  static fromBlob (
    blob: Blob,
    name?: string,
    md5?: string,
  ): FileBox {
    const fileName = name || (blob as any).name || 'blob.dat'
    return new this({
      blob,
      md5,
      name: fileName,
      size: blob.size,
      type: FileBoxType.File,
    })
  }

  /**
   * Creates a FileBox from a WHATWG ReadableStream or stream factory function.
   */
  static fromStream (
    stream: ReadableStream<Uint8Array> | (() => ReadableStream<Uint8Array>) | any,
    name?: string,
    md5?: string,
    options?: { size?: number },
  ): FileBox {
    return new this({
      md5,
      name: name || 'stream.dat',
      size: options?.size,
      stream,
      type: FileBoxType.Stream,
    })
  }

  static fromBase64 (
    base64: string,
    name?: string,
    md5?: string,
  ): FileBox {
    const clean = base64.trim()
    const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0
    const size = Math.max(0, Math.floor(clean.length * 3 / 4) - padding)
    return new this({
      base64: clean,
      md5,
      name: name || 'base64.dat',
      size,
      type: FileBoxType.Base64,
    })
  }

  static fromDataURL (
    dataUrl: string,
    name?: string,
    md5?: string,
  ): FileBox {
    return this.fromBase64(
      dataUrlToBase64(dataUrl),
      name || 'data-url.dat',
      md5,
    )
  }

  static fromQRCode (
    qrCode: string,
    md5?: string,
  ): FileBox {
    return new this({
      md5,
      name: 'qrcode.png',
      qrCode,
      type: FileBoxType.QRCode,
    })
  }

  declare protected static uuidToStream?: UuidLoader
  declare protected static uuidFromStream?: UuidSaver

  static fromUuid (
    uuid: string,
    options?: {
      name?: string
      size?: number
      md5?: string
    },
  ): FileBox

  /**
   * @deprecated use `fromUuid(name, options)` instead
   */
  static fromUuid (
    uuid: string,
    name?: string,
    md5?: string,
  ): FileBox

  static fromUuid (
    uuid: string,
    nameOrOptions?: string | {
      name?: string
      size?: number
      md5?: string
    },
    md5?: string,
  ): FileBox {
    let name: undefined | string
    let size: undefined | number

    if (typeof nameOrOptions === 'object') {
      name = nameOrOptions.name
      size = nameOrOptions.size
      md5 = nameOrOptions.md5
    } else {
      name = nameOrOptions
    }

    return new this({
      md5,
      name: name || `${uuid}.dat`,
      size,
      type: FileBoxType.Uuid,
      uuid,
    })
  }

  static setUuidLoader (loader: UuidLoader): void {
    if (Object.hasOwn(this, 'uuidToStream') && this.uuidToStream) {
      throw new Error('this FileBox has been set resolver before, can not set twice')
    }
    this.uuidToStream = loader
  }

  static setUuidSaver (saver: UuidSaver): void {
    if (Object.hasOwn(this, 'uuidFromStream') && this.uuidFromStream) {
      throw new Error('this FileBox has been set register before, can not set twice')
    }
    this.uuidFromStream = saver
  }

  static fromJSON (obj: FileBoxJsonObject | string): FileBox {
    if (typeof obj === 'string') {
      obj = JSON.parse(obj) as FileBoxJsonObject
    }

    if (!(obj as any).type && 'boxType' in (obj as any)) {
      obj.type = (obj as any)['boxType']
    }

    let fileBox: FileBox

    switch (obj.type) {
      case FileBoxType.Base64:
        fileBox = this.fromBase64(
          obj.base64,
          obj.name,
          obj.md5,
        )
        break

      case FileBoxType.Url:
        fileBox = this.fromUrl(obj.url, {
          md5: obj.md5,
          name: obj.name,
          size: obj.size,
        })
        break

      case FileBoxType.QRCode:
        fileBox = this.fromQRCode(
          obj.qrCode,
          obj.md5,
        )
        break

      case FileBoxType.Uuid:
        fileBox = this.fromUuid(obj.uuid, {
          md5: obj.md5,
          name: obj.name,
          size: obj.size,
        })
        break

      default:
        throw new Error(`unknown filebox json object{type}: ${JSON.stringify(obj)}`)
    }

    if (obj.metadata) {
      (fileBox as FileBox).metadata = obj.metadata
    }

    return fileBox
  }

  readonly version = VERSION

  readonly _type: FileBoxType
  get type () { return this._type }

  _size?: number
  get size (): number {
    if (typeof this._size !== 'undefined') {
      return this._size
    }
    return UNKNOWN_SIZE
  }

  readonly md5: undefined | string

  /**
   * @deprecated: use `mediaType` instead.
   */
  mimeType = 'application/unknown'

  protected _mediaType?: string
  get mediaType (): string {
    if (this._mediaType) {
      return this._mediaType
    }
    return 'application/unknown'
  }

  protected _name: string
  get name (): string {
    return this._name
  }

  protected _metadata?: Metadata
  get metadata (): Metadata {
    if (this._metadata) {
      return this._metadata
    }
    return EMPTY_META_DATA
  }

  set metadata (data: Metadata) {
    if (this._metadata) {
      throw new Error('metadata can not be modified after set')
    }
    this._metadata = { ...data }
    Object.freeze(this._metadata)
  }

  protected readonly base64?: string
  protected readonly remoteUrl?: string
  protected readonly qrCode?: string
  protected readonly uuid?: string
  protected readonly buffer?: Uint8Array
  protected readonly _blob?: Blob
  protected readonly stream?: ReadableStream<Uint8Array> | (() => ReadableStream<Uint8Array>) | any
  protected readonly headers?: any
  protected localPath?: string

  constructor (options: FileBoxOptions) {
    this._name = basename(options.name)
    this._type = options.type
    this._mediaType = mime.getType(this.name) ?? undefined
    this.md5 = options.md5

    switch (options.type) {
      case FileBoxType.Buffer:
        this.buffer = options.buffer
        this._size = options.buffer.byteLength
        break

      case FileBoxType.File:
        if (options.blob) {
          this._blob = options.blob
          this._size = options.blob.size
          this._mediaType = options.blob.type || this._mediaType
        } else if (options.path) {
          this.localPath = options.path
          if (options.size !== undefined) {
            this._size = options.size
          }
        }
        break

      case FileBoxType.Url:
        if (!options.url) {
          throw new Error('no url')
        }
        this.remoteUrl = options.url
        if (options.headers) {
          this.headers = options.headers
        }
        if (options.size !== undefined) {
          this._size = options.size
        }
        break

      case FileBoxType.Stream:
        this.stream = options.stream
        if (options.size !== undefined) {
          this._size = options.size
        }
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
        this._size = Math.max(0, Math.floor(options.base64.length * 3 / 4) - (options.base64.endsWith('==') ? 2 : options.base64.endsWith('=') ? 1 : 0))
        break

      case FileBoxType.Uuid:
        if (!options.uuid) {
          throw new Error('no UUID data')
        }
        this.uuid = options.uuid
        if (options.size !== undefined) {
          this._size = options.size
        }
        break

      default:
        throw new Error(`unknown options(type): ${JSON.stringify(options)}`)
    }
  }

  async ready (): Promise<void> {
    switch (this.type) {
      case FileBoxType.Url:
        await this._syncUrlMetadata()
        break

      case FileBoxType.QRCode:
        if (this.size === UNKNOWN_SIZE) {
          this._size = (await this.toBytes()).byteLength
        }
        break

      default:
        break
    }
  }

  protected async _syncUrlMetadata (): Promise<void> {
    if (this.type !== FileBoxType.Url) {
      throw new Error('type is not Url')
    }
    if (!this.remoteUrl) {
      throw new Error('no url')
    }

    const headers = await fetchHeadHeader(this.remoteUrl, this.headers)

    const httpFilename = httpHeaderToFileName(headers)
    if (httpFilename) {
      this._name = httpFilename
    }

    if (!this.name) {
      throw new Error('NONAME')
    }

    const httpMediaType = headers['content-type'] || (httpFilename && mime.getType(httpFilename))
    if (httpMediaType) {
      this._mediaType = httpMediaType
    }

    const contentEncoding = headers['content-encoding']
    if (headers['content-length']) {
      if (!contentEncoding || contentEncoding === 'identity') {
        this._size = Number(headers['content-length'])
      }
    }
  }

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
      md5: this.md5,
      metadata: this.metadata,
      name: this.name,
    }

    if (typeof this.size !== 'undefined') {
      objCommon.size = this.size
    }

    let obj: FileBoxJsonObject

    switch (this.type) {
      case FileBoxType.Url: {
        if (!this.remoteUrl) {
          throw new Error('no url')
        }
        const objUrl: FileBoxOptionsUrl = {
          headers: this.headers,
          type: FileBoxType.Url,
          url: this.remoteUrl,
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
          qrCode: this.qrCode,
          type: FileBoxType.QRCode,
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
          base64: this.base64,
          type: FileBoxType.Base64,
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
          type: FileBoxType.Uuid,
          uuid: this.uuid,
        }
        obj = {
          ...objCommon,
          ...objUuid,
        }
        break
      }

      default:
        throw new Error('FileBox.toJSON() can only work on limited FileBoxType(s). See: <https://github.com/huan/file-box/issues/25>')
    }

    (obj as any)['boxType'] = obj.type
    return obj
  }

  async toReadableStream (): Promise<ReadableStream<Uint8Array>> {
    switch (this.type) {
      case FileBoxType.Buffer:
        if (!this.buffer) {
          throw new Error('no buffer!')
        }
        return new Blob([this.buffer as any]).stream()

      case FileBoxType.File:
        return this._transformFileToStream()

      case FileBoxType.Url:
        return this._transformUrlToStream()

      case FileBoxType.Stream: {
        if (!this.stream) {
          throw new Error('no stream')
        }
        if (typeof this.stream === 'function') {
          return this.stream()
        }
        const stream = this.stream as any
        if (typeof stream.getReader === 'function') {
          if (stream.locked) {
            throw new Error('The stream is not readable. Maybe has already been consumed, and now it was drained. See: https://github.com/huan/file-box/issues/50')
          }
          return stream as ReadableStream<Uint8Array>
        }
        if (stream.readable === false || stream.destroyed) {
          throw new Error('The stream is not readable. Maybe has already been consumed, and now it was drained. See: https://github.com/huan/file-box/issues/50')
        }
        return nodeStreamToWebStream(stream)
      }

      case FileBoxType.QRCode:
        if (!this.qrCode) {
          throw new Error('no QR Code')
        }
        return qrValueToReadableStream(this.qrCode)

      case FileBoxType.Base64: {
        if (!this.base64) {
          throw new Error('no base64 data')
        }
        const bytes = base64ToBytes(this.base64)
        return new Blob([bytes as any]).stream()
      }

      case FileBoxType.Uuid: {
        if (!this.uuid) {
          throw new Error('no uuid data')
        }
        const FileBoxKlass = instanceToClass(this, FileBox)
        if (!FileBoxKlass.uuidToStream) {
          throw new Error('need to call FileBox.setUuidLoader() to set UUID loader first.')
        }
        const streamResult = await FileBoxKlass.uuidToStream.call(this, this.uuid)
        if (streamResult && typeof (streamResult as any).getReader === 'function') {
          return streamResult as ReadableStream<Uint8Array>
        }
        if (streamResult && typeof (streamResult as any).pipe === 'function') {
          return nodeStreamToWebStream(streamResult)
        }
        throw new Error('UUID loader must return a ReadableStream or Readable')
      }

      default:
        throw new Error('not supported FileBoxType: ' + FileBoxType[this.type])
    }
  }

  async pipeTo (
    destination: WritableStream<Uint8Array>,
    options?: StreamPipeOptions,
  ): Promise<void> {
    const stream = await this.toReadableStream()
    await stream.pipeTo(destination, options)
  }

  async toBytes (): Promise<Uint8Array> {
    if (this.type === FileBoxType.Buffer && this.buffer) {
      return this.buffer
    }
    if (this.type === FileBoxType.Base64 && this.base64) {
      return base64ToBytes(this.base64)
    }
    if (this._blob) {
      return new Uint8Array(await this._blob.arrayBuffer())
    }
    const stream = await this.toReadableStream()
    return streamToBytes(stream)
  }

  async toBlob (): Promise<Blob> {
    if (this._blob) {
      return this._blob
    }
    const bytes = await this.toBytes()
    return new Blob([bytes as any], { type: this.mediaType })
  }

  async toBase64 (): Promise<string> {
    if (this.type === FileBoxType.Base64) {
      if (!this.base64) {
        throw new Error('no base64 data')
      }
      return this.base64
    }
    const bytes = await this.toBytes()
    return bytesToBase64(bytes)
  }

  async toDataURL (): Promise<string> {
    const base64Text = await this.toBase64()
    const mediaType = this.mediaType || 'application/octet-stream'
    return `data:${mediaType};base64,${base64Text}`
  }

  async toQRCode (): Promise<string> {
    if (this.type === FileBoxType.QRCode) {
      if (!this.qrCode) {
        throw new Error('no QR Code!')
      }
      return this.qrCode
    }
    const bytes = await this.toBytes()
    return bufferToQrValue(bytes)
  }

  async toUuid (): Promise<string> {
    if (this.type === FileBoxType.Uuid) {
      if (!this.uuid) {
        throw new Error('no uuid found for a UUID type file box!')
      }
      return this.uuid
    }

    const FileBoxKlass = instanceToClass(this, FileBox)
    if (!FileBoxKlass.uuidFromStream) {
      throw new Error('need to use FileBox.setUuidSaver() before dealing with UUID')
    }

    const stream = await this.toReadableStream()
    return FileBoxKlass.uuidFromStream.call(this, stream)
  }

  async toBuffer (): Promise<any> {
    const bytes = await this.toBytes()
    if (typeof (globalThis as any).Buffer !== 'undefined') {
      return (globalThis as any).Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    }
    return bytes
  }

  async toStream (): Promise<any> {
    throw new Error('FileBox.toStream() requires Node.js streams. For universal WHATWG streams, use toReadableStream(). For Node.js streams, import { FileBox } from "file-box/server".')
  }

  pipe<T> (_destination: T, _options?: { end?: boolean }): T {
    throw new Error('FileBox.pipe() requires Node.js streams. For universal WHATWG streams, use pipeTo(). For Node.js streams, import { FileBox } from "file-box/server".')
  }

  async toFile (_filePath?: string, _overwrite = false): Promise<void> {
    throw new Error('FileBox.toFile() requires native filesystem access. In browser and edge runtimes, use toBlob() or toBytes(). For Node.js filesystem access, import { FileBox } from "file-box/server".')
  }

  protected _transformFileToStream (): Promise<ReadableStream<Uint8Array>> | ReadableStream<Uint8Array> {
    if (this._blob) {
      return this._blob.stream()
    }
    throw new Error('Local filesystem streaming requires "file-box/server". In browser/edge runtimes, pass a Web Blob or File to fromFile().')
  }

  private async _transformUrlToStream (): Promise<ReadableStream<Uint8Array>> {
    if (!this.remoteUrl) {
      throw new Error('no url')
    }
    return fetchStream(this.remoteUrl, this.headers)
  }

}

interfaceOfFileBox = interfaceOfClass(FileBox)<FileBoxInterface>()
looseInstanceOfFileBox = looseInstanceOfClass(FileBox)

export default FileBox
