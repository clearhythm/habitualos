/**
 * Zer0 Gr@vity — ZG Block Embedder
 *
 * Takes a ZG block and generates a vector embedding via OpenAI.
 * Embeds the semantic skeleton (ZG block text), not the full article.
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
 * Generate an embedding for a ZG block.
 *
 * @param {Object} openai - OpenAI SDK client
 * @param {Object} options
 * @param {string} options.blockText - The raw ZG block text (between delimiters, inclusive)
 * @param {string} options.zgId - The ZG block id field
 * @param {string} [options.model] - Embedding model
 * @param {number} [options.dimensions] - Vector dimensions
 * @returns {Promise<{zg_id: string, zg_version: string, model: string, dimensions: number, input_hash: string, created_at: string, vector: number[]}>}
 */
async function embed(openai, { blockText, zgId, model = DEFAULT_MODEL, dimensions = DEFAULT_DIMENSIONS }) {
  const response = await openai.embeddings.create({
    model,
    input: blockText,
    dimensions
  });

  const vector = response.data[0].embedding;

  return {
    zg_id: zgId,
    zg_version: '0.1',
    model,
    dimensions,
    input_hash: hashText(blockText),
    created_at: new Date().toISOString(),
    vector
  };
}

module.exports = { embed, hashText, DEFAULT_MODEL, DEFAULT_DIMENSIONS };
