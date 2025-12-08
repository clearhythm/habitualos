require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const {
  getAction,
  getChatMessages,
  insertArtifact
} = require('../../db/helpers');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * POST /api/action/:id/generate
 * Generate artifact content (e.g., markdown document, code file)
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
    // Extract action ID from path (last part of path)
    const pathParts = event.path.split('/').filter(p => p);
    const actionId = pathParts[pathParts.length - 1];

    if (!actionId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Action ID is required'
        })
      };
    }

    // Parse request body
    const { type, title } = JSON.parse(event.body);

    if (!type || !title) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Type and title are required'
        })
      };
    }

    // Get action details
    const action = getAction(actionId);

    if (!action) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: 'Action not found'
        })
      };
    }

    // Get chat history for context
    const chatHistory = getChatMessages(actionId);

    // Build artifact generation prompt
    const artifactPrompt = `You are an AI agent generating a work artifact.

Action: ${action.title}
Description: ${action.description}

Conversation history (for context):
${chatHistory.map(m => `${m.role}: ${m.content}`).join('\n')}

Generate a ${type} artifact titled "${title}".

Requirements:
- High quality, production-ready content
- Follow best practices for ${type}
- Be thorough but concise
- Return ONLY the artifact content, no preamble or explanation

${type === 'markdown' ? 'Use proper markdown formatting.' : ''}
${type === 'code' ? 'Include comments and follow conventions.' : ''}`;

    // Call Claude API
    const apiResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: artifactPrompt
      }]
    });

    // Extract generated content
    const content = apiResponse.content[0].text;

    // Insert artifact into database
    const artifact = insertArtifact({
      action_id: actionId,
      type: type,
      title: title,
      content: content,
      destination: null
    });

    // Return success response with full artifact
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        artifact: artifact
      })
    };

  } catch (error) {
    console.error('Error in action-generate:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
