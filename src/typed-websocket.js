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
   * @private
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
   * @private
   */
  _emitNewError(message) {
    this._emitError(new Error(message))
  }

  /**
   * Sends an error to WebSocket and emits error
   * @param {Error} error Error object
   * @private
   */
  _emitError(error) {
    this.send(this.createMessage('error', error))
    this.emit('error', error)
  }

  /**
   * Send a data message.
   *
   * @param {string} type The message type
   * @param {Object} data The message to send
   * @param {Object} options Options object
   * @param {Boolean} options.compress Specifies whether or not to compress
   *     `data`
   * @param {Boolean} options.binary Specifies whether `data` is binary or text
   * @param {Boolean} options.fin Specifies whether the fragment is the last one
   * @param {Boolean} options.mask Specifies whether or not to mask `data`
   * @param {Function} cb Callback which is executed when data is written out
   * @public
   */
  sendt(type, data, options, cb) {
    const message = this.createMessage(type, data)

    this.send(message, options, cb)
  }

  /**
   * Creates a message with type and data
   * @param {string} type The message type
   * @param {object} data The message data
   * @public
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
