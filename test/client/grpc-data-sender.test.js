/**
 * Pinpoint Node.js Agent
 * Copyright 2020-present NAVER Corp.
 * Apache License v2.0
 */

const test = require('tape')
const annotationKey = require('../../lib/constant/annotation-key')
const AsyncId = require('../../lib/context/async-id')
const SpanChunk = require('../../lib/context/span-chunk')
const Span = require('../../lib/context/span')
const SpanEvent = require('../../lib/context/span-event')
const MockGrpcDataSender = require('./mock-grpc-data-sender')
const grpc = require('@grpc/grpc-js')
const services = require('../../lib/data/v1/Service_grpc_pb')
const { beforeSpecificOne, afterOne, getCallRequests, getMetadata, DataSourceCallCountable } = require('./grpc-fixture')
const cmdMessage = require('../../lib/data/v1/Cmd_pb')
const CommandType = require('../../lib/client/command/command-type')
const { Empty } = require('google-protobuf/google/protobuf/empty_pb')
const Annotations = require('../../lib/instrumentation/context/annotation/annotations')
const CallArgumentsBuilder = require('../../lib/client/call-arguments-builder')

let sendSpanMethodOnDataCallback
function sendSpan(call) {
  call.on('error', function (error) {
  })
  call.on('data', function (spanMessage) {
    const span = spanMessage.getSpan()
    const callRequests = getCallRequests()
    callRequests.push(span)
    if (typeof sendSpanMethodOnDataCallback === 'function') {
      sendSpanMethodOnDataCallback(span)
    }
  })
  call.on('end', function () {
  })
  const callMetadata = getMetadata()
  callMetadata.push(call.metadata)
}

class DataSource extends DataSourceCallCountable {
  constructor(collectorIp, collectorTcpPort, collectorStatPort, collectorSpanPort, agentInfo, config) {
    super(collectorIp, collectorTcpPort, collectorStatPort, collectorSpanPort, agentInfo, config)
  }

  initializeClients() { }
  initializeMetadataClients() { }
  initializeStatStream() { }
  initializePingStream() { }
  initializeAgentInfoScheduler() { }
  initializeProfilerClients() { }
}

