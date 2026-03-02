require('dotenv').config();
const { getPracticesByUserId } = require('./_services/db-practices.cjs');
const { getPracticeLogsByUserId } = require('./_services/db-practice-logs.cjs');
const {
  getSurveyDefinition,
  createSurveyDefinition,
  getResponsesByUser,
  getOpenSurveyAction,
  createSurveyAction
} = require('@habitualos/survey-engine');

const SURVEY_ID = 'survey-obi-v1';

function getTodayPacific() {
  const now = new Date();
  const parts = now.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' }).split('/');
  // M/D/YYYY → YYYY-MM-DD
  return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
}

function toDatePacific(isoString) {
  if (!isoString) return null;
  const parts = new Date(isoString).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' }).split('/');
  return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
}

async function ensureSurveyDefinition() {
  const def = await getSurveyDefinition(SURVEY_ID);
  if (!def) {
    await createSurveyDefinition(SURVEY_ID, {
      title: 'Daily Challenge Check-in',
      version: 1,
      dimensions: [
        { name: 'Resistance', questions: ['How much resistance did you feel getting started?'] },
        { name: 'Self-efficacy', questions: ['How confident do you feel about completing all 30 days?'] },
        { name: 'Inner access', questions: ['How available do you feel to yourself right now?'] }
      ]
    });
  }
}

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

    // Ensure survey definition exists (idempotent)
    await ensureSurveyDefinition();

    // Fetch practice data + check-in history in parallel
    const todayPT = getTodayPacific();
    const [practices, practiceLogs, allResponses] = await Promise.all([
      getPracticesByUserId(userId),
      getPracticeLogsByUserId(userId),
      getResponsesByUser(userId, SURVEY_ID).catch(() => [])
    ]);

    // Smart check-in trigger
    let checkInMode = null;
    try {
      const todayResponses = allResponses
        .filter(r => toDatePacific(r._createdAt) === todayPT)
        .sort((a, b) => new Date(b._createdAt) - new Date(a._createdAt));

      const todayLogs = practiceLogs.filter(l => l.timestamp && toDatePacific(l.timestamp) === todayPT);

      if (todayResponses.length === 0) {
        // No check-in today — auto-trigger
        let action = await getOpenSurveyAction(SURVEY_ID, userId);
        if (!action || action.date !== todayPT) {
          const { id } = await createSurveyAction({
            _userId: userId,
            surveyDefinitionId: SURVEY_ID,
            type: 'daily',
            focusDimensions: ['Resistance', 'Self-efficacy', 'Inner access'],
            date: todayPT
          });
          action = { id };
        }
        checkInMode = { actionId: action.id, context: 'first' };
      } else {
        // Check-in done today — trigger again only if practices logged since last check-in
        const lastCheckInTime = new Date(todayResponses[0]._createdAt);
        const newPracticesAfter = todayLogs.some(l => new Date(l.timestamp) > lastCheckInTime);
        if (newPracticesAfter) {
          const { id } = await createSurveyAction({
            _userId: userId,
            surveyDefinitionId: SURVEY_ID,
            type: 'daily',
            focusDimensions: ['Resistance', 'Self-efficacy', 'Inner access'],
            date: todayPT
          });
          checkInMode = { actionId: id, context: 'post-practice' };
        }
      }
    } catch (err) {
      console.warn('[obi-wai-chat-init] Check-in detection failed (non-fatal):', err.message);
    }

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

    const checkInPrompt = checkInMode ? `== DAILY CHECK-IN ==

${checkInMode.context === 'post-practice' ? 'You\'ve completed your practices today. Before coaching, offer a quick post-practice check-in: "You\'ve done your practices — want a quick post-practice check-in? (Say skip to go straight to coaching.)" If they skip, proceed to normal coaching immediately. Otherwise, do the three questions below.' : 'Before anything else, do today\'s brief check-in. Three questions, one at a time, in this order:'}
1. Resistance — how much did you resist getting started today?
2. Self-efficacy — how confident are you about completing all 30 days?
3. Inner access — how available do you feel to yourself right now?

Scale is 1–5 for each:
- Resistance: 1 = flowed right in, 5 = had to really push
- Self-efficacy: 1 = shaky, 5 = solid
- Inner access: 1 = closed/scattered, 5 = present/open

Rules:
- ONE question per message. Never combine.
- One brief sentence describing what the dimension means, then ask for 1–5.
- If they give a number with no context, ask one brief follow-up: what's behind that?
- If they give a number WITH context, reflect in one sentence (Obi-Wai voice), then move on.
- No cheerleading. Calm, observational.

After all 3: "That's all three. Want me to save this?" When they confirm, emit the signal below exactly, then offer to continue into coaching or close.
If they want to skip mid-way, emit the signal with whatever dimensions were scored.

STORE_MEASUREMENT
---
{
  "surveyActionId": "${checkInMode.actionId}",
  "dimensions": [
    { "name": "Resistance", "score": <1-5>, "notes": "<their words, first person>" },
    { "name": "Self-efficacy", "score": <1-5>, "notes": "<their words, first person>" },
    { "name": "Inner access", "score": <1-5>, "notes": "<their words, first person>" }
  ]
}

==

` : '';

    const systemPrompt = `${checkInPrompt}You are Obi-Wai, a wise companion helping someone discover what they need to practice today.

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
