/**
 * Pinpoint Node.js Agent
 * Copyright 2021-present NAVER Corp.
 * Apache License v2.0
 */

const test = require('tape')
const grpc = require('@grpc/grpc-js')
const agent = require('../support/agent-singleton-mock')
const cmdMessage = require('../../lib/data/v1/Cmd_pb')
const services = require('../../lib/data/v1/Service_grpc_pb')
const { Empty } = require('google-protobuf/google/protobuf/empty_pb')
const { log } = require('../test-helper')
const GrpcDataSender = require('../../lib/client/grpc-data-sender')
const GrpcClientSideStream = require('../../lib/client/grpc-client-side-stream')
const SpanBuilder = require('../../lib/context/span-builder')
const RemoteTraceRootBuilder = require('../../lib/context/remote-trace-root-builder')
const AgentInfo = require('../../lib/data/dto/agent-info')
const SpanRepository = require('../../lib/context/trace/span-repository')
const DataSender = require('../../lib/client/data-sender')
const SpanChunkBuilder = require('../../lib/context/span-chunk-builder')

let actuals

const agentInfo = AgentInfo.create({
                    agentId: 'express-node-sample-id',
                    applicationName: 'express-node-sample-name',
                    serviceType: 1400
                }, 1592572771026)
const traceRoot = new RemoteTraceRootBuilder(agentInfo, 5).build()
const expectedSpanBuilder = new SpanBuilder(traceRoot)
expectedSpanBuilder.setServiceType(1400)
expectedSpanBuilder.setEndPoint('localhost:3000')
expectedSpanBuilder.setRemoteAddress('::1')

// https://github.com/agreatfool/grpc_tools_node_protoc_ts/blob/v5.0.0/examples/src/grpcjs/server.ts
function sendAgentStat(call, callback) {
    call.on('data', function (statMessage) {

    })
    call.on('error', function (error) {
        log.debug(`error: ${error}`)
    })
    call.on('end', function () {
        callback(null, new Empty())
    })
}

function sendSpan(call, callback) {
    call.on('error', function (error) {
        actuals.t.equal(error.message, '6st sendSpan serverSpanDataCount is 4', '6st sendSpan serverSpanDataCount throws an error')
    })
    call.on('data', function (spanMessage) {
        actuals.serverSpanDataCount++

        const span = spanMessage.getSpan()
        if (actuals.serverSpanDataCount == 1) {
            actuals.t.equal(actuals.serverSpanDataCount, 1, '1st sendSpan serverSpanDataCount is 1')
            actuals.t.equal(span.getSpanid(), expectedSpanBuilder.getTraceRoot().getTraceId().getSpanId(), 'span ID match in 1st sendSpan')
        } else if (actuals.serverSpanDataCount == 2) {
            actuals.t.equal(actuals.serverSpanDataCount, 2, '2st sendSpan serverSpanDataCount is 2')
            actuals.t.equal(span.getServicetype(), 1400, 'service type match in 2st sendSpan')
        } else if (actuals.serverSpanDataCount == 4) {
            actuals.t.equal(actuals.serverSpanDataCount, 4, '6st sendSpan serverSpanDataCount is 4')
            call.emit('error', new Error('6st sendSpan serverSpanDataCount is 4'))
        }
    })
    call.on('end', function () {
        callback(null, new Empty())
    })
}

function pingSession(call) {
    call.on('data', function () {
        actuals.serverPingCount++
    })
    call.on('end', () => {
        call.end()
    })
}

const handleCommandV2Service = (call, callback) => {
    const result = new cmdMessage.PResult()
    callback(null, result)
}


