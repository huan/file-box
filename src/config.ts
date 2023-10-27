/// <reference path="./typings.d.ts" />
export { VERSION } from './version.js'

export const HTTP_TIMEOUT = Number(process.env['FILEBOX_HTTP_TIMEOUT'])
  || 60 * 1000

export const NO_SLICE_DOWN = process.env['FILEBOX_NO_SLICE_DOWN'] === 'true'

export const HTTP_CHUNK_SIZE = Number(process.env['FILEBOX_HTTP_CHUNK_SIZE'])
  || 1024 * 512
