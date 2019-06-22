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

const box = FileBox.fromFile(__filename)
console.log(`FileBox v${box.version()} smoke testing passed!`)
