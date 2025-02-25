/**
 * Pinpoint Node.js Agent
 * Copyright 2021-present NAVER Corp.
 * Apache License v2.0
 */

'use strict'

const test = require('tape')
const grpc = require('@grpc/grpc-js')
const { beforeSpecificOne } = require('./grpc-fixture')
const services = require('../../lib/data/v1/Service_grpc_pb')
const cmdMessage = require('../../lib/data/v1/Cmd_pb')
const { ProfilerDataSource } = require('./grpc-fixture')
const { Empty } = require('google-protobuf/google/protobuf/empty_pb')
const shimmer = require('@pinpoint-apm/shimmer')
const GrpcReadableStream = require('../../lib/client/grpc-readable-stream')

test('If you run the ActiveRequest function, send the fifth piece of data, and the Pinpoint server fails, the ActiveRequest gRPC Stream closes and the for statement stops', (t) => {
    t.plan(45)
    const server = new grpc.Server()
    let handleCommandCall
    let requestId = 1
    function callHandleCommandStream(requestId) {
        const result = new cmdMessage.PCmdRequest()
        result.setRequestid(requestId)
        const message = new cmdMessage.PCmdActiveThreadCount()
        result.setCommandactivethreadcount(message)
        handleCommandCall.write(result)
    }
    let activeRequestCount = 0
    const profilerServices = {
        handleCommand: (call) => {
            handleCommandCall = call

            callHandleCommandStream(requestId)
        },
        commandStreamActiveThreadCount: (call, callback) => {
            call.on('data', (data) => {
                activeRequestCount++
                const commonStream = data.getCommonstreamresponse()
                if (commonStream.getResponseid() == 1) {
                    t.equal(data.getHistogramschematype(), 2, 'schemaType is 2')
                    t.equal(commonStream.getResponseid(), 1, 'responseId is 1')
                    t.equal(commonStream.getSequenceid(), activeRequestCount, `sequenceId is ${activeRequestCount}`)

                    if (activeRequestCount === 5) {
                        server.forceShutdown()
                    }

                    if (activeRequestCount > 5) {
                        t.fail('The for statement should stop when the server fails')
                    }
                } else if (commonStream.getResponseid() == 2) {
                    t.equal(data.getHistogramschematype(), 2, 'schemaType is 2')
                    t.equal(commonStream.getResponseid(), 2, 'responseId is 2')
                    t.equal(commonStream.getSequenceid(), activeRequestCount - 5, `sequenceId is ${activeRequestCount - 5}`)

                    if (activeRequestCount === 13) {
                        callback(null, new Empty())
                    }
                }
            })
        }
    }
    server.addService(services.ProfilerCommandServiceService, profilerServices)

    let dataSender
    server.bindAsync('localhost:0', grpc.ServerCredentials.createInsecure(), (err, port) => {
        dataSender = beforeSpecificOne(port, ProfilerDataSource)
        let handleCommandCallCount = 0
        shimmer.wrap(dataSender.profilerClient, 'handleCommand', function (original) {
            return function () {
                handleCommandCallCount++
                const result = original.apply(this, arguments)
                result.on('end', () => {
                    if (handleCommandCallCount === 3) {
                        server2 = new grpc.Server()
                        server2.addService(services.ProfilerCommandServiceService, profilerServices)
                        server2.bindAsync(`localhost:${port}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
                            requestId = 2
                        })
                    }
                })
                return result
            }
        })

        let makeCallMethodCallCount = 0
        let firstCommandStream
        let firstActiveRequestStream
        shimmer.wrap(GrpcReadableStream.prototype, 'pipeWritableStream', function (original) {
            return function () {
                makeCallMethodCallCount++

                const result = original.apply(this, arguments)
                if (makeCallMethodCallCount === 1) {
                    firstCommandStream = this
                    t.equal(firstCommandStream.name, '', '1st created commandStream is creating writable stream')
                } else if (makeCallMethodCallCount === 2) {
                    firstActiveRequestStream = this
                    t.equal(firstActiveRequestStream.name, 'activeThreadCountStream', '2nd created stream is activeRequestStream')
                    firstActiveRequestStream.writableStream.on('end', () => {
                        t.fail('ActiveThreadCountStream writableStream is the Server side stream, so it call directly end method')
                    })
                    shimmer.wrap(firstActiveRequestStream.writableStream, 'end', function (original) {
                        return function () {
                            const result = original.apply(this, arguments)
                            t.true('The first activeRequestStream is end method called by Readable Stream ended')
                            t.equal(firstActiveRequestStream.writableStream, this, 'The first activeRequestStream is end method called by Readable Stream ended')
                            return result
                        }
                    })
                }
                return result
            }
        })

        let callCountHandleCommand = 0
        let server2
        dataSender.sendSupportedServicesCommand((err) => {
            callCountHandleCommand++
            if (callCountHandleCommand == 1) {
                t.equal(err.code, 1, 'When the server is down, the error code is 1')
                t.equal(activeRequestCount, 5, 'ended activeRequestCount is 5')
            } else if (callCountHandleCommand === 2) {
                setTimeout(() => {
                    dataSender.close()
                    handleCommandCall.end()
                    process.nextTick(() => {
                        server2.forceShutdown()
                    })
                    shimmer.unwrap(GrpcReadableStream.prototype, 'pipeWritableStream')
                    t.end()
                }, 1000)
            }
        })
    })
})
