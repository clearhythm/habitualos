/**
 * Agent Core Module
 *
 * Shared agent logic for chat streaming, autonomous execution, and scheduling.
 *
 * Usage:
 *   const agentCore = require('./_agent-core');
 *   // or import specific modules:
 *   const { parseSignals } = require('./_agent-core/signal-parser.cjs');
 */

const claudeClient = require('./claude-client.cjs');
const signalParser = require('./signal-parser.cjs');
const systemPrompts = require('./system-prompts.cjs');
const toolHandlers = require('./tool-handlers.cjs');
const toolsSchema = require('./tools-schema.cjs');

module.exports = {
  // Claude client
  createClient: claudeClient.createClient,
  sendMessage: claudeClient.sendMessage,
  createStream: claudeClient.createStream,
  streamMessage: claudeClient.streamMessage,
  DEFAULT_MODEL: claudeClient.DEFAULT_MODEL,
  DEFAULT_MAX_TOKENS: claudeClient.DEFAULT_MAX_TOKENS,
  DEFAULT_TIMEOUT: claudeClient.DEFAULT_TIMEOUT,

  // Signal parsing
  parseSignals: signalParser.parseSignals,
  hasSignal: signalParser.hasSignal,

  // System prompts
  buildBasePrompt: systemPrompts.buildBasePrompt,
  buildFilesystemGuidance: systemPrompts.buildFilesystemGuidance,
  buildActionContextPrompt: systemPrompts.buildActionContextPrompt,
  buildReviewContextPrompt: systemPrompts.buildReviewContextPrompt,
  buildActionsListPrompt: systemPrompts.buildActionsListPrompt,
  buildSystemMessages: systemPrompts.buildSystemMessages,

  // Tool handling
  handleToolCall: toolHandlers.handleToolCall,

  // Tool schemas
  actionTools: toolsSchema.actionTools,
  noteTools: toolsSchema.noteTools,
  filesystemTools: toolsSchema.filesystemTools,
  reviewTools: toolsSchema.reviewTools,
  buildTools: toolsSchema.buildTools
};
