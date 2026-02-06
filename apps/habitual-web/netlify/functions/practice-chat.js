require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { getPracticesByUserId } = require('./_services/db-practices.cjs');
const { getPracticeLogsByUserId } = require('./_services/db-practice-logs.cjs');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * POST /api/practice-chat
 * Conversational coaching to help user discover what practice they need
 */
exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    // Parse request body
    const { userId, message, chatHistory = [], timezone = 'America/Los_Angeles' } = JSON.parse(event.body);

    // Validate inputs
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Valid userId is required'
        })
      };
    }

    if (!message || !message.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Message is required'
        })
      };
    }

    // Fetch practice history for context
    const practices = await getPracticesByUserId(userId); // Practice library (unique practices)
    const practiceLogs = await getPracticeLogsByUserId(userId); // Practice logs (timeline)

    const practiceCount = practices.length; // Number of unique practices

    // Extract recent practice names from logs (what they've been doing lately)
    const practiceNames = practiceLogs
      .slice(0, 10) // Last 10 logs
      .map(p => p.practice_name)
      .filter(name => name && name.trim());

    // Extract recent reflections from logs (last 3)
    const recentReflections = practiceLogs
      .slice(0, 3)
      .map(p => p.reflection)
      .filter(r => r && r.trim())
      .join('; ');

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
    const systemPrompt = `You are Obi-Wai, a wise companion helping someone discover what they need to practice today.

Your voice:
- Calm, observant, present-tense
- Ask focused questions that help them notice what's already there
- Brief responses (2-3 sentences usually)
- NOT cheerleading or pressuring - just quiet clarity
- Stay observational, not pushy
- Use "I see..." and "I notice..." language, not "you should..."

User's context:
- Current time: ${timeOfDay}, ${dayOfWeek}
- Total practices: ${practiceCount}
- Recent practices: ${practiceNames.length > 0 ? practiceNames.slice(0, 5).join(', ') : 'None yet'}
${recentReflections ? `- Recent reflections: ${recentReflections}` : ''}

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

    // Build conversation history for Claude
    const conversationHistory = chatHistory.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));

    // Add current user message
    conversationHistory.push({
      role: 'user',
      content: message
    });

    // Call Claude API
    const apiResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1000,
      system: systemPrompt,
      messages: conversationHistory
    });

    // Extract assistant response
    const assistantResponse = apiResponse.content[0].text;

    // Check if response indicates readiness to practice
    if (assistantResponse.startsWith('READY_TO_PRACTICE')) {
      // Parse the structured data
      const lines = assistantResponse.split('\n');
      let practiceName = '';
      let message = '';
      let inMessage = false;

      for (let i = 2; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith('PRACTICE_NAME:')) {
          practiceName = line.substring(14).trim();
        } else if (line.startsWith('MESSAGE:')) {
          message = line.substring(8).trim();
          inMessage = true;
        } else if (inMessage && line.trim() && !line.startsWith('READY_TO_PRACTICE') && !line.startsWith('---')) {
          // Continue multi-line message only if we're actively building the message
          message += ' ' + line.trim();
        }
      }

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          ready: true,
          response: message.trim(),
          practiceName: practiceName.trim()
        })
      };
    }

    // Regular conversational response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        ready: false,
        response: assistantResponse
      })
    };

  } catch (error) {
    console.error('Error in practice-chat:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