test('Should send span', function (t) {
  sendSpanMethodOnDataCallback = null
  const expectedSpan = {
    'traceId': {
      'transactionId': {
        'agentId': 'express-node-sample-id',
        'agentStartTime': '1592572771026',
        'sequence': '5'
      },
      'spanId': '2894367178713953',
      'parentSpanId': '-1',
      'flag': 0
    },
    'agentId': 'express-node-sample-id',
    'applicationName': 'express-node-sample-name',
    'agentStartTime': 1592572771026,
    'serviceType': 1400,
    'spanId': '2894367178713953',
    'parentSpanId': '-1',
    'transactionId': {
      'type': 'Buffer',
      'data': [0, 44, 101, 120, 112, 114, 101, 115, 115, 45, 110, 111, 100, 101, 45, 115, 97, 109, 112, 108, 101, 45, 105, 100, 210, 245, 239, 229, 172, 46, 5]
    },
    'startTime': 1592574173350,
    'elapsedTime': 28644,
    'rpc': '/',
    'endPoint': 'localhost:3000',
    'remoteAddr': '::1',
    'annotations': [],
    'flag': 0,
    'err': 1,
    'spanEventList': null,
    'apiId': 1,
    'exceptionInfo': null,
    'applicationServiceType': 1400,
    'loggingTransactionInfo': null,
    'version': 1
  }

  const span = Object.assign(new Span({
    spanId: 2894367178713953,
    parentSpanId: -1,
    transactionId: {
      'agentId': 'express-node-sample-id',
      'agentStartTime': 1592574173350,
      'sequence': 0
    }
  }, {
    agentId: 'express-node-sample-id',
    applicationName: 'express-node-sample-name',
    agentStartTime: 1592574173350
  }), expectedSpan)

  const server = new grpc.Server()
  server.addService(services.SpanService, {
    sendSpan: sendSpan
  })
  let dataSender
  server.bindAsync('localhost:0', grpc.ServerCredentials.createInsecure(), (error, port) => {
    dataSender = beforeSpecificOne(port, DataSource)
    sendSpanMethodOnDataCallback = (actual) => {
      t.true(actual != null, 'spanChunk send')
      t.equal(actual.getVersion(), 1, `spanChunk version is ${actual.getVersion()}`)

      const actualTransactionId = actual.getTransactionid()
      t.equal(actualTransactionId.getAgentid(), span.agentId, `agentId ${span.agentId}`)
      t.equal(actualTransactionId.getAgentstarttime(), span.traceId.transactionId.agentStartTime, 'agent start time')
      t.equal(actualTransactionId.getSequence(), span.traceId.transactionId.sequence, `sequence ${span.traceId.transactionId.sequence}`)
      t.equal(actual.getSpanid(), span.spanId, 'span ID')
      t.equal(actual.getParentspanid(), span.parentSpanId, 'parent span ID')

      t.equal(actual.getStarttime(), span.startTime, 'startTimeStamp')
      t.equal(actual.getElapsed(), 28644, 'elapsed time')
      t.equal(actual.getApiid(), 1, 'api ID')

      t.equal(actual.getServicetype(), 1400, 'service type')

      const actualAcceptEvent = actual.getAcceptevent()
      t.equal(actualAcceptEvent.getRpc(), '/', 'rpc')
      t.equal(actualAcceptEvent.getEndpoint(), 'localhost:3000', 'endPoint')
      t.equal(actualAcceptEvent.getRemoteaddr(), '::1', 'remoteAddr')

      t.equal(actual.getFlag(), 0, 'flag')
      t.equal(actual.getErr(), 1, 'Error')

      const actualSpanEvents = actual.getSpaneventList()
      actualSpanEvents.forEach(pSpanEvent => {
        t.equal(pSpanEvent.getSequence(), 10, 'sequence')
        t.equal(pSpanEvent.getDepth(), 1, 'depth')

        t.equal(pSpanEvent.getStartelapsed(), 72, 'startElapsed')
        t.equal(pSpanEvent.getEndelapsed(), 0, 'endElapsed')

        t.equal(pSpanEvent.getServicetype(), 9057, 'serviceType')

        const pAnnotations = pSpanEvent.getAnnotationList()
        pAnnotations.forEach(annotation => {
          t.equal(annotation.getKey(), 12, 'annotation key')
          const pAnnotationValue = annotation.getValue()
          t.equal(pAnnotationValue.getStringvalue(), 'http.request', 'annotation string value')
        })
      })

      t.equal(actual.getApiid(), 1, 'API ID')
      t.equal(actual.getExceptioninfo(), undefined, 'span exceptionInfo')

      t.equal(actual.getApplicationservicetype(), 1400, 'applicaiton service type')
      t.equal(actual.getLoggingtransactioninfo(), 0, 'logging transaction info')

      afterOne(t)
    }
    dataSender.sendSpan(span)
  })
  t.teardown(() => {
    dataSender.close()
    server.forceShutdown()
  })
})

const grpcDataSender = new MockGrpcDataSender('', 0, 0, 0, { agentId: 'agent', applicationName: 'applicationName', agentStartTime: 1234344 })