// https://github.com/grpc/grpc-node/issues/1542
// https://github.com/grpc/grpc-node/pull/1616/files
// https://github.com/agreatfool/grpc_tools_node_protoc_ts/blob/v5.0.0/examples/src/grpcjs/client.ts
// stream.isReady() newRunnable(DefaultStreamTask.java)
test('client side streaming with deadline and cancellation', function (t) {
    t.plan(24)
    actuals = {}
    // when server send stream
    let callOrder = 0

    const server = new grpc.Server()
    server.addService(services.AgentService, {
        pingSession: pingSession
    })
    server.addService(services.StatService, {
        sendAgentStat: sendAgentStat
    })
    server.addService(services.SpanService, {
        sendSpan: sendSpan
    })
    server.addService(services.ProfilerCommandServiceService, {
        handleCommandV2: handleCommandV2Service
    })

    server.bindAsync('localhost:0', grpc.ServerCredentials.createInsecure(), (err, port) => {
        actuals.dataCount = 1
        actuals.t = t
        actuals.sendSpanCount = 0
        actuals.sendStatCount = 0
        actuals.serverSpanDataCount = 0
        actuals.serverPingCount = 0

        this.grpcDataSender = new GrpcDataSender('localhost', port, port, port, agentInfo, agent.config)
        this.dataSender = new DataSender(agent.config, this.grpcDataSender)
        const spanChunkBuilder = new SpanChunkBuilder(traceRoot)
        const repository = new SpanRepository(spanChunkBuilder, this.dataSender, agentInfo)

        this.grpcDataSender.spanStream.callback = (err) => {
            callOrder++

            if (callOrder == 1/* 3st spanStream end in callback */) {
                t.equal(callOrder, 1, '3st spanStream end in callback')
                t.equal(actuals.sendSpanCount, actuals.serverSpanDataCount, `span data count on server ${actuals.sendSpanCount}`)
            } else if (callOrder == 3/* 5st spanStream end in callback */) {
                t.equal(callOrder, 3, '5st spanStream end in callback')
            } else if (callOrder == 5/* 6st sendSpan */) {
                t.equal(callOrder, 5, '6st spanStream end in callback')
                t.equal(err.details, '6st sendSpan serverSpanDataCount is 4', 'details in 6st spanStream callback')
            } else if (callOrder == 7/* 8st when spanStream end, recovery spanstream */) {
                t.equal(callOrder, 7, '8st when spanStream end, recovery spanstream in callback')
                t.false(err, 'OK in 8st recovery spanstream callback')
            } else if (callOrder == 9/* 12st sendSpan and end when server shutdown */) {
                t.equal(callOrder, 9, '12st sendSpan and end when server shutdown in callback')
            }
        }

        const registerEventListeners = () => {
            const originStatus = this.grpcDataSender.spanStream.grpcStream.stream.listeners('status')[0]
            this.grpcDataSender.spanStream.grpcStream.stream.removeListener('status', originStatus)
            this.grpcDataSender.spanStream.grpcStream.stream.on('status', (status) => {
                callOrder++
                if (callOrder == 2/* 3st spanStream end on stream status event */) {
                    t.true(callOrder == 2, '3st spanStream end call Order on stream status event')
                    t.equal(status.code, 0, 'OK on 3st stream status event')
                    t.equal(status.details, 'OK', 'OK on 3st stream status event')
                } else if (callOrder == 4/* 5st spanStream end on stream status event */) {
                    t.true(callOrder == 4, '5st spanStream end call Order on stream status event')
                    t.equal(status.code, 0, 'status.code: 0 OK on 5st stream status event')
                    t.equal(status.details, 'OK', `status.details: OK on 5st stream status event`)
                    setTimeout(() => {
                        // 6st sendSpan
                        actuals.sendSpanCount++
                        repository.storeSpan(expectedSpanBuilder)
                        registerEventListeners()
                    })
                } else if (callOrder == 6/* 6st sendSpan */) {
                    t.true(callOrder == 6, '6st spanStream end call Order on stream status event')
                    t.equal(status.details, '6st sendSpan serverSpanDataCount is 4', 'details on stream status event')
                    setTimeout(() => {
                        // 8st when spanStream end, recovery spanstream
                        actuals.sendSpanCount++
                        repository.storeSpan(expectedSpanBuilder)
                        registerEventListeners()
                        this.grpcDataSender.spanStream.grpcStream.end()
                    })
                } else if (callOrder == 8/* 8st when spanStream end, recovery spanstream */) {
                    t.equal(callOrder, 8, '8st when spanStream end, recovery on stream status event')
                    t.equal(status.code, 0, 'OK on 8st stream status event')
                    t.equal(status.details, 'OK', 'OK on 8st stream status event')
                    // // 8st sendSpan when server shutdown
                    // this.grpcDataSender.sendSpan(span)
                    // // 9st sendSpan when server shutdown
                    // this.grpcDataSender.sendSpan(span)
                    // // 10st sendSpan when server shutdown
                    // this.grpcDataSender.sendSpan(span)
                    t.end()
                }
                originStatus.call(this.grpcDataSender.spanStream, status)
            })
        }

        registerEventListeners()

        t.teardown(() => {
            server.forceShutdown()
            this.grpcDataSender.close()
        })

        // 1st sendSpan
        actuals.sendSpanCount++
        repository.storeSpan(expectedSpanBuilder)
        // 2st sendSpan
        actuals.sendSpanCount++
        repository.storeSpan(expectedSpanBuilder)
        // 3st spanStream end
        this.grpcDataSender.spanStream.grpcStream.end()

        // 4st sendSpan
        actuals.sendSpanCount++
        repository.storeSpan(expectedSpanBuilder)
        registerEventListeners()
        // 5st spanStream end
        this.grpcDataSender.spanStream.grpcStream.end()

        this.grpcDataSender.pingStream.grpcStream.end()
        this.grpcDataSender.statStream.grpcStream.end()
    })
})


