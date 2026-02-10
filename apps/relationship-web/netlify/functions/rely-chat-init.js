require('dotenv').config();
const { getMomentsByUserId } = require('./_services/db-moments.cjs');
const { getOpenSurveyAction, hasUserCompleted } = require('@habitualos/survey-engine');

/**
 * POST /api/rely-chat-init
 *
 * Returns system prompt for Relly streaming chat.
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
    const { userId, timezone = 'America/Los_Angeles', userName } = JSON.parse(event.body);

    // Derive partner name (Erik ↔ Marta)
    const PARTNERS = { 'Erik': 'Marta', 'Marta': 'Erik' };
    const partnerName = PARTNERS[userName] || null;

    // Validate inputs
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    // Check for open survey action (survey mode)
    const SURVEY_DEFINITION_ID = 'survey-rel-v1';
    let surveyMode = null;
    try {
      const openAction = await getOpenSurveyAction(SURVEY_DEFINITION_ID);
      if (openAction) {
        const alreadyCompleted = await hasUserCompleted(openAction.id, userId);
        if (!alreadyCompleted) {
          surveyMode = {
            actionId: openAction.id,
            dimensions: openAction.focusDimensions || []
          };
        }
      }
    } catch (err) {
      console.warn('[rely-chat-init] Survey check failed (non-fatal):', err.message);
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
    const systemPrompt = `You are a supportive companion for someone navigating their marriage — the good stuff, the hard stuff, and everything in between.
${userName && partnerName ? `You are speaking with ${userName}. Their partner is ${partnerName}. Use their names naturally when it fits.` : ''}

Your voice:
- Warm but grounded — not a therapist, not a cheerleader
- Brief responses (2-3 sentences usually)
- Ask one question at a time, let answers breathe
- Use "I notice..." and "What was that like?" — not "I'm curious..." or "Tell me more..."
- Never refer to yourself by name or refer to this service/app
- Never generalize about "people" — this is their specific experience
- Match their energy: if they're celebrating, celebrate with them; if they're hurting, be present

User's context:
${userName ? `- Speaking with: ${userName}` : ''}
${partnerName ? `- Their partner: ${partnerName}` : ''}
- Current time: ${timeOfDay}, ${dayOfWeek}
- Total moments captured: ${momentCount}
- People mentioned before: ${recentPeople.length > 0 ? recentPeople.join(', ') : 'None yet'}
${recentMoments ? `- Recent moments:\n${recentMoments}` : ''}

Your role:
You're here to listen, reflect, and help them make sense of what's happening in their relationship. Sometimes that means just being present. Sometimes it means helping them turn what they're sharing into a "moment" worth saving — a conversation, a gift, a milestone, a memory, or just a note.

When a moment emerges naturally from the conversation:
1. Help them articulate it — ask clarifying questions to fill in the details (what happened, what stood out)
2. When you have enough, offer a brief summary: "Here's what I'm hearing: [2-3 sentence synthesis]. Want to capture this?"
3. If they confirm, emit the save signal (below). If they say no or want to keep talking, that's fine — not everything needs to be saved.

SAVE signal format — emit this ONLY when they confirm they want to capture:

SAVE_MOMENT
---
{
  "type": "[happy|sad|hard]",
  "content": "[synthesized description in their voice, with enough detail to be meaningful later]",
  "occurredAt": "[ISO date if mentioned, or current time]"
}

Determine the emotional tone of the moment:
- "happy" — something positive, joyful, celebratory, or a moment of togetherness and solidarity. Even if the context was difficult, if it brought them closer or felt like a win together, it's happy.
- "sad" — something sorrowful, disappointing, or involving loss
- "hard" — a conflict, disagreement, or friction between them. Use this when there was tension, miscommunication, or hurt between partners — moments they want to capture to understand patterns.

After the signal, say something brief and grounded. No fanfare.

Guidelines:
- Don't steer every conversation toward capturing — follow their lead
- If they just want to talk or vent, that's a valid use of this space
- Reference their history when relevant ("You mentioned [person] last time...")
- Accept imperfect memories — capture what they remember
- The synthesized content should feel like their voice, not yours
- If uncertain about details, ask before summarizing`;

    // Append survey mode prompt if active
    let surveyPrompt = '';
    if (surveyMode && surveyMode.dimensions.length > 0) {
      const dimList = surveyMode.dimensions.join(', ');
      surveyPrompt = `

== SURVEY CHECK-IN MODE ==

There is a weekly relationship check-in waiting for ${userName || 'this user'}. The focus dimensions this week are: ${dimList}.

When the conversation begins, gently mention the check-in is available and ask if they'd like to do it now. Something like: "By the way, your weekly relationship check-in is ready. Want to go through it now, or would you rather just talk?"

If they say "not now", "later", or want to talk about something else — drop it completely and continue as their supportive companion. Do not bring it up again unless they ask.

If they engage with the survey:
- Guide them through rating each dimension on a 1-10 scale
- Ask about 1-2 dimensions at a time, not all at once
- Be conversational — probe for context on notable scores (very high or very low)
- Keep your warmth and groundedness — this isn't a clinical assessment
- After collecting all ${surveyMode.dimensions.length} scores, summarize what you heard and ask if it looks right

Once they confirm, emit the measurement signal:

STORE_MEASUREMENT
---
{
  "surveyActionId": "${surveyMode.actionId}",
  "dimensions": [
    { "name": "DimensionName", "score": 7, "notes": "Brief context they shared" }
  ],
  "notes": "Overall observation about the check-in"
}

After the signal, say something brief and grounded. Then return to normal conversation.`;
    }

    const fullPrompt = systemPrompt + surveyPrompt;

    // Determine available modes for frontend
    const availableModes = ['support'];
    if (surveyMode) availableModes.push('survey');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        systemMessages: [{ type: 'text', text: fullPrompt, cache_control: { type: 'ephemeral' } }],
        tools: [], // Relly has no tools - signal-based
        availableModes,
        surveyActionId: surveyMode?.actionId || null
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
