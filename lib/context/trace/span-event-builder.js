/**
 * Pinpoint Node.js Agent
 * Copyright 2020-present NAVER Corp.
 * Apache License v2.0
 */

'use strict'

const { nullObject } = require("./span-event-recorder2")

class SpanEvent {
    constructor(sequence) {
        this.sequence = sequence
    }
}

class SpanEventBuilder {
    static nullObject = new SpanEventBuilder(-1, -1)

    constructor(sequence, depth) {
        this.sequence = sequence
        this.depth = depth
        this.annotations = []
        this.startTime = Date.now()
    }

    markElapsedTime() {
        this.elapsedTime = Date.now() - this.startTime
        return this
    }

    addAnnotation(annotation) {
        this.annotations.push(annotation)
        return this
    }

    makeTraceBlockBegin() {
        if (this === SpanEventBuilder.nullObject) {
            return SpanEventBuilder.nullObject
        }
        return new SpanEventBuilder(this.sequence + 1, this.depth + 1)
    }

    build() {
        const spanEvent = new SpanEvent(this.sequence)
        spanEvent.depth = this.depth
        spanEvent.annotations = this.annotations
        spanEvent.startTime = this.startTime
        spanEvent.elapsedTime = this.elapsedTime
        return spanEvent
    }
}

module.exports = SpanEventBuilder