/**
 * Pinpoint Node.js Agent
 * Copyright 2021-present NAVER Corp.
 * Apache License v2.0
 */


const test = require('tape')
const services = require('../../lib/data/grpc/Service_grpc_pb')
const { log } = require('../test-helper')
const GrpcDataSender = require('../../lib/client/grpc-data-sender')
const GrpcServer = require('./grpc-server')

let actualsPingSession
let endAction
// https://github.com/agreatfool/grpc_tools_node_protoc_ts/blob/v5.0.0/examples/src/grpcjs/server.ts
// https://github.com/grpc/grpc-node/pull/1616/files
function pingSession(call) {
    actualsPingSession.serverDataCount = 0
    call.on('data', (ping) => {
        actualsPingSession.serverDataCount++
        log.debug(`pingSession in data: ${JSON.stringify(ping.toObject())}`)
        if (actualsPingSession.serverDataCount == 1) {
            call.write(ping)
        } else if (actualsPingSession.serverDataCount == 2) {
            call.cancel()
        } else if (actualsPingSession.serverDataCount == 3) {
            call.write(ping)
        }

        actualsPingSession.t.true(actualsPingSession.serverDataCount <= actualsPingSession.dataCount, 'dataCount is matching')

        if (actualsPingSession.serverDataCount == actualsPingSession.dataCount) {
            endAction()
        }
    })
    actualsPingSession.serverEndCount = 0
    call.on('end', () => {
        actualsPingSession.serverEndCount++
        call.end()
        if (actualsPingSession.serverEndCount == 2) {
            actualsPingSession.t.equal(actualsPingSession.serverEndCount, actualsPingSession.endCount, 'bidirectional stream end count match')
        }
    })
}

test('when ping stream write throw a error, gRPC bidirectional stream Ping end ex) Deadline exceeded error case', function (t) {
    t.plan(10)
    actualsPingSession = {}
    const server = new GrpcServer()

    server.addService(services.AgentService, {
        pingSession: pingSession
    })
    server.addService(services.StatService, {
        sendAgentStat: pingSessionServer
    })
    server.addService(services.SpanService, {
        sendSpan: pingSessionServer
    })
    server.startup((port) => {
        actualsPingSession.endCount = 2
        actualsPingSession.dataCount = 2
        actualsPingSession.t = t

        this.grpcDataSender = new GrpcDataSender('localhost', port, port, port, {
            'agentid': '12121212',
            'applicationname': 'applicationName',
            'starttime': Date.now()
        })

        t.equal(this.grpcDataSender.pingStream.constructor.name, 'GrpcBidirectionalStream', `pingStream is the GrpcBidirectionalStream`)
        t.equal(this.grpcDataSender.pingStream.stream.constructor.name, 'ClientDuplexStreamImpl', 'when previous throw Deadline exceeded')

        // when server send stream end event
        let callOrder = 0

        const registeEventListeners = () => {
            const originEnd = this.grpcDataSender.pingStream.stream.listeners('end')[0]
            this.grpcDataSender.pingStream.stream.removeListener('end', originEnd)
            this.grpcDataSender.pingStream.stream.on('end', () => {
                callOrder++
                originEnd()
                if (callOrder == 1) {
                    t.true(this.grpcDataSender.pingStream.stream === null, 'stream is null')
                    nextSendPingTest()
                }
                endAction()
            })

            const originData = this.grpcDataSender.pingStream.stream.listeners('data')[0]
            this.grpcDataSender.pingStream.stream.removeListener('data', originData)
            this.grpcDataSender.pingStream.stream.on('data', (data) => {
                callOrder++
                if (callOrder == 1) {
                    t.true(callOrder == 1, '1st event is data')
                }
                originData(data)
            })

            const originError = this.grpcDataSender.pingStream.stream.listeners('error')[0]
            this.grpcDataSender.pingStream.stream.removeListener('error', originData)
            this.grpcDataSender.pingStream.stream.on('error', (error) => {
                callOrder++
                if (callOrder == 2) {
                    t.true(callOrder == 2, '2st event is error')
                    t.equal(error.code, 13, '"call.cancel is not a function" error code is 13')
                    t.equal(error.message, '13 INTERNAL: call.cancel is not a function', '13 INTERNAL: call.cancel is not a function')
                }
                originError(error)
            })

            const originStatus = this.grpcDataSender.pingStream.stream.listeners('status')[0]
            this.grpcDataSender.pingStream.stream.removeListener('status', originStatus)
            this.grpcDataSender.pingStream.stream.on('status', (status) => {
                callOrder++
                if (callOrder == 3) {
                    t.true(callOrder == 3, '3st is status')
                    // t.equal(error.code, 13, '"call.cancel is not a function" error code is 13')
                    // t.equal(error.message, '13 INTERNAL: call.cancel is not a function', '13 INTERNAL: call.cancel is not a function')
                }
                originStatus(status)
            })
        }

        registeEventListeners()
        t.true(this.grpcDataSender.pingStream.stream, 'Ping stream is Good')
        this.grpcDataSender.sendPing()

        t.true(this.grpcDataSender.pingStream.stream, 'Ping stream is Good')
        this.grpcDataSender.sendPing()


        const nextSendPingTest = () => {
            t.true(this.grpcDataSender.pingStream.stream === null, 'stream is null after call.cancel not found error')
            this.grpcDataSender.sendPing()

            this.grpcDataSender.pingStream.end()
        }
        // t.false(this.grpcDataSender.pingStream.stream, 'after throw Deadline exceeded, ')
        // t.true(this.grpcDataSender.pingStream.actualEnded, 'when throw Deadline exceeded, ended')

        // const originConnectStream = this.grpcDataSender.pingStream.connectStream
        // this.grpcDataSender.pingStream.connectStream = () => {
        //     this.grpcDataSender.pingStream.actualConnectedStream = true
        //     originConnectStream.call(this.grpcDataSender.pingStream)
        // }
        // t.true(this.grpcDataSender.pingStream.stream === null, 'stream is null')
        // t.false(this.grpcDataSender.pingStream.actualConnectedStream, 'stream not reconnected stream')
        // this.grpcDataSender.sendPing()
        // t.true(this.grpcDataSender.pingStream.stream, 'after sendPing, stream is an instance')

        endAction = () => {
            server.tryShutdown(() => {
                t.end()
            })
        }
    })
})

