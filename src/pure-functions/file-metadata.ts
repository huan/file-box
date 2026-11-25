/**
 * Parses Data URL payloads and download filenames independently of the HTTP
 * client and file implementations that supply those strings.
 */

/** Returns the Base64 payload after the last comma in a Data URL. */
export function dataUrlToBase64 (dataUrl: string): string {
  const dataList = dataUrl.split(',')
  return dataList[dataList.length - 1]!
}

/** Returns the filename from an attachment Content-Disposition header, or null. */
export function httpHeaderToFileName (headers: { 'content-disposition'?: string }): string | null {
  const contentDisposition = headers['content-disposition']
  const matches = contentDisposition?.match(/attachment; filename="?(.+[^"])"?$/i)
  return matches?.[1] || null
}