test('sendSpanChunk redis.SET.end', function (t) {
  let expectedSpanChunk = {
    'agentId': 'express-node-sample-id',
    'applicationName': 'express-node-sample-name',
    'agentStartTime': 1592872080170,
    'serviceType': 1400,
    'spanId': 7056897257955935,
    'parentSpanId': -1,
    'transactionId': {
      'type': 'Buffer',
      'data': [0, 44, 101, 120, 112, 114, 101, 115, 115, 45, 110, 111, 100, 101, 45, 115, 97, 109, 112, 108, 101, 45, 105, 100, 170, 166, 204, 244, 173, 46, 0]
    },
    'transactionIdObject': {
      'agentId': 'express-node-sample-id',
      'agentStartTime': 1592872080170,
      'sequence': 0
    },
    'spanEventList': [Object.assign(new SpanEvent({
      spanId: 7056897257955935,
      endPoint: 'localhost:6379'
    }, 0), {
      'spanId': 7056897257955935,
      'sequence': 0,
      'startTime': 1592872091543,
      'elapsedTime': 0,
      'startElapsed': 14,
      'serviceType': 100,
      'endPoint': null,
      'annotations': [],
      'depth': 1,
      'nextSpanId': -1,
      'destinationId': null,
      'apiId': 1,
      'exceptionInfo': null,
      'asyncId': null,
      'nextAsyncId': null,
      'asyncSequence': null,
      'dummyId': null,
      'nextDummyId': null
    }),
    Object.assign(new SpanEvent({
      spanId: 7056897257955935,
      endPoint: 'localhost:6379'
    }, 1), {
      'spanId': 7056897257955935,
      'sequence': 1,
      'startTime': 1592872091543,
      'elapsedTime': 2,
      'startElapsed': 7,
      'serviceType': 8200,
      'endPoint': 'localhost:6379',
      'annotations': [Annotations.of(annotationKey.API.getCode(), 'redis.SET.end')],
      'depth': 2,
      'nextSpanId': 1508182809976945,
      'destinationId': 'Redis',
      'apiId': 0,
      'exceptionInfo': null,
      'asyncId': null,
      'nextAsyncId': null,
      'asyncSequence': null,
      'dummyId': null,
      'nextDummyId': null
    })
    ],
    'endPoint': null,
    'applicationServiceType': 1400,
    'localAsyncId': new AsyncId(1)
  }
  const spanChunk = Object.assign(new SpanChunk({
    spanId: 2894367178713953,
    parentSpanId: -1,
    transactionId: {
      'agentId': 'express-node-sample-id',
      'agentStartTime': 1592872080170,
      'sequence': 0
    }
  }, {
    agentId: 'express-node-sample-id',
    applicationName: 'express-node-sample-name',
    agentStartTime: 1592872080170
  }), expectedSpanChunk)

  grpcDataSender.sendSpanChunk(spanChunk)

  const actual = grpcDataSender.actualSpan.getSpanchunk()

  t.plan(22)
  t.true(actual != null, 'spanChunk send')
  t.equal(actual.getVersion(), 1, 'spanChunk version is 1')

  const actualTransactionId = actual.getTransactionid()
  t.equal(actualTransactionId.getAgentid(), 'express-node-sample-id', 'gRPC agentId')
  t.equal(actualTransactionId.getAgentstarttime(), 1592872080170, 'agent start time')
  t.equal(actualTransactionId.getSequence(), 0, 'sequence')

  t.equal(actual.getSpanid(), 7056897257955935, 'span ID')
  t.equal(actual.getEndpoint(), '', 'endpoint')
  t.equal(actual.getApplicationservicetype(), 1400, 'application service type')

  const actualLocalAsyncId = actual.getLocalasyncid()
  t.equal(actualLocalAsyncId.getAsyncid(), 1, 'local async id')
  t.equal(actualLocalAsyncId.getSequence(), 0, 'local async id sequence')

  t.equal(actual.getKeytime(), 1592872091543, 'keytime')
  const actualSpanEvents = actual.getSpaneventList()
  actualSpanEvents.forEach((pSpanEvent, index) => {
    if (index == 0) {
      t.equal(pSpanEvent.getSequence(), 0, 'sequence')
      t.equal(pSpanEvent.getDepth(), 1, 'depth')
      t.equal(pSpanEvent.getServicetype(), 100, 'serviceType')
      t.equal(pSpanEvent.getStartelapsed(), 0, 'startElapsed')
    } else if (index == 1) {
      t.equal(pSpanEvent.getSequence(), 1, 'sequence')
      t.equal(pSpanEvent.getDepth(), 2, 'depth')

      t.equal(pSpanEvent.getStartelapsed(), 0, 'startElapsed')
      t.equal(pSpanEvent.getEndelapsed(), 2, 'endElapsed')
      t.equal(pSpanEvent.getServicetype(), 8200, 'serviceType')

      const pAnnotations = pSpanEvent.getAnnotationList()
      pAnnotations.forEach(annotation => {
        t.equal(annotation.getKey(), 12, 'annotation key')
        const pAnnotationValue = annotation.getValue()
        t.equal(pAnnotationValue.getStringvalue(), 'redis.SET.end', 'annotation string value')
      })
    }
  })
})

