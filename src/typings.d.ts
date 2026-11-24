/**
 * Ambient type declarations for FileBox.
 */

declare module 'omggif' {
  export class GifReader {
    readonly width: number
    readonly height: number
    constructor (buf: Uint8Array)
    decodeAndBlitFrameRGBA (frame: number, pixels: Uint8Array): void
  }

  export class GifWriter {
    constructor (
      buf: Uint8Array,
      width: number,
      height: number,
      options?: { palette?: number[] },
    )
    addFrame (
      x: number,
      y: number,
      width: number,
      height: number,
      indexedPixels: Uint8Array,
      options?: { palette?: number[] },
    ): void
    end (): number
  }
}

declare module 'utif2' {
  interface TiffIfd {
    width: number
    height: number
  }

  interface UtifApi {
    decode (buffer: ArrayBuffer | Uint8Array): TiffIfd[]
    decodeImage (buffer: ArrayBuffer | Uint8Array, ifd: TiffIfd): void
    toRGBA8 (ifd: TiffIfd): Uint8Array
    encodeImage (rgba: Uint8Array, width: number, height: number): ArrayBuffer
  }

  const UTIF: UtifApi
  export default UTIF
}
