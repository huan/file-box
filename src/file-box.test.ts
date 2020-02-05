#!/usr/bin/env ts-node

/* eslint @typescript-eslint/no-unused-vars:off */

import assert from 'assert'

import 'reflect-metadata'

import { test } from 'tstest'
// import * as sinon from 'sinon'
import { FileBox } from './file-box'

const requiredMetadataKey = Symbol('required')

const tstest = {
  methodFixture () {
    return (
      ..._: any[]
      // target      : Object,
      // propertyKey : string,
      // descriptor  : PropertyDescriptor,
    ) => {
      console.info('@fixture()')
    }
  },
  // tslint:disable:ban-types
  classFixture () {
    return (constructor: Function) => {
      console.info(constructor.name)
      console.info(constructor.prototype.name)
    }
  },
  parameterFixture () {
    return (target: object, propertyKey: string | symbol, parameterIndex: number) => {
      console.info(propertyKey)
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
  public static localFileFixutre () {
    return {
      content: 'T',
      name: 'test.txt',
      size: '1',
      type: 'plain/text',
    }
  }

}

// tslint:disable:max-classes-per-file

export class TestFileBox {

  public static testFileCreateLocal (
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

  await (fileBox as any).syncRemoteName()

  t.equal(fileBox.name, EXPECTED_NAME_FROM_HEADER, 'should get the name from remote header')
  t.equal(fileBox.mimeType, EXPECTED_TYPE_FROM_HEADER, 'should get the mime type from remote http header')
})

test('toDataURL()', async t => {
  const FILE_PATH         = 'tests/fixtures/data.bin'
  const EXPECTED_DATA_URL = 'data:application/octet-stream;base64,dGVzdA=='

  const fileBox = FileBox.fromFile(FILE_PATH)

  const dataUrl = await fileBox.toDataURL()

  t.equal(dataUrl, EXPECTED_DATA_URL, 'should get the data url right')
})

test('toString()', async t => {
  const FILE_PATH     = 'tests/fixtures/data.bin'
  const EXPECT_STRING = 'FileBox#File<data.bin>'

  const fileBox = FileBox.fromFile(FILE_PATH)
  t.equal(fileBox.toString(), EXPECT_STRING, 'should get the toString() result')
})

test('toBuffer()', async t => {
  const FILE_PATH     = 'tests/fixtures/data.bin'
  const EXPECT_STRING = 'test'

  const fileBox = FileBox.fromFile(FILE_PATH)
  const buffer = await fileBox.toBuffer()

  t.equal(buffer.toString(), EXPECT_STRING, 'should get the toBuffer() result')
})

test('metadata', async t => {
  const FILE_PATH     = 'tests/fixtures/data.bin'

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
    metaage: EXPECTED_AGE,
    metaname: EXPECTED_NAME,
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

test('fromQRCode()', async t => {
  const QRCODE_VALUE = 'hello, world!'
  const EXPECTED_QRCODE_IMAGE_BASE64 = [
    'iVBORw0KGgoAAAANSUhEUgAAAHQAAAB0CAYAAABUmhYnAAAAAklEQVR4AewaftIAAAKcSURBVO3BQY7',
    'cQAwEwSxC//9yeo88NSBIsx7TjIg/WGMUa5RijVKsUYo1SrFGKdYoxRqlWKMUa5RijVKsUYo1SrFGKd',
    'YoxRrl4qEk/CaVkyTcoXKShN+k8kSxRinWKMUa5eJlKm9Kwh0qn6TypiS8qVijFGuUYo1y8WFJuEPlj',
    'iR0Kl0SOpUuCZ3KHUm4Q+WTijVKsUYp1igXw6n8T4o1SrFGKdYoF8MloVOZrFijFGuUYo1y8WEq3yQJ',
    'ncoTKt+kWKMUa5RijXLxsiR8M5UuCZ3KSRK+WbFGKdYoxRrl4iGVf5nKicq/pFijFGuUYo0Sf/BAEjq',
    'VLglvUnkiCZ3KSRLepPJJxRqlWKMUa5SLlyXhROU3JaFT6ZJwonKShCeS0Kk8UaxRijVKsUaJP3hREj',
    'qVO5JwotIloVO5Iwl3qJwk4Q6VNxVrlGKNUqxRLv6yJJyodEl4Igl3qHRJ6FTuUPmkYo1SrFGKNcrFQ',
    '0k4ScITSehUuiScJKFT6ZLQqXRJuEPljiR0Kk8Ua5RijVKsUS4eUvkmSbhDpUvCHUk4UflNxRqlWKMU',
    'a5SLh5Lwm1Q6lS4JdyThCZWTJJyovKlYoxRrlGKNcvEylTcl4SQJnUqXhCdUuiScJOFvKtYoxRqlWKN',
    'cfFgS7lB5k0qXhDuS0Kl0SehUTpLQJaFTeaJYoxRrlGKNcjFcEjqVJ5JwkoROpVP5pGKNUqxRijXKxX',
    '8mCScqXRJOVE6S0Kl8UrFGKdYoxRrl4sNUPknlDpUuCV0SOpWTJHyTYo1SrFGKNcrFy5Lwm5LQqXQqX',
    'RI6lZMkdConKidJ6FTeVKxRijVKsUaJP1hjFGuUYo1SrFGKNUqxRinWKMUapVijFGuUYo1SrFGKNUqx',
    'RinWKMUa5Q8Ztu740xD9iQAAAABJRU5ErkJggg==',
  ].join('')

  const fileBox = FileBox.fromQRCode(QRCODE_VALUE)
  const base64Text = await fileBox.toBase64()

  t.equal(base64Text, EXPECTED_QRCODE_IMAGE_BASE64, 'should encode QR Code value to expected image')
})

test('toQRCode()', async t => {
  const QRCODE_IMAGE_BASE64 = [
    'iVBORw0KGgoAAAANSUhEUgAAAMgAAADIAQMAAACXljzdAAAABlBMVEX///8AAABVwtN+AAAA',
    'CXBIWXMAAA7EAAAOxAGVKw4bAAAA7klEQVRYw+2WsQ3EIAxFjShSMgKjZLRktIzCCJQpIv7Z',
    'hCiXO/qzT/wCWXo0X3wbEw0NWVaEKM187KHW2QLZ+AhpXovfQ+J6skEWHELqBa5NEeCwR7iS',
    'V7BDzuzAiZ9eqn5IWjfWXHf7VCO5tPAM6U9AjSRideyHFn4FiuvDqV5CM9rZXuF2pZmIAjZy',
    'x4S0MDdBxEmu3TrliPf7iglPvuLlRydfU3P70UweCSK+ZYK0mUg1O4AVcv0/8itGkC7SdiTH',
    '0+Mz19oJZ4NkhhSPbIhQkQGI8u1HJzmzs7p7pzNAru2pJb6z8ykkQ0P/pheK6vjurjf7+wAA',
    'AABJRU5ErkJggg==',
  ].join('')
  const EXPECTED_QRCODE_TEXT = 'hello, world!'

  const fileBox = FileBox.fromBase64(QRCODE_IMAGE_BASE64, 'qrcode.png')
  const qrCodeValue = await fileBox.toQRCode()

  t.equal(qrCodeValue, EXPECTED_QRCODE_TEXT, 'should decode qrcode image base64 to qr code value')
})
