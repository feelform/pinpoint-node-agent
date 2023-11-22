/**
 * Pinpoint Node.js Agent
 * Copyright 2023-present NAVER Corp.
 * Apache License v2.0
 */

'use strict'

const semver = require('semver')
const defaultPredefinedMethodDescriptorRegistry = require('../../lib/constant/default-predefined-method-descriptor-registry')
const ServiceType = require('../../lib/context/service-type')
const mysqlExecuteQueryServiceType = require('../../lib/instrumentation/module/mysql/mysql-execute-query-service-type')

const expected = (expected1, exprected2) => {
    if (semver.satisfies(process.versions.node, '<17.0')) {
        return exprected2
    }
    return expected1
}

const asyncSpanChunkMySQLMatcher = (t, trace, actualSpanEvent) => {
    if (!actualSpanEvent.nextAsyncId) {
        return
    }
    const actualSpanChunk = trace.storage.dataSender.findSpanChunk(actualSpanEvent.nextAsyncId)
    t.equal(actualSpanChunk.spanId, actualSpanEvent.spanId, 'spanChunk spanId on asyncSpanChunkMySQLMatcher')
    t.equal(actualSpanChunk.transactionIdObject, trace.traceId.transactionId, 'spanChunk transactionIdObject on asyncSpanChunkMySQLMatcher')
    t.equal(actualSpanChunk.localAsyncId.asyncId, actualSpanEvent.nextAsyncId, 'spanChunk localAsyncId.asyncId is spanEvent nextAsyncId on asyncSpanChunkMySQLMatcher')
    t.equal(actualSpanChunk.localAsyncId.sequence, 0, 'spanChunk localAsyncId.sequence is spanEvent 0 on asyncSpanChunkMySQLMatcher')
    t.equal(actualSpanChunk.spanEventList[0].apiId, defaultPredefinedMethodDescriptorRegistry.asyncInvocationDescriptor.apiId, 'spanChunk spanEventList[0].apiId must be asyncInvocationDescriptor.apiId on asyncSpanChunkMySQLMatcher')
    t.equal(actualSpanChunk.spanEventList[0].depth, 1, 'spanChunk spanEventList[0].depth is 1 on asyncSpanChunkMySQLMatcher')
    t.equal(actualSpanChunk.spanEventList[0].sequence, 0, 'spanChunk spanEventList[0].sequence is 0 on asyncSpanChunkMySQLMatcher')
    t.equal(actualSpanChunk.spanEventList[0].serviceType, ServiceType.async.getCode(), 'spanChunk spanEventList[0].serviceType is ServiceTypeCode.async on asyncSpanChunkMySQLMatcher')
    t.equal(actualSpanChunk.spanEventList[1].apiId, actualSpanEvent.apiId, 'spanChunk spanEventList[1].apiId must be actualSpanEvent.apiId on asyncSpanChunkMySQLMatcher')
    t.equal(actualSpanChunk.spanEventList[1].depth, 2, 'spanChunk spanEventList[1].depth is 2 on asyncSpanChunkMySQLMatcher')
    t.equal(actualSpanChunk.spanEventList[1].sequence, 1, 'spanChunk spanEventList[1].sequence is 1 on asyncSpanChunkMySQLMatcher')
    t.equal(actualSpanChunk.spanEventList[1].serviceType, mysqlExecuteQueryServiceType.getCode(), 'spanChunk spanEventList[1].serviceType is null on asyncSpanChunkMySQLMatcher')
}

module.exports = {
    expected,
    asyncSpanChunkMySQLMatcher
}