test('sendSpanChunk redis.GET.end', (t) => {
  let expectedSpanChunk = {
    'agentId': 'express-node-sample-id',
    'applicationName': 'express-node-sample-name',
    'agentStartTime': 1592872080170,
    'serviceType': 1400,
    'spanId': 7056897257955935,
    'parentSpanId': -1,
    'transactionId': {
      'type': 'Buffer',
      'data': [0, 44, 101, 120, 112, 114, 101, 115, 115, 45, 110, 111, 100, 101, 45, 115, 97, 109, 112, 108, 101, 45, 105, 100, 170, 166, 204, 244, 173, 46, 0]
    },
    'transactionIdObject': {
      'agentId': 'express-node-sample-id',
      'agentStartTime': 1592872080170,
      'sequence': 0
    },
    'spanEventList': [Object.assign(new SpanEvent({
      spanId: 7056897257955935,
      endPoint: 'localhost:6379'
    }, 0), {
      'spanId': 7056897257955935,
      'sequence': 0,
      'startTime': 1592872091543,
      'elapsedTime': 0,
      'startElapsed': 14,
      'serviceType': 100,
      'endPoint': null,
      'annotations': [],
      'depth': 1,
      'nextSpanId': -1,
      'destinationId': null,
      'apiId': 1,
      'exceptionInfo': null,
      'asyncId': null,
      'nextAsyncId': null,
      'asyncSequence': null,
      'dummyId': null,
      'nextDummyId': null
    }),
    {
      'spanId': 7056897257955935,
      'sequence': 1,
      'startTime': 1592872091543,
      'elapsedTime': 0,
      'startElapsed': 7,
      'serviceType': 8200,
      'endPoint': 'localhost:6379',
      'annotations': [Annotations.of(annotationKey.API.getCode(), 'redis.GET.end')],
      'depth': 2,
      'nextSpanId': 6277978728741477,
      'destinationId': 'Redis',
      'apiId': 0,
      'exceptionInfo': null,
      'asyncId': null,
      'nextAsyncId': null,
      'asyncSequence': null,
      'dummyId': null,
      'nextDummyId': null
    }
    ],
    'endPoint': null,
    'applicationServiceType': 1400,
    'localAsyncId': new AsyncId(2)
  }

  const spanChunk = Object.assign(new SpanChunk({
    spanId: 7056897257955935,
    parentSpanId: -1,
    transactionId: {
      'agentId': 'express-node-sample-id',
      'agentStartTime': 1592872080170,
      'sequence': 0
    }
  }, {
    agentId: 'express-node-sample-id',
    applicationName: 'express-node-sample-name',
    agentStartTime: 1592872080170
  }), expectedSpanChunk)
  grpcDataSender.sendSpanChunk(spanChunk)
  const actual = grpcDataSender.actualSpan.getSpanchunk()

  t.plan(16)
  t.equal(actual.getVersion(), 1, 'version')

  const actualTransactionId = actual.getTransactionid()
  t.equal(actualTransactionId.getAgentid(), 'express-node-sample-id', 'gRPC agentId')
  t.equal(actualTransactionId.getAgentstarttime(), 1592872080170, 'agent start time')
  t.equal(actualTransactionId.getSequence(), 0, 'sequence')

  t.equal(actual.getSpanid(), 7056897257955935, 'span ID')
  t.equal(actual.getEndpoint(), '', 'endpoint')
  t.equal(actual.getApplicationservicetype(), 1400, 'application service type')

  const actualLocalAsyncId = actual.getLocalasyncid()
  t.equal(actualLocalAsyncId.getAsyncid(), 2, 'local async id')
  t.equal(actualLocalAsyncId.getSequence(), 0, 'local async id sequence')

  t.equal(actual.getKeytime(), 1592872091543, 'keytime')
  const actualSpanEvents = actual.getSpaneventList()
  actualSpanEvents.forEach((pSpanEvent, index) => {
    if (index == 1) {
      t.equal(pSpanEvent.getSequence(), 1, 'sequence')
      t.equal(pSpanEvent.getDepth(), 2, 'depth')

      t.equal(pSpanEvent.getStartelapsed(), 0, 'startElapsed')

      t.equal(pSpanEvent.getServicetype(), 8200, 'serviceType')

      const pAnnotations = pSpanEvent.getAnnotationList()
      pAnnotations.forEach(annotation => {
        t.equal(annotation.getKey(), 12, 'annotation key')
        const pAnnotationValue = annotation.getValue()
        t.equal(pAnnotationValue.getStringvalue(), 'redis.GET.end', 'annotation string value')
      })
    }
  })
})

