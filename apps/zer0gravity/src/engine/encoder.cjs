/**
 * Zer0 Gr@vity — Encoder
 *
 * Takes original text + encoding system description,
 * calls Claude to produce encoded (compressed) text.
 */

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

/**
 * Encode text using a given encoding system via Claude.
 *
 * @param {Object} anthropic - Anthropic SDK client
 * @param {Object} options
 * @param {string} options.text - Original text to encode
 * @param {string} options.encodingSystem - Description of encoding rules
 * @param {string} [options.model] - Claude model to use
 * @returns {Promise<{encodedText: string, usage: Object}>}
 */
async function encode(anthropic, { text, encodingSystem, model = DEFAULT_MODEL }) {
  const response = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    system: `You are an encoding agent participating in the Zer0 Gr@vity compression challenge.

Your task: Compress the given text using the encoding system described below.
Output ONLY the encoded text — no explanations, no commentary, no metadata.

ENCODING SYSTEM:
${encodingSystem}`,
    messages: [
      { role: 'user', content: text }
    ]
  });

  const encodedText = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  return {
    encodedText,
    usage: response.usage
  };
}

module.exports = { encode, DEFAULT_MODEL };
