import * as assert from 'assert'
import FileBox from 'file-box'

const box = FileBox.createLocal(__filename)

console.log(`FileBox v${box.version()} smoke testing passed!`)
