/**
 * Pinpoint Node.js Agent
 * Copyright 2020-present NAVER Corp.
 * Apache License v2.0
 */

'use strict'

const semver = require('semver')
const InstrumentMethod = require('../instrument-method')
const MongoClientConnectInterceptor = require('./mongodb/mongo-client-connect-interceptor')

module.exports = function (agent, version, mongodb) {
    if (!semver.satisfies(version, '>=4.0.0')) {
        return mongodb
    }

    if (!mongodb.MongoClient) {
        return mongodb
    }

    const traceContext = agent.getTraceContext()
    InstrumentMethod.make(mongodb.MongoClient, 'connect', traceContext).addInterceptor(new MongoClientConnectInterceptor(traceContext))
    return mongodb
}