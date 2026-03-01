require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { getPracticesByUserId } = require('./_services/db-practices.cjs');
const { getPracticeLogsByUserId } = require('./_services/db-practice-logs.cjs');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

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

function handleTool(name, input, allLogs, allPractices) {
  if (name === 'get_practice_history') {
    let logs = allLogs;
    if (input.practice_name) {
      const pattern = new RegExp(input.practice_name, 'i');
      logs = logs.filter(l => pattern.test(l.practice_name));
    }
    const limit = Math.min(input.limit || 15, 50);
    return logs.slice(0, limit).map(l => ({
      date: l.timestamp,
      practice: l.practice_name,
      duration: l.duration,
      reflection: l.reflection || null,
      wisdom: l.obi_wan_message || null
    }));
  }

  if (name === 'get_practice_detail') {
    const pattern = new RegExp(input.practice_name, 'i');
    const definition = allPractices.find(p => pattern.test(p.name || p.practice_name));
    const logs = allLogs.filter(l => pattern.test(l.practice_name));
    return {
      definition: definition || null,
      log_count: logs.length,
      logs: logs.slice(0, 20).map(l => ({
        date: l.timestamp,
        duration: l.duration,
        reflection: l.reflection || null,
        wisdom: l.obi_wan_message || null
      }))
    };
  }

  return { error: `Unknown tool: ${name}` };
}

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
    const practices = await getPracticesByUserId(userId);
    const practiceLogs = await getPracticeLogsByUserId(userId);

    const practiceCount = practices.length;

    // Extract recent practice names from logs (what they've been doing lately)
    const practiceNames = practiceLogs
      .slice(0, 10)
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

    // Build conversation history for Claude
    const conversationHistory = chatHistory.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));

    let messages = [...conversationHistory, { role: 'user', content: message }];
    const toolsUsed = [];

    // Call Claude API with tool use loop
    let apiResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: systemPrompt,
      tools,
      messages
    });

    while (apiResponse.stop_reason === 'tool_use') {
      const toolUseBlocks = apiResponse.content.filter(b => b.type === 'tool_use');

      messages.push({ role: 'assistant', content: apiResponse.content });

      const toolResults = toolUseBlocks.map(toolUse => {
        toolsUsed.push(toolUse.name);
        const result = handleTool(toolUse.name, toolUse.input, practiceLogs, practices);
        return {
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result)
        };
      });

      messages.push({ role: 'user', content: toolResults });

      apiResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: systemPrompt,
        tools,
        messages
      });
    }

    // Extract text from final response
    const assistantResponse = apiResponse.content.find(b => b.type === 'text')?.text || '';

    // Check if response indicates readiness to practice
    if (assistantResponse.startsWith('READY_TO_PRACTICE')) {
      const lines = assistantResponse.split('\n');
      let practiceName = '';
      let readyMessage = '';
      let inMessage = false;

      for (let i = 2; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith('PRACTICE_NAME:')) {
          practiceName = line.substring(14).trim();
        } else if (line.startsWith('MESSAGE:')) {
          readyMessage = line.substring(8).trim();
          inMessage = true;
        } else if (inMessage && line.trim() && !line.startsWith('READY_TO_PRACTICE') && !line.startsWith('---')) {
          readyMessage += ' ' + line.trim();
        }
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          ready: true,
          response: readyMessage.trim(),
          practiceName: practiceName.trim(),
          toolsUsed
        })
      };
    }

    // Regular conversational response
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        ready: false,
        response: assistantResponse,
        toolsUsed
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
