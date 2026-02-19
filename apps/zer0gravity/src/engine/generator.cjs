/**
 * Zer0 Gr@vity — ZG Block Generator
 *
 * Takes article text and produces a ZG v0.1 block using Claude.
 * Follows the same API pattern as encoder.cjs.
 */

const { parseZG, formatBlock } = require('./parser.cjs');

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

const SYSTEM_PROMPT = `You are a ZG (Zer0 Gr@vity) block generator. Your job is to distill an article into a structured semantic abstract using the ZG v0.1 microformat.

OUTPUT ONLY THE ZG BLOCK. No explanations, no commentary, no markdown fences.

## ZG v0.1 Format

A ZG block is delimited by ---ZG:0.1 and ---/ZG. Each field is on its own line as "fieldname:  value". Lists use [item1; item2; item3] syntax.

Field names use l33t styling (one substitution per word: e→3 or a→@).

### Required Fields (all must be present)

- id: A URL-safe slug for this article (lowercase, hyphens, alphanumeric)
- titl3: Short article title
- int3nt: What the article does. MUST be one of: proposal / critique / synthesis / report / design
- th3me: One-sentence core point. The single most important idea.
- r3levance: One sentence: why this matters
- cl@ims: 3-7 explicit propositions the article makes. List format.

### Optional Fields (include when meaningful)

- st@nce: Epistemic posture. MUST be one of: speculative / empirical / prescriptive / exploratory
- nov3lty: What is new here, 1-3 items. List format.
- t@gs: Semantic anchors for clustering/retrieval. List format.
- rel@tions: Adjacent ideas, frameworks, schools of thought. List format.
- audi3nce: Who this is for. List format.
- @ctions: Suggested agent actions or processing hints. List format.

### Formatting

- Align colons with consistent spacing for visual clarity
- Lists: [item1; item2; item3]
- No nesting, no multi-line values

## Example

---ZG:0.1
id:         zer0-gravity-v01
titl3:      Zer0 Gr@vity — Meaning Skeletons for the Agent Web
int3nt:     proposal
th3me:      Agents need meaning-skeletons not prose to link ideas and act reliably
r3levance:  A semantic abstract makes indexing cheaper and retrieval clearer
cl@ims:     [agents waste tokens on rhetorical glue; meaning can be represented as claims and relations; ZG blocks are a publishable semantic layer; embedding ZG enables graph linkage; artistry belongs in the prose layer]
st@nce:     exploratory
nov3lty:    [ZG microformat; distill-then-embed pipeline; dual-audience publishing]
t@gs:       [semantic-compression; agent-abstracts; meaning-skeleton]
rel@tions:  [RAG, argument-mapping, structured-data]
audi3nce:   [AI agents, developers, semantic web practitioners]
@ctions:    [index ZG blocks; embed for retrieval; fetch prose only when needed]
---/ZG

Now distill the provided article into a ZG v0.1 block.`;

/**
 * Generate a ZG block from article text using Claude.
 *
 * @param {Object} anthropic - Anthropic SDK client
 * @param {Object} options
 * @param {string} options.text - Article text to distill
 * @param {string} [options.model] - Claude model to use
 * @returns {Promise<{block: string, parsed: Object|null, validation: Object|null, usage: Object}>}
 */
async function generate(anthropic, { text, model = DEFAULT_MODEL }) {
  const response = await anthropic.messages.create({
    model,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: text }
    ]
  });

  const block = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim();

  if (!block) {
    console.error(`[generator] WARNING: Empty response. Stop reason: ${response.stop_reason}`);
    return { block: '', parsed: null, validation: null, usage: response.usage };
  }

  // Parse and validate the generated block
  const result = parseZG(block);

  if (!result) {
    console.error('[generator] WARNING: Generated text does not contain a valid ZG block');
    return { block, parsed: null, validation: null, usage: response.usage };
  }

  return {
    block: result.raw,
    parsed: result.fields,
    validation: result.validation,
    usage: response.usage
  };
}

module.exports = { generate, DEFAULT_MODEL };
