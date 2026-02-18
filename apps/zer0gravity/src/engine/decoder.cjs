/**
 * Zer0 Gr@vity — Decoder
 *
 * Takes encoded text + encoding system description,
 * calls Claude in a FRESH context (no knowledge of original)
 * to decode back to English.
 */

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

/**
 * Decode encoded text back to English using a given encoding system.
 * The decoder has NO knowledge of the original text.
 *
 * @param {Object} anthropic - Anthropic SDK client
 * @param {Object} options
 * @param {string} options.encodedText - The encoded/compressed text
 * @param {string} options.encodingSystem - Description of encoding rules
 * @param {string} [options.model] - Claude model to use
 * @returns {Promise<{decodedText: string, usage: Object}>}
 */
async function decode(anthropic, { encodedText, encodingSystem, model = DEFAULT_MODEL }) {
  const response = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    system: `You are a decoding agent participating in the Zer0 Gr@vity compression challenge.

You have NEVER seen the original text. You only have:
1. The encoding system rules below
2. The encoded text

Your task: Decode the encoded text back to natural English.
Output ONLY the decoded text — no explanations, no commentary, no metadata.

ENCODING SYSTEM:
${encodingSystem}`,
    messages: [
      { role: 'user', content: encodedText }
    ]
  });

  const decodedText = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  return {
    decodedText,
    usage: response.usage
  };
}

module.exports = { decode, DEFAULT_MODEL };
