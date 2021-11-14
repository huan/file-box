import assert from 'assert'

import {
  FileBox,
  VERSION,
}             from 'file-box'

async function main () {
  const box = FileBox.fromUrl('https://raw.githubusercontent.com/huan/file-box/main/docs/images/file-box-logo.jpg')

  await box.ready()
  assert.ok(box.size > 0, 'should get remote url content length')

  if (VERSION === '0.0.0') {
    throw new Error('version not set right before publish!')
  }

  console.log(`FileBox v${box.version} smoke testing passed!`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