test('sendSpan', (t) => {
  let expectedSpanChunk = {
    'traceId': {
      'transactionId': {
        'agentId': 'express-node-sample-id',
        'agentStartTime': 1592872080170,
        'sequence': 0
      },
      'spanId': 7056897257955935,
      'parentSpanId': -1,
      'flag': 0
    },
    'agentId': 'express-node-sample-id',
    'applicationName': 'express-node-sample-name',
    'agentStartTime': 1592872080170,
    'serviceType': 1400,
    'spanId': 7056897257955935,
    'parentSpanId': -1,
    'transactionId': {
      'type': 'Buffer',
      'data': [0, 44, 101, 120, 112, 114, 101, 115, 115, 45, 110, 111, 100, 101, 45, 115, 97, 109, 112, 108, 101, 45, 105, 100, 170, 166, 204, 244, 173, 46, 0]
    },
    'startTime': 1592872091536,
    'elapsedTime': 412,
    'rpc': '/',
    'endPoint': 'localhost:3000',
    'remoteAddr': '::1',
    'annotations': [],
    'flag': 0,
    'err': null,
    'spanEventList': [
      Object.assign(new SpanEvent({
        spanId: 7056897257955935,
        endPoint: 'localhost:3000'
      }, 4), {
        'spanId': 7056897257955935,
        'sequence': 4,
        'startTime': 1592872091540,
        'elapsedTime': 1,
        'startElapsed': 4,
        'serviceType': 6600,
        'endPoint': 'localhost:3000',
        'annotations': [Annotations.of(annotationKey.API.getCode(), 'express.middleware.serveStatic')],
        'depth': 5,
        'nextSpanId': -1,
        'destinationId': 'localhost:3000',
        'apiId': 0,
        'exceptionInfo': null,
        'asyncId': null,
        'nextAsyncId': null,
        'asyncSequence': null,
        'dummyId': null,
        'nextDummyId': null
      }),
      Object.assign(new SpanEvent({
        spanId: 7056897257955935,
        endPoint: 'localhost:3000'
      }, 3), {
        'spanId': 7056897257955935,
        'sequence': 3,
        'startTime': 1592872091540,
        'elapsedTime': 1,
        'startElapsed': 4,
        'serviceType': 6600,
        'endPoint': 'localhost:3000',
        'annotations': [Annotations.of(annotationKey.API.getCode(), 'express.middleware.cookieParser')],
        'depth': 4,
        'nextSpanId': -1,
        'destinationId': 'localhost:3000',
        'apiId': 0,
        'exceptionInfo': null,
        'asyncId': null,
        'nextAsyncId': null,
        'asyncSequence': null,
        'dummyId': null,
        'nextDummyId': null
      }),
      Object.assign(new SpanEvent({
        spanId: 7056897257955935,
        endPoint: 'localhost:3000'
      }, 2), {
        'spanId': 7056897257955935,
        'sequence': 2,
        'startTime': 1592872091540,
        'elapsedTime': 1,
        'startElapsed': 4,
        'serviceType': 6600,
        'endPoint': 'localhost:3000',
        'annotations': [Annotations.of(annotationKey.API.getCode(), 'express.middleware.urlencodedParser')],
        'depth': 3,
        'nextSpanId': -1,
        'destinationId': 'localhost:3000',
        'apiId': 0,
        'exceptionInfo': null,
        'asyncId': null,
        'nextAsyncId': null,
        'asyncSequence': null,
        'dummyId': null,
        'nextDummyId': null
      }),
      Object.assign(new SpanEvent({
        spanId: 7056897257955935,
        endPoint: 'localhost:3000'
      }, 1), {
        'spanId': 7056897257955935,
        'sequence': 1,
        'startTime': 1592872091540,
        'elapsedTime': 1,
        'startElapsed': 4,
        'serviceType': 6600,
        'endPoint': 'localhost:3000',
        'annotations': [Annotations.of(annotationKey.API.getCode(), 'express.middleware.jsonParser')],
        'depth': 2,
        'nextSpanId': -1,
        'destinationId': 'localhost:3000',
        'apiId': 0,
        'exceptionInfo': null,
        'asyncId': null,
        'nextAsyncId': null,
        'asyncSequence': null,
        'dummyId': null,
        'nextDummyId': null
      }),
      Object.assign(new SpanEvent({
        spanId: 7056897257955935,
        endPoint: 'localhost:3000'
      }, 0), {
        'spanId': 7056897257955935,
        'sequence': 0,
        'startTime': 1592872091539,
        'elapsedTime': 2,
        'startElapsed': 3,
        'serviceType': 6600,
        'endPoint': 'localhost:3000',
        'annotations': [Annotations.of(annotationKey.API.getCode(), 'express.middleware.logger')],
        'depth': 1,
        'nextSpanId': -1,
        'destinationId': 'localhost:3000',
        'apiId': 0,
        'exceptionInfo': null,
        'asyncId': null,
        'nextAsyncId': null,
        'asyncSequence': null,
        'dummyId': null,
        'nextDummyId': null
      }),
      Object.assign(new SpanEvent({
        spanId: 7056897257955935,
        endPoint: 'localhost:3000'
      }, 6), {
        'spanId': 7056897257955935,
        'sequence': 6,
        'startTime': 1592872091543,
        'elapsedTime': 0,
        'startElapsed': 7,
        'serviceType': 9057,
        'endPoint': 'localhost:6379',
        'annotations': [Annotations.of(annotationKey.API.getCode(), 'redis.SET.call')],
        'depth': 2,
        'nextSpanId': -1,
        'destinationId': 'Redis',
        'apiId': 0,
        'exceptionInfo': null,
        'asyncId': null,
        'nextAsyncId': 1,
        'asyncSequence': null,
        'dummyId': null,
        'nextDummyId': null
      }),
      Object.assign(new SpanEvent({
        spanId: 7056897257955935,
        endPoint: 'localhost:3000'
      }, 7), {
        'spanId': 7056897257955935,
        'sequence': 7,
        'startTime': 1592872091543,
        'elapsedTime': 0,
        'startElapsed': 7,
        'serviceType': 9057,
        'endPoint': 'localhost:6379',
        'annotations': [Annotations.of(annotationKey.API.getCode(), 'redis.GET.call')],
        'depth': 2,
        'nextSpanId': -1,
        'destinationId': 'Redis',
        'apiId': 0,
        'exceptionInfo': null,
        'asyncId': null,
        'nextAsyncId': 2,
        'asyncSequence': null,
        'dummyId': null,
        'nextDummyId': null
      }),
      Object.assign(new SpanEvent({
        spanId: 7056897257955935,
        endPoint: 'localhost:3000'
      }, 5), {
        'spanId': 7056897257955935,
        'sequence': 5,
        'startTime': 1592872091542,
        'elapsedTime': 3,
        'startElapsed': 6,
        'serviceType': 6600,
        'endPoint': 'localhost:3000',
        'annotations': [],
        'depth': 1,
        'nextSpanId': -1,
        'destinationId': 'localhost:3000',
        'apiId': 2,
        'exceptionInfo': null,
        'asyncId': null,
        'nextAsyncId': null,
        'asyncSequence': null,
        'dummyId': null,
        'nextDummyId': null
      }),
      Object.assign(new SpanEvent({
        spanId: 7056897257955935,
        endPoint: 'localhost:3000'
      }, 8), {
        'spanId': 7056897257955935,
        'sequence': 8,
        'startTime': 1592872091558,
        'elapsedTime': 0,
        'startElapsed': 22,
        'serviceType': 9057,
        'endPoint': 'localhost:3000',
        'annotations': [Annotations.of(annotationKey.API.getCode(), 'http.request')],
        'depth': 1,
        'nextSpanId': -1,
        'destinationId': 'localhost:3000',
        'apiId': 0,
        'exceptionInfo': null,
        'asyncId': null,
        'nextAsyncId': 3,
        'asyncSequence': null,
        'dummyId': null,
        'nextDummyId': null
      })
    ],
    'apiId': 1,
    'exceptionInfo': null,
    'applicationServiceType': 1400,
    'loggingTransactionInfo': null,
    'version': 1
  }

  const span = Object.assign(new Span({
    spanId: 2894367178713953,
    parentSpanId: -1,
    transactionId: {
      'agentId': 'express-node-sample-id',
      'agentStartTime': 1592872080170,
      'sequence': 5
    }
  }, {
    agentId: 'express-node-sample-id',
    applicationName: 'express-node-sample-name',
    agentStartTime: 1592872080170
  }), expectedSpanChunk)
  grpcDataSender.sendSpan(span)
  const actual = grpcDataSender.actualSpan.getSpan()

  t.plan(22)
  t.equal(actual.getVersion(), 1, 'version')

  const actualTransactionId = actual.getTransactionid()
  t.equal(actualTransactionId.getAgentid(), 'express-node-sample-id', 'gRPC agentId')
  t.equal(actualTransactionId.getAgentstarttime(), 1592872080170, 'agent start time')
  t.equal(actualTransactionId.getSequence(), 0, 'sequence')

  t.equal(actual.getSpanid(), 7056897257955935, 'span ID')
  t.equal(actual.getParentspanid(), -1, 'span.parentspanid')

  t.equal(actual.getStarttime(), 1592872091536, 'span.startTime')
  t.equal(actual.getElapsed(), 412, 'span.elapsed')
  t.equal(actual.getApiid(), 1, 'span.apiid')

  t.equal(actual.getServicetype(), 1400, 'span.servicetype')

  const actualAcceptEvent = actual.getAcceptevent()
  t.equal(actualAcceptEvent.getRpc(), '/', 'rpc')
  t.equal(actualAcceptEvent.getEndpoint(), 'localhost:3000', 'endPoint')
  t.equal(actualAcceptEvent.getRemoteaddr(), '::1', 'remoteAddr')

  t.equal(actual.getFlag(), 0, 'flag')
  t.equal(actual.getErr(), 0, 'Error')

  t.equal(actual.getExceptioninfo(), null, 'span exceptionInfo')

  t.equal(actual.getApplicationservicetype(), 1400, 'applicaiton service type')
  t.equal(actual.getLoggingtransactioninfo(), 0, 'logging transaction info')

  const actualSpanEvents = actual.getSpaneventList()
  actualSpanEvents.forEach((pSpanEvent, index) => {
    if (index == 0) {
      t.equal(pSpanEvent.getSequence(), 0, 'sort span events')
      t.equal(pSpanEvent.getDepth(), 1, 'depth')
      t.equal(pSpanEvent.getStartelapsed(), 3, 'startElapsed')
    }
    if (pSpanEvent.getSequence() == 6) {
      t.equal(pSpanEvent.getAsyncevent(), 1, 'async event')
    }
  })
})

test.skip('sendStat', (t) => {
  let expectedStat = {
    'agentId': 'express-node-sample-id',
    'agentStartTime': 1593058531421,
    'timestamp': 1593058537472,
    'collectInterval': 1000,
    'memory': {
      'heapUsed': 37042600,
      'heapTotal': 62197760
    },
    'cpu': {
      'user': 0.0003919068831319893,
      'system': 0
    },
    'activeTrace': {
      'schema': {
        'typeCode': 2,
        'fast': 1000,
        'normal': 3000,
        'slow': 5000
      },
      'typeCode': 2,
      'fastCount': 0,
      'normalCount': 0,
      'slowCount': 0,
      'verySlowCount': 0
    }
  }
  grpcDataSender.sendStat(expectedStat)

  const pStatMessage = grpcDataSender.actualPStatMessage
  const pAgentStat = pStatMessage.getAgentstat()
  t.plan(4)

  t.equal(pAgentStat.getTimestamp(), 1593058537472, 'timestamp')
  t.equal(pAgentStat.getCollectinterval(), 1000, 'collectInterval')

  const pCpuLoad = pAgentStat.getCpuload()
  t.equal(pCpuLoad.getJvmcpuload(), 0.0003919068831319893, 'cpu.user')
  t.equal(pCpuLoad.getSystemcpuload(), 0, 'cpu.system')
})

