/**
 * Pinpoint Node.js Agent
 * Copyright 2020-present NAVER Corp.
 * Apache License v2.0
 */

const test = require('tape')
const agent = require('../../support/agent-singleton-mock')
const express = require('express')
const { MongoDBContainer } = require('@testcontainers/mongodb')
const axios = require('axios')
const grpc = require('@grpc/grpc-js')
const services = require('../../../lib/data/v1/Service_grpc_pb')
const spanMessages = require('../../../lib/data/v1/Span_pb')
const { MongoClient } = require('mongodb')

test('mongodb connect', async (t) => {
    const collectorServer = new grpc.Server()
    collectorServer.addService(services.MetadataService, {
        requestApiMetaData: (call, callback) => {
            const result = new spanMessages.PResult()
            callback(null, result)
        }
    })
    collectorServer.bindAsync('localhost:0', grpc.ServerCredentials.createInsecure(), async (error, port) => {
        agent.bindHttpWithCallSite(port)
        const mongodbContainer = await new MongoDBContainer("mongo:6.0.1").start()
        const client = new MongoClient(mongodbContainer.getConnectionString(), { directConnection: true })
        await client.connect()

        const app = express()
        app.get('/', async (req, res) => {
            const result = await client.db('test').collection('test').insertOne({ name: 'test' })
            const findOneResult = await client.db('test').collection('test').findOne({ name: 'test' })
            agent.callbackTraceClose(async (trace) => {
                t.true(result.insertedId, `insertedId is ${result.insertedId}`)
                t.deepEqual(result.insertedId, findOneResult._id, `findOne result is ${findOneResult._id}`)
                t.end()
            })
            res.send('ok get')
        })

        const server = app.listen(5006, async () => {
            const result = await axios.get('http://localhost:5006/')
            t.equal(result.status, 200, 'status code is 200')
        })
        t.teardown(async () => {
            client.close()
            server.close()
            await mongodbContainer.stop()
            collectorServer.tryShutdown(() => { })
        })
    })
})