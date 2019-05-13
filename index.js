'use strict'

const TypedWebSocket = require('./src/typed-websocket')

const TypedServer = require('./src/typed-websocket-server')

TypedWebSocket.Server = TypedServer

module.exports = TypedWebSocket
