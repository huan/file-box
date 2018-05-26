# FILEBOX

Pack a file in a Box for easy transport between servers with the least payload, no mater than where it is.(local path, remote url, or cloud storage)

![File Box](https://zixia.github.io/node-file-box/images/file-box-logo.jpg)

## API Reference

1. `name`: the file name of the file in the box

```ts
const fileBox = FileBox.fromRemote(
  'https://zixia.github.io/node-file-box/images/file-box-logo.jpg',
)
console.log(fileBox.name) // Output: file-box-logo.jpg
```

1. `version()`: version of the FileBox

1. `toJSON()`: to be implemented

1. `syncRemoteName()`: try to get the filename from the HTTP Response Header

HTTP Header Example: `Content-Disposition: attachment; filename="filename.ext"`

### Load File to Box

1. `fromLocal(filePath: string): FileBox`

```ts
const fileBox = FileBox.fromLocal('/tmp/test.txt')
```

1. `fromRemote(url: string, name?: string, headers?: { [idx: string]: string }): FileBox`

```ts
const fileBox = FileBox.fromRemote(
  'https://zixia.github.io/node-file-box/images/file-box-logo.jpg',
  'logo.jpg',
  {},
)
```

1. `fromStream(stream: NoddeJS.ReadableStream, name: string): FileBox`

```ts
const fileBox = FileBox.fromStream(res, '/tmp/download.zip')
```

1. `fromBuffer(buffer: Buffer, name: string): FileBox`

```ts
const fileBox = FileBox.fromBuffer(buf, '/tmp/download.zip')
```

### Pipe File to Strem

1. `pipe(destination: Writable): Promise<void>`

```ts
const fileBox = FileBox.fromRemote(
  'https://zixia.github.io/node-file-box/images/file-box-logo.jpg',
)
const writableStream = fs.createWritable('/tmp/logo.jpg')
fileBox.pipe(writableStream)
```

### Save to File System

1. `save(path: string): Promise<void>`

```ts
const fileBox = FileBox.fromRemote(
  'https://zixia.github.io/node-file-box/images/file-box-logo.jpg',
)
await fileBox.save('/tmp/logo.jpg')
```

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

### v0.4 (master)

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

## THANKS

This module is inspired by https://github.com/gulpjs/vinyl and https://github.com/DefinitelyTyped/DefinitelyTyped/pull/12368 when I need a virtual File module for my [Chatie](https://github.com/Chatie) project.

## AUTHOR

[Huan LI](http://linkedin.com/in/zixia) \<zixia@zixia.net\>

<a href="https://stackexchange.com/users/265499">
  <img src="https://stackexchange.com/users/flair/265499.png" width="208" height="58" alt="profile for zixia on Stack Exchange, a network of free, community-driven Q&amp;A sites" title="profile for zixia on Stack Exchange, a network of free, community-driven Q&amp;A sites">
</a>

## COPYRIGHT & LICENSE

* Code & Docs © 2016-2018 Huan LI \<zixia@zixia.net\>
* Code released under the Apache-2.0 License
* Docs released under Creative Commons
