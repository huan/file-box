let version = '0.0.0'

try {
  version = require('../../package.json').version
} catch (e) {
  try {
    version = require('../package.json').version
  } catch (e) {
    version = require('../../../package.json').version
  }
}

export const VERSION = version
