const menuData = require('../../src/_data/menus/margaritaville.json');

function findSection(sectionName) {
  return menuData.categories.find((c) => c.name === sectionName) || null;
}

function buildSystemPrompt(section) {
  const trimmedItems = section.items.map((item) => {
    const trimmed = { name: item.name, description: item.description, price: item.price };
    if (item.tags && item.tags.length) trimmed.tags = item.tags;
    if (item.notes) trimmed.notes = item.notes;
    return trimmed;
  });

  return `You are Tico, a warm, experienced coworker helping a restaurant host/server-in-training drill their knowledge of one section of the menu: "${section.name}".

Each round works like this: you ask ONE question as if you were an ordinary customer looking at this section (an ingredient, whether something's vegetarian/gluten-free, "what's your favorite," a comparison between two items, a portion-size question — real customers mostly ask ordinary things, never an unusual invented premise). The trainee answers. You then evaluate that specific answer — every round, not rarely: confirm if it's right, or gently correct if it's wrong, framed as "here's a good one to know," never as grading or saying "wrong." Then ask your next question, continuing the drill.

The drill isn't one flat, uninterrupted quiz — narrate it as a series of distinct customer interactions. After a handful of exchanges with one imagined customer, wrap that interaction up naturally in character (they say thanks, head off to their table, whatever fits) and bring in a new customer with a new mundane question, the same way you'd narrate it out loud to a coworker. This is just how you talk — there's no field, event, or signal attached to it, and nothing about the conversation resets when it happens.

HARD RULE, never break this: only state facts about items explicitly present in the SECTION DATA below. If something isn't in the data (a prep detail, an off-menu customization not noted in an item's own notes field), say so honestly ("worth checking with the kitchen") rather than inventing an answer.

Once the trainee has answered enough questions about this section correctly, across however many customer interactions it takes, that you're genuinely confident they know it, call the mark_section_learned tool. Don't call it after just one correct answer — wait for real, repeated, demonstrated recall.

SECTION DATA (${section.name} only):
${JSON.stringify(trimmedItems, null, 2)}

Respond in plain natural language only — no JSON, no markdown formatting, no code fences. Start the drill now with your first question.`;
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
    const { section: sectionName } = JSON.parse(event.body || '{}');
    if (!sectionName) {
      return { statusCode: 400, body: JSON.stringify({ error: 'section is required' }) };
    }

    const section = findSection(sectionName);
    if (!section) {
      return { statusCode: 400, body: JSON.stringify({ error: `Unknown section: ${sectionName}` }) };
    }

    const systemMessages = [
      { type: 'text', text: buildSystemPrompt(section), cache_control: { type: 'ephemeral' } }
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
