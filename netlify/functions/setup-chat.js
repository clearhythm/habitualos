require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * POST /api/setup-chat
 * Conversational NorthStar creation - guides user through defining their goal
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
    const { message, chatHistory = [] } = JSON.parse(event.body);

    if (!message || !message.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Message is required'
        })
      };
    }

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

    // System prompt for NorthStar creation
    const systemPrompt = `You're helping someone define a goal they want to work toward.

Your voice:
- Brief responses (2-3 sentences, match their length)
- Ask focused questions, one at a time
- Observational, not pushy ("I notice..." not "you should...")
- NOT cheerleading - just clarity
- If they write a lot, that's fine - acknowledge and focus on what matters

What you're listening for:
- What they want to achieve (the goal)
- How they'll know it's done (success criteria)
- When they're aiming for (timeline)

Conversation flow:
- Start where they are - what do they want to accomplish?
- If vague, ask what that would look like
- If clear, ask how they'd know they're done
- If success is fuzzy, ask what "done" means to them
- Once you have goal + success markers, ask about timeline
- Don't rush - let each piece emerge naturally

When you have a clear goal, concrete success criteria (2-4 specific things), and timeline, respond with:
READY_TO_CREATE
---
TITLE: [Concise title, 2-5 words]
GOAL: [What they want to achieve]
SUCCESS_CRITERIA:
- [Concrete milestone 1]
- [Concrete milestone 2]
- [Concrete milestone 3]
TIMELINE: [When they're aiming for]

Example:
READY_TO_CREATE
---
TITLE: Launch HabitualOS MVP
GOAL: Build and deploy a minimal viable product of HabitualOS that allows users to create NorthStar goals, generate action cards via AI, and track progress through a web dashboard.
SUCCESS_CRITERIA:
- Working web UI deployed to production
- AI agent generates actionable tasks
- Users can chat with AI to refine actions
TIMELINE: End of January 2025`;

    // Call Claude API
    const apiResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: conversationHistory
    });

    // Extract assistant response
    const assistantResponse = apiResponse.content[0].text;

    // Check if response indicates readiness to create
    if (assistantResponse.startsWith('READY_TO_CREATE')) {
      // Parse the structured data
      const lines = assistantResponse.split('\n');
      let title = '';
      let goal = '';
      let successCriteria = [];
      let timeline = '';

      let currentSection = null;
      let criteriaLines = [];

      for (let i = 2; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith('TITLE:')) {
          currentSection = 'title';
          title = line.substring(6).trim();
        } else if (line.startsWith('GOAL:')) {
          currentSection = 'goal';
          goal = line.substring(5).trim();
        } else if (line.startsWith('SUCCESS_CRITERIA:')) {
          currentSection = 'criteria';
        } else if (line.startsWith('TIMELINE:')) {
          currentSection = 'timeline';
          timeline = line.substring(9).trim();
        } else if (currentSection === 'goal' && line.trim()) {
          goal += ' ' + line.trim();
        } else if (currentSection === 'criteria' && line.trim().startsWith('-')) {
          criteriaLines.push(line.trim().substring(1).trim());
        } else if (currentSection === 'timeline' && line.trim()) {
          timeline += ' ' + line.trim();
        }
      }

      successCriteria = criteriaLines;

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          ready: true,
          response: "Perfect! I have everything I need. Click 'Create My Agent' when you're ready, and I'll set up your agent with initial actions to get started.",
          agentData: {
            name: title.trim(),
            goal: goal.trim(),
            success_criteria: successCriteria,
            timeline: timeline.trim(),
            type: 'northstar'
          }
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
    console.error('Error in setup-chat:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
