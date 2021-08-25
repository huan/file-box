import Default, {
  FileBox,
  VERSION,
}             from 'file-box'

if (VERSION as any === '0.0.0') {
  throw new Error('version not set right before publish!')
}

if (Default !== FileBox) {
  throw new Error('default export does not match the exported module!')
}

const box = FileBox.fromUrl('https://raw.githubusercontent.com/huan/file-box/master/docs/images/file-box-logo.jpg')
console.log(`FileBox v${box.version()} smoke testing passed!`)
