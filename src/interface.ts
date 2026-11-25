/**
 * Interface and constructor type definitions for FileBox instances.
 */
import type {
  Constructor,
} from 'clone-class'
import type {
  FileBox,
} from './file-box.ts'

interface FileBoxInterface {
  type: FileBox['type']
  name: FileBox['name']
  size: FileBox['size']
  md5: FileBox['md5']
  mediaType: FileBox['mediaType']
  metadata: FileBox['metadata']

  toBase64: FileBox['toBase64']
  toBuffer: FileBox['toBuffer']
  toDataURL: FileBox['toDataURL']
  toFile: FileBox['toFile']
  toJSON: FileBox['toJSON']
  toQRCode: FileBox['toQRCode']
  toStream: FileBox['toStream']
  toReadableStream: FileBox['toReadableStream']
  toUuid: FileBox['toUuid']
  toBytes: FileBox['toBytes']
  toBlob: FileBox['toBlob']

  pipe: FileBox['pipe']
  pipeTo: FileBox['pipeTo']
}

type FileBoxConstructor = Constructor<FileBoxInterface>

export type {
  FileBoxInterface,
  FileBoxConstructor,
}
