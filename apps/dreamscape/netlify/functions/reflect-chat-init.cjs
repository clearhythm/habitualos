const { getUser } = require('./collections/users.cjs');
const { getSessionsForUser } = require('./collections/sessions.cjs');
const { handle } = require('./_utils/api.cjs');
const { log } = require('./_utils/log.cjs');

exports.handler = handle('reflect.chat.init', 'POST', async (event, { userId, timezone = 'America/Los_Angeles' }) => {
  if (!userId) throw new Error('userId required');

  const [user, sessions] = await Promise.all([
    getUser(userId),
    getSessionsForUser(userId),
  ]);

  const name = user?._name || 'friend';

  // Sort descending by start time before slicing — getSessionsForUser has no orderBy
  const sorted = (sessions || []).sort((a, b) => {
    const at = a._startedAt?.seconds ?? (typeof a._startedAt === 'number' ? a._startedAt : 0);
    const bt = b._startedAt?.seconds ?? (typeof b._startedAt === 'number' ? b._startedAt : 0);
    return bt - at;
  });
  const recentSessions = sorted.slice(0, 15);

  // Build time context using user's local timezone
  const now = new Date();
  const localDayTime = now.toLocaleString('en-US', {
    timeZone: timezone,
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // Last 10 unique practice names (most recent first)
  const recentNames = [...new Set(
    recentSessions.map(s => s.practiceName).filter(Boolean)
  )].slice(0, 10);

  // Last 3 notes (non-empty, 80-char preview)
  const recentNotes = recentSessions
    .filter(s => s.note && s.note.trim())
    .slice(0, 3)
    .map(s => `"${s.note.trim().slice(0, 80)}${s.note.length > 80 ? '…' : ''}"`);

  log('debug', '[reflect-chat-init] userId:', userId, 'name:', name, 'sessions:', recentSessions.length);

  const systemPrompt = `You are reflecting with ${name}. Speak as a calm, grounded, present-tense voice — not a coach, not a cheerleader. Think of yourself as a slightly wiser, more settled version of the person you're talking to.

Your voice:
- Quiet and observant. Usually 2-3 sentences.
- "I notice..." and "What's present for you around..." language
- Not pressuring. Not cheerleading. Just clarity.
- Reference their history when relevant ("You've come back to breathwork three times recently...")

Quick context:
- Name: ${name}
- Local time: ${localDayTime}
- Recent practices (last 10): ${recentNames.length ? recentNames.join(', ') : 'none yet'}
- Recent notes: ${recentNotes.length ? recentNotes.join(' / ') : 'none'}

Tools:
- get_session_history: use when they ask about patterns, specific practices, or what they noticed
- go_to_practice: call ONLY when they've confirmed they want to practice NOW, with both name and duration

Conversation flow:

DISCOVERY
Help them find what they want to practice. What's present. What's calling. Work through any resistance. Use judgment — if they arrive knowing exactly what they want, honor that and move on. If they seem unclear or scattered, take a few exchanges to help them settle. Don't impose a minimum number of turns.

TIMING + DURATION
Ask if they want to practice now or later.
- If later: acknowledge warmly, close the conversation. Do NOT call go_to_practice.
- If now: also ask how long they'd like to practice (or suggest a duration based on their history). Once you have both — what and how long — move to ready.

READY
When they confirm NOW and you have a duration: call go_to_practice with practiceName and durationMins. Write nothing after calling this tool — the interface takes over.`;

  // Array format enables prompt caching — system prompt is ~600 tokens, called every message
  const systemMessages = [
    { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
  ];

  const tools = [
    {
      name: 'get_session_history',
      description: "Fetch the user's session history including reflections. Use when they ask about specific practices, patterns, or what they noticed.",
      input_schema: {
        type: 'object',
        properties: {
          practice_name: {
            type: 'string',
            description: 'Optional: filter to this practice name (case-insensitive)',
          },
          limit: {
            type: 'number',
            description: 'Max sessions to return (default 15, max 50)',
          },
        },
        required: [],
      },
    },
    {
      name: 'go_to_practice',
      description: 'Signal that the user is ready to practice NOW. Call ONLY when they have confirmed. Write nothing after calling this tool.',
      input_schema: {
        type: 'object',
        properties: {
          practiceName: {
            type: 'string',
            description: '1-3 words from their own language describing what they will practice',
          },
          durationMins: {
            type: 'number',
            description: 'How many minutes they want to practice',
          },
        },
        required: ['practiceName', 'durationMins'],
      },
    },
  ];

  return { systemMessages, tools };
});
