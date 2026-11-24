/**
 * Miscellaneous HTTP, Stream, and URL utilities supporting FileBox operations.
 */
import * as http from 'node:http'
import * as https from 'node:https'
import * as nodeUrl from 'node:url'
import type * as stream from 'node:stream'

export { dataUrlToBase64, httpHeaderToFileName } from './pure-functions/file-metadata.ts'

/**
 * Get http headers for specific `url` following HTTP 302 redirections.
 *
 * @param url Remote target URL
 * @returns HTTP response headers
 */
export async function httpHeadHeader (url: string): Promise<http.IncomingHttpHeaders> {
  let REDIRECT_TTL = 7

  while (true) {
    if (REDIRECT_TTL-- <= 0) {
      throw new Error(`ttl expired! too many(>${REDIRECT_TTL}) 302 redirection.`)
    }

    const res = await _headHeader(url)

    if (!/^3/.test(String(res.statusCode))) {
      return res.headers
    }

    if (!res.headers.location) {
      throw new Error('302 found but no location!')
    }

    url = res.headers.location
  }

  async function _headHeader (destUrl: string): Promise<http.IncomingMessage> {
    const parsedUrl = nodeUrl.parse(destUrl)
    const options: https.RequestOptions = {
      ...parsedUrl,
      headers: {
        Connection: 'close',
      },
      method: 'HEAD',
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
      request(options, resolve)
        .on('error', reject)
        .end()
    })
  }
}

/**
 * Creates an HTTP GET stream from a remote URL.
 *
 * @param url Remote resource URL
 * @param headers Optional request headers
 * @returns Readable HTTP incoming message stream
 */
export async function httpStream (
  url: string,
  headers: http.OutgoingHttpHeaders = {},
): Promise<http.IncomingMessage> {
  const parsedUrl = nodeUrl.parse(url)
  const protocol = parsedUrl.protocol

  let options: http.RequestOptions
  let get: typeof https.get

  if (!protocol) {
    throw new Error('protocol is empty')
  }

  if (protocol.match(/^https:/i)) {
    get = https.get
    options = parsedUrl
    options.agent = https.globalAgent
  } else if (protocol.match(/^http:/i)) {
    get = http.get
    options = parsedUrl
    options.agent = http.globalAgent
  } else {
    throw new Error('protocol unknown: ' + protocol)
  }

  options.headers = {
    Connection: 'close',
    ...options.headers,
    ...headers,
  }

  const res = await new Promise<http.IncomingMessage>((resolve, reject) => {
    get(options, resolve)
      .on('error', reject)
      .end()
  })
  return res
}

/**
 * Consumes a Node.js readable stream into an in-memory Buffer.
 *
 * @param stream Readable stream to consume
 * @returns Resolves with concatenated Buffer
 */
export async function streamToBuffer (
  stream: stream.Readable,
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const bufferList: Buffer[] = []
    stream.once('error', reject)
    stream.once('end', () => {
      const fullBuffer = Buffer.concat(bufferList)
      resolve(fullBuffer)
    })
    stream.on('data', buffer => bufferList.push(buffer))
  })
}
