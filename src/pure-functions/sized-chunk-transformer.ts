/**
 * ChunkerTransformStream: A WHATWG TransformStream to chunk arbitrary byte streams consistently.
 *
 * Slices input byte buffers into uniform chunk sizes suitable for network and streaming workloads.
 * Fully universal and compliant with WinterTC specifications with zero native runtime imports.
 */

/**
 * Default chunk size for streaming (256 KB).
 * Tuned for standard network throughput and socket streaming.
 */
const DEFAULT_CHUNK_BYTE = 256 * 1024 // 256 KB

/**
 * Creates a WHATWG TransformStream that emits Uint8Array chunks of at most `chunkByte` size.
 *
 * @param chunkByte Maximum byte length per chunk (defaults to 256KB)
 * @returns TransformStream slicing incoming bytes into uniform chunks
 */
export function sizedChunkTransformStream (
  chunkByte = DEFAULT_CHUNK_BYTE,
): TransformStream<Uint8Array, Uint8Array> {
  if (chunkByte <= 0) {
    throw new RangeError(`chunkByte must be greater than 0, received ${chunkByte}`)
  }
  let buffer: Uint8Array<any> = new Uint8Array(0)

  return new TransformStream<Uint8Array, Uint8Array>({
    transform (chunk, controller) {
      if (buffer.byteLength === 0) {
        buffer = chunk
      } else {
        const next = new Uint8Array(buffer.byteLength + chunk.byteLength)
        next.set(buffer, 0)
        next.set(chunk, buffer.byteLength)
        buffer = next
      }

      while (buffer.byteLength >= chunkByte) {
        controller.enqueue(buffer.subarray(0, chunkByte))
        buffer = buffer.subarray(chunkByte)
      }
    },
    flush (controller) {
      if (buffer.byteLength > 0) {
        controller.enqueue(buffer)
        buffer = new Uint8Array(0)
      }
    },
  })
}

/**
 * Legacy transformer bridge for Node.js stream pipelines.
 * In Node.js environments, wraps sizedChunkTransformStream as a Node Transform stream.
 *
 * @param chunkByte Maximum chunk size
 * @returns Node stream.Transform when running under Node.js, or TransformStream otherwise
 */
export function sizedChunkTransformer (chunkByte = DEFAULT_CHUNK_BYTE): any {
  if (typeof (globalThis as any).process !== 'undefined') {
    const nodeStream = (globalThis as any).process?.getBuiltinModule?.('node:stream')
    if (nodeStream?.Transform?.fromWeb) {
      return nodeStream.Transform.fromWeb(sizedChunkTransformStream(chunkByte))
    }
  }
  return sizedChunkTransformStream(chunkByte)
}
