/**
 * Pinpoint Node.js Agent
 * Copyright 2021-present NAVER Corp.
 * Apache License v2.0
 */

'use strict'

const MethodDescriptor = require('./method-descriptor')

const MethodType = require('../constant/method-type').MethodType

class MethodDescriptorBuilder {
    constructor(moduleName, objectPath, methodName) {
        this.moduleName = moduleName
        this.objectPath = objectPath
        this.methodName = methodName
        this.type = MethodType.DEFAULT
        this.apiDescriptor = this.getDescriptor()
        this.apiId = 0
    }

    setType(type) {
        this.type = type
        return this
    }

    setAPIDescriptor(apiDescriptor) {
        this.apiDescriptor = apiDescriptor
        return this
    }

    setAPIID(apiID) {
        this.apiID = apiID
        return this
    }

    build() {
        return new MethodDescriptor()
    }
}

module.exports = MethodDescriptorBuilder