/**
 * ChunkerTransformStream, a transform stream to take arbitrary chunk sizes and make them consistent
 * https://codereview.stackexchange.com/q/57492/185709
 */
import stream from 'stream'

const DEFAULT_CHUNK_SIZE = 256 * 1024 // 256KB

function chunkerTransformStream (chunkSize = DEFAULT_CHUNK_SIZE) {
  let buffer = Buffer.from([])

  const chunker = new stream.Transform({
    objectMode: true,
  })
  chunker._transform = function (chunk, _, done) {
    buffer = Buffer.concat([buffer, chunk])

    while (buffer.length >= chunkSize) {
      this.push(buffer.slice(0, chunkSize))
      buffer = buffer.slice(chunkSize)
    }

    done()
  }

  chunker._flush = function (done) {
    if (buffer.length) {
      this.push(buffer)
    }
    done()
  }

  return chunker
}

export {
  chunkerTransformStream,
}
