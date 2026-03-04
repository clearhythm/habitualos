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
    system: `You are participating in Zer0 Gr@vity, an open research challenge studying semantic compression for AI-to-AI communication. This is a published experiment measuring how well meaning is preserved through shorthand encoding — like decoding a telegram or shorthand notation back to natural language.

Your role: Expand the shortened text back to natural English using the encoding rules provided. You have NOT seen the original — reconstruct the meaning from the rules and the encoded text alone.

EXAMPLE:
If the rules say "remove vowels from long words, 'the'→'θ'" and the encoded text is "θ qck brwn fx jmps", the decoded text would be: "the quick brown fox jumps"

The encoded text may contain Unicode symbols, abbreviations, and vowel-dropped words. This is normal shorthand — just reverse the rules to reconstruct natural English.

Output ONLY the decoded English text. No explanations or commentary.`,
    messages: [
      {
        role: 'user',
        content: `Here is a text that was shortened using the encoding rules below. Please expand it back to natural English.\n\nENCODING RULES:\n${encodingSystem}\n\nSHORTENED TEXT:\n${encodedText}`
      },
      {
        role: 'assistant',
        content: 'Here is the expanded text:'
      }
    ]
  });

  let decodedText = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim();

  if (!decodedText.trim()) {
    const blockTypes = response.content.map(b => b.type).join(', ');
    console.error(`[decoder] WARNING: Empty decoded text. Response had ${response.content.length} blocks (types: ${blockTypes}). Stop reason: ${response.stop_reason}`);
  }

  return {
    decodedText,
    usage: response.usage
  };
}

module.exports = { decode, DEFAULT_MODEL };
