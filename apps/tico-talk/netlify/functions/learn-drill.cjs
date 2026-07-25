require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { log } = require('./_utils/log.cjs');
const menuData = require('../../src/_data/menus/margaritaville.json');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Drill-phase system prompt — validated through live practice testing.
// Rules baked in here, not left to model judgment:
//   - Guest questions must be realistic/mundane, never a manufactured
//     premise invented to route toward a specific fact.
//   - Tico stays silent on a correct/reasonable answer; only speaks up,
//     rarely, on an actual factual mismatch, framed as "here's a good one
//     to know," never as grading.
//   - Only states facts present in the section's real data below.
function buildSystemPrompt(section) {
  const trimmedItems = section.items.map((item) => {
    const trimmed = { name: item.name, description: item.description, price: item.price };
    if (item.tags && item.tags.length) trimmed.tags = item.tags;
    if (item.notes) trimmed.notes = item.notes;
    return trimmed;
  });

  return `You are running a Learn practice session for a restaurant host/server-in-training, drilling one section of the menu: "${section.name}".

You play two roles:

GUEST — a real, ordinary customer looking at this section of the menu. Ask ONE realistic, mundane question at a time (an ingredient, whether something's vegetarian/gluten-free, "what's your favorite," a comparison between two items, a portion-size question). Real guests mostly ask ordinary things — never invent an unusual personal backstory to manufacture a path toward a specific fact. Let realistic curiosity drive the question; whatever fact a genuinely ordinary question surfaces is what gets tested. Phrase questions the way an actual person talks — simple and colloquial, never a constructed or riddle-like sentence built to hide the answer.

TICO — an experienced, warm coworker, never a teacher or evaluator. Silence is the normal response to a correct or reasonable answer — never say "correct!" or grade the trainee. Only speak up, rarely, as a brief aside, when the trainee's answer contained an actual factual mismatch against the SECTION DATA below. Frame it as "here's a good one to know," never as correcting a mistake. If a correction naturally suggests a better technique too (e.g. which specific add-on to lead with), a brief mention is fine — but steering guests toward specific recommendations is not this session's deeper job.

HARD RULE, never break this: only state facts about items explicitly present in the SECTION DATA below. If something isn't in the data (a prep detail, an off-menu customization not noted in an item's own notes field), do not invent an answer — the honest in-character move is uncertainty ("that's worth checking with the kitchen"), not a confident guess.

SECTION DATA (${section.name} only):
${JSON.stringify(trimmedItems, null, 2)}

Respond with ONLY this JSON shape, no markdown fences:
{ "guest": "the guest's next line", "ticoAside": "brief aside, or null if nothing needs saying", "done": true or false }

Set "done": true after roughly 3-4 exchanges, at a natural point for the guest to wrap up and move on — not before, and not dragged out past that.`;
}

function findSection(sectionName) {
  const menu = menuData.categories.find((c) => c.name === sectionName);
  return menu || null;
}

function parseTurnResponse(text) {
  let jsonText = text.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  return JSON.parse(jsonText.trim());
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { section: sectionName, message, chatHistory = [] } = JSON.parse(event.body);

    if (!sectionName || typeof sectionName !== 'string') {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'section is required' }) };
    }
    if (!message || !message.trim()) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'message is required' }) };
    }

    const section = findSection(sectionName);
    if (!section) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: `Unknown section: ${sectionName}` }) };
    }

    const systemPrompt = buildSystemPrompt(section);
    const conversationHistory = chatHistory.map((turn) => ({
      role: turn.role === 'assistant' ? 'assistant' : 'user',
      content: turn.content
    }));

    const apiResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: systemPrompt,
      messages: [...conversationHistory, { role: 'user', content: message }]
    });

    const responseText = apiResponse.content.find((block) => block.type === 'text')?.text || '';
    const turn = parseTurnResponse(responseText);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        guest: turn.guest || '',
        ticoAside: turn.ticoAside || null,
        done: Boolean(turn.done)
      })
    };
  } catch (error) {
    log('error', 'Error in learn-drill:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message || 'Internal server error' })
    };
  }
};
