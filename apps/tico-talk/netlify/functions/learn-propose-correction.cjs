// POST /api/learn-propose-correction
//
// The trainee flags something Tico got wrong or didn't know during a
// drill. Rather than asking them to retype it as a clean note from
// scratch, this sends the last exchange to a small extraction call that
// proposes a standalone factual statement + a scope classification —
// the trainee then confirms/edits/rejects it (learn-save-correction.cjs)
// rather than the app inventing or guessing at the fact itself. Per
// docs/VISION.md's Data Principle: only extracts what the trainee
// actually said, never adds detail they didn't provide.

const Anthropic = require('@anthropic-ai/sdk');
const { getRestaurant } = require('./_services/db-restaurants.cjs');
const { log } = require('./_utils/log.cjs');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const EXTRACTION_SYSTEM_PROMPT = `You help turn a restaurant trainee's flagged correction into a clean, standalone factual note for staff reference.

You'll be given the trainee's most recent message (where they flagged something) and Tico's prior message it's responding to, plus which menu section was being drilled. Extract ONLY the factual claim the trainee actually made — never add detail, never infer anything they didn't say, never soften or embellish it. If the trainee's message doesn't actually contain a clear, checkable fact (e.g. it's just "that's wrong" with no correction, or a question, or off-topic), say so instead of inventing one.

Also classify scope:
- "restaurant": true regardless of which section a guest is asking about (e.g. hours, walk-in policy, general allergy handling).
- "section": true only within the section currently being drilled.

Respond with ONLY a JSON object, no other text, no markdown fences:
{"ok": true, "text": "<clean standalone fact, one sentence, no hedging>", "scope": "restaurant"|"section"}
or, if there's no extractable fact:
{"ok": false, "reason": "<short reason>"}`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { restaurantId, lastUserMessage, lastAssistantMessage, currentSection } = JSON.parse(event.body || '{}');
    if (!restaurantId || !lastUserMessage || !lastAssistantMessage || !currentSection) {
      return { statusCode: 400, body: JSON.stringify({ error: 'restaurantId, lastUserMessage, lastAssistantMessage, and currentSection are required' }) };
    }

    const restaurant = await getRestaurant(restaurantId);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: JSON.stringify({
          restaurant: restaurant.name,
          currentSection,
          ticoMessage: lastAssistantMessage,
          traineeMessage: lastUserMessage
        })
      }]
    });

    const raw = response.content.find((b) => b.type === 'text')?.text || '';
    let parsed;
    try {
      parsed = JSON.parse(raw.trim());
    } catch {
      log('error', '[learn-propose-correction] unparseable extraction response', raw);
      return { statusCode: 502, body: JSON.stringify({ error: 'Could not extract a correction from that exchange.' }) };
    }

    if (!parsed.ok) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, reason: parsed.reason || 'No clear correction found.' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, text: parsed.text, scope: parsed.scope === 'restaurant' ? 'restaurant' : 'section', section: currentSection })
    };
  } catch (error) {
    log('error', '[learn-propose-correction] failed', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Internal server error' }) };
  }
};
