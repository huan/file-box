# FILEBOX

[![NPM Version](https://badge.fury.io/js/file-box.svg)](https://badge.fury.io/js/file-box)
[![Build Status](https://api.travis-ci.com/huan/file-box.svg?branch=master)](https://travis-ci.com/huan/file-box)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-blue.svg)](https://www.typescriptlang.org/)
[![Greenkeeper badge](https://badges.greenkeeper.io/huan/file-box.svg)](https://greenkeeper.io/)

FileBox is a virtual container for packing a file data into it for future read, and easily transport between servers with the least payload, no mater than where it is (local path, remote url, or cloud storage).

![File Box](https://huan.github.io/file-box/images/file-box-logo.jpg)

Currently the FileBox supports almost all kinds of the data input/output methods/formats:

| File Type | Pack Method | Unpack Method | Description |
| :--- | :--- | :--- | :--- |
| Local File | `fromFile()` | `toFile()` | Local file in file system |
| Remote URL | `fromUrl()` | `toUrl()`(TBW) | Remote file in a HTTP/HTTPS URL |
| Buffer | `fromBuffer()` | `toBuffer()` | JavaScript Buffer |
| Stream | `fromStream()` | `toStream()` | JavaScript Stream |
| Base64 | `fromBase64()` | `toBase64()` | Base64 data |
| DataURL | `fromDataURL()` | `toDataURL()` | DataURL data |
| QRCode | `fromQRCode()` | `toQRCode()` | QR Code |
| JSON | `fromJSON()`(TBW) | `toJSON()`(TBW) | Serialize/Deserialize FileBox |

## EXAMPLES

The following example demos:

1. Save URL to File
1. Convert Buffer to Stream
1. Pack from Base64 then Unpack to DataURL

```ts
import { FileBox } from 'file-box'

/**
 * 1. Save URL to File
 */
const fileBox1 = FileBox.fromUrl(
  'https://huan.github.io/file-box/images/file-box-logo.jpg',
  'logo.jpg',
)
fileBox1.toFile('/tmp/file-box-logo.jpg')

/**
 * 2. Convert Buffer to Stream
 */
import fs from 'fs'
const fileBox2 = FileBox.fromBuffer(
  Buffer.from('world'),
  'hello.txt',
)
const writeStream = fs.createWriteStream('/tmp/hello.txt')
fileBox2.pipe(writeStream)

/**
 * 3. Pack Base64, Unpack to DataURL
 */
const fileBox3 = FileBox.fromBase64('d29ybGQK', 'hello.txt')
fileBox3.toDataURL()
        .then(console.log)
// Output: data:text/plain;base64,d29ybGQK
```

## API REFERENCE

### 1. Load File in to Box

#### 1.1 `fromFile(filePath: string): FileBox`

Alias: `fromLocal()`

```ts
const fileBox = FileBox.fromLocal('/tmp/test.txt')
```

#### 1.2 `fromUrl(url: string, name?: string, headers?: http.OutgoingHttpHeaders): FileBox`

Alais: `fromRemote()`

```ts
const fileBox = FileBox.fromUrl(
  'https://huan.github.io/file-box/images/file-box-logo.jpg',
  'logo.jpg',
)
```

#### 1.3 `fromStream(stream: NoddeJS.ReadableStream, name: string): FileBox`

```ts
const fileBox = FileBox.fromStream(res, '/tmp/download.zip')
```

#### 1.4 `fromBuffer(buffer: Buffer, name: string): FileBox`

```ts
const fileBox = FileBox.fromBuffer(buf, '/tmp/download.zip')
```

#### 1.5 `FileBox.fromBase64(base64: string, name: string): FileBox`

Decoded a base64 encoded file data.

```ts
const fileBox = FileBox.fromBase64('d29ybGQK', 'hello.txt')
fileBox.toFile()
```

#### 1.6 `FileBox.fromDataURL(dataUrl: string, name: string): FileBox`

Decoded a DataURL data.

```ts
const fileBox = FileBox.fromDataURL('data:text/plain;base64,d29ybGQK', 'hello.txt')
fileBox.toFile()
```

#### 1.7 `FileBox.fromJSON()`

Restore a `FileBox.toJSON()` text string back to a FileBox instance.

WIP: **Not Implement Yet**

```ts
const restoredFileBox = FileBox.fromJSON(jsonText)
```

#### 1.8 `FileBox.fromQRCode(qrCodeValue: string)`

Get a FileBox instance that represent a QR Code value.

```ts
const fileBox = FileBox.fromQRCode('https://github.com')
fileBox.toFile('qrcode.png')
```

### 2. Get File out from Box

### 2.1 `toFile(name?: string): Promise<void>`

Save file to current work path(cwd) of the local file system with the default `name`.

if `name` specified with a full path, then will use the speficied file name instead.

```ts
const fileBox = FileBox.fromRemote(
  'https://huan.github.io/file-box/images/file-box-logo.jpg',
)
await fileBox.toFile('/tmp/logo.jpg')
```

#### 2.2 `pipe(destination: Writable): Promise<void>`

Pipe to a writable stream.

```ts
const fileBox = FileBox.fromRemote(
  'https://huan.github.io/file-box/images/file-box-logo.jpg',
)
const writableStream = fs.createWritable('/tmp/logo.jpg')
fileBox.pipe(writableStream)
```

#### 2.3 `toBase64(): Promise<string>`

Get the base64 data of file.

```ts
const fileBox = FileBox.fromRemote(
  'https://huan.github.io/file-box/images/file-box-logo.jpg',
)
const base64Text = await fileBox.toBase64()
console.log(base64Text) // Output: the base64 encoded data of the file
```

#### 2.4 `toJSON(): string`

Get the `JSON.stringify`-ed text.

**Not Implement Yet: Working In Progress...**

```ts
const fileBox = FileBox.fromRemote(
  'https://huan.github.io/file-box/images/file-box-logo.jpg',
)
const jsonText1 = fileBox.toJSON()
const jsonText2 = JSON.stringify(fileBox)
assert(jsonText1 === jsonText2)

console.log(jsonText1) // Output: the stringified data of the fileBox

const restoredFileBox = fileBox.fromJSON(jsonText1)
restoredFileBox.toFile('/tmp/file-box-logo.jpg')
```

#### 2.5 `toDataURL(): Promise<string>`

Get the DataURL of the file.

```ts
const fileBox = FileBox.fromFile('tests/fixtures/hello.txt')
const dataUrl = await fileBox.toDataURL()
console.log(dataUrl) // Output: data:text/plain;base64,d29ybGQK'
```

#### 2.6 `toBuffer(): Promise<Buffer>`

Get the Buffer of the file.

```ts
const fileBox = FileBox.fromFile('tests/fixtures/hello.txt')
const buffer = await fileBox.toBuffer()
console.log(buffer.toString()) // Output: world
```

#### 2.7 `toQRCode(): Promise<string>`

Decode the QR Code value from the file.

```ts
const fileBox = FileBox.fromFile('qrcode.jpg')
const qrCodeValue = await fileBox.toQRCode()
console.log(`QR Code decoded value is: "${qrCodeValue}"`)
// Output: QR Code decoded value is: "https://github.com"
```

### 3. Misc

#### 3.1 `name`

File name of the file in the box

```ts
const fileBox = FileBox.fromRemote(
  'https://huan.github.io/file-box/images/file-box-logo.jpg',
)
console.log(fileBox.name) // Output: file-box-logo.jpg
```

#### 3.2 `metadata: Metadata { [key: string]: any } `

Metadata for the file in the box. This value can only be assigned once, and will be immutable afterwards, all following assign or modify actions on `metadata` will throw errors

```ts
const fileBox = FileBox.fromRemote(
  'https://zixia.github.io/file-box/images/file-box-logo.jpg',
)
fileBox.metadata = {
  author      : 'zixia',
  githubRepo  : 'https://github.com/zixia/file-box',
}

console.log(fileBox.metadata)       // Output: { author: 'zixia', githubRepo: 'https://github.com/zixia/file-box' }
fileBox.metadata.author = 'Thanos'  // Will throw exception 
```

#### 3.3 `version(): string`

Version of the FileBox

#### 3.4 `toJSON(): string`

Serialize FileBox metadata to JSON.

**To be implemented.**

#### 3.5 `ready(): Promise<void>`

Update the necessary internal data and make everything ready for use.

#### 3.6 `syncRemoteName(): Promise<void>`

Sync the filename with the HTTP Response Header

HTTP Header Example:
> Content-Disposition: attachment; filename="filename.ext"

## FEATURES

1. Present A File by Abstracting It's Meta Information that supports Reading & toJSON() API.
1. Follow DOM File/BLOB Interface
1. Present a file that could be: Local, Remote, Stream
1. Lazy load
1. Serializable
1. Can be Transfered from server to server, server to browser.

## SCHEMAS

### Url

[Node.js Documentation > URL Strings and URL Objects](https://nodejs.org/docs/latest/api/url.html#url_url_strings_and_url_objects)

```asciiart
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                            href                                             │
├──────────┬──┬─────────────────────┬─────────────────────┬───────────────────────────┬───────┤
│ protocol │  │        auth         │        host         │           path            │ hash  │
│          │  │                     ├──────────────┬──────┼──────────┬────────────────┤       │
│          │  │                     │   hostname   │ port │ pathname │     search     │       │
│          │  │                     │              │      │          ├─┬──────────────┤       │
│          │  │                     │              │      │          │ │    query     │       │
"  https:   //    user   :   pass   @ sub.host.com : 8080   /p/a/t/h  ?  query=string   #hash "
│          │  │          │          │   hostname   │ port │          │                │       │
│          │  │          │          ├──────────────┴──────┤          │                │       │
│ protocol │  │ username │ password │        host         │          │                │       │
├──────────┴──┼──────────┴──────────┼─────────────────────┤          │                │       │
│   origin    │                     │       origin        │ pathname │     search     │ hash  │
├─────────────┴─────────────────────┴─────────────────────┴──────────┴────────────────┴───────┤
│                                            href                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Path

[Node.js Documentation > path.parse(path)](https://nodejs.org/api/path.html#path_path_parse_path)

```asciiart
┌─────────────────────┬────────────┐
│          dir        │    base    │
├──────┬              ├──────┬─────┤
│ root │              │ name │ ext │
"  /    home/user/dir / file  .txt "
└──────┴──────────────┴──────┴─────┘
```

## CHANGE LOG

### master

### v0.10 (Feb 2020)

1. Add support to QR Code: `FileBox.fromQRCode()` and `FileBox.toQRCode()`
1. Start using @chatie/tsconfig

### v0.8 (Jun 2018)

1. Add two new factory methods: `fromBase64()`, `fromDataURL()`
1. Add `toBuffer()`, `toBase64()` and `toDataURL()` to get the Buffer and BASE64 encoded file data
1. Add `metadata` property to store additional informations. ([#3](https://github.com/huan/file-box/issues/3))

### v0.4 (May 2018)

1. Add `headers` option for `fromRemote()` method

### v0.2 (Apr 2018)

Initial version.

## SEE ALSO

* [File API - W3C Working Draft, 26 October 2017](https://www.w3.org/TR/FileAPI/)
* [MIME Sniffing - Living Standard — Last Updated 20 April 2018](https://mimesniff.spec.whatwg.org/#parsable-mime-type)
* [Using files from web applications](https://developer.mozilla.org/en-US/docs/Web/API/File/Using_files_from_web_applications)
* [Web technology for developers > Web APIs > File](https://developer.mozilla.org/en-US/docs/Web/API/File)
* [Web technology for developers > Web APIs > Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob)
* [Web technology for developers > Web APIs > FileReader](https://developer.mozilla.org/en-US/docs/Web/API/FileReader)
* [A simple HTTP Request & Response Service.](https://httpbin.org)
* [Hurl.it — Make HTTP Requests](https://www.hurl.it)

## THANKS

This module is inspired by https://github.com/gulpjs/vinyl and https://github.com/DefinitelyTyped/DefinitelyTyped/pull/12368 when I need a virtual File module for my [Chatie](https://github.com/Chatie) project.

## AUTHOR

[Huan LI](http://linkedin.com/in/zixia) \<zixia@zixia.net\>

<a href="https://stackexchange.com/users/265499">
  <img src="https://stackexchange.com/users/flair/265499.png" width="208" height="58" alt="profile for zixia on Stack Exchange, a network of free, community-driven Q&amp;A sites" title="profile for zixia on Stack Exchange, a network of free, community-driven Q&amp;A sites">
</a>

## COPYRIGHT & LICENSE

* Docs released under Creative Commons
* Code released under the Apache-2.0 License
* Code & Docs © 2018 Huan LI \<zixia@zixia.net\>
