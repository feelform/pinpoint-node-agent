/**
 * Pinpoint Node.js Agent
 * Copyright 2020-present NAVER Corp.
 * Apache License v2.0
 */

'use strict'

const SIGNATURE = -17
const VERSION = 16
const HEADER_PREFIX_SIZE = 4

class Header {
  constructor (type) {
    this.signature = SIGNATURE
    this.version = VERSION
    this.type = type
  }
}

module.exports = {
  Header,
  HEADER_PREFIX_SIZE
}
