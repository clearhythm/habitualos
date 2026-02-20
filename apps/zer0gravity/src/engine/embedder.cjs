/**
 * Zero Gravity — Embedder
 *
 * Generates vector embeddings via OpenAI for Zero Gravity content.
 * Embeds the semantic skeleton (field values), not the full article.
 *
 * Also provides buildFullJSON() to assemble the complete output JSON.
 */

const crypto = require('crypto');

const DEFAULT_MODEL = 'text-embedding-3-small';
const DEFAULT_DIMENSIONS = 1536;

/**
 * Compute SHA-256 hash of text.
 *
 * @param {string} text
 * @returns {string} Hex-encoded hash
 */
function hashText(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Build a text representation of the fields for embedding.
 * Concatenates the semantic fields into a clean text block.
 *
 * @param {Object} fields - Full JSON fields
 * @returns {string}
 */
function fieldsToEmbeddingText(fields) {
  const parts = [];
  if (fields.title) parts.push(`Title: ${fields.title}`);
  if (fields.intent) parts.push(`Intent: ${fields.intent}`);
  if (fields.relevance) parts.push(`Relevance: ${fields.relevance}`);
  if (Array.isArray(fields.indexes)) {
    parts.push(`Indexes: ${fields.indexes.join('; ')}`);
  }
  if (Array.isArray(fields.claims)) {
    parts.push(`Claims: ${fields.claims.join('; ')}`);
  }
  if (Array.isArray(fields.tags)) {
    parts.push(`Tags: ${fields.tags.join(', ')}`);
  }
  if (Array.isArray(fields.relations)) {
    parts.push(`Relations: ${fields.relations.join(', ')}`);
  }
  return parts.join('\n');
}

/**
 * Generate an embedding for Zero Gravity fields.
 *
 * @param {Object} openai - OpenAI SDK client
 * @param {Object} options
 * @param {Object} options.fields - Full JSON fields
 * @param {string} [options.model] - Embedding model
 * @param {number} [options.dimensions] - Vector dimensions
 * @returns {Promise<{model: string, dimensions: number, input_hash: string, vector: number[]}>}
 */
async function embed(openai, { fields, model = DEFAULT_MODEL, dimensions = DEFAULT_DIMENSIONS }) {
  const inputText = fieldsToEmbeddingText(fields);

  const response = await openai.embeddings.create({
    model,
    input: inputText,
    dimensions
  });

  const vector = response.data[0].embedding;

  return {
    model,
    dimensions,
    input_hash: hashText(inputText),
    vector
  };
}

/**
 * Build the full output JSON.
 * Merges all fields with an optional embedding.
 *
 * @param {Object} options
 * @param {Object} options.fields - Generated fields
 * @param {Object} [options.embedding] - Embedding result from embed()
 * @returns {Object} Full JSON structure
 */
function buildFullJSON({ fields, embedding = null }) {
  const result = {
    encoding: 'zero-gravity',
    version: '0.1',
    ...fields,
    created_at: new Date().toISOString()
  };

  if (embedding) {
    result.embedding = embedding;
  }

  return result;
}

module.exports = { embed, buildFullJSON, fieldsToEmbeddingText, hashText, DEFAULT_MODEL, DEFAULT_DIMENSIONS };