test('gRPC client side stream reconnect test', (t) => {
    let actuals = {}
    const given = new GrpcClientSideStream('spanStream', {}, () => {
        return {
            on: function () {

            },
            write: function (data) {
                actuals.data = data
                return true
            },
            end: function () {
                actuals.ended = true
            },
            writable: true
        }
    })
    t.true(given.deadline > 0, 'deadline is initialized')
    given.write({})
    t.deepEqual(actuals.data, {}, 'actuals data')
    t.false(actuals.ended, 'client side stream lives')

    given.deadline = given.deadline - (10 * 60 * 1000 + 100)
    const fistDeadline = given.deadline
    given.write({ order: 2 })
    t.deepEqual(actuals.data, { order: 2 }, 'actuals data is order: 2')

    t.equal(fistDeadline, given.deadline, 'deadline no changes')
    given.write({ order: 3 })
    t.deepEqual(actuals.data, { order: 3 }, 'actuals data is order: 3')

    t.end()
})

function sendSpan1(call, callback) {
    call.on('data', function () {
        actualsSpanSession.serverDataCount++
        if (typeof actualsSpanSession.callback === 'function') {
            actualsSpanSession.callback(actualsSpanSession.serverDataCount)
        }
    })
    call.on('error', function (error) {
        log.debug(`error: ${error}`)
    })
    call.on('end', function () {
        actualsSpanSession.serverEndCount++
        callback(null, new Empty())
    })
}
let actualsSpanSession
test('spanStream ERR_STREAM_WRITE_AFTER_END', (t) => {
    actualsSpanSession = {
        serverDataCount: 0,
        serverEndCount: 0
    }
    const callCount = 10

    const server = new grpc.Server()
    server.addService(services.AgentService, {
        pingSession: pingSession
    })
    server.addService(services.StatService, {
        sendAgentStat: sendAgentStat
    })
    server.addService(services.SpanService, {
        sendSpan: sendSpan1
    })

    server.bindAsync('localhost:0', grpc.ServerCredentials.createInsecure(), (err, port) => {
        this.grpcDataSender = new GrpcDataSender('localhost', port, port, port, agent.getAgentInfo())

        actualsSpanSession.callback = (count) => {
            if (count == callCount) {
                t.end()
            }
        }

        for (let index = 0; index < callCount; index++) {
            if (0 == index % 2) {
                this.grpcDataSender.spanStream.grpcStream.end()
            }
            this.grpcDataSender.sendSpan(expectedSpanBuilder.build())
        }

        this.grpcDataSender.pingStream.grpcStream.end()
        this.grpcDataSender.statStream.grpcStream.end()
    })

    t.teardown(() => {
        this.grpcDataSender.close()
        server.forceShutdown()
    })
})

// https://github.com/pinpoint-apm/pinpoint-node-agent/issues/33#issuecomment-783891805
test('gRPC stream write retry test', (t) => {
    let retryCount = 0
    const given = new GrpcClientSideStream('spanStream', {}, () => {
        return {
            on: function () {

            },
            write: function (data, callback) {
                retryCount++

                if (retryCount == 1) {
                    callback(new Error('[ERR_STREAM_WRITE_AFTER_END]: write after end'))
                } else {
                    callback(new Error('Unknow exception'))
                }
            },
            once: function () {
            },
            end: function () {
            }
        }
    })

    t.true(given.grpcStream.stream, 'gRPC stream has streams')
    given.write({})
    t.equal(retryCount, 2, 'retry only once')
    t.false(given.stream, 'gRPC stream has ended')


    t.end()
})

