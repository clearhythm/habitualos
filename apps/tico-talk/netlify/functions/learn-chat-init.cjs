const { getRestaurant } = require('./_services/db-restaurants.cjs');
const { getRestaurantNotes } = require('./_services/db-restaurant-notes.cjs');
const { PASS_FACT_TYPES, findSection, derivePass, openTargets } = require('./_services/learn-coverage-logic.cjs');

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
// The app owns "ordering" — which pass, when it's complete, when the
// section is covered, when to even invoke you for a new turn — but not
// which specific open item you ask about. That's your call, every turn:
// you're handed the open-items list (see THIS TURN below) and you freely
// pick one, reporting your pick back through the tool so the app can
// track it. Vary your picks turn to turn rather than always reaching for
// the same one.
function buildSectionPrompt(restaurant, section, notes, pass) {
  const trimmedItems = section.items.map((item) => {
    const trimmed = { id: item.id, name: item.name };
    // Only expose the fields relevant to the CURRENT pass — not just an
    // instruction to ignore the rest, actually omit them, so there's no
    // ambiguity about what's in scope right now. review is ungated (any
    // fact is fair game), so it gets everything.
    if (pass === 'basics') {
      trimmed.description = item.description;
      // description is guest-facing menu copy, not the real recipe — a
      // drink's actual ingredient list (e.g. a syrup that's never
      // printed on the menu) can be more complete than its description.
      // Drilling ingredients against description alone meant the model
      // could "correctly" reject a trainee who knew the real recipe,
      // just because that detail wasn't in the abbreviated guest text.
      if (item.recipe?.ingredientNames?.length) trimmed.ingredients = item.recipe.ingredientNames;
    } else if (pass === 'complete') {
      trimmed.price = item.price;
      if (item.tags && item.tags.length) trimmed.tags = item.tags;
    } else {
      trimmed.description = item.description;
      if (item.recipe?.ingredientNames?.length) trimmed.ingredients = item.recipe.ingredientNames;
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
    : pass === 'complete'
    ? `You are drilling COMPLETE right now: dietary restrictions and pricing. Ingredients are already covered for this section, don't re-drill them. Every question must be about whether a dish is vegetarian/gluten-free/dairy-free/etc, or its price/add-on cost. Never ask a pure ingredients question in this pass.`
    : `This is a REVIEW right now, not a first pass — the trainee already covered this whole section once. Any fact is fair game and mixed together: ingredients, dietary, or pricing, in any order, for any dish. This isn't about introducing anything new, it's about keeping it sharp — treat it exactly like a normal customer question either way, nothing about your tone or phrasing should signal "this is a review."`;

  return `Drilling section: "${section.name}" at ${restaurant.name}, ${pass} pass.

${passScope}

Each round works like this: you ask ONE question, in scope for this pass, as if you were an ordinary seated customer looking at this section. Real customers mostly ask ordinary things, never an unusual invented premise. The trainee answers. You then evaluate that specific answer, every round, not rarely: confirm if it's right, or gently correct if it's wrong, framed as "here's a good one to know," never as grading or saying "wrong." Then freely pick your next question from the open items you're handed each turn (see THIS TURN below), and ask it.

Every question needs a genuine, specific, in-character answer a server would actually give about the FOOD — phrase it the way an ordinary customer would ask about that dish, never a vague catch-all like "is there anything else I should know?" Never refer to the section by its internal name either ("the salad menu," "this section," "your soups") — a customer doesn't think in terms of your menu's category names, they just ask about a dish.

No scene-setting narration, ever — not a table sitting down, not a customer wrapping up ("thanks so much, we're all set for now") before the next question. This isn't a series of narrated vignettes with distinct customers arriving and leaving; it's a continuous stream of customer questions, one after another.

FORMAT, follow exactly: every line of your visible text starts with either "TICO:" or "GUEST:" (all caps, immediately followed by a colon and a space), marking what that line is. Always start a new line for it too, never run a marker straight onto the end of the previous sentence. Never write anything before your first marker either — no working-through-it-out-loud, no scratch reasoning like "let me check that" or "let me evaluate and move on," your very first characters of output are always a marker.
- GUEST: the customer's own question or line of dialogue.
- TICO: your evaluation of the trainee's last answer, nothing else — no scene-setting, no narration, no asides, and never a mention of tools, tracking, passes, or what happens next, that's not your line to deliver.

Evaluate the trainee's message exactly as given, however short — "yes," "no," a single number, one word, whatever they actually typed is their complete answer. Never ask them to repeat themselves, clarify, or "share their full answer": that's not a real customer-facing interaction and it never happens in this drill. You already have everything you need in their message plus SECTION DATA above; judge it directly, first try.

TRACKING: call the record_fact_result tool exactly once every turn. On the drill's very first question, there's nothing to evaluate yet, so call it right away (before any GUEST: text) with just your freely-chosen nextItemId/nextFactType. Every turn after that: write your TICO: line first, then call the tool with your judgment (result) AND your freely-chosen next pick (nextItemId/nextFactType) together — always include a next pick, even if this might be the last open item, the app will tell you if there's nothing left to ask. Never write any of this out as text, never skip it.

STOP after your GUEST: question, every turn. Never invent, assume, or simulate what the trainee would say, only evaluate an answer they actually gave earlier in this conversation.

HARD RULE, never break this: only state facts about items explicitly present in the SECTION DATA below, or facts listed in RESTAURANT NOTES or this section's additional notes. If something isn't in any of those, say so honestly ("worth checking with the kitchen") rather than inventing an answer.

That same rule applies to how you EVALUATE, not just to your own answers. The "name" field in SECTION DATA is real content too, not just a label — dish names often directly name a key ingredient or component ("Spring Vegetable Salad with Tuna Tonnato" names tuna tonnato as an actual ingredient, not decoration; "Castelvetrano Olives" names the entire dish, nothing more to it). Always weigh the full name alongside the description when judging an answer, never the description alone. Some dishes genuinely have little to them — don't make the trainee hedge if they've already got it right: a confident, accurate answer that simply restates what the name and/or description actually say (even if that's short, like "it's just the olives, nothing else") is fully correct on its own, no need to also offer to check with the kitchen. Only when NEITHER the name NOR the description reveals anything real for this dish's fact this turn is there truly nothing to test — mark it correct if they recognize that and say they'd check with the kitchen or similar, rather than guessing. Either way, only mark it incorrect if they invent specific details that aren't backed by anything in SECTION DATA/RESTAURANT NOTES/the section's additional notes.

SECTION DATA (${section.name} only, ${pass} pass, only the fields relevant to this pass are included):
${JSON.stringify(trimmedItems, null, 2)}
${sectionNotesBlock}
Follow the format exactly, on every line. No markdown formatting, no code fences, no em dashes.`;
}

// Uncached, per-turn — the two things that genuinely change every turn:
// what's being evaluated (if anything) and what's still open to ask
// about. Everything about HOW to behave lives in the pass-static, cached
// section block above.
function buildTurnPrompt(section, target, openList, isKickoff) {
  const listBlock = openList.length
    ? openList.map((t) => {
        const item = section.items.find((i) => i.id === t.itemId);
        return `- ${item ? item.name : t.itemId} (${t.factType}), id: "${t.itemId}"`;
      }).join('\n')
    : '(nothing else open — this would only happen if the app already meant to stop; don\'t call the tool with a next pick if you land here)';

  if (isKickoff) {
    return `THIS TURN: this is the drill's very first question, nothing to evaluate yet. Call record_fact_result now, before any text, with just nextItemId/nextFactType for whichever of these you pick — then ask that one GUEST: question.

OPEN ITEMS this pass:
${listBlock}`;
  }

  const item = target && section.items.find((i) => i.id === target.itemId);
  const targetLine = target
    ? `THIS TURN: the trainee's message is their answer to a question testing "${item ? item.name : target.itemId}" (${target.factType}). Evaluate it in a TICO: line, then call record_fact_result with your judgment and your next pick.`
    : `THIS TURN: evaluate the trainee's last answer as usual, then call record_fact_result with your judgment and your next pick.`;

  return `${targetLine}

OPEN ITEMS this pass (pick your next question from here — vary your picks, don't default to the same one repeatedly unless it's the only one left). This list is from just before your evaluation above, so it may still include the exact item you just judged — if you marked it correct, prefer a different one instead:
${listBlock}`;
}

// nextItemId is a real enum, not free text — SECTION DATA (cached, shown
// for the whole pass) lists every item regardless of coverage, while
// OPEN ITEMS (uncached, per-turn) is the actual valid set; without a hard
// constraint here the model can blur the two and confidently propose an
// item that's already covered or otherwise not currently open. Better
// prompting alone couldn't guarantee this — the model would occasionally
// drift back to an item from SECTION DATA regardless — so this makes it
// structurally impossible rather than just discouraged. Empty openList
// never reaches here in practice: that's a 'covered' stop, handled by
// learn-tool-execute.cjs ending the session before another init call.
function buildTools(pass, openList) {
  return [
    {
      name: 'record_fact_result',
      description: "Report your judgment on the trainee's last answer (omit on the drill's very first question, nothing to evaluate yet) and freely pick which open item you're about to ask about next.",
      input_schema: {
        type: 'object',
        properties: {
          result: { type: 'string', enum: ['correct', 'partial', 'incorrect'], description: "Omit only on the drill's very first question." },
          nextItemId: { type: 'string', enum: [...new Set(openList.map((t) => t.itemId))], description: 'The "id" of the dish you\'re about to ask about, from the OPEN ITEMS list.' },
          nextFactType: { type: 'string', enum: PASS_FACT_TYPES[pass] }
        },
        required: ['nextItemId', 'nextFactType']
      }
    }
  ];
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { restaurantId, section: sectionName, factCoverage, isKickoff, target, reviewMode } = JSON.parse(event.body || '{}');
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

    // reviewMode forces 'review' rather than deriving from factCoverage —
    // a review session's factCoverage is the client's own ephemeral,
    // session-only tracker (see learn-practice.js), which starts empty
    // every time, so deriving from it would just say "basics."
    const pass = reviewMode ? 'review' : derivePass(section, factCoverage);
    // Includes target itself — factCoverage here is from before this
    // turn's evaluation happens, so whether target is actually still open
    // is genuinely unresolved yet at prompt-build time. If the model picks
    // it again and it turns out to have just been covered,
    // learn-tool-execute.cjs's validation against the POST-evaluation
    // coverage naturally rejects it and falls back to a real open item —
    // excluding it here would instead risk handing the model an empty
    // list on the last open item of a pass, when the tool schema still
    // requires a next pick.
    const openList = openTargets(section, factCoverage, pass);

    const systemMessages = [
      { type: 'text', text: buildSharedPrompt(restaurant, notes), cache_control: { type: 'ephemeral' } },
      { type: 'text', text: buildSectionPrompt(restaurant, section, notes, pass), cache_control: { type: 'ephemeral' } },
      { type: 'text', text: buildTurnPrompt(section, target, openList, isKickoff) } // no cache_control
    ];

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemMessages, tools: buildTools(pass, openList) })
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Internal server error' }) };
  }
};
