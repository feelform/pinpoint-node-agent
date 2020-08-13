/**
 * Pinpoint Node.js Agent
 * Copyright 2020-present NAVER Corp.
 * Apache License v2.0
 */

'use strict'

const semver = require('semver')
const shimmer = require('shimmer')
const ServiceTypeCode = require('../../constant/service-type').ServiceTypeCode
const log = require('../../utils/logger')

module.exports = function(agent, version, koa) {

  // todo. emit 체크
  shimmer.wrap(koa.prototype, 'emit', function(original) {
    return function (evt, err, ctx) {
      const trace = agent.traceContext.currentTraceObject()
      let spanEventRecorder = null
      if (evt === 'error' & ctx) {
        spanEventRecorder = trace.traceBlockBegin()
        spanEventRecorder.recordServiceType(ServiceTypeCode.koa)
        spanEventRecorder.recordApiDesc('koa')
        spanEventRecorder.recordException(err, true)
        trace.traceBlockEnd(spanEventRecorder)
        return original.apply(this, arguments)
      }
      if (trace) {
        spanEventRecorder = trace.traceBlockBegin()
        spanEventRecorder.recordServiceType(ServiceTypeCode.koa)
        spanEventRecorder.recordApiDesc('koa') // Todo. check this
      }
      const result = original.apply(this, arguments)
      if (trace) {
        trace.traceBlockEnd(spanEventRecorder)
      }
      return result
    }
  })
  shimmer.wrap(koa.prototype, 'use', function(original) {
    return function wrapMiddleware(middleware) {
      if (typeof middleware === 'function') {
        const cb = arguments[0]
        const name = middleware.name || 'AnonymousFunction'
        // todo. 기본로직을 제외 하는 방법 검토할 것
        // if (cb.toString().trim().match(/^async/)) {}
        arguments[0] = async function(ctx, next) {
          let result
          const trace = agent.traceContext.currentTraceObject()
          let spanEventRecorder = null
          try {
            if (trace) {
              spanEventRecorder = trace.traceBlockBegin()
              spanEventRecorder.recordServiceType(ServiceTypeCode.koa)
              spanEventRecorder.recordApiDesc(`middleware [${name}]`)
            }
            result = await cb.apply(this, arguments)
          } catch (e) {
            if (!e._pinpointCheck) {
              e._pinpointCheck = true
              spanEventRecorder.recordServiceType(ServiceTypeCode.koa)
              spanEventRecorder.recordApiDesc(`middleware [${name}]`)
              spanEventRecorder.recordException(e, true)
            }
            throw e
          } finally {
            if (trace) {
              trace.traceBlockEnd(spanEventRecorder)
            }
          }
          return result
        }

      }
      return original.apply(this, arguments)
    }
  })
  // Test 3. createContext
  // shimmer.wrap(koa.prototype, 'createContext', function(original) {
  //   return function wrapCreateContext(req, res) {
  //     const result = original.apply(this, arguments)
  //
  //     shimmer.wrap(result, 'onerror', function(ori) {
  //       return function (err) {
  //         const trace = agent.traceContext.currentTraceObject()
  //         if (trace) {
  //           const spanEventRecorder = trace.traceBlockBegin()
  //           spanEventRecorder.recordServiceType(ServiceTypeCode.express)
  //           spanEventRecorder.recordApiDesc('tes')
  //           spanEventRecorder.recordException(err, true)
  //           trace.traceBlockEnd(spanEventRecorder)
  //         }
  //         return ori.apply(this, arguments)
  //       }
  //     })
  //
  //
  //
  //     return result
  //   }
  // })
  return koa
}
