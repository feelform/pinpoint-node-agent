/**
 * Pinpoint Node.js Agent
 * Copyright 2020-present NAVER Corp.
 * Apache License v2.0
 */

'use strict'

const fs = require('fs')
const path = require('path')

const log = require('../utils/logger')
const Hook = require('require-in-the-middle')
const MODULES = [
  'express',
  'http',
  'https',
  'koa-router',
  'redis',
  'ioredis',
  'mysql',
  'mysql2',
  'mongodb',
]

class ModuleHook {
  constructor(agent) {
    try {
      this.loadedModules = []
      const self = this
      this.hook = Hook(MODULES, function (exports, name, basedir) {
        self.loadModule(name, agent, exports, basedir)
        return exports
      })
    } catch (e) {
      log.error('error occurred', e)
    }
  }

  loadModule(name, agent, m, basedir) {
    if (MODULES.includes(name) && this.needLoadModules(name)) {
      try {
        const version = this._getModuleVersion(basedir)
        require('./module/' + name)(agent, version, m)
        this.setModules({
          name: name,
          version: version
        })
        if (log.isInfo()) {
          log.info('loader ==> %s (%s)', name, version)
        }
      } catch (e) {
        log.error('fail to load:', e)
      }
    }
  }

  _getModuleVersion(basedir) {
    let version

    if (basedir) {
      const pkg = path.join(basedir, 'package.json')
      try {
        version = JSON.parse(fs.readFileSync(pkg)).version
      } catch (error) {
        log.error('error occurred', error)
      }
    }

    if (!version) {
      version = process.versions.node
    }
    return version
  }

  needLoadModules(name) {
    return !this.moduleObj(name)
  }

  moduleObj(name) {
    return this.loadedModules.find(moduleObj => moduleObj.name == name)
  }

  setModules(moduleObj) {
    this.loadedModules.push(moduleObj)
  }

  unhook() {
    try {
      this.hook.unhook()
    } catch (error) {
      if (error) {
        log.error(error)
      }
    }
  }
}

module.exports = ModuleHook