function pingSessionServer(call) {
    actualsPingSessionServer.serverDataCount = 0
    call.on('data', (ping) => {
        actualsPingSessionServer.serverDataCount++
        actualsPingSessionServer.t.true(actualsPingSessionServer.serverDataCount <= actualsPingSessionServer.sendPingCount, 'server data count matches')

        if (actualsPingSessionServer.serverDataCount != 4) {
            call.write(ping)
        }

        if (actualsPingSessionServer.serverDataCount == 2) {
            call.end()
        } else if (actualsPingSessionServer.serverDataCount == 3) {
            throw new Error("Server Error")
        } else if (actualsPingSessionServer.serverDataCount == 4) {
            call.cancel()
        }
    })
    actualsPingSession.serverEndCount = 0
    call.on('end', () => {
        actualsPingSession.serverEndCount++
    })
}

let actualsPingSessionServer
test.skip('Server end(), error, data Test', function (t) {
    t.plan(7)
    actualsPingSessionServer = {}
    const server = new GrpcServer()

    server.addService(services.AgentService, {
        pingSession: pingSessionServer
    })
    server.addService(services.StatService, {
        sendAgentStat: pingSessionServer
    })
    server.addService(services.SpanService, {
        sendSpan: pingSessionServer
    })
    server.startup((port) => {
        actualsPingSessionServer.dataCount = 2
        actualsPingSessionServer.t = t
        actualsPingSessionServer.sendPingCount = 0

        this.grpcDataSender = new GrpcDataSender('localhost', port, port, port, {
            'agentid': '12121212',
            'applicationname': 'applicationName',
            'starttime': Date.now()
        })

        let clientReceiveDataCount = 0
        const originData = this.grpcDataSender.pingStream.stream.listeners('data')[0]
        this.grpcDataSender.pingStream.stream.on('data', (data) => {
            clientReceiveDataCount++
            t.true(clientReceiveDataCount <= actualsPingSessionServer.sendPingCount, 'client receive data count')
            originData(data)
        })

        actualsPingSessionServer.sendPingCount++
        this.grpcDataSender.sendPing()

        // when server send stream end event
        let clientReceiveEndCount = 0
        const originEnd = this.grpcDataSender.pingStream.stream.listeners('end')[0]
        this.grpcDataSender.pingStream.stream.removeListener('end', originEnd)
        this.grpcDataSender.pingStream.stream.on('end', () => {
            clientReceiveEndCount++
            t.true(clientReceiveEndCount <= 2, 'client receive data count')
            originEnd()

            if (clientReceiveDataCount == actualsPingSessionServer.dataCount) {
                endAction()
            }
        })
        actualsPingSessionServer.sendPingCount++
        this.grpcDataSender.sendPing()

        actualsPingSessionServer.sendPingCount++
        this.grpcDataSender.sendPing()

        actualsPingSessionServer.sendPingCount++
        this.grpcDataSender.sendPing()

        endAction = () => {
            this.grpcDataSender.pingStream.end()
            setTimeout(() => {
                t.end()
                server.shutdown()
            }, 0)
        }
    })
})
