/**
 * Utility functions for converting UUID strings to BigInt values.
 */

/**
 * Converts a canonical UUID string to a BigInt numeric representation.
 *
 * @param uuid Standard 36-character hyphenated UUID string
 * @returns BigInt representation of the UUID hexadecimal digits
 */
function uuidToBigInt (uuid: string): bigint {
  const hexBytes = `0x${uuid.replace(/-/g, '')}`
  const bigInteger = BigInt(hexBytes)
  return bigInteger
}

export {
  uuidToBigInt,
}
