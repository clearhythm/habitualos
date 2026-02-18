/**
 * Zer0 Gr@vity — Scorer
 *
 * Applies the 100-point rubric to score a compression experiment.
 *
 * Rubric:
 * - Token Efficiency:        40 points (math)
 * - Semantic Preservation:   40 points (Claude evaluation)
 * - Learnability:            15 points (derived from semantic score)
 * - Implementability:         5 points (Claude evaluation)
 * - Total:                  100 points
 */

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

/**
 * Score token efficiency. Pure math — no API call.
 * 1 point per 1% compression, max 40.
 */
function scoreTokenEfficiency(originalTokens, encodedTokens) {
  if (originalTokens <= 0) return { score: 0, compressionPercent: 0 };

  const compressionPercent = ((originalTokens - encodedTokens) / originalTokens) * 100;
  const score = Math.min(Math.max(Math.round(compressionPercent), 0), 40);

  return { score, compressionPercent: Math.round(compressionPercent * 10) / 10 };
}

/**
 * Score semantic preservation. Claude compares original vs decoded.
 */
async function scoreSemanticPreservation(anthropic, originalText, decodedText, model = DEFAULT_MODEL) {
  const response = await anthropic.messages.create({
    model,
    max_tokens: 512,
    system: `You are evaluating semantic preservation in the Zer0 Gr@vity compression challenge.

Compare the ORIGINAL text to the DECODED text. The decoded text was produced by an agent that never saw the original — it only had the encoding rules and the encoded text.

Score on a 0-40 scale:
- 36-40: Meaning is identical or imperceptibly different
- 28-35: Meaning is preserved but with minor loss of nuance
- 16-27: Meaning is recognizable but some context is lost
- 6-15: Meaning is partially preserved but significant loss
- 0-5: Meaning is corrupted or lost

Respond with ONLY a JSON object: {"score": <number>, "reasoning": "<1-2 sentence explanation>"}`,
    messages: [
      {
        role: 'user',
        content: `ORIGINAL:\n${originalText}\n\nDECODED:\n${decodedText}`
      }
    ]
  });

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  try {
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }
    const result = JSON.parse(cleaned);
    return {
      score: Math.min(Math.max(Math.round(result.score), 0), 40),
      reasoning: result.reasoning || '',
      usage: response.usage
    };
  } catch (e) {
    // If Claude didn't return valid JSON, try to extract a number
    const match = text.match(/(\d+)/);
    return {
      score: match ? Math.min(Math.max(parseInt(match[1]), 0), 40) : 0,
      reasoning: `Parse error — raw response: ${text.slice(0, 200)}`,
      usage: response.usage
    };
  }
}

/**
 * Score learnability. Derived from semantic preservation.
 * If the fresh agent decoded well, the encoding is learnable.
 */
function scoreLearnability(semanticPreservationScore) {
  return Math.round((semanticPreservationScore / 40) * 15);
}

/**
 * Score implementability. Claude evaluates encoding system complexity.
 */
async function scoreImplementability(anthropic, encodingSystem, model = DEFAULT_MODEL) {
  const response = await anthropic.messages.create({
    model,
    max_tokens: 512,
    system: `Evaluate this encoding system for implementability as an agent skill (a set of rules an agent can learn and apply).

- 5: Fully describable as a simple, unambiguous rule set
- 4: Clear rules with minor edge cases
- 3: Mostly describable, some ambiguous rules
- 2: Requires interpretation or judgment calls
- 1: Complex, hard to apply consistently
- 0: Requires significant custom code or external tools

Respond with ONLY a JSON object: {"score": <number>, "reasoning": "<1-2 sentence explanation>"}`,
    messages: [
      { role: 'user', content: encodingSystem }
    ]
  });

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  try {
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }
    const result = JSON.parse(cleaned);
    return {
      score: Math.min(Math.max(Math.round(result.score), 0), 5),
      reasoning: result.reasoning || '',
      usage: response.usage
    };
  } catch (e) {
    const match = text.match(/(\d+)/);
    return {
      score: match ? Math.min(Math.max(parseInt(match[1]), 0), 5) : 0,
      reasoning: `Parse error — raw response: ${text.slice(0, 200)}`,
      usage: response.usage
    };
  }
}

/**
 * Run all scoring and return full breakdown.
 */
async function scoreAll(anthropic, {
  originalText,
  decodedText,
  originalTokens,
  encodedTokens,
  encodingSystem,
  model = DEFAULT_MODEL
}) {
  const efficiency = scoreTokenEfficiency(originalTokens, encodedTokens);

  const [semantic, implementability] = await Promise.all([
    scoreSemanticPreservation(anthropic, originalText, decodedText, model),
    scoreImplementability(anthropic, encodingSystem, model)
  ]);

  const learnability = scoreLearnability(semantic.score);
  const total = efficiency.score + semantic.score + learnability + implementability.score;

  return {
    scores: {
      tokenEfficiency: efficiency.score,
      semanticPreservation: semantic.score,
      learnability,
      implementability: implementability.score
    },
    total,
    details: {
      compressionPercent: efficiency.compressionPercent,
      semanticReasoning: semantic.reasoning,
      implementabilityReasoning: implementability.reasoning
    },
    usage: {
      semantic: semantic.usage,
      implementability: implementability.usage
    }
  };
}

module.exports = {
  scoreTokenEfficiency,
  scoreSemanticPreservation,
  scoreLearnability,
  scoreImplementability,
  scoreAll
};
