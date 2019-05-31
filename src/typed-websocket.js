'use strict'

const WebSocket = require('ws')
const Receiver = require('ws/lib/receiver')
const Sender = require('ws/lib/sender')
const { kStatusCode, kWebSocket, NOOP } = require('ws/lib/constants')

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

    if (options && typeof options.typePassthrough === 'boolean') {
      this.typePassthrough = options.typePassthrough
    } else {
      this.typePassthrough = false
    }
  }

  /**
   * Set up the socket and the internal resources.
   *
   * @param {net.Socket} socket The network socket between the server and client
   * @param {Buffer} head The first packet of the upgraded stream
   * @param {Number} maxPayload The maximum allowed message size
   * @private
   */
  setSocket(socket, head, maxPayload) {
    const receiver = new Receiver(this._binaryType, this._extensions, maxPayload)

    this._sender = new Sender(socket, this._extensions)
    this._receiver = receiver
    this._socket = socket

    receiver[kWebSocket] = this
    socket[kWebSocket] = this

    receiver.on('conclude', receiverOnConclude)
    receiver.on('drain', receiverOnDrain)
    receiver.on('error', receiverOnError)
    receiver.on('message', receiverOnMessage)
    receiver.on('ping', receiverOnPing)
    receiver.on('pong', receiverOnPong)

    socket.setTimeout(0)
    socket.setNoDelay()

    if (head.length > 0) socket.unshift(head)

    socket.on('close', socketOnClose)
    socket.on('data', socketOnData)
    socket.on('end', socketOnEnd)
    socket.on('error', socketOnError)

    this.readyState = WebSocket.OPEN
    this.emit('open')
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

/**
 * The listener of the `Receiver` `'conclude'` event.
 *
 * @param {Number} code The status code
 * @param {String} reason The reason for closing
 * @private
 */
function receiverOnConclude(code, reason) {
  const websocket = this[kWebSocket]

  websocket._socket.removeListener('data', socketOnData)
  websocket._socket.resume()

  websocket._closeFrameReceived = true
  websocket._closeMessage = reason
  websocket._closeCode = code

  if (code === 1005) websocket.close()
  else websocket.close(code, reason)
}

/**
 * The listener of the `Receiver` `'drain'` event.
 *
 * @private
 */
function receiverOnDrain() {
  this[kWebSocket]._socket.resume()
}

/**
 * The listener of the `Receiver` `'error'` event.
 *
 * @param {(RangeError|Error)} err The emitted error
 * @private
 */
function receiverOnError(err) {
  const websocket = this[kWebSocket]

  websocket._socket.removeListener('data', socketOnData)

  websocket.readyState = WebSocket.CLOSING
  websocket._closeCode = err[kStatusCode]
  websocket.emit('error', err)
  websocket._socket.destroy()
}

/**
 * The listener of the `Receiver` `'finish'` event.
 *
 * @private
 */
function receiverOnFinish() {
  this[kWebSocket].emitClose()
}

/**
 * The listener of the `Receiver` `'message'` event.
 *
 * @param {(String|Buffer|ArrayBuffer|Buffer[])} data The message
 * @private
 */
function receiverOnMessage(data) {
  try {
    const parsedData = JSON.parse(data)

    if (typeof parsedData.type !== 'string') {
      onMessageTypeError('Type is not a string', data)
      return
    }

    if (typeof parsedData.data !== 'object') {
      onMessageTypeError('Data is not an object', data)
      return
    }

    this[kWebSocket].emit(`type:${parsedData.type}`, parsedData.data)
  } catch (error) {
    onMessageTypeError(error, data)
  }
}

/**
 * Checks if error is to be emitted else emits data
 *
 * @param {(string|Error)} error The error
 * @param {(String|Buffer|ArrayBuffer|Buffer[])} data The message
 * @private
 */
function onMessageTypeError(error, data) {
  if (this.typePassthrough) {
    this[kWebSocket].emit('message', data)
  } else if (typeof error === 'string') {
    this.emit('error', new Error(error))
  } else {
    this.emit('error', error)
  }
}

/**
 * The listener of the `Receiver` `'ping'` event.
 *
 * @param {Buffer} data The data included in the ping frame
 * @private
 */
function receiverOnPing(data) {
  const websocket = this[kWebSocket]

  websocket.pong(data, !websocket._isServer, NOOP)
  websocket.emit('ping', data)
}

/**
 * The listener of the `Receiver` `'pong'` event.
 *
 * @param {Buffer} data The data included in the pong frame
 * @private
 */
function receiverOnPong(data) {
  this[kWebSocket].emit('pong', data)
}

/**
 * The listener of the `net.Socket` `'close'` event.
 *
 * @private
 */
function socketOnClose() {
  const websocket = this[kWebSocket]

  this.removeListener('close', socketOnClose)
  this.removeListener('end', socketOnEnd)

  websocket.readyState = WebSocket.CLOSING

  //
  // The close frame might not have been received or the `'end'` event emitted,
  // for example, if the socket was destroyed due to an error. Ensure that the
  // `receiver` stream is closed after writing any remaining buffered data to
  // it. If the readable side of the socket is in flowing mode then there is no
  // buffered data as everything has been already written and `readable.read()`
  // will return `null`. If instead, the socket is paused, any possible buffered
  // data will be read as a single chunk and emitted synchronously in a single
  // `'data'` event.
  //
  websocket._socket.read()
  websocket._receiver.end()

  this.removeListener('data', socketOnData)
  this[kWebSocket] = undefined

  clearTimeout(websocket._closeTimer)

  if (websocket._receiver._writableState.finished || websocket._receiver._writableState.errorEmitted) {
    websocket.emitClose()
  } else {
    websocket._receiver.on('error', receiverOnFinish)
    websocket._receiver.on('finish', receiverOnFinish)
  }
}

/**
 * The listener of the `net.Socket` `'data'` event.
 *
 * @param {Buffer} chunk A chunk of data
 * @private
 */
function socketOnData(chunk) {
  if (!this[kWebSocket]._receiver.write(chunk)) {
    this.pause()
  }
}

/**
 * The listener of the `net.Socket` `'end'` event.
 *
 * @private
 */
function socketOnEnd() {
  const websocket = this[kWebSocket]

  websocket.readyState = WebSocket.CLOSING
  websocket._receiver.end()
  this.end()
}

/**
 * The listener of the `net.Socket` `'error'` event.
 *
 * @private
 */
function socketOnError() {
  const websocket = this[kWebSocket]

  this.removeListener('error', socketOnError)
  this.on('error', NOOP)

  websocket.readyState = WebSocket.CLOSING
  this.destroy()
}
