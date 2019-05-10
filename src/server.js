'use strict'

const EventEmitter = require('events')
const WebSocket = require('ws')
const uuidv4 = require('uuid/v4')

/**
 * A server class
 */
class Server extends EventEmitter {
  /**
   * Creates a new server
   * @param {number} port The listening port
   * @param {boolean} greeting Send greetings to new clients
   */
  constructor(port, greeting = true) {
    super()
    this.port = port
    this.greeting = greeting
  }

  /**
   * Starts the server
   */
  listen() {
    this.server = new WebSocket.Server({ port: this.port })

    this.server.on('listening', () => {
      this.emit('listening')
    })

    this.server.on('error', err => {
      this.emit('error', err)
    })

    this.server.on('connection', ws => {
      ws.clientId = uuidv4()

      if (this.greeting) {
        ws.send(this.createMessage('greeting', { clientId: ws.clientId }))
      }

      ws.on('message', serializedMessage => {
        const message = JSON.parse(serializedMessage)

        if (typeof message.type !== 'string') {
          this._emitError('data is not of type object', ws)
          return
        }

        if (typeof data !== 'object') {
          this._emitError('data is not of type object', ws)
          return
        }

        this.emit(message.type, { messageId: uuidv4(), clientId: ws.clientId, time: Date.now(), data: message.data })
      })
    })
  }

  /**
   * Sends an error to a client and emits error
   * @param {string} message Error message
   * @param {WebSocker} ws Related client
   */
  _emitError(message, ws) {
    const error = new Error(message)

    ws.emit(this.createMessage('error', error))
    this.emit('error', error)
  }

  /**
   * Send a message to all connected clients
   * @param {string} type Message type
   * @param {object} data Message data
   */
  sendAll(type, data) {
    const message = this.createMessage(type, data)

    this.server.clients.forEach(ws => {
      ws.send(message)
    })
  }

  /**
   * Creates a message with type and data
   * @param {string} type The message type
   * @param {object} data The message data
   */
  createMessage(type, data) {
    if (typeof type !== 'string') {
      throw new Error('type is not of type string')
    }

    if (typeof data !== 'object') {
      throw new Error('data is not of type object')
    }

    return JSON.stringify({ type, data })
  }
}

module.exports = Server
