#!/usr/bin/env bash
set -e

restore_version() {
  git checkout src/version.ts 2>/dev/null || true
}
trap restore_version EXIT

./scripts/generate-version.sh

npm run dist
npm pack

restore_version

TMPDIR="/tmp/npm-pack-testing.$$"
mkdir -p "$TMPDIR"
mv ./*-*.*.*.tgz "$TMPDIR"
cp tests/fixtures/smoke-testing.ts "$TMPDIR"

cd "$TMPDIR"

npm init -y
npm pkg set type="module"
npm install ./*-*.*.*.tgz @types/node typescript

./node_modules/.bin/tsc \
  --lib esnext,dom \
  --types node \
  --noEmitOnError \
  --noImplicitAny \
  --skipLibCheck \
  --target esnext \
  --module NodeNext \
  --moduleResolution NodeNext \
  smoke-testing.ts

echo
echo "ES Module: pack testing..."
node smoke-testing.js
