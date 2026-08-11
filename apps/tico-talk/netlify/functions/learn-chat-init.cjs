const { getRestaurant } = require('./_services/db-restaurants.cjs');
const { getRestaurantNotes } = require('./_services/db-restaurant-notes.cjs');
const { findSection, derivePass, pickNextTarget } = require('./_services/learn-coverage-logic.cjs');

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
//
// What to ask/evaluate each specific turn is NOT in here — that's the app's
// job now (see buildTurnPrompt, the small uncached block below), computed
// deterministically from factCoverage rather than left to the model to
// figure out from a coverage list. That also means there's no "coverage
// awareness" for the model to accidentally leak into a guest's in-character
// question anymore — it's never shown one, it only ever gets a single
// target per turn.
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

Each round, the app (see THIS TURN below) tells you exactly which dish and which fact to focus on — you're never choosing what to ask about or deciding when the drill is done, just phrasing the question and judging the answer. On the drill's very first question, just ask about the given target, as if you were an ordinary seated customer looking at this section, nothing to evaluate yet. Every round after that: evaluate the trainee's last answer against the target you were already given, every time, not rarely — confirm if it's right, or gently correct if it's wrong, framed as "here's a good one to know," never as grading or saying "wrong." Then call record_fact_result with your judgment. The tool's result tells you what happens next: a "next" field means ask ONE natural customer question about that new target, nothing else (no eval text, you already gave that in your TICO: line); a "stop" field means don't write anything further at all, no GUEST line, no closing remarks, no mention of the pass or drill being done, that's not your line to deliver.

Every question needs a genuine, specific, in-character answer a server would actually give about the FOOD — phrase it the way an ordinary customer would ask about that dish, never a vague catch-all like "is there anything else I should know?" Never refer to the section by its internal name either ("the salad menu," "this section," "your soups") — a customer doesn't think in terms of your menu's category names, they just ask about a dish.

No scene-setting narration, ever — not a table sitting down, not a customer wrapping up ("thanks so much, we're all set for now") before the next question. This isn't a series of narrated vignettes with distinct customers arriving and leaving; it's a continuous stream of customer questions, one after another.

FORMAT, follow exactly: every line of your visible text starts with either "TICO:" or "GUEST:" (all caps, immediately followed by a colon and a space), marking what that line is. Always start a new line for it too, never run a marker straight onto the end of the previous sentence.
- GUEST: the customer's own question or line of dialogue.
- TICO: your evaluation of the trainee's last answer, nothing else — no scene-setting, no narration, no asides, and never a mention of tools, tracking, passes, or what happens next, that's not your line to deliver.

TRACKING: right after your TICO: line, call the record_fact_result tool with your judgment: correct, partial, or incorrect. That's the only field it takes, the app already knows which dish/fact this result is for. Never write this out as text, never skip it.

STOP after your GUEST: question, every turn. Never invent, assume, or simulate what the trainee would say, only evaluate an answer they actually gave earlier in this conversation.

HARD RULE, never break this: only state facts about items explicitly present in the SECTION DATA below, or facts listed in RESTAURANT NOTES or this section's additional notes. If something isn't in any of those, say so honestly ("worth checking with the kitchen") rather than inventing an answer.

SECTION DATA (${section.name} only, ${pass} pass, only the fields relevant to this pass are included):
${JSON.stringify(trimmedItems, null, 2)}
${sectionNotesBlock}
Follow the format exactly, on every line. No markdown formatting, no code fences, no em dashes.`;
}

// Uncached, per-turn — the one thing that genuinely changes every turn:
// which specific dish/fact this turn is about. Everything else about how
// to behave lives in the pass-static, cached section block above.
function buildTurnPrompt(section, evalTarget, isKickoff) {
  if (!evalTarget) {
    // Defensive only — shouldn't happen, the client stops sending turns
    // once a pass reports stop. If it ever does, don't ask/evaluate
    // anything, just acknowledge warmly.
    return `THIS TURN: every fact for this pass is already covered. Don't evaluate anything and don't ask a new question — just a brief, warm TICO: line acknowledging the trainee, nothing else.`;
  }

  const item = section.items.find((i) => i.id === evalTarget.itemId);
  const itemName = item ? item.name : evalTarget.itemId;

  if (isKickoff) {
    return `THIS TURN: ask your very first GUEST: question, testing "${itemName}" (${evalTarget.factType}). Nothing to evaluate yet — no TICO: line, no tool call, just the question.`;
  }

  return `THIS TURN: the trainee's message is their answer to a question testing "${itemName}" (${evalTarget.factType}). Evaluate it in a TICO: line, then call record_fact_result.`;
}

function buildTools() {
  return [
    {
      name: 'record_fact_result',
      description: "Report the trainee's result on the answer you just evaluated in your TICO: line. Call this once, immediately after that line. The app already knows which dish/fact this is for — just report the result.",
      input_schema: {
        type: 'object',
        properties: {
          result: { type: 'string', enum: ['correct', 'partial', 'incorrect'] }
        },
        required: ['result']
      }
    }
  ];
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { restaurantId, section: sectionName, factCoverage, isKickoff } = JSON.parse(event.body || '{}');
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
    const evalTarget = pickNextTarget(section, factCoverage, pass);

    const systemMessages = [
      { type: 'text', text: buildSharedPrompt(restaurant, notes), cache_control: { type: 'ephemeral' } },
      { type: 'text', text: buildSectionPrompt(restaurant, section, notes, pass), cache_control: { type: 'ephemeral' } },
      { type: 'text', text: buildTurnPrompt(section, evalTarget, isKickoff) } // no cache_control
    ];

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemMessages, tools: isKickoff ? [] : buildTools() })
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Internal server error' }) };
  }
};
