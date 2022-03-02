#!/usr/bin/env node
const path = require('path')
const controllerGen = require('../index.js')
const projectPath = path.resolve(process.cwd(), process.argv[2] ?? '')
controllerGen(projectPath)
