/**
 * Pinpoint Node.js Agent
 * Copyright 2020-present NAVER Corp.
 * Apache License v2.0
 */

'use strict'

const MethodDescriptorBuilder = require('../../../context/method-descriptor-builder')
const serviceType = require('./mongodb-service-type')

class MongoClientConnectInterceptor {
    constructor(traceContext) {
        this.MethodDescriptorBuilder = new MethodDescriptorBuilder('connect')
        this.traceContext = traceContext
    }

    doInBeforeTrace(recorder) {
        recorder.recorderServiceType(serviceType)
    }

    prepareAfterTrace(target, args, connection) {
        if (connection) {

        }
    }
}

module.exports = MongoClientConnectInterceptor