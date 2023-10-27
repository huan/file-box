import assert from 'assert'
import { randomUUID } from 'crypto'
import { once } from 'events'
import { createReadStream, createWriteStream } from 'fs'
import { rm } from 'fs/promises'
import http from 'http'
import https from 'https'
import { tmpdir } from 'os'
import { join } from 'path'
import type { Readable } from 'stream'
import { URL } from 'url'

import { HTTP_CHUNK_SIZE, HTTP_TIMEOUT, NO_SLICE_DOWN } from './config.js'

const protocolMap: {
  [key: string]: { request: typeof http.request; agent: http.Agent }
} = {
  'http:': { request: http.request, agent: http.globalAgent },
  'https:': { request: https.request, agent: https.globalAgent },
}

function getProtocol(protocol: string) {
  assert(protocolMap[protocol], new Error('unknown protocol: ' + protocol))
  return protocolMap[protocol]!
}

export function dataUrlToBase64(dataUrl: string): string {
  const dataList = dataUrl.split(',')
  return dataList[dataList.length - 1]!
}

/**
 * Get http headers for specific `url`
 * follow 302 redirection for max `REDIRECT_TTL` times.
 *
 * @credit https://stackoverflow.com/a/43632171/1123955
 */
export async function httpHeadHeader(url: string): Promise<http.IncomingHttpHeaders> {
  const originUrl = url
  let REDIRECT_TTL = 7

  while (true) {
    if (REDIRECT_TTL-- <= 0) {
      throw new Error(`ttl expired! too many(>${REDIRECT_TTL}) 302 redirection.`)
    }

    const res = await _headHeader(url)

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

  async function _headHeader(destUrl: string): Promise<http.IncomingMessage> {
    const parsedUrl = new URL(destUrl)
    const options = {
      method: 'HEAD',
      // method   : 'GET',
    }

    let request: typeof http.request

    if (parsedUrl.protocol === 'https:') {
      request = https.request
    } else if (parsedUrl.protocol === 'http:') {
      request = http.request
    } else {
      throw new Error('unknown protocol: ' + parsedUrl.protocol)
    }

    return new Promise<http.IncomingMessage>((resolve, reject) => {
      let res: undefined | http.IncomingMessage
      const req = request(parsedUrl, options, (response) => {
        res = response
        resolve(res)
      })
        .on('error', reject)
        .setTimeout(HTTP_TIMEOUT, () => {
          const e = new Error(`FileBox: Http request timeout (${HTTP_TIMEOUT})!`)
          req.emit('error', e)
          req.destroy()
        })
        .end()
    })
  }
}

export function httpHeaderToFileName(headers: http.IncomingHttpHeaders): null | string {
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

export async function httpStream(url: string, headers: http.OutgoingHttpHeaders = {}): Promise<Readable> {
  const headHeaders = await httpHeadHeader(url)
  if (headHeaders.location) {
    url = headHeaders.location
  }

  const parsedUrl = new URL(url)

  const { request, agent } = getProtocol(parsedUrl.protocol)
  const options: http.RequestOptions = {
    method: 'GET',
    agent,
    headers: { ...headers },
  }

  const fileSize = Number(headHeaders['content-length'])

  if (!NO_SLICE_DOWN && headHeaders['accept-ranges'] === 'bytes' && fileSize > HTTP_CHUNK_SIZE) {
    return await downloadFileInChunks(request, url, options, fileSize, HTTP_CHUNK_SIZE)
  } else {
    return await downloadFile(request, url, options)
  }
}

async function downloadFile(
  request: typeof https.request,
  url: string,
  options: http.RequestOptions
): Promise<http.IncomingMessage> {
  const req = request(url, options)
    .setTimeout(HTTP_TIMEOUT)
    .once('timeout', () => {
      req.destroy(new Error(`FileBox: Http request timeout (${HTTP_TIMEOUT})!`))
    })
    .end()
  const [res] = (await once(req, 'response')) as [http.IncomingMessage]
  return res
}

async function downloadFileInChunks(
  request: typeof https.request,
  url: string,
  options: http.RequestOptions,
  fileSize: number,
  chunkSize = HTTP_CHUNK_SIZE
): Promise<Readable> {
  const tmpFile = join(tmpdir(), `filebox-${randomUUID()}`)
  const writeStream = createWriteStream(tmpFile)
  const allowStatusCode = [200, 206]
  const ac = new AbortController()
  const requestBaseOptions: http.RequestOptions = {
    headers: {},
    ...options,
    signal: ac.signal,
    timeout: HTTP_TIMEOUT,
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
      const res = await downloadFile(request, url, options)
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
        void rm(tmpFile, { force: true, maxRetries: 5 })
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
      void rm(tmpFile, { force: true, maxRetries: 5 })
    })
  return readStream
}

export async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const bufferList: Buffer[] = []
    stream.once('error', reject)
    stream.once('end', () => {
      const fullBuffer = Buffer.concat(bufferList)
      resolve(fullBuffer)
    })
    stream.on('data', (buffer) => bufferList.push(buffer))
  })
}
