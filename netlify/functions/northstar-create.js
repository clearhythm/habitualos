require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const {
  insertNorthStar,
  insertActionCard
} = require('../../db/helpers');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * POST /api/northstar/create
 * Create NorthStar and generate initial ActionCards via Claude API
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
    const { title, goal, success_criteria, timeline } = JSON.parse(event.body);

    // Validate required fields
    if (!title || !goal) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields: title and goal are required'
        })
      };
    }

    // Insert NorthStar into database
    const northStar = insertNorthStar({
      title,
      goal,
      success_criteria: success_criteria || [],
      timeline: timeline || ''
    });

    // Generate actions via Claude API
    const generateActionsPrompt = `You are an AI agent helping a user achieve their goal.

NorthStar Goal: ${northStar.goal}
Success Criteria: ${JSON.stringify(northStar.success_criteria)}
Timeline: ${northStar.timeline}

Generate 3-5 high-priority, immediately actionable steps to move toward this goal.

Requirements for each action:
- Completable in 1-4 hours
- Has a clear deliverable/outcome
- Does not depend on other actions being completed first
- Specific and concrete (not vague)
- Focuses on tangible work product

Return ONLY a JSON array with this exact structure:
[
  {
    "title": "Short, clear action title",
    "description": "Detailed description of what needs to be done and why",
    "priority": "high|medium|low"
  }
]

No preamble, no explanation, just the JSON array.`;

    // Call Claude API
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: generateActionsPrompt
      }]
    });

    // Parse Claude's response
    let generatedActions = [];
    try {
      const responseText = message.content[0].text;
      generatedActions = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse Claude response:', parseError);
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: 'Failed to parse AI response'
        })
      };
    }

    // Insert generated actions into database
    const actions = generatedActions.map(action => {
      return insertActionCard({
        north_star_id: northStar.id,
        title: action.title,
        description: action.description,
        priority: action.priority || 'medium'
      });
    });

    // Return success response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        northstar: northStar,
        actions: actions
      })
    };

  } catch (error) {
    console.error('Error in northstar-create:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
