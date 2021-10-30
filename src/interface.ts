import type {
  Readable,
  Writable,
}                       from 'stream'
import type {
  Constructor,
}                       from 'clone-class'
import type {
  FileBoxJsonObject,
  FileBoxType,
}                       from './file-box.type'

interface FileBoxInterface {
  type: FileBoxType
  name: string
  size: number

  // version: any
  // metadata: any
  // ready: any
  // syncRemote: any
  // transformBufferToStream: any
  // transformBase64ToStream: any
  // transformFileToStream: any
  // ransformUrlToStream: any
  // transformQRCodeToStream: any
  // transformUrlToStream: any

  toBase64  () : Promise<string>
  toBuffer  () : Promise<Buffer>
  toDataURL () : Promise<string>
  toFile    () : Promise<void>
  toJSON    () : FileBoxJsonObject
  toQRCode  () : Promise<string>
  toStream  () : Promise<Readable>
  toUuid    () : Promise<string>

  pipe<T extends Writable> (
    destination: T,
  ): T
}

/**
 * Huan(202110): TODO support static methods after TypeScript 4.5: fromXXX()
 */
type FileBoxConstructor = Constructor<FileBoxInterface>

export type {
  FileBoxInterface,
  FileBoxConstructor,
}
