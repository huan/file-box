import http    from 'http'
import https   from 'https'
import { URL } from 'url'

import { PassThrough, pipeline, Readable } from 'stream'

import { HTTP_CHUNK_SIZE, HTTP_TIMEOUT } from './config.js'

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
): Promise<Readable> {
  const parsedUrl = new URL(url)

  const protocol = parsedUrl.protocol

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

  const headHeaders = await httpHeadHeader(url)
  const fileSize    = Number(headHeaders['content-length'])

  if (headHeaders['accept-ranges'] === 'bytes' && fileSize > HTTP_CHUNK_SIZE) {
    return await downloadFileInChunks(get, url, options, fileSize, HTTP_CHUNK_SIZE)
  } else {
    return await downloadFile(get, url, options)
  }
}

async function downloadFile (
  get: typeof https.get,
  url: string,
  options: http.RequestOptions,
): Promise<Readable> {
  return new Promise<Readable>((resolve, reject) => {
    let res: http.IncomingMessage | null = null
    const req = get(url, options, (response) => {
      res = response
      resolve(res)
    })

    req
      .on('error', reject)
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

async function downloadFileInChunks (
  get: typeof https.get,
  url: string,
  options: http.RequestOptions,
  fileSize: number,
  chunkSize = HTTP_CHUNK_SIZE,
): Promise<Readable> {
  const ac = new AbortController()
  const stream = new PassThrough()

  const abortAc = () => {
    if (!ac.signal.aborted) {
      ac.abort()
    }
  }

  stream
    .once('close', abortAc)
    .once('error', abortAc)

  const chunksCount = Math.ceil(fileSize / chunkSize)
  let chunksDownloaded = 0
  let dataTotalSize = 0

  const doDownloadChunk = async function (i: number, retries: number) {
    const start = i * chunkSize
    const end = Math.min((i + 1) * chunkSize - 1, fileSize - 1)
    const range = `bytes=${start}-${end}`

    // console.info('doDownloadChunk() range:', range)

    if (ac.signal.aborted) {
      stream.destroy(new Error('Signal aborted.'))
      return
    }

    const requestOptions: http.RequestOptions = {
      ...options,
      signal: ac.signal,
      timeout: HTTP_TIMEOUT,
    }
    if (!requestOptions.headers) {
      requestOptions.headers = {}
    }
    requestOptions.headers['Range'] = range

    try {
      const chunk = await downloadChunk(get, url, requestOptions, retries)
      if (chunk.errored) {
        throw new Error('chunk stream error')
      }
      if (chunk.closed) {
        throw new Error('chunk stream closed')
      }
      if (chunk.destroyed) {
        throw new Error('chunk stream destroyed')
      }
      const buf = await streamToBuffer(chunk)
      stream.push(buf)
      chunksDownloaded++
      dataTotalSize += buf.length

      if (chunksDownloaded === chunksCount || dataTotalSize >= fileSize) {
        stream.push(null)
      }
    } catch (err) {
      if (retries === 0) {
        stream.emit('error', err)
      } else {
        await doDownloadChunk(i, retries - 1)
      }
    }
  }

  const doDownloadAllChunks = async function () {
    for (let i = 0; i < chunksCount; i++) {
      if (ac.signal.aborted) {
        return
      }
      await doDownloadChunk(i, 3)
    }
  }

  void doDownloadAllChunks().catch((e) => {
    stream.emit('error', e)
  })

  return stream
}

async function downloadChunk (
  get: typeof https.get,
  url: string,
  requestOptions: http.RequestOptions,
  retries: number,
): Promise<Readable> {
  return new Promise<Readable>((resolve, reject) => {
    const doRequest = (attempt: number) => {
      let resolved = false
      const req = get(url, requestOptions, (res) => {
        const statusCode = res.statusCode ?? 0
        // console.info('downloadChunk(%d) statusCode: %d rsp.headers: %o', attempt, statusCode, res.headers)

        if (statusCode < 200 || statusCode >= 300) {
          if (attempt < retries) {
            void doRequest(attempt + 1)
          } else {
            reject(new Error(`Request failed with status code ${res.statusCode}`))
          }
          return
        }

        const stream = pipeline(res, new PassThrough(), () => {})
        resolve(stream)
        resolved = true
      })

      req
        .once('error', (err) => {
          if (resolved) {
            return
          }
          // console.error('downloadChunk(%d) req error:', attempt, err)
          if (attempt < retries) {
            void doRequest(attempt + 1)
          } else {
            reject(err)
          }
        })
        .setTimeout(HTTP_TIMEOUT, () => {
          const e = new Error(`FileBox: Http request timeout (${HTTP_TIMEOUT})!`)
          req.emit('error', e)
          req.destroy()
        })
        .end()
    }
    void doRequest(0)
  })
}

export async function streamToBuffer (stream: Readable): Promise<Buffer> {
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
