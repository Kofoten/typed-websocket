'use strict'

const WebSocket = require('ws')

/**
 * Class representing a TypedWebSocket.
 *
 * @extends WebSocket
 */
class TypedWebSocket extends WebSocket {
  /**
   * Create a new `TypedWebSocket`.
   *
   * @param {(String|url.URL)} address The URL to which to connect
   * @param {(String|String[])} protocols The subprotocols
   * @param {Object} options Connection options
   */
  constructor(address, protocols, options) {
    super(address, protocols, options)
    this._init()
  }

  /**
   * Initializes the type listener
   */
  _init() {
    this.on('message', (raw) => {
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
    this.send(this.createMessage('error', error))
    this.emit('error', error)
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

module.exports = TypedWebSocket
