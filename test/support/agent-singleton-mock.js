/**
 * Pinpoint Node.js Agent
 * Copyright 2020-present NAVER Corp.
 * Apache License v2.0
 */

'use strict'

const { log } = require('../test-helper')
const enableDataSending = require('../test-helper').enableDataSending
enableDataSending()
const Agent = require('../../lib/agent')
const dataSenderMock = require('./data-sender-mock')
const shimmer = require('@pinpoint-apm/shimmer')
const httpShared = require('../../lib/instrumentation/http-shared')
const TraceContext = require('../../lib/context/trace-context')
const activeTrace = require('../../lib/metric/active-trace')
const apiMetaService = require('../../lib/context/api-meta-service')
const { setDataSender } = require('../../lib/client/data-sender-factory')
const localStorage = require('../../lib/instrumentation/context/local-storage')
const { cleanup } = require('../fixture')
const sqlMetaDataService = require('../../lib/instrumentation/sql/sql-metadata-service')
const SimpleCache = require('../../lib/utils/simple-cache')
const sampler = require('../../lib/sampler/sampler')
const transactionIdGenerator = require('../../lib/context/sequence-generators').transactionIdGenerator
const closedTraceWrapped = Symbol('closedTraceWrapped')

class MockAgent extends Agent {
    startSchedule(agentId, agentStartTime) {
        this.mockAgentId = agentId
        this.mockAgentStartTime = agentStartTime
    }

    initializeDataSender() {
        this.dataSender = dataSenderMock()
        this.dataSender.send(this.agentInfo)
    }

    bindHttp(json) {
        this.cleanHttp()
        apiMetaService.init(dataSenderMock())

        if (!json) {
            json = require('../pinpoint-config-test')
        } else {
            json = Object.assign({}, require('../pinpoint-config-test'), json)
        }
        require('../../lib/config').clear()
        const config = require('../../lib/config').getConfig(json)
        this.config = config

        sqlMetaDataService.cache = new SimpleCache(1024)
        this.traceContext.isSampling = sampler.getIsSampling(config.sampling, config.sampleRate)
        if (sampler.getSamplingCountGenerator()) {
            sampler.getSamplingCountGenerator().reset()
        }
        transactionIdGenerator.reset()

        httpShared.clearPathMatcher()
        const http = require('http')
        log.debug('shimming http.Server.prototype.emit function')
        shimmer.wrap(http && http.Server && http.Server.prototype, 'emit', httpShared.instrumentRequest(agent, 'http'))

        log.debug('shimming http.request function')
        shimmer.wrap(http, 'request', httpShared.traceOutgoingRequest(agent, 'http'))

        localStorage.disable()

        const activeTraces = activeTrace.getAllTraces()
        activeTraces.forEach((value) => {
            activeTrace.remove(value)
        })

        this.dataSender = dataSenderMock()
        setDataSender(this.dataSender)
        this.traceContext = new TraceContext(this.agentInfo, this.dataSender, this.config)

        this.closedTraces = []
    }

    cleanHttp() {
        cleanup()
        const http = require('http')
        shimmer.unwrap(http && http.Server && http.Server.prototype, 'emit')
        shimmer.unwrap(http, 'request')
    }

    callbackTraceClose(callback) {
        const trace = this.traceContext.currentTraceObject()
        const closedTrace = this.closedTraces.find((closedTrace) => trace === closedTrace)
        if (closedTrace) {
            callback(closedTrace)
            return
        }

        const origin = trace.close
        trace.close = function () {
            origin.apply(trace, arguments)
            callback(trace)
        }
        trace[closedTraceWrapped] = true
    }

    bindHttpWithCallSite() {
        this.bindHttp({ 'trace-location-and-filename-of-call-site': true })
    }

    completeTraceObject(trace) {
        super.completeTraceObject(trace)
        if (!trace[closedTraceWrapped]) {
            this.closedTraces.push(trace)
        }
    }
}

const agent = new MockAgent(require('../pinpoint-config-test'))
module.exports = agent