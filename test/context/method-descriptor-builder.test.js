/**
 * Pinpoint Node.js Agent
 * Copyright 2020-present NAVER Corp.
 * Apache License v2.0
 */

const test = require('tape')

const MethodDescriptorBuilder = require('../../lib/context/method-descriptor-builder')
test('callstack', (t) => {
    /*Error
    at doPatchLayer (/Users/feelform/workspace/pinpoint/pinpoint-node-agent/lib/instrumentation/module/express.js:72:11)
    at Function.route (/Users/feelform/workspace/pinpoint/pinpoint-node-agent/lib/instrumentation/module/express.js:64:9)
    at Function.app.<computed> [as get] (/Users/feelform/workspace/pinpoint/pinpoint-node-agent/node_modules/express/lib/application.js:481:30)
    at Test.<anonymous> (/Users/feelform/workspace/pinpoint/pinpoint-node-agent/test/instrumentation/module/express.test.js:42:7)
    at Test.bound [as _cb] (/Users/feelform/workspace/pinpoint/pinpoint-node-agent/node_modules/tape/lib/test.js:80:32)
    at Test.run (/Users/feelform/workspace/pinpoint/pinpoint-node-agent/node_modules/tape/lib/test.js:96:10)
    at Test.bound [as run] (/Users/feelform/workspace/pinpoint/pinpoint-node-agent/node_modules/tape/lib/test.js:80:32)
    at Immediate.next [as _onImmediate] (/Users/feelform/workspace/pinpoint/pinpoint-node-agent/node_modules/tape/lib/results.js:83:19)
    at processImmediate (internal/timers.js:456:21)*/

    let stack = 'at Function.app.<computed> [as get] (/Users/feelform/workspace/pinpoint/pinpoint-node-agent/node_modules/express/lib/application.js:481:30)'
    let captureGroups = stack.match(/at (?<type>\w+(?=\.))?\.?(?<functionName>[^\s]+)(?: \[as (?<methodName>\w+)\])? \(.+\/(?<fileName>[^:/]+):(?<lineNumber>[0-9]+):(?<columnNumber>[0-9]+)\)$/)
    if (!captureGroups || !captureGroups.groups) {
        return
    }
    let actual = new MethodDescriptorBuilder('express', captureGroups.groups)
    t.equal(actual.methodName, 'get')
    t.equal(actual.functionName, 'app.get')
    t.end()
})