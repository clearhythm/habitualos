/**
 * Claude Client Module
 *
 * Shared Anthropic client configuration for agent chat.
 * Provides both streaming and non-streaming message interfaces.
 */

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';
const DEFAULT_MAX_TOKENS = 2048;
const DEFAULT_TIMEOUT = 20000; // 20 second timeout

/**
 * Create an Anthropic client instance
 * @param {Object} options - Client options
 * @param {number} [options.timeout] - Request timeout in ms (default: 20000)
 * @returns {Anthropic} Configured Anthropic client
 */
function createClient(options = {}) {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: options.timeout || DEFAULT_TIMEOUT
  });
}

/**
 * Send a non-streaming message to Claude
 * @param {Anthropic} client - Anthropic client instance
 * @param {Object} params - Message parameters
 * @param {Array} params.system - System messages
 * @param {Array} params.messages - Conversation messages
 * @param {Array} [params.tools] - Available tools
 * @param {string} [params.model] - Model to use (default: claude-sonnet-4-5-20250929)
 * @param {number} [params.maxTokens] - Max tokens (default: 2048)
 * @returns {Promise<Object>} Claude API response
 */
async function sendMessage(client, params) {
  return client.messages.create({
    model: params.model || DEFAULT_MODEL,
    max_tokens: params.maxTokens || DEFAULT_MAX_TOKENS,
    system: params.system,
    messages: params.messages,
    tools: params.tools || []
  });
}

/**
 * Create a streaming message request to Claude
 * Returns the stream object for the caller to iterate over
 * @param {Anthropic} client - Anthropic client instance
 * @param {Object} params - Message parameters
 * @param {Array} params.system - System messages
 * @param {Array} params.messages - Conversation messages
 * @param {Array} [params.tools] - Available tools
 * @param {string} [params.model] - Model to use
 * @param {number} [params.maxTokens] - Max tokens
 * @returns {Object} Stream object with async iterator
 */
function createStream(client, params) {
  return client.messages.stream({
    model: params.model || DEFAULT_MODEL,
    max_tokens: params.maxTokens || DEFAULT_MAX_TOKENS,
    system: params.system,
    messages: params.messages,
    tools: params.tools || []
  });
}

/**
 * Async generator that yields events from a Claude stream
 * @param {Anthropic} client - Anthropic client instance
 * @param {Object} params - Message parameters
 * @yields {Object} Stream events
 */
async function* streamMessage(client, params) {
  const stream = createStream(client, params);
  for await (const event of stream) {
    yield event;
  }
}

module.exports = {
  createClient,
  sendMessage,
  createStream,
  streamMessage,
  DEFAULT_MODEL,
  DEFAULT_MAX_TOKENS,
  DEFAULT_TIMEOUT
};
