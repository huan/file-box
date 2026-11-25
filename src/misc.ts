/**
 * Miscellaneous HTTP, Stream, and String utilities supporting FileBox operations.
 *
 * Fully universal and compliant with WinterTC specifications with zero native runtime imports.
 */
export { dataUrlToBase64, httpHeaderToFileName } from './pure-functions/file-metadata.ts'

/**
 * Strips directory and path prefixes from a file path or URL to return its basename.
 * Works uniformly across Unix, Windows, and URL pathname formats.
 *
 * @param filePath Path or URL string
 * @returns Basename portion of the input string
 */
export function basename (filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/')
  return parts.filter(Boolean).pop() || filePath
}

/**
 * Normalizes credentials from HTTP Basic authentication URLs into Authorization headers.
 * Standard Web fetch rejects URLs containing username/password credentials.
 *
 * @param url Target URL
 * @param headers Optional request headers
 * @returns Clean URL and merged Headers
 */
export function normalizeFetchUrlAndHeaders (
  url: string,
  headers?: HeadersInit,
): { cleanUrl: string, headers: Headers } {
  const reqHeaders = new Headers(headers)
  try {
    const parsed = new URL(url)
    if (parsed.username || parsed.password) {
      const credentials = `${decodeURIComponent(parsed.username)}:${decodeURIComponent(parsed.password)}`
      if (!reqHeaders.has('authorization')) {
        reqHeaders.set('authorization', `Basic ${btoa(credentials)}`)
      }
      parsed.username = ''
      parsed.password = ''
      return { cleanUrl: parsed.toString(), headers: reqHeaders }
    }
  } catch {
    // Return original url if unparseable
  }
  return { cleanUrl: url, headers: reqHeaders }
}

/**
 * Retrieves HTTP response headers following redirects via standard Web fetch.
 *
 * @param url Target HTTP(S) URL
 * @param headers Optional request headers
 * @returns Normalised lowercase header key-value map
 */
export async function fetchHeadHeader (
  url: string,
  headers?: HeadersInit,
): Promise<Record<string, string>> {
  const { cleanUrl, headers: reqHeaders } = normalizeFetchUrlAndHeaders(url, headers)
  const response = await fetch(cleanUrl, {
    headers: reqHeaders,
    method: 'HEAD',
    redirect: 'follow',
  })
  const result: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    result[key.toLowerCase()] = value
  })
  return result
}

/**
 * Initiates an HTTP GET request and returns the response body as a WHATWG ReadableStream.
 *
 * @param url Target HTTP(S) URL
 * @param headers Optional request headers
 * @param signal Optional abort signal
 * @returns Readable stream of byte chunks
 */
export async function fetchStream (
  url: string,
  headers?: HeadersInit,
  signal?: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  const { cleanUrl, headers: reqHeaders } = normalizeFetchUrlAndHeaders(url, headers)
  const response = await fetch(cleanUrl, {
    headers: reqHeaders,
    method: 'GET',
    redirect: 'follow',
    signal,
  })
  if (!response.ok) {
    throw new Error(`fetch failed with HTTP ${response.status}: ${response.statusText}`)
  }
  if (!response.body) {
    throw new Error(`response body is null for ${url}`)
  }
  return response.body
}

/**
 * Backward-compatible alias for fetchHeadHeader.
 */
export const httpHeadHeader = fetchHeadHeader

/**
 * Backward-compatible HTTP streaming helper.
 * Returns a WHATWG ReadableStream, which is consumed seamlessly by streamToBuffer.
 */
export const httpStream = fetchStream

/**
 * Consumes a WHATWG ReadableStream or Node.js Readable into a Uint8Array.
 *
 * @param stream Byte stream to consume
 * @returns Concatenated bytes
 */
export async function streamToBytes (
  stream: ReadableStream<Uint8Array> | any,
): Promise<Uint8Array> {
  if (stream && typeof stream.getReader === 'function') {
    const response = new Response(stream)
    return new Uint8Array(await response.arrayBuffer())
  }
  return new Promise<Uint8Array>((resolve, reject) => {
    const chunks: Uint8Array[] = []
    stream.once('error', reject)
    stream.once('end', () => {
      const totalLen = chunks.reduce((acc, c) => acc + c.byteLength, 0)
      const merged = new Uint8Array(totalLen)
      let offset = 0
      for (const chunk of chunks) {
        merged.set(chunk, offset)
        offset += chunk.byteLength
      }
      resolve(merged)
    })
    stream.on('data', (chunk: any) => {
      const u8 = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk)
      chunks.push(u8)
    })
  })
}

/**
 * Consumes a stream into a Node Buffer or Uint8Array.
 *
 * @param stream Byte stream to consume
 * @returns Resolves with Buffer in Node.js/Deno, or Uint8Array in browser
 */
export async function streamToBuffer (
  stream: ReadableStream<Uint8Array> | any,
): Promise<any> {
  const bytes = await streamToBytes(stream)
  if (typeof (globalThis as any).Buffer !== 'undefined') {
    return (globalThis as any).Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }
  return bytes
}

/**
 * Encodes a Uint8Array into a Base64 string without native Node.js dependencies.
 *
 * @param bytes Binary payload
 * @returns Base64 encoded string
 */
export function bytesToBase64 (bytes: Uint8Array): string {
  if (typeof (bytes as any).toBase64 === 'function') {
    return (bytes as any).toBase64()
  }
  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i += 8192) {
    const chunk = bytes.subarray(i, Math.min(i + 8192, len))
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

/**
 * Decodes a Base64 string into a Uint8Array without native Node.js dependencies.
 *
 * @param base64 Base64 encoded string
 * @returns Decoded byte array
 */
export function base64ToBytes (base64: string): Uint8Array {
  if (typeof (Uint8Array as any).fromBase64 === 'function') {
    return (Uint8Array as any).fromBase64(base64)
  }
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}
