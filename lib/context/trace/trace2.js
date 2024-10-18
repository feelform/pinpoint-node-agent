/**
 * Pinpoint Node.js Agent
 * Copyright 2020-present NAVER Corp.
 * Apache License v2.0
 */

'use strict'

const SpanEventBuilder = require('./span-event-builder')
const SpanEventRecorder = require('./span-event-recorder2')
const SpanRecorder = require('./span-recorder2')

class Trace {
    /**
     * Creates an instance of Trace.
     * 
     * @param {Object} spanBuilder - The builder for creating a span.
     * @param {Object} repository - The repository for storing trace data.
     */
    constructor(spanBuilder, repository) {
        this.spanBuilder = spanBuilder
        this.repository = repository
        this.spanRecorder = new SpanRecorder(spanBuilder)

        this.callStack = []
        this.closed = false

        this.spanEventRecorder = new SpanEventRecorder(new SpanEventBuilder(0, this.callStack.length + 1))
    }

    // DefaultTrace.java: traceBlockEnd
    traceBlockBegin() {
        if (this.closed) {
            return SpanEventRecorder.nullObject
        }

        // GrpcSpanProcessorV2: postProcess
        const spanEventRecorder = this.spanEventRecorder.makeTraceBlockBegin()
        this.callStack.push(spanEventRecorder.getSpanEventBuilder())

        return spanEventRecorder
    }

    canSampled() {
        return true
    }

    close() {
        this.closed = true
        this.repository.storeSpan(this.spanBuilder.build())
    }
}

module.exports = Trace