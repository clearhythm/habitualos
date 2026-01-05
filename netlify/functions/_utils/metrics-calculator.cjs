//
// netlify/functions/_utils/metrics-calculator.cjs
// ------------------------------------------------------
// METRICS CALCULATION UTILITIES
// Handles API cost calculations and metrics tracking.
//
// Responsibilities:
//   - calculateCost(model, inputTokens, outputTokens) - Calculate cost based on model pricing
//   - createApiCallRecord(model, inputTokens, outputTokens, operation) - Generate API call tracking object
// ------------------------------------------------------

/**
 * Pricing table for Claude models (per 1M tokens)
 * Updated as of January 2025
 */
const MODEL_PRICING = {
  'claude-opus-4-5': {
    input: 15.00,   // $15 per 1M input tokens
    output: 75.00   // $75 per 1M output tokens
  },
  'claude-sonnet-4-5': {
    input: 3.00,    // $3 per 1M input tokens
    output: 15.00   // $15 per 1M output tokens
  },
  'claude-sonnet-4': {
    input: 3.00,
    output: 15.00
  },
  'claude-haiku-4': {
    input: 0.80,    // $0.80 per 1M input tokens
    output: 4.00    // $4 per 1M output tokens
  },
  // Legacy models (if still in use)
  'claude-3-5-sonnet-20241022': {
    input: 3.00,
    output: 15.00
  },
  'claude-3-5-haiku-20241022': {
    input: 0.80,
    output: 4.00
  },
  'claude-3-opus-20240229': {
    input: 15.00,
    output: 75.00
  }
};

/**
 * Default pricing for unknown models (uses Sonnet pricing as fallback)
 */
const DEFAULT_PRICING = {
  input: 3.00,
  output: 15.00
};

/**
 * Calculate cost for API call
 * @param {string} model - Model name (e.g., 'claude-sonnet-4-5')
 * @param {number} inputTokens - Input token count
 * @param {number} outputTokens - Output token count
 * @returns {number} Cost in dollars (rounded to 6 decimal places)
 */
exports.calculateCost = (model, inputTokens, outputTokens) => {
  const pricing = MODEL_PRICING[model] || DEFAULT_PRICING;

  // Calculate cost: (tokens / 1M) * price per 1M tokens
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  const totalCost = inputCost + outputCost;

  // Round to 6 decimal places to avoid floating point issues
  return Math.round(totalCost * 1_000_000) / 1_000_000;
};

/**
 * Create an API call record object for metrics tracking
 * @param {string} model - Model name
 * @param {number} inputTokens - Input token count
 * @param {number} outputTokens - Output token count
 * @param {string} operation - Operation type (e.g., 'chat', 'generate', 'analyze')
 * @returns {Object} API call record
 */
exports.createApiCallRecord = (model, inputTokens, outputTokens, operation = 'chat') => {
  const cost = exports.calculateCost(model, inputTokens, outputTokens);

  return {
    timestamp: new Date().toISOString(),
    model,
    inputTokens,
    outputTokens,
    cost,
    operation
  };
};

/**
 * Get pricing info for a model (useful for displaying rates)
 * @param {string} model - Model name
 * @returns {Object} Pricing info { input, output, perMillion: true }
 */
exports.getModelPricing = (model) => {
  const pricing = MODEL_PRICING[model] || DEFAULT_PRICING;
  return {
    ...pricing,
    perMillion: true
  };
};
