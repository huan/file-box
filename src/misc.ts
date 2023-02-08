import http    from 'http'
import https   from 'https'
import { URL } from 'url'
import type stream   from 'stream'

import { HTTP_TIMEOUT } from './config.js'

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

  let REDIRECT_TTL = 7

  while (true) {
    if (REDIRECT_TTL-- <= 0) {
      throw new Error(`ttl expired! too many(>${REDIRECT_TTL}) 302 redirection.`)
    }

    const res = await _headHeader(url)

    if (!/^3/.test(String(res.statusCode))) {
      return res.headers
    }

    // console.log('302 found for ' + url)

    if (!res.headers.location) {
      throw new Error('302 found but no location!')
    }

    url = res.headers.location
  }

  async function _headHeader (destUrl: string): Promise<http.IncomingMessage> {
    const parsedUrl = new URL(destUrl)
    const options = {
      method   : 'HEAD',
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
        .once('error', reject)
        .setTimeout(HTTP_TIMEOUT, () => {
          const e = new Error(`FileBox: Http request timeout (${HTTP_TIMEOUT})!`)
          if (res) {
            res.emit('error', e)
          } else {
            req.emit('error', e)
          }
        })
        .end()
    })
  }
}

export function httpHeaderToFileName (
  headers: http.IncomingHttpHeaders,
): null | string {
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

export async function httpStream (
  url     : string,
  headers : http.OutgoingHttpHeaders = {},
): Promise<http.IncomingMessage> {
  const parsedUrl = new URL(url)

  const protocol  = parsedUrl.protocol

  const options: http.RequestOptions = {}

  let get: typeof https.get

  if (!protocol) {
    throw new Error('protocol is empty')
  }

  if (protocol.match(/^https:/i)) {
    get           = https.get
    options.agent = https.globalAgent
  } else if (protocol.match(/^http:/i)) {
    get           = http.get
    options.agent = http.globalAgent
  } else {
    throw new Error('protocol unknown: ' + protocol)
  }

  options.headers = {
    ...headers,
  }

  return new Promise<http.IncomingMessage>((resolve, reject) => {
    let res: http.IncomingMessage | null = null
    const req = get(parsedUrl, options, (response) => {
      res = response
      resolve(res)
    })
      .once('error', reject)
      .setTimeout(HTTP_TIMEOUT, () => {
        const e = new Error(`FileBox: Http request timeout (${HTTP_TIMEOUT})!`)
        if (res) {
          res.emit('error', e)
        }
        req.emit('error', e)
        req.destroy()
      })
      .end()
  })
}

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
