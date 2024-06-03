/// <reference path="./typings.d.ts" />
export { VERSION } from './version.js'

export const HTTP_REQUEST_TIMEOUT = Number(process.env['FILEBOX_HTTP_REQUEST_TIMEOUT'])
  || 10 * 1000

export const HTTP_RESPONSE_TIMEOUT = Number(process.env['FILEBOX_HTTP_RESPONSE_TIMEOUT'] ?? process.env['FILEBOX_HTTP_TIMEOUT'])
  || 60 * 1000

export const NO_SLICE_DOWN = process.env['FILEBOX_NO_SLICE_DOWN'] === 'true'

export const HTTP_CHUNK_SIZE = Number(process.env['FILEBOX_HTTP_CHUNK_SIZE'])
  || 1024 * 512

export const PROXY_TYPE = process.env['FILEBOX_PROXY_TYPE']
export const PROXY_HOST = process.env['FILEBOX_PROXY_HOST'] || ''
export const PROXY_PORT = Number(process.env['FILEBOX_PROXY_PORT']) || 0
export const PROXY_USERNAME = process.env['FILEBOX_PROXY_USERNAME'] || ''
export const PROXY_PASSWORD = process.env['FILEBOX_PROXY_PASSWORD'] || ''
