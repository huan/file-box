
export function dataUrlToBase64(dataUrl: string): string {
  const dataList = dataUrl.split(',')
  return dataList[dataList.length - 1]
}
