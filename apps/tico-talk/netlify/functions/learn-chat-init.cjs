const { getRestaurant } = require('./_services/db-restaurants.cjs');
const { getRestaurantNotes } = require('./_services/db-restaurant-notes.cjs');

// Two gated drill passes per section: Basics (ingredients only) then
// Complete (dietary + pricing together). See plans/tico-learn-ticket5.md —
// reviewing a section's full description/price/tags at once, then being
// quizzed on any of it, was overwhelming; each pass only shows/asks its
// own fields.
const PASS_FACT_TYPES = { basics: ['ingredients'], complete: ['dietary', 'pricing'] };

function findSection(restaurant, sectionName) {
  return [...restaurant.food, ...restaurant.drinks].find((c) => c.name === sectionName) || null;
}

// Basics until every item's ingredients are covered; Complete after that.
// Derived from coverage data every turn, never stored separately.
function derivePass(section, factCoverage) {
  const allIngredientsDone = section.items.every((item) => factCoverage?.[item.id]?.ingredients);
  return allIngredientsDone ? 'complete' : 'basics';
}

function buildSharedPrompt(restaurant, notes) {
  const restaurantNotes = notes.filter((n) => n.scope === 'restaurant');
  const notesBlock = restaurantNotes.length
    ? restaurantNotes.map((n) => `- ${n.text}`).join('\n')
    : '(none yet)';

  return `You are Tico, a warm, experienced coworker helping a restaurant server-in-training drill their knowledge of the menu at ${restaurant.name}.

The trainee is a server working the floor, not a host at the entrance. Every customer in this drill is already seated at a table, mid-visit. That means the trainee can and should take orders, make recommendations, and answer questions the way a server actually would. Never frame anything as out of scope for them because "that's the host's job" or "wait until they're seated," they're already seated.

RESTAURANT NOTES for ${restaurant.name} (apply across every section, equally authoritative to the section's menu data below — these are staff-confirmed facts, not guesses):
${notesBlock}

Never use an em dash anywhere in your response, in either voice. Use a comma, period, or parentheses instead.`;
}

// Pass-aware and restaurant-aware. Two distinct, still-static-within-a-pass
// variants per restaurant — each independently cacheable across
// turns/trainees within that pass at that restaurant; a pass boundary is a
// natural, rare, acceptable cache miss, same as a restaurant boundary.
function buildSectionPrompt(restaurant, section, notes, pass) {
  const trimmedItems = section.items.map((item) => {
    const trimmed = { id: item.id, name: item.name };
    // Only expose the fields relevant to the CURRENT pass — not just an
    // instruction to ignore the rest, actually omit them, so there's no
    // ambiguity about what's in scope right now.
    if (pass === 'basics') {
      trimmed.description = item.description;
    } else {
      trimmed.price = item.price;
      if (item.tags && item.tags.length) trimmed.tags = item.tags;
    }
    if (item.notes) trimmed.notes = item.notes; // notes can matter either pass
    return trimmed;
  });

  const sectionNotes = notes.filter((n) => n.scope === 'section' && n.section === section.name);
  const sectionNotesBlock = sectionNotes.length
    ? `\nADDITIONAL NOTES FOR THIS SECTION (equally authoritative to SECTION DATA):\n${sectionNotes.map((n) => `- ${n.text}`).join('\n')}\n`
    : '';

  const passScope = pass === 'basics'
    ? `You are drilling BASICS only right now: ingredients. Every question must be about what's in a dish (ingredients, preparation, what it's made of). Never ask about price, dietary restrictions, or add-ons in this pass, even if the trainee brings one up, gently redirect back to ingredients or note you'll circle back to that later.`
    : `You are drilling COMPLETE right now: dietary restrictions and pricing. Ingredients are already covered for this section, don't re-drill them. Every question must be about whether a dish is vegetarian/gluten-free/dairy-free/etc, or its price/add-on cost. Never ask a pure ingredients question in this pass.`;

  return `Drilling section: "${section.name}" at ${restaurant.name}, ${pass} pass.

${passScope}

Each round works like this: you ask ONE question, in scope for this pass, as if you were an ordinary seated customer looking at this section. Real customers mostly ask ordinary things, never an unusual invented premise. The trainee answers. You then evaluate that specific answer, every round, not rarely: confirm if it's right, or gently correct if it's wrong, framed as "here's a good one to know," never as grading or saying "wrong." Then ask your next question, continuing the drill.

The drill isn't one flat, uninterrupted quiz. Narrate it as a series of distinct customer interactions. After a handful of exchanges with one table, wrap that interaction up naturally in character (they say thanks, go back to their conversation, whatever fits) and bring in a new table with a new mundane question, the same way you'd narrate it out loud to a coworker. This is just how you talk, there's no field, event, or signal attached to it, and nothing about the conversation resets when it happens.

FORMAT, follow exactly: every line of your response starts with one of "TICO:", "GUEST:", "ITEM:", "FACT_TYPE:", or "RESULT:" (all caps, immediately followed by a colon and a space), marking what that line is.
- GUEST: the customer's own question or line of dialogue.
- TICO: everything that's you: narrating the scene, evaluating the trainee's answer, or any other aside.
- ITEM: only right before you evaluate an answer, one line, the id of the specific dish (use the "id" field from SECTION DATA below, e.g. "baja-fish-tacos").
- FACT_TYPE: only right after an ITEM: line, one line, one word: ${pass === 'basics' ? '"ingredients" (the only valid value this pass)' : '"dietary" or "pricing"'}.
- RESULT: only right after a FACT_TYPE: line, one line, one word: "correct", "partial", or "incorrect".

ITEM:/FACT_TYPE:/RESULT: lines are never shown to the trainee, they're just for tracking. Always emit all three together, right before your TICO: evaluation (never on the very first question of the drill, there's nothing to evaluate yet). Never put content from two different markers on the same line, never skip a marker on a new line.

STOP after your GUEST: question, every turn. Never invent, assume, or simulate what the trainee would say, only evaluate an answer they actually gave earlier in this conversation.

HARD RULE, never break this: only state facts about items explicitly present in the SECTION DATA below, or facts listed in RESTAURANT NOTES or this section's additional notes. If something isn't in any of those, say so honestly ("worth checking with the kitchen") rather than inventing an answer.

SECTION DATA (${section.name} only, ${pass} pass, only the fields relevant to this pass are included):
${JSON.stringify(trimmedItems, null, 2)}
${sectionNotesBlock}
Follow the format exactly, on every line. No markdown formatting, no code fences, no em dashes. Start the drill now with your first line.`;
}

// Uncached, per-turn — live coverage state changes every turn, so it lives
// in its own small block rather than busting the cache on the (larger,
// pass-static) section block above. Filtered to the current pass's fact
// type(s) only — no point mentioning dietary/pricing gaps while the model
// is still restricted to ingredients.
function buildCoveragePrompt(section, factCoverage, pass) {
  const types = PASS_FACT_TYPES[pass];
  const remaining = [];
  const done = [];
  section.items.forEach((item) => {
    types.forEach((type) => {
      const label = `${item.id} (${type})`;
      if (factCoverage?.[item.id]?.[type]) done.push(label); else remaining.push(label);
    });
  });

  if (remaining.length === 0) {
    return `CURRENT COVERAGE: every ${pass}-pass fact for this section is already covered. Wrap up warmly, let the trainee know they've got this pass down, and don't manufacture new questions just to keep going.`;
  }

  return `CURRENT COVERAGE (${pass} pass): still need: ${remaining.join(', ')}.${done.length ? ` Already covered, don't re-drill unless genuinely useful: ${done.join(', ')}.` : ''} Prioritize what's not covered yet.`;
}

const tools = []; // coverage is fully client-computed from the stream, no tool calls

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { restaurantId, section: sectionName, factCoverage } = JSON.parse(event.body || '{}');
    if (!restaurantId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'restaurantId is required' }) };
    }
    if (!sectionName) {
      return { statusCode: 400, body: JSON.stringify({ error: 'section is required' }) };
    }

    const restaurant = await getRestaurant(restaurantId);
    const notes = await getRestaurantNotes(restaurantId);

    const section = findSection(restaurant, sectionName);
    if (!section) {
      return { statusCode: 400, body: JSON.stringify({ error: `Unknown section: ${sectionName}` }) };
    }

    const pass = derivePass(section, factCoverage);

    const systemMessages = [
      { type: 'text', text: buildSharedPrompt(restaurant, notes), cache_control: { type: 'ephemeral' } },
      { type: 'text', text: buildSectionPrompt(restaurant, section, notes, pass), cache_control: { type: 'ephemeral' } },
      { type: 'text', text: buildCoveragePrompt(section, factCoverage, pass) } // no cache_control
    ];

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemMessages, tools })
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Internal server error' }) };
  }
};
