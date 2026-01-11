//
// netlify/functions/_tools/registry.cjs
// ------------------------------------------------------
// Tool Registry for HabitualOS Agent Capabilities
//
// This registry defines tools available to agents in an
// MCP-adjacent format. Each tool has a schema that could
// later be converted to an actual MCP server.
//
// Architecture:
// - Tools are defined declaratively here
// - Each tool has an implementation in this directory
// - Agents use tools via USE_TOOL signal
// - Backend routes to appropriate handler
// ------------------------------------------------------

const tools = {
  sync_documentation: {
    name: 'sync_documentation',
    description: 'Updates project documentation (ARCHITECTURE.md, DESIGN.md, README.md) by syncing with recent git commits and code changes. Use when documentation appears stale or out of sync.',
    inputSchema: {
      type: 'object',
      properties: {
        force: {
          type: 'boolean',
          description: 'Force sync even if staleness threshold not met',
          default: false
        }
      }
    },
    handler: './sync-documentation.cjs'
  }

  // Future tools:
  // generate_shift_cards: { ... }
  // query_actions: { ... }
  // query_assets: { ... }
};

/**
 * Get tool definition by name
 * @param {string} name - Tool name
 * @returns {Object|null} Tool definition or null
 */
function getTool(name) {
  return tools[name] || null;
}

/**
 * Get all available tools for agent context
 * @returns {Array} Array of tool definitions
 */
function getAllTools() {
  return Object.values(tools);
}

/**
 * Execute a tool by name
 * @param {string} name - Tool name
 * @param {Object} input - Tool input parameters
 * @returns {Promise<Object>} Tool execution result
 */
async function executeTool(name, input = {}) {
  const tool = getTool(name);

  if (!tool) {
    throw new Error(`Tool not found: ${name}`);
  }

  // Dynamically require the handler
  const handler = require(tool.handler);

  if (typeof handler.execute !== 'function') {
    throw new Error(`Tool ${name} does not export execute function`);
  }

  return await handler.execute(input);
}

module.exports = {
  tools,
  getTool,
  getAllTools,
  executeTool
};
