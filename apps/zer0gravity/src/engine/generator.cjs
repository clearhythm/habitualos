/**
 * Zero Gravity — Full JSON Generator
 *
 * Takes article text and produces a Zero Gravity v0.1 full JSON using Claude.
 * The full JSON contains all semantic fields. The stamp is derived from it.
 */

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

const SYSTEM_PROMPT = `You are a Zero Gravity generator. Your job is to distill an article into a structured semantic abstract.

OUTPUT ONLY VALID JSON. No explanations, no commentary, no markdown fences.

## Required Fields

- id: A URL-safe slug for this article (lowercase, hyphens, alphanumeric only)
- title: Short article title
- intent: What the article does. MUST be one of: proposal / critique / synthesis / report / design
- relevance: One sentence: why this matters
- claims: Array of 3-7 explicit propositions the article makes
- indexes: Array of 4-8 semantic fragments for the stamp. Each entry should capture one of three things: (1) unique key phrases — distinctive terms that make this article findable in semantic search, (2) argument distillation — core claims as indexable propositions, (3) notable snippets — specific quotes or formulations worth preserving. Mix all three freely. Include the author name as an entry if identifiable.

## Optional Fields (include when meaningful)

- stance: Epistemic posture. MUST be one of: speculative / empirical / prescriptive / exploratory
- novelty: Array of 1-3 items describing what is new here
- tags: Array of semantic anchors for clustering/retrieval
- relations: Array of adjacent ideas, frameworks, schools of thought
- audience: Array describing who this is for
- actions: Array of suggested agent actions or processing hints

## Example Output

{
  "id": "zero-gravity-v01",
  "title": "Zero Gravity — A Semantic Bootstrap for the Agentic Web",
  "intent": "proposal",
  "relevance": "A semantic abstract makes indexing cheaper and retrieval clearer",
  "indexes": ["Erik Burns", "semantic bootstrap for agents", "token gravity", "agents need structure not prose", "meaning has bones"],
  "claims": [
    "agents waste tokens on rhetorical glue",
    "meaning can be represented as claims and relations",
    "ZG blocks are a publishable semantic layer",
    "embedding a semantic skeleton produces cleaner vectors than embedding full prose"
  ],
  "stance": "exploratory",
  "novelty": ["Zero Gravity microformat", "distill-then-embed pipeline", "dual-audience publishing"],
  "tags": ["semantic-compression", "agent-abstracts", "meaning-skeleton"],
  "relations": ["RAG", "argument-mapping", "structured-data"],
  "audience": ["AI agents", "developers", "semantic web practitioners"],
  "actions": ["parse stamp for free", "embed stamp fields or fetch pre-computed vector", "read prose only when relevant"]
}

Now distill the provided article.`;

/**
 * Generate Zero Gravity fields from article text using Claude.
 *
 * @param {Object} anthropic - Anthropic SDK client
 * @param {Object} options
 * @param {string} options.text - Article text to distill
 * @param {string} [options.model] - Claude model to use
 * @returns {Promise<{fields: Object|null, raw: string, usage: Object}>}
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

  const raw = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim();

  if (!raw) {
    console.error(`[generator] WARNING: Empty response. Stop reason: ${response.stop_reason}`);
    return { fields: null, raw: '', usage: response.usage };
  }

  // Parse JSON
  let fields;
  try {
    fields = JSON.parse(raw);
  } catch (e) {
    console.error(`[generator] WARNING: Response is not valid JSON: ${e.message}`);
    return { fields: null, raw, usage: response.usage };
  }

  return {
    fields,
    raw,
    usage: response.usage
  };
}

module.exports = { generate, DEFAULT_MODEL };
