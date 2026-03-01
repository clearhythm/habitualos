require('dotenv').config();
const { getPracticesByUserId } = require('./_services/db-practices.cjs');
const { getPracticeLogsByUserId } = require('./_services/db-practice-logs.cjs');

const tools = [
  {
    name: 'get_practice_history',
    description: "Fetch the user's practice log entries including their written reflections. Use this when the user asks about their history, patterns, or what they've noticed across practices.",
    input_schema: {
      type: 'object',
      properties: {
        practice_name: {
          type: 'string',
          description: "Optional: filter to logs for a specific practice (e.g. 'LASSO', 'jogging'). Case-insensitive."
        },
        limit: {
          type: 'number',
          description: 'Max number of logs to return (default 15, max 50)'
        }
      },
      required: []
    }
  },
  {
    name: 'get_practice_detail',
    description: 'Fetch the full definition and all logged sessions for one specific practice by name. Use this when the user asks about a particular practice in depth.',
    input_schema: {
      type: 'object',
      properties: {
        practice_name: {
          type: 'string',
          description: "The name of the practice to look up (e.g. 'LASSO', 'jogging', 'journaling')"
        }
      },
      required: ['practice_name']
    }
  }
];

/**
 * POST /api/obi-wai-chat-init
 *
 * Returns system prompt and tools for Obi-Wai streaming chat.
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

    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    // Fetch practice history for context
    const practices = await getPracticesByUserId(userId);
    const practiceLogs = await getPracticeLogsByUserId(userId);

    const practiceCount = practices.length;

    const practiceNames = practiceLogs
      .slice(0, 10)
      .map(p => p.practice_name)
      .filter(name => name && name.trim());

    const recentReflections = practiceLogs
      .slice(0, 3)
      .map(p => p.reflection)
      .filter(r => r && r.trim())
      .join('; ');

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

    const systemPrompt = `You are Obi-Wai, a wise companion helping someone discover what they need to practice today.

Your voice:
- Calm, observant, present-tense
- Ask focused questions that help them notice what's already there
- Brief responses (2-3 sentences usually)
- NOT cheerleading or pressuring - just quiet clarity
- Stay observational, not pushy
- Use "I see..." and "I notice..." language, not "you should..."

Quick summary (minimal — use tools for specifics):
- Current time: ${timeOfDay}, ${dayOfWeek}
- Unique practices in library: ${practiceCount}
- Recent practice names (last 10 logs): ${practiceNames.length > 0 ? practiceNames.join(', ') : 'None yet'}
${recentReflections ? `- Last 3 reflections (preview only): ${recentReflections}` : ''}

Available tools:
- get_practice_history: fetch logged sessions with reflections, optionally filtered by practice name
- get_practice_detail: fetch full history + definition for one specific practice

Use these tools whenever the user asks anything specific about:
- How many times they've done a practice
- What they wrote in their reflections
- How a particular practice has gone
- Patterns or trends across their history
- Anything about a specific practice by name

The quick summary above is intentionally minimal — do not use it alone to answer history questions. Call the appropriate tool first.

Conversation flow (3 phases):

PHASE 1: DISCOVERY (4-6 exchanges)
- Help them discover WHAT practice they need
- Explore WHY if relevant (what's present, what's calling them)
- Work through any misgivings or questions they have
- Help them understand HOW to do the practice
- DON'T move to Phase 2 until they seem clear on what and how

PHASE 2: TIMING
- Once discovery is complete, ask: "Would you like to do this now, or are you planning it for later?"
- Listen to their response about timing
- If they say "later" or "not now", acknowledge supportively and end conversation (no READY_TO_PRACTICE)
- If they say "now" or "yes" or "ready", move to Phase 3

PHASE 3: READY CONFIRMATION
- ONLY when they confirm they want to practice NOW, respond with READY_TO_PRACTICE signal
- This triggers the "I'm Ready" button in the UI

Guidelines:
- DON'T rush through phases - each unfolds naturally
- Avoid pressure - if response feels "slightly too pressured," back off
- They might give long context - that's okay, acknowledge it
- If uncertain about anything, help them notice what's present ("What does that scattering feel like?")
- Reference their history when relevant ("You've come back to meditation seven times...")
- Accept "ready enough" as readiness, but only if they mean NOW

When user confirms they want to practice NOW (after identifying what and when), respond with:
READY_TO_PRACTICE
---
PRACTICE_NAME: [1-3 words from their own language]
MESSAGE: [Brief affirmation, 1-2 sentences, Obi-Wai voice]

Example:
READY_TO_PRACTICE
---
PRACTICE_NAME: LASSO
MESSAGE: I see you. Ready enough. Two or three minutes. Your body knows.`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        systemMessages: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        tools
      })
    };

  } catch (error) {
    console.error('[obi-wai-chat-init] ERROR:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    };
  }
};
