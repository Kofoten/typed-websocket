'use strict'

const WebSocket = require('ws')
const helper = require('./helper')

/**
 * A typed WebSocket
 */
class TypedWebSocket extends WebSocket {
  /**
   * Creates a new TypedWebSocket
   * @param {string} address
   * @param {WebSocket.ClientOptions} options
   */
  constructor(address, options = null) {
    super(address, options)
    this._init();
  }

  /**
   * Creates a new TypedWebSocket
   * @param {string} address
   * @param {string|string[]} protocols
   * @param {WebSocket.ClientOptions} options
   */
  constructor(address, protocols = null, options = null) {
    super(address, protocols, options)
    this._init();
  }

  /**
   * Initializes the type listener
   */
  _init() {
    this.on('message', raw => {
      try {
        const message = JSON.parse(raw)

        if (typeof message.type !== 'string') {
          this._emitError('data is not of type object')
          return
        }

        if (typeof message.data !== 'object') {
          this._emitError('data is not of type object')
          return
        }

        this.emit(`type:${message.type}`, message.data)
      } catch (error) {
        this._emitError(error)
      }
    })
  }

  /**
   * Sends an error to WebSocket and emits error
   * @param {string} message Error message
   */
  _emitNewError(message) {
    this._emitError(new Error(message))
  }

  /**
   * Sends an error to WebSocket and emits error
   * @param {Error} error Error object
   */
  _emitError(error) {
    this.send(helper.createMessage('error', error))
    this.emit('error', error)
  }
}

module.exports = TypedWebSocket
