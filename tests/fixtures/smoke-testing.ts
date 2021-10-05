import {
  FileBox,
  VERSION,
}             from 'file-box'

async function main () {
  const box = FileBox.fromUrl('https://raw.githubusercontent.com/huan/file-box/main/docs/images/file-box-logo.jpg')

  if (VERSION as any === '0.0.0') {
    throw new Error('version not set right before publish!')
  }

  console.log(`FileBox v${box.version()} smoke testing passed!`)
}

main()
  .catch(console.error)
