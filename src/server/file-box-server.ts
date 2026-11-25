/**
 * Server-extended FileBox with native OS capabilities.
 *
 * Subclasses the universal WinterTC FileBox to provide native filesystem access
 * (`toFile`, `fromFile`) and legacy Node.js stream bridges (`toStream`, `toBuffer`,
 * `pipe`). Preserves identical class identity across client and server environments.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import { FileBox as UniversalFileBox } from '../file-box.ts'
import { FileBoxType } from '../file-box.type.ts'
import type { FileBoxInterface } from '../interface.ts'

export class FileBox extends UniversalFileBox {

  static override [Symbol.hasInstance] (target: any): target is FileBox {
    return Object.prototype.isPrototypeOf.call(this.prototype, target)
  }

  /**
   * Loads a file from the native filesystem or a Web Blob/File.
   *
   * @param fileOrPath - File path string or Web Blob/File.
   * @param name - Optional file name override.
   * @param md5 - Optional MD5 checksum.
   */
  static override fromFile (
    fileOrPath: string | Blob,
    name?: string,
    md5?: string,
  ): FileBox {
    if (typeof fileOrPath === 'string') {
      const resolved = path.resolve(fileOrPath)
      const fileName = name || path.basename(resolved)
      const stats = fs.statSync(resolved)
      const box = new this({
        md5,
        name: fileName,
        path: resolved,
        size: stats.size,
        type: FileBoxType.File,
      })
      ;(box as FileBox).localPath = resolved
      return box
    }
    return super.fromFile(fileOrPath, name, md5) as FileBox
  }

  /**
   * Creates a server FileBox from any FileBoxInterface instance.
   * If the box is already a server FileBox, returns it directly.
   * Otherwise, promotes it to a server FileBox with native OS capabilities.
   *
   * @param box Source FileBoxInterface instance
   */
  static override fromBox (box: FileBoxInterface): FileBox {
    return super.fromBox(box) as FileBox
  }

  protected override _transformFileToStream (): ReadableStream<Uint8Array> {
    if (this.localPath) {
      const nodeStream = fs.createReadStream(this.localPath)
      return Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>
    }
    return super._transformFileToStream() as ReadableStream<Uint8Array>
  }

  /**
   * Writes file contents to the native filesystem.
   *
   * @param filePath - Destination file path (defaults to this.name in current working directory).
   * @param overwrite - Whether to overwrite an existing file (defaults to false).
   */
  override async toFile (
    filePath?: string,
    overwrite = false,
  ): Promise<void> {
    if (this.type === FileBoxType.Url) {
      if (!this._mediaType || this.mediaType === 'application/unknown') {
        await this._syncUrlMetadata()
      }
    }
    const fullPath = path.resolve(filePath || this.name)
    const exists = fs.existsSync(fullPath)
    if (exists && !overwrite) {
      throw new Error(`FileBox.toFile(${fullPath}): file exists. Pass overwrite=true to force overwrite.`)
    }

    const writeStream = fs.createWriteStream(fullPath, { flags: overwrite ? 'w' : 'wx' })
    try {
      const webStream = await this.toReadableStream()
      const source = typeof (webStream as any).pipeTo === 'function'
        ? Readable.fromWeb(webStream as any)
        : (webStream as unknown as Readable)
      await pipeline(source, writeStream)
    } catch (error) {
      await fs.promises.rm(fullPath, { force: true }).catch(() => undefined)
      throw error
    }
  }

  /**
   * Returns a Node.js Readable stream representation.
   */
  override async toStream (): Promise<Readable> {
    if (this.localPath) {
      return fs.createReadStream(this.localPath)
    }
    const webStream = await this.toReadableStream()
    if (typeof Readable.fromWeb === 'function') {
      return Readable.fromWeb(webStream as any)
    }
    return webStream as any
  }

  /**
   * Pipes file content to a Node.js Writable stream.
   */
  override pipe<T> (
    destination: T,
    options?: { end?: boolean },
  ): T {
    this.toStream()
      .then(stream => {
        stream.on('error', (err: any) => (destination as any).emit?.('error', err))
        return stream.pipe(destination as any, options)
      })
      .catch(err => (destination as any).emit?.('error', err))
    return destination
  }

  /**
   * Returns a Node.js Buffer representation.
   */
  override async toBuffer (): Promise<Buffer> {
    const bytes = await this.toBytes()
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }

}

export default FileBox