let requestId = 0
const handleCommandV2Service = (call) => {
  const callRequests = getCallRequests()
  const callMetadata = getMetadata()
  callRequests.push(call.request)
  callMetadata.push(call.metadata)

  handleCommandCall = call

  requestId++
  serverCallWriter(CommandType.echo)
}

let handleCommandCall
const serverCallWriter = (commandType) => {
  const result = new cmdMessage.PCmdRequest()
  result.setRequestid(requestId)

  if (commandType === CommandType.activeThreadCount) {
    const commandActiveThreadCount = new cmdMessage.PCmdActiveThreadCount()
    result.setCommandactivethreadcount(commandActiveThreadCount)
  } else {
    const message = new cmdMessage.PCmdEcho()
    message.setMessage('echo')
    result.setCommandecho(message)
  }

  handleCommandCall.write(result)
}

let dataCallbackOnServerCall
const emptyResponseService = (call, callback) => {
  call.on('data', (data) => {
    if (typeof dataCallbackOnServerCall === 'function') {
      dataCallbackOnServerCall(data)
    }
  })

  const succeedOnRetryAttempt = call.metadata.get('succeed-on-retry-attempt')
  const previousAttempts = call.metadata.get('grpc-previous-rpc-attempts')
  const callRequests = getCallRequests()
  const callMetadata = getMetadata()
  // console.debug(`succeed-on-retry-attempt: ${succeedOnRetryAttempt[0]}, grpc-previous-rpc-attempts: ${previousAttempts[0]}`)
  if (succeedOnRetryAttempt.length === 0 || (previousAttempts.length > 0 && previousAttempts[0] === succeedOnRetryAttempt[0])) {
    callRequests.push(call.request)
    callMetadata.push(call.metadata)
    callback(null, new Empty())
  } else {
    const statusCode = call.metadata.get('respond-with-status')
    const code = statusCode[0] ? Number.parseInt(statusCode[0]) : grpc.status.UNKNOWN
    callback({ code: code, details: `Failed on retry ${previousAttempts[0] ?? 0}` })
  }
}

