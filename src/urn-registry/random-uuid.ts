/** Generates the v4 UUIDs used by the native URN registry. */
export function randomUuid (): string {
  return crypto.randomUUID()
}
