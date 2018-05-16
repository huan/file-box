#!/usr/bin/env bash
set -e

if [ -z "$1" ]; then
  echo
  echo "Need distination folder."
  echo "For example:"
  echo " $ $0 ~/chatie/wechaty/node_modules/file-box"
  echo
  exit 1
fi

npm run lint
npm run clean
npm run dist

#rm -fr @chatie/db/node_modules

cp -Rav dist/* "$1/dist/"