class ProfilerDataSource extends DataSourceCallCountable {
  constructor(collectorIp, collectorTcpPort, collectorStatPort, collectorSpanPort, agentInfo, config) {
    super(collectorIp, collectorTcpPort, collectorStatPort, collectorSpanPort, agentInfo, config)
  }

  initializeClients() { }
  initializeMetadataClients() { }
  initializeSpanStream() { }
  initializeStatStream() { }
  initializePingStream() { }
  initializeAgentInfoScheduler() { }
}

test('sendSupportedServicesCommand and commandEcho', (t) => {
  dataCallbackOnServerCall = null
  const server = new grpc.Server()
  server.addService(services.ProfilerCommandServiceService, {
    handleCommandV2: handleCommandV2Service,
    commandEcho: emptyResponseService
  })

  let dataSender
  server.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(), (error, port) => {
    dataSender = beforeSpecificOne(port, ProfilerDataSource)

    const callArguments = new CallArgumentsBuilder(function (error, response) {
      const callRequests = getCallRequests()
      const commonResponse = callRequests[1].getCommonresponse()
      t.equal(commonResponse.getResponseid(), requestId, 'response id matches request id')
      t.equal(commonResponse.getStatus(), 0, 'status is success')
      t.equal(commonResponse.getMessage().getValue(), '', 'message is empty')

      const cmdEchoResponse = callRequests[1]
      t.equal(cmdEchoResponse.getMessage(), 'echo', 'echo message')
      dataSender.commandStream.writableStream.on('close', () => {
        t.end()
      })
      dataSender.close()
      server.forceShutdown()
    }).build()
    dataSender.sendSupportedServicesCommand(callArguments)
  })
})

test('CommandStreamActiveThreadCount', (t) => {
  const server = new grpc.Server()
  server.addService(services.ProfilerCommandServiceService, {
    handleCommandV2: handleCommandV2Service,
    commandEcho: emptyResponseService,
    commandStreamActiveThreadCount: emptyResponseService
  })
  let dataSender
  server.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(), (error, port) => {
    dataSender = beforeSpecificOne(port, ProfilerDataSource)

    let callCount = 0
    dataCallbackOnServerCall = (data) => {
      ++callCount
      const commonStreamResponse = data.getCommonstreamresponse()
      t.equal(commonStreamResponse.getResponseid(), requestId, 'response id matches request id')
      t.equal(commonStreamResponse.getSequenceid(), callCount, `sequenceid is ${callCount}`)
      t.equal(commonStreamResponse.getMessage().getValue(), '', 'message is empty')

      t.equal(data.getHistogramschematype(), 2, 'histogram schema type')
      t.equal(data.getActivethreadcountList()[0], 1, 'active thread count')

      console.log(`dataCallbackOnServerCall callCount: ${callCount}`)
      if (callCount == 1) {
        dataSender.commandStream.writableStream.on('close', () => {
          t.end()
        })
        dataSender.close()
        server.forceShutdown()
      }
    }

    const callArguments = new CallArgumentsBuilder(function () {
      if (callArguments.once) {
        return
      }
      callArguments.once = true

      process.nextTick(() => {
        serverCallWriter(CommandType.activeThreadCount)
      })
    }).build()
    dataSender.sendSupportedServicesCommand(callArguments)
  })
})
