/**
 * Zer0 Gr@vity — Experiment Orchestrator
 *
 * Runs the full encode → decode → score cycle.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../../.env') });
const Anthropic = require('@anthropic-ai/sdk');
const { encode } = require('./encoder.cjs');
const { decode } = require('./decoder.cjs');
const { scoreAll } = require('./scorer.cjs');

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

/**
 * Count tokens for a given text using the Anthropic API.
 */
async function countTokens(anthropic, text, model = DEFAULT_MODEL) {
  try {
    const result = await anthropic.messages.countTokens({
      model,
      messages: [{ role: 'user', content: text }]
    });
    return result.input_tokens;
  } catch (e) {
    // Fallback: rough estimate based on character count
    // Claude tokenizes English at ~4 chars per token on average
    console.error(`[zer0gravity] Token counting API failed, using estimate: ${e.message}`);
    return Math.ceil(text.length / 4);
  }
}

/**
 * Run a single compression experiment.
 *
 * @param {Object} options
 * @param {string} options.originalText - Text to compress
 * @param {string} options.encodingSystem - Encoding rules description
 * @param {string} [options.model] - Claude model to use
 * @param {string} [options.testCaseId] - Test case identifier (e.g., "1a")
 * @returns {Promise<Object>} Full experiment result
 */
async function runExperiment({
  originalText,
  encodingSystem,
  model = DEFAULT_MODEL,
  testCaseId = 'unknown'
}) {
  const anthropic = new Anthropic();
  const startTime = Date.now();
  const totalUsage = { input: 0, output: 0 };

  function trackUsage(usage) {
    if (usage) {
      totalUsage.input += usage.input_tokens || 0;
      totalUsage.output += usage.output_tokens || 0;
    }
  }

  console.error(`[zer0gravity] Running experiment ${testCaseId}...`);

  // Step 1: Count tokens for original
  console.error(`[zer0gravity]   Counting original tokens...`);
  const originalTokens = await countTokens(anthropic, originalText, model);

  // Step 2: Encode
  console.error(`[zer0gravity]   Encoding...`);
  const encodeResult = await encode(anthropic, { text: originalText, encodingSystem, model });
  trackUsage(encodeResult.usage);

  // Step 3: Count tokens for encoded
  console.error(`[zer0gravity]   Counting encoded tokens...`);
  const encodedTokens = await countTokens(anthropic, encodeResult.encodedText, model);

  // Step 4: Decode (fresh context)
  console.error(`[zer0gravity]   Decoding (fresh context)...`);
  const decodeResult = await decode(anthropic, {
    encodedText: encodeResult.encodedText,
    encodingSystem,
    model
  });
  trackUsage(decodeResult.usage);

  // Step 5: Score
  console.error(`[zer0gravity]   Scoring...`);
  const scoreResult = await scoreAll(anthropic, {
    originalText,
    decodedText: decodeResult.decodedText,
    originalTokens,
    encodedTokens,
    encodingSystem,
    model
  });
  trackUsage(scoreResult.usage?.semantic);
  trackUsage(scoreResult.usage?.implementability);

  const duration = Date.now() - startTime;
  const compressionRatio = originalTokens > 0
    ? (originalTokens - encodedTokens) / originalTokens
    : 0;

  console.error(`[zer0gravity]   Done (${(duration / 1000).toFixed(1)}s) — Score: ${scoreResult.total}/100`);

  return {
    testCaseId,
    originalText,
    encodedText: encodeResult.encodedText,
    decodedText: decodeResult.decodedText,
    encodingSystem,
    originalTokens,
    encodedTokens,
    compressionRatio: Math.round(compressionRatio * 1000) / 1000,
    scores: scoreResult.scores,
    total: scoreResult.total,
    details: scoreResult.details,
    metadata: {
      model,
      timestamp: new Date().toISOString(),
      durationMs: duration,
      totalTokensUsed: totalUsage
    }
  };
}

module.exports = { runExperiment, countTokens };
