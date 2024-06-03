import assert from 'assert'
import { randomUUID } from 'crypto'
import { once } from 'events'
import { createReadStream, createWriteStream } from 'fs'
import { rm } from 'fs/promises'
import http, { RequestOptions } from 'http'
import https from 'https'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { tmpdir } from 'os'
import { join } from 'path'
import type { Readable } from 'stream'
import { URL } from 'url'

import {
  HTTP_CHUNK_SIZE,
  HTTP_REQUEST_TIMEOUT,
  HTTP_RESPONSE_TIMEOUT,
  NO_SLICE_DOWN,
  PROXY_HOST,
  PROXY_PASSWORD,
  PROXY_PORT,
  PROXY_TYPE,
  PROXY_USERNAME,
} from './config.js'

const protocolMap: {
  [key: string]: { agent: http.Agent; request: typeof http.request }
} = {
  'http:': { agent: http.globalAgent, request: http.request },
  'https:': { agent: https.globalAgent, request: https.request },
}

function getProtocol (protocol: string) {
  assert(protocolMap[protocol], new Error('unknown protocol: ' + protocol))
  return protocolMap[protocol]!
}

export function dataUrlToBase64 (dataUrl: string): string {
  const dataList = dataUrl.split(',')
  return dataList[dataList.length - 1]!
}

/**
 * Get http headers for specific `url`
 * follow 302 redirection for max `REDIRECT_TTL` times.
 *
 * @credit https://stackoverflow.com/a/43632171/1123955
 */
export async function httpHeadHeader (url: string): Promise<http.IncomingHttpHeaders> {
  const originUrl = url
  let REDIRECT_TTL = 7

  while (true) {
    if (REDIRECT_TTL-- <= 0) {
      throw new Error(`ttl expired! too many(>${REDIRECT_TTL}) 302 redirection.`)
    }

    const res = await fetch(url, {
      method: 'HEAD',
    })
    res.destroy()

    if (!/^3/.test(String(res.statusCode))) {
      if (originUrl !== url) {
        res.headers.location = url
      }
      return res.headers
    }

    // console.log('302 found for ' + url)

    if (!res.headers.location) {
      throw new Error('302 found but no location!')
    }

    url = res.headers.location
  }
}

export function httpHeaderToFileName (headers: http.IncomingHttpHeaders): null | string {
  const contentDisposition = headers['content-disposition']

  if (!contentDisposition) {
    return null
  }

  // 'content-disposition': 'attachment; filename=db-0.0.19.zip'
  const matches = contentDisposition.match(/attachment; filename="?(.+[^"])"?$/i)

  if (matches && matches[1]) {
    return matches[1]
  }

  return null
}

export async function httpStream (url: string, headers: http.OutgoingHttpHeaders = {}): Promise<Readable> {
  const headHeaders = await httpHeadHeader(url)
  if (headHeaders.location) {
    url = headHeaders.location
    const { protocol } = new URL(url)
    getProtocol(protocol)
  }

  const options: http.RequestOptions = {
    headers: { ...headers },
    method: 'GET',
  }

  const fileSize = Number(headHeaders['content-length'])

  if (!NO_SLICE_DOWN && headHeaders['accept-ranges'] === 'bytes' && fileSize > HTTP_CHUNK_SIZE) {
    return await downloadFileInChunks(url, options, fileSize, HTTP_CHUNK_SIZE)
  } else {
    return await fetch(url, options)
  }
}

async function fetch (url: string, options: http.RequestOptions): Promise<http.IncomingMessage> {
  const { protocol } = new URL(url)
  const { request, agent } = getProtocol(protocol)
  const opts: http.RequestOptions = {
    agent,
    ...options,
  }
  setProxy(opts)
  const req = request(url, opts).end()
  req
    .on('error', () => {
      req.destroy()
    })
    .setTimeout(HTTP_REQUEST_TIMEOUT, () => {
      req.emit('error', new Error(`FileBox: Http request timeout (${HTTP_REQUEST_TIMEOUT})!`))
    })
  const responseEvents = await once(req, 'response')
  const res = responseEvents[0] as http.IncomingMessage
  res
    .on('error', () => {
      res.destroy()
    })
    .setTimeout(HTTP_RESPONSE_TIMEOUT, () => {
      res.emit('error', new Error(`FileBox: Http response timeout (${HTTP_RESPONSE_TIMEOUT})!`))
    })
  return res
}

async function downloadFileInChunks (
  url: string,
  options: http.RequestOptions,
  fileSize: number,
  chunkSize = HTTP_CHUNK_SIZE,
): Promise<Readable> {
  const tmpFile = join(tmpdir(), `filebox-${randomUUID()}`)
  const writeStream = createWriteStream(tmpFile)
  const allowStatusCode = [ 200, 206 ]
  const requestBaseOptions: http.RequestOptions = {
    headers: {},
    ...options,
  }
  let chunkSeq = 0
  let start = 0
  let end = 0
  let downSize = 0
  let retries = 3

  while (downSize < fileSize) {
    end = Math.min(start + chunkSize, fileSize - 1)
    const range = `bytes=${start}-${end}`
    const requestOptions = Object.assign({}, requestBaseOptions)
    assert(requestOptions.headers, 'Errors that should not happen: Invalid headers')
    requestOptions.headers['Range'] = range

    try {
      const res = await fetch(url, requestOptions)
      assert(allowStatusCode.includes(res.statusCode ?? 0), `Request failed with status code ${res.statusCode}`)
      assert(Number(res.headers['content-length']) > 0, 'Server returned 0 bytes of data')
      for await (const chunk of res) {
        assert(Buffer.isBuffer(chunk))
        downSize += chunk.length
        writeStream.write(chunk)
      }
      res.destroy()
    } catch (error) {
      const err = error as Error
      if (--retries <= 0) {
        void rm(tmpFile, { force: true })
        writeStream.close()
        throw new Error(`Download file with chunk failed! ${err.message}`, { cause: err })
      }
    }
    chunkSeq++
    start = downSize
  }
  writeStream.close()

  const readStream = createReadStream(tmpFile)
  readStream
    .once('end', () => readStream.close())
    .once('close', () => {
      void rm(tmpFile, { force: true })
    })
  return readStream
}

export async function streamToBuffer (stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

function getProxyUrl () {
  const proxyType = PROXY_TYPE
  const proxyHost = PROXY_HOST
  const proxyPort = PROXY_PORT
  const proxyUsername = PROXY_USERNAME
  const proxyPassword = PROXY_PASSWORD
  if (proxyType === 'http') {
    return `http://${proxyUsername}:${proxyPassword}@${proxyHost}:${proxyPort}`
  }
  return ''
}

function setProxy (options: RequestOptions): void {
  const url = getProxyUrl()
  if (url) {
    const agent = new HttpsProxyAgent(url)
    options.agent = agent
  }
}
