/**
 * Pinpoint Node.js Agent
 * Copyright 2020-present NAVER Corp.
 * Apache License v2.0
 */

const test = require('tape')

const services = require('../../lib/data/grpc/Service_grpc_pb')

var _ = require('lodash')
const GrpcServer = require('./grpc-server')

const spanMessages = require('../../lib/data/grpc/Span_pb')
const dataSenderFactory = require('../../lib/client/data-sender-factory')
const AgentInfo = require('../../lib/data/dto/agent-info')

let agentInfo = 0
// https://github.com/agreatfool/grpc_tools_node_protoc_ts/blob/v5.0.0/examples/src/grpcjs/server.ts
function requestAgentInfo(call, callback) {
    agentInfo++

    const result = new spanMessages.PResult()
    _.delay(() => {
        callback(null, result)
        if (agentInfo == 3) {
            tryShutdown()
        }
    }, 100)
}

// https://github.com/agreatfool/grpc_tools_node_protoc_ts/blob/v5.0.0/examples/src/grpcjs/client.ts
let tryShutdown
test('sendAgentInfo refresh', (t) => {
    const server = new GrpcServer()
    server.addService(services.AgentService, {
        requestAgentInfo: requestAgentInfo
    })
    server.startup((port) => {
        const agentInfo1 = Object.assign(new AgentInfo({
            agentId: '12121212',
            applicationName: 'applicationName',
            agentStartTime: Date.now()
        }), {
            ip: '1'
        })

        this.dataSender = dataSenderFactory.create({
            collectorIp: 'localhost',
            collectorTcpPort: port,
            collectorStatPort: port,
            collectorSpanPort: port,
            enabledDataSending: true
        }, agentInfo1)

        this.dataSender.dataSender.requestAgentInfo.getDeadline = () => {
            const deadline = new Date()
            deadline.setMilliseconds(deadline.getMilliseconds() + 100)
            return deadline
        }
        this.dataSender.dataSender.requestAgentInfo.retryInterval = 0
        const origin = this.dataSender.dataSender.requestAgentInfo.request
        let callbackTimes = 0
        const callback = (err, response) => {
            callbackTimes++
            t.true(err, 'retry 3 times and err deadline')
            t.equal(callbackTimes, 1, 'callback only once called')
            t.false(response, 'retry response is undefined')
        }
        this.dataSender.dataSender.requestAgentInfo.request = (data, _, timesOfRetry = 0) => {
            origin.call(this.dataSender.dataSender.requestAgentInfo, data, callback, timesOfRetry)
        }
        this.dataSender.send(agentInfo1)

        tryShutdown = () => {
            setTimeout(() => {
                server.tryShutdown(() => {
                    t.end()
                })
            }, 0)
        }
    })
})
