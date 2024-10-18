/**
 * Pinpoint Node.js Agent
 * Copyright 2020-present NAVER Corp.
 * Apache License v2.0
 */

'use strict'

const SpanEventBuilder = require("./span-event-builder")

class SpanEventRecorder {
    static nullObject = new SpanEventRecorder(SpanEventBuilder.nullObject)
    constructor(spanEventBuilder) {
        this.spanEventBuilder = spanEventBuilder
    }

    makeTraceBlockBegin() {
        return new SpanEventRecorder(spanEventBuilder.makeTraceBlockBegin())
    }

    getSpanEventBuilder() {
        return this.spanEventBuilder
    }
}

module.exports = SpanEventRecorder