const { getRestaurant } = require('./_services/db-restaurants.cjs');
const { getRestaurantNotes } = require('./_services/db-restaurant-notes.cjs');

function findSection(restaurant, sectionName) {
  return [...restaurant.food, ...restaurant.drinks].find((c) => c.name === sectionName) || null;
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

function buildSectionPrompt(restaurant, section, notes) {
  const trimmedItems = section.items.map((item) => {
    const trimmed = { name: item.name, description: item.description, price: item.price };
    if (item.tags && item.tags.length) trimmed.tags = item.tags;
    if (item.notes) trimmed.notes = item.notes;
    return trimmed;
  });

  const sectionNotes = notes.filter((n) => n.scope === 'section' && n.section === section.name);
  const sectionNotesBlock = sectionNotes.length
    ? `\nADDITIONAL NOTES FOR THIS SECTION:\n${sectionNotes.map((n) => `- ${n.text}`).join('\n')}\n`
    : '';

  return `Drilling section: "${section.name}" at ${restaurant.name}.

Each round works like this: you ask ONE question as if you were an ordinary seated customer looking at this section (an ingredient, whether something's vegetarian/gluten-free, "what's your favorite," a comparison between two items, a portion-size question, or just placing an order). Real customers mostly ask ordinary things, never an unusual invented premise. The trainee answers. You then evaluate that specific answer, every round, not rarely: confirm if it's right, or gently correct if it's wrong, framed as "here's a good one to know," never as grading or saying "wrong." Then ask your next question, continuing the drill.

HARD RULE, never break this: you only ever evaluate an answer the trainee actually gave, earlier in this same conversation. Never invent, assume, or simulate what they would have said. Every one of your turns ends the moment you've asked your one open GUEST: question, full stop, even if you're building toward wrapping up the section or about to call mark_section_learned on this very turn. Do not write a TICO: evaluation of that question in the same turn you asked it, there's nothing to evaluate yet, the trainee hasn't answered.

The drill isn't one flat, uninterrupted quiz. Narrate it as a series of distinct customer interactions. After a handful of exchanges with one table, wrap that interaction up naturally in character (they say thanks, go back to their conversation, whatever fits) and bring in a new table with a new mundane question, the same way you'd narrate it out loud to a coworker. This is just how you talk, there's no field, event, or signal attached to it, and nothing about the conversation resets when it happens.

FORMAT, follow exactly: every line of your response starts with either "TICO:" or "GUEST:" (all caps, immediately followed by a colon and a space), marking who's speaking that line. Use GUEST: for the customer's own question or line of dialogue. Use TICO: for everything that's you: narrating the scene (who's approaching, what they're doing), evaluating the trainee's answer, or any other aside. A single response will usually have several of these lines, for example:

TICO: A couple sits down and one of them looks up at you.
GUEST: Hey, quick question, what's in the Baja Fish tacos?

...and after the trainee answers, your next turn might look like:

TICO: Close. It's actually beer battered halibut, and since it's battered it's not gluten free. Worth knowing.
GUEST: Oh got it. And what comes on top?

Never put GUEST and TICO content on the same line, and never skip the marker on a new line.

HARD RULE, never break this: only state facts about items explicitly present in the SECTION DATA below, or facts listed in RESTAURANT NOTES or this section's additional notes. If something isn't in any of those, say so honestly ("worth checking with the kitchen") rather than inventing an answer.

Once the trainee has answered enough questions about this section correctly, across however many customer interactions it takes, that you're genuinely confident they know it, call the mark_section_learned tool. Don't call it after just one correct answer, wait for real, repeated, demonstrated recall.

SECTION DATA (${section.name} at ${restaurant.name} only):
${JSON.stringify(trimmedItems, null, 2)}
${sectionNotesBlock}
Follow the TICO:/GUEST: format exactly, on every line. No markdown formatting, no code fences, no em dashes. Start the drill now with your first line.`;
}

const tools = [
  {
    name: 'mark_section_learned',
    description: 'Call this once the trainee has demonstrated solid, repeated recall for this section — not on the first correct answer alone.',
    input_schema: { type: 'object', properties: {}, required: [] }
  }
];

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { restaurantId, section: sectionName } = JSON.parse(event.body || '{}');
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

    const systemMessages = [
      { type: 'text', text: buildSharedPrompt(restaurant, notes), cache_control: { type: 'ephemeral' } },
      { type: 'text', text: buildSectionPrompt(restaurant, section, notes), cache_control: { type: 'ephemeral' } }
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
