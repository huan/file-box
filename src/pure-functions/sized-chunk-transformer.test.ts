/**
 * Unit tests for sized chunk stream transformer across WHATWG and Node runtimes.
 */
import { test } from 'node:test'
import * as assert from 'node:assert/strict'

import {
  sizedChunkTransformStream,
  sizedChunkTransformer,
} from './sized-chunk-transformer.ts'

test('sizedChunkTransformStream chunks arbitrary byte streams', async () => {
  const encoder = new TextEncoder()
  const data = encoder.encode('abcdef')

  const stream = new ReadableStream<Uint8Array>({
    start (controller) {
      controller.enqueue(data)
      controller.close()
    },
  }).pipeThrough(sizedChunkTransformStream(2))

  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }

  assert.strictEqual(chunks.length, 3, 'should split 6 bytes into 3 chunks of 2 bytes')
  const decoder = new TextDecoder()
  assert.strictEqual(decoder.decode(chunks[0]), 'ab')
  assert.strictEqual(decoder.decode(chunks[1]), 'cd')
  assert.strictEqual(decoder.decode(chunks[2]), 'ef')
})

test('sizedChunkTransformer compatibility bridge', async () => {
  const transformer = sizedChunkTransformer(2)
  assert.ok(transformer, 'transformer should be created')
})

test('sizedChunkTransformStream throws RangeError for non-positive chunkByte', () => {
  assert.throws(() => sizedChunkTransformStream(0), RangeError)
  assert.throws(() => sizedChunkTransformStream(-5), RangeError)
})
