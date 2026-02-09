require('dotenv').config();
const { createMoment } = require('./_services/db-moments.cjs');

/**
 * POST /api/moment-capture
 *
 * Creates a moment directly from the Capture form.
 * Accepts { userId, personName, type, content } without signal wrapper.
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { userId, addedBy, type, content, chatId } = JSON.parse(event.body);

    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Content is required' })
      };
    }

    const result = await createMoment({
      userId,
      addedBy: addedBy || null,
      type: type || 'happy',
      content: content.trim(),
      occurredAt: new Date().toISOString(),
      chatId: chatId || null
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        momentId: result.id
      })
    };

  } catch (error) {
    console.error('[moment-capture] ERROR:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Failed to save moment' })
    };
  }
};
