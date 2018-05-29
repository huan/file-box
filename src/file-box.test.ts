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
  const box = FileBox.packLocal('x')
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
    const file = FileBox.packLocal(localFileFixture)

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

test('base64()', async t => {
  const BASE64_DECODED = 'FileBoxBase64\n'
  const BASE64_ENCODED = 'RmlsZUJveEJhc2U2NAo='

  const fileBox = FileBox.packBase64(BASE64_ENCODED, 'test.txt')
  const base64 = await fileBox.base64()

  t.equal(base64, BASE64_ENCODED, 'should get base64 back')

  const text = Buffer.from(base64, 'base64').toString()
  t.equal(text, BASE64_DECODED, 'should get the text right')
})
