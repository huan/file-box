#!/usr/bin/env ts-node

import * as assert from 'assert'

import 'reflect-metadata'

// tslint:disable:no-shadowed-variable
import * as test  from 'blue-tape'
// import * as sinon from 'sinon'
import { FileBox } from './file-box'

const requiredMetadataKey = Symbol('required')

const tstest = {
  methodFixture() {
    return function (
      ..._: any[]
      // target      : Object,
      // propertyKey : string,
      // descriptor  : PropertyDescriptor,
    ) {
      console.log('@fixture()')
    }
  },
  classFixture() {
    return function (constructor: Function) {
      console.log(constructor.name)
      console.log(constructor.prototype.name)
    }
  },
  parameterFixture() {
    return function (target: Object, propertyKey: string | symbol, parameterIndex: number) {
      console.log(propertyKey)
      const existingRequiredParameters: number[] = Reflect.getOwnMetadata(requiredMetadataKey, target, propertyKey) || []
      existingRequiredParameters.push(parameterIndex)
      Reflect.defineMetadata(requiredMetadataKey, existingRequiredParameters, target, propertyKey)
    }
  },
}

test('File smoke testing', async t => {
  const box = FileBox.fromFile('x')
  t.ok(box)
})

@tstest.classFixture()
export class FixtureFileBox {

  @tstest.methodFixture()
  public static localFileFixutre() {
    return {
      name: 'test.txt',
      type: 'plain/text',
      size: '1',
      content: 'T',
    }
  }

}

export class TestFileBox {

  public static testFileCreateLocal(
    @tstest.parameterFixture() localFileFixture: any,
  ) {
    const file = FileBox.fromFile(localFileFixture)

    test('File.createLocal()', async t => {
      t.ok(file, 'ok')

    })

    test('File.fromRemote()', async t => {
      const URL = 'http://httpbin.org/response-headers?Content-Type=text/plain;%20charset=UTF-8&Content-Disposition=attachment;%20filename%3d%22test.json%22'
      assert(URL)
      t.pass('ok')
    })

  }

}

test('toBase64()', async t => {
  const BASE64_DECODED = 'FileBoxBase64\n'
  const BASE64_ENCODED = 'RmlsZUJveEJhc2U2NAo='

  const fileBox = FileBox.fromBase64(BASE64_ENCODED, 'test.txt')
  const base64 = await fileBox.toBase64()

  t.equal(base64, BASE64_ENCODED, 'should get base64 back')

  const text = Buffer.from(base64, 'base64').toString()
  t.equal(text, BASE64_DECODED, 'should get the text right')
})

test('syncRemoteName()', async t => {
  const URL = 'http://httpbin.org/response-headers?Content-Disposition=attachment;%20filename%3d%22test.txt%22&filename=test.txt'

  const EXPECTED_NAME_FROM_URL    = 'response-headers?Content-Disposition=attachment;%20filename%3d%22test.txt%22&filename=test.txt'
  const EXPECTED_TYPE_FROM_URL    = 'text/plain'

  const EXPECTED_NAME_FROM_HEADER = 'test.txt'
  const EXPECTED_TYPE_FROM_HEADER = 'application/json'

  const fileBox = FileBox.fromUrl(URL)

  t.equal(fileBox.name, EXPECTED_NAME_FROM_URL, 'should get the name from url')
  t.equal(fileBox.mimeType, EXPECTED_TYPE_FROM_URL, 'should get the mime type from url')

  await fileBox.syncRemoteName()

  t.equal(fileBox.name, EXPECTED_NAME_FROM_HEADER, 'should get the name from remote header')
  t.equal(fileBox.mimeType, EXPECTED_TYPE_FROM_HEADER, 'should get the mime type from remote http header')
})

test('toDataURL()', async t => {
  const FILE_PATH         = 'tests/fixtures/hello.txt'
  const EXPECTED_DATA_URL = 'data:text/plain;base64,d29ybGQK'

  const fileBox = FileBox.fromFile(FILE_PATH)

  const dataUrl = await fileBox.toDataURL()

  t.equal(dataUrl, EXPECTED_DATA_URL, 'should get the data url right')
})

test('toString()', async t => {
  const FILE_PATH     = 'tests/fixtures/hello.txt'
  const EXPECT_STRING = 'FileBox#File<hello.txt>'

  const fileBox = FileBox.fromFile(FILE_PATH)
  t.equal(fileBox.toString(), EXPECT_STRING, 'should get the toString() result')
})

test('toBuffer()', async t => {
  const FILE_PATH     = 'tests/fixtures/hello.txt'
  const EXPECT_STRING = 'world\n'

  const fileBox = FileBox.fromFile(FILE_PATH)
  const buffer = await fileBox.toBuffer()

  t.equal(buffer.toString(), EXPECT_STRING, 'should get the toBuffer() result')
})

test('metadata', async t => {
  const FILE_PATH     = 'tests/fixtures/hello.txt'

  const EXPECTED_NAME = 'myname'
  const EXPECTED_AGE  = 'myage'
  const EXPECTED_MOL  = 42

  // interface MetadataType {
  //   metaname : string,
  //   metaage  : number,
  //   metaobj: {
  //     mol: number,
  //   }
  // }

  const EXPECTED_METADATA = {
    metaname: EXPECTED_NAME,
    metaage: EXPECTED_AGE,
    metaobj: {
      mol: EXPECTED_MOL,
    },
  }

  const fileBox = FileBox.fromFile(FILE_PATH)

  t.deepEqual(fileBox.metadata, {}, 'should get a empty {} if not set')

  t.doesNotThrow(
    () => {
      fileBox.metadata = EXPECTED_METADATA
    },
    'should not throw for set metadata for the first time',
  )

  t.throws(
    () => {
      fileBox.metadata = EXPECTED_METADATA
    },
    'should throw for set metadata again',
  )

  t.throws(
    () => {
      fileBox.metadata.mol = EXPECTED_MOL
    },
    'should throw for change value of a property on metadata',
  )

  t.deepEqual(fileBox.metadata, EXPECTED_METADATA, 'should get the metadata')
})
