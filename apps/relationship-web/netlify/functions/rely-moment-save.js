require('dotenv').config();
const { createMoment } = require('./_services/db-moments.cjs');

/**
 * POST /api/rely-moment-save
 *
 * Creates a moment from a SAVE_MOMENT signal.
 * Called by the frontend when a signal is detected in chat.
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { userId, signal, chatId } = JSON.parse(event.body);

    // Validate inputs
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    if (!signal || !signal.data) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Signal data is required' })
      };
    }

    const { personName, type, content, occurredAt } = signal.data;

    if (!content) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Moment content is required' })
      };
    }

    // Create the moment
    const result = await createMoment({
      userId,
      personName: personName || 'Someone',
      type: type || 'note',
      content,
      occurredAt: occurredAt || new Date().toISOString(),
      chatId: chatId || null // Link back to source chat if provided
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        momentId: result.id,
        message: 'Moment saved successfully'
      })
    };

  } catch (error) {
    console.error('[rely-moment-save] ERROR:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Failed to save moment' })
    };
  }
};
