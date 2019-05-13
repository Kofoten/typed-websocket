'use strict'

const WebSocket = require('ws')
const { createHash } = require('crypto')

const PerMessageDeflate = require('ws/lib/permessage-deflate')
const { format } = require('ws/lib/extension')
const { GUID } = require('ws/lib/constants')

const TypedWebSocket = require('./typed-websocket')

/**
 * Handle premature socket errors.
 *
 * @private
 */
function socketOnError() {
  this.destroy()
}

/**
 * Class representing a TypedWebSocket server.
 *
 * @extends WebSocket.Server
 */
class Server extends WebSocket.Server {
  /**
   * Upgrade the connection to WebSocket.
   *
   * @param {String} key The value of the `Sec-WebSocket-Key` header
   * @param {Object} extensions The accepted extensions
   * @param {http.IncomingMessage} req The request object
   * @param {net.Socket} socket The network socket between the server and client
   * @param {Buffer} head The first packet of the upgraded stream
   * @param {Function} cb Callback
   * @private
   */
  completeUpgrade(key, extensions, req, socket, head, cb) {
    //
    // Destroy the socket if the client has already sent a FIN packet.
    //
    if (!socket.readable || !socket.writable) return socket.destroy()

    const digest = createHash('sha1')
      .update(key + GUID)
      .digest('base64')

    const headers = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${digest}`,
    ]

    const ws = new TypedWebSocket(null)
    let protocol = req.headers['sec-websocket-protocol']

    if (protocol) {
      protocol = protocol.trim().split(/ *, */)

      //
      // Optionally call external protocol selection handler.
      //
      if (this.options.handleProtocols) {
        protocol = this.options.handleProtocols(protocol, req)
      } else {
        protocol = protocol[0]
      }

      if (protocol) {
        headers.push(`Sec-WebSocket-Protocol: ${protocol}`)
        ws.protocol = protocol
      }
    }

    if (extensions[PerMessageDeflate.extensionName]) {
      const params = extensions[PerMessageDeflate.extensionName].params
      const value = format({
        [PerMessageDeflate.extensionName]: [params],
      })
      headers.push(`Sec-WebSocket-Extensions: ${value}`)
      ws._extensions = extensions
    }

    //
    // Allow external modification/inspection of handshake headers.
    //
    this.emit('headers', headers, req)

    socket.write(headers.concat('\r\n').join('\r\n'))
    socket.removeListener('error', socketOnError)

    ws.setSocket(socket, head, this.options.maxPayload)

    if (this.clients) {
      this.clients.add(ws)
      ws.on('close', () => this.clients.delete(ws))
    }

    cb(ws)
  }
}

module.exports = Server
