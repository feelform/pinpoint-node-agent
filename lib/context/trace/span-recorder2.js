/**
 * Pinpoint Node.js Agent
 * Copyright 2020-present NAVER Corp.
 * Apache License v2.0
 */

'use strict'

const annotationKey = require('../../constant/annotation-key')
const Annotations = require('../../instrumentation/context/annotation/annotations')
const stringMetaService = require('../string-meta-service')

class SpanRecorder {
    constructor(spanBuilder) {
        this.spanBuilder = spanBuilder
    }

    recordServiceType(code) {
        if (code) {
            this.spanBuilder.setServiceType(code)
        }
    }

    recordApiId(apiId) {
        if (apiId) {
            this.spanBuilder.setApiId(apiId)
        }
    }

    recordApi(methodDescriptor) {
        if (!methodDescriptor || typeof methodDescriptor.getApiId !== 'function' || typeof methodDescriptor.getFullName !== 'function') {
            return
        }

        if (methodDescriptor.getApiId() === 0) {
            this.recordAttribute(annotationKey.API, methodDescriptor.getFullName())
        } else {
            this.setApiId0(methodDescriptor.getApiId())
        }
    }

    setApiId0(apiId) {
        this.spanBuilder.setApiId(apiId)
    }

    recordAttribute(key, value) {
        if (key && typeof key.getCode === 'function' && value) {
            this.spanBuilder.addAnnotation(Annotations.of(key.getCode(), value))
        }
    }

    recordRpc(rpc) {
        if (rpc) {
            this.spanBuilder.setRpc(rpc)
        }
    }

    recordEndPoint(endPoint) {
        if (endPoint) {
            this.spanBuilder.setEndPoint(endPoint)
        }
    }

    recordRemoteAddress(remoteAddr) {
        if (remoteAddr) {
            this.spanBuilder.setRemoteAddress(remoteAddr)
        }
    }

    recordException(error) {
        if (error) {
            const metaInfo = stringMetaService.get(error.name || 'Error')
            this.spanBuilder.setExceptionInfo({
                intValue: metaInfo.stringId,
                stringValue: error.toString()
            })
        }
    }

    recordSpanEvent(spanEvent) {
        if (spanEvent) {
            this.spanBuilder.addSpanEvent(spanEvent)
        }
    }
}

module.exports = SpanRecorder