/**
 * Pinpoint Node.js Agent
 * Copyright 2020-present NAVER Corp.
 * Apache License v2.0
 */

'use strict'

const MethodDescriptorBuilder = require('../../../context/method-descriptor-builder')

class MongoClientConnectInterceptor {
    constructor() {
        this.MethodDescriptorBuilder = new MethodDescriptorBuilder('connect')
    }
}

module.exports = MongoClientConnectInterceptor