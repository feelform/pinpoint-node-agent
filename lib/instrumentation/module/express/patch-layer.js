/**
 * Pinpoint Node.js Agent
 * Copyright 2023-present NAVER Corp.
 * Apache License v2.0
 */

'use strict'

const apiMetaService = require('../../../context/api-meta-service')
const shimmer = require('@pinpoint-apm/shimmer')
const serviceType = require('./express-service-type')
const util = require('util')
const errorReportedSymbol = Symbol('PinpointErrorReported')
const localStorage = require('../../../instrumentation/context/local-storage')

function patchLayer(layer, context) {
    shimmer.wrap(layer, 'handle', function (original) {
        let handle
        if (original.length !== 4) {
            handle = function(req, res, next) {
                const trace = localStorage.getStore()
                if (!trace) {
                    return original.apply(this, arguments)
                }
                
                const spanEventRecorder = trace.traceBlockBegin()
                spanEventRecorder.recordServiceType(serviceType)

                let builder = context.getMethodDescriptorBuilder()
                if (builder && typeof builder.isRuntimeDetection === 'function' && builder.isRuntimeDetection() && req && typeof req.method === 'string') {
                    builder = builder.makeCloneOf(req.method.toLowerCase())
                }
                const apiMethodDescriptor = apiMetaService.cacheApiWithBuilder(builder)
                spanEventRecorder.recordApi(apiMethodDescriptor)

                // https://github.com/elastic/apm-agent-nodejs/issues/443#issuecomment-455352070
                if (!layer.route && typeof next === 'function') {
                    arguments[2] = function () {
                        trace.traceBlockEnd(spanEventRecorder)
                        return next.apply(this, arguments)
                    }
                }
                const result = original.apply(this, arguments)
                trace.traceBlockEnd(spanEventRecorder)
                return result
            }
        } else {
            handle = function (err, req, res, next) {
                const trace = localStorage.getStore()
                let spanEventRecorder = null
                if (shouldReport(err, trace)) {
                    spanEventRecorder = trace.traceBlockBegin()
                    spanEventRecorder.recordServiceType(serviceType)
                    spanEventRecorder.recordException(err, true)

                    let builder = context.getMethodDescriptorBuilder()
                    if (builder && typeof builder.isRuntimeDetection === 'function' && builder.isRuntimeDetection() && req && typeof req.method === 'string') {
                        builder = builder.makeCloneOf(req.method.toLowerCase())
                    }
                    const apiMethodDescriptor = apiMetaService.cacheApiWithBuilder(builder)
                    spanEventRecorder.recordApi(apiMethodDescriptor)
                }
                const result = original.apply(this, arguments)
                if (trace && spanEventRecorder) {
                    trace.traceBlockEnd(spanEventRecorder)
                }
                return result
            }
        }
        return handle
    })
}

function shouldReport(error, trace) {
    if (!trace) {
      return false
    }
    if (typeof error === 'string') {
      return true
    }
    if (isError(error) && !error[errorReportedSymbol]) {
      error[errorReportedSymbol] = true
      return true
    }
    return false
}

function isError(error) {
    if (!util.types) {
      return util.isError(error)
    }
    return util.types.isNativeError(error)
}

module.exports = patchLayer