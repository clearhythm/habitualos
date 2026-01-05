require('dotenv').config();
const { createPracticeChat } = require('./_services/db-practice-chats.cjs');
const { getPracticeByName, createPractice, updatePractice } = require('./_services/db-practices.cjs');

// Helper to generate practice chat ID (pc- prefix + timestamp-based unique ID)
function generatePracticeChatId() {
  const timestamp = Math.floor(Date.now() / 1000);
  const randomPart = Math.floor(Math.random() * 1000);
  return 'pc-' + (timestamp * 1000 + randomPart).toString(36).slice(-8);
}

/**
 * POST /api/practice-chat-save
 * Save a practice chat to Firestore
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
    const { userId, messages, suggestedPractice, fullSuggestion, completed } = JSON.parse(event.body);

    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'userId is required'
        })
      };
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'messages array is required'
        })
      };
    }

    // Generate practice chat ID
    const chatId = generatePracticeChatId();

    // Save to Firestore
    const chatData = {
      _userId: userId,
      messages: messages,
      suggestedPractice: suggestedPractice || null,
      fullSuggestion: fullSuggestion || null,
      completed: completed || false,
      savedAt: new Date().toISOString()
    };

    await createPracticeChat(chatId, chatData);

    // Create or update practice definition if we have a suggested practice
    if (suggestedPractice && fullSuggestion) {
      try {
        // Look up existing practice (case-insensitive)
        const existingPractice = await getPracticeByName(userId, suggestedPractice);

        if (existingPractice) {
          // Update instructions and _updatedAt
          await updatePractice(existingPractice.id, {
            instructions: fullSuggestion,
            _updatedAt: new Date().toISOString()
          });
        } else {
          // Create new practice with original casing
          const practiceId = 'practice-' + Math.random().toString(36).substring(2, 15);
          await createPractice(practiceId, {
            _userId: userId,
            name: suggestedPractice,  // Preserve original casing
            instructions: fullSuggestion,
            checkins: 0,
            _createdAt: new Date().toISOString()
          });
        }
      } catch (practiceError) {
        // Log but don't fail the chat save if practice creation fails
        console.error('Error creating/updating practice:', practiceError);
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        chatId: chatId
      })
    };

  } catch (error) {
    console.error('Error saving practice chat:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