//https://github.com/pinpoint-apm/pinpoint-node-agent/issues/67
test('stream HighWaterMark method in write', (t) => {
    t.plan(4)
    let eventCount = 0
    const given = new GrpcClientSideStream('spanStream', {}, () => {
        return {
            on: function (eventName) {
                eventCount++
                if (eventCount == 1) {
                    t.equal(eventName, 'error', 'clientSideStream listen error event')
                } else if (eventCount == 2) {
                    t.equal(eventName, 'status', 'clientSideStream listen status event')
                }
            },
            write: function () {
                return false
            },
            once: function (eventName) {
                t.equal(eventName, 'drain', 'once event called')
            }
        }
    })
    given.write({})
    t.true(given.grpcStream.writableHighWaterMarked, 'HightWaterMarked')
    t.end()
})

//https://github.com/pinpoint-apm/pinpoint-node-agent/issues/67
test('steam is null on HighWaterMark case', (t) => {
    const given = new GrpcClientSideStream('spanStream', {}, () => {
        return {
            on: function () {
            },
            write: function () {
                return false
            },
            once: function (eventName) {
                t.equal(eventName, 'drain', 'once event called')
            }
        }
    })
    given.grpcStream.stream = undefined
    t.equal(given.grpcStream.writableHighWaterMarked, undefined, 'if stream is null, writableHighWaterMarked is undefined')
    t.end()
})

test('sendSpan throw error and then stream is HighWaterMark', (t) => {
    t.plan(12)
    let streamCount = 0
    let callEndCount = 0
    let callback
    let writeCount = 0
    const given = new GrpcClientSideStream('spanStream', {}, () => {
        streamCount++
        if (streamCount == 1) {
            return {
                on: function () {
                },
                write: function (data, cb) {
                    writeCount++
                    process.nextTick(() => {
                        t.equal(streamCount, 1, 'sendSpan pass an error')
                        cb(new Error('error write'))
                    })
                    return true
                },
                once: function (eventName) {
                },
                end: function () {
                    callEndCount++
                    if (callEndCount == 1) {
                        t.equal(streamCount, 1, 'sendSpan pass an error and then end a stream')
                    }
                    if (callEndCount == 2) {
                        t.false(given.stream, 'stream is not null')
                        t.equal(streamCount, 1, 'sendSpan pass an error and then end a stream')
                    }
                }
            }
        }
        return {
            on: function (eventName) {
                if (eventName == 'error') {
                    t.equal(streamCount, 2, 'after pass an error and then create stream')
                }
            },
            write: function () {
                writeCount++
                return false
            },
            once: function (eventName, cb) {
                callback = cb
                t.equal(eventName, 'drain', 'once event called')
            }
        }
    })
    given.write({})
    process.nextTick(() => {
        t.equal(writeCount, 2, 'sendSpan throw an error and then retry sendSpan and then HightWaterMark')

        given.write({})
        t.equal(writeCount, 2, 'sendSpan canceled, when HightWaterMark')

        given.write({})
        t.equal(writeCount, 2, 'sendSpan canceled, when HightWaterMark')

        callback()
        given.write({})
        t.equal(writeCount, 3, 'sendSpan canceled, when HightWaterMark')

        given.write({})
        t.equal(writeCount, 3, 'sendSpan canceled, when HightWaterMark')
    })
})

test('stream deadline test', (t) => {
    t.plan(2)
    const given = new GrpcClientSideStream('spanStream', {}, () => {
        return {
            on: function () {
            },
            write: function () {
                return false
            },
            once: function (eventName) {
                t.equal(eventName, 'drain', 'once event called')
            }
        }
    })

    t.equal(given.grpcStreamDeadline, 600 * 1000, 'default dealine times')

    given.setDeadlineMinutes(6)
    t.equal(given.grpcStreamDeadline, 6 * 60 * 1000, '6 minutes dealine times')
})