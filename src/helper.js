'use strict'

/**
 * Creates a message with type and data
 * @param {string} type The message type
 * @param {object} data The message data
 */
const createMessage = (type, data) => {
  if (typeof type !== 'string') {
    throw new Error('type is not of type string')
  }

  if (typeof data !== 'object') {
    throw new Error('data is not of type object')
  }

  return JSON.stringify({ type, data })
}
