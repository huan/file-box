# FILEBOX

Pack a file in a Box for easy transport between servers with the least payload, no mater than where it is.(local path, remote url, or cloud storage)

![File Box](https://zixia.github.io/node-file-box/images/file-box-logo.jpg)

## WIP

WORKING IN PROGRESS ...

PLEASE COME BACK AFTER 4 WEEKS ...

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
