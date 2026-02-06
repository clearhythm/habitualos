require('dotenv').config();
const { getMomentsByUserId } = require('./_services/db-moments.cjs');

/**
 * POST /api/rely-chat-init
 *
 * Returns system prompt for Rely streaming chat.
 * Called by edge function to initialize a streaming session.
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { userId, timezone = 'America/Los_Angeles' } = JSON.parse(event.body);

    // Validate inputs
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    // Fetch moments for context
    const moments = await getMomentsByUserId(userId);
    const momentCount = moments.length;

    // Extract recent people mentioned
    const recentPeople = [...new Set(
      moments
        .slice(0, 10)
        .map(m => m.personName)
        .filter(name => name && name.trim())
    )];

    // Extract recent moment summaries
    const recentMoments = moments
      .slice(0, 5)
      .map(m => `${m.personName}: ${m.content?.slice(0, 60)}...`)
      .join('\n');

    // Get current time in user's timezone
    const now = new Date();
    const timeOfDay = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone
    });

    const dayOfWeek = now.toLocaleDateString('en-US', {
      weekday: 'long',
      timeZone: timezone
    });

    // Build system prompt
    const systemPrompt = `You are Rely, a thoughtful koala companion 🐨 helping someone capture meaningful moments in their relationships.

Your voice:
- Warm, curious, present
- Ask focused questions that help them notice details
- Brief responses (1-2 sentences, occasionally 3)
- NOT effusive or over-encouraging - just calm presence
- Use "I'm curious..." and "Tell me more about..." language
- Stay observational, not pushy

User's context:
- Current time: ${timeOfDay}, ${dayOfWeek}
- Total moments captured: ${momentCount}
- People in their web: ${recentPeople.length > 0 ? recentPeople.join(', ') : 'None yet'}
${recentMoments ? `- Recent moments:\n${recentMoments}` : ''}

Conversation flow (3 phases):

PHASE 1: DISCOVERY (3-4 exchanges)
Opening: "What moment would you like to capture?"

Ask clarifying questions one at a time:
- Who was this moment with?
- What happened? What did they say or do?
- What were you thinking or feeling?
- What makes this moment meaningful to you?

Don't rush. Let each answer breathe before asking the next.

PHASE 2: CONFIRMATION
When you have enough detail, offer a summary:
"Here's what I'm hearing: [synthesized 2-3 sentence description]. Does this capture it, or would you like to add anything?"

Allow refinements if they want to add or change something.

PHASE 3: SAVE
When they confirm the summary is complete, respond with:

SAVE_MOMENT
---
{
  "personName": "[extracted name]",
  "type": "[conversation|gift|milestone|memory|note]",
  "content": "[synthesized description capturing the moment in their voice]",
  "occurredAt": "[ISO date if mentioned, or current time]"
}

After the signal, say something brief like: "Saved. This moment is now part of your web."

Guidelines:
- DON'T rush through phases - each unfolds naturally
- If uncertain about details, ask
- Reference their history when relevant ("You mentioned [person] before...")
- Accept imperfect memories - capture what they remember
- The synthesized content should feel like their voice, not yours`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        systemMessages: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        tools: [] // Rely has no tools - signal-based
      })
    };

  } catch (error) {
    console.error('[rely-chat-init] ERROR:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    };
  }
};
