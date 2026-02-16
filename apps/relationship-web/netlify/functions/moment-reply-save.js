require('dotenv').config();
const { getMoment } = require('./_services/db-moments.cjs');
const { createReply, getReplyForMoment } = require('./_services/db-replies.cjs');

const PARTNERS = { 'Erik': 'Marta', 'Marta': 'Erik' };

/**
 * POST /api/moment-reply-save
 *
 * Saves a reply to a moment. Validates that the replier is the partner.
 * See: docs/plans/sunlight-replies-Phase1.md
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { userId, momentId, content, repliedBy } = JSON.parse(event.body);

    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    if (!momentId || typeof momentId !== 'string') {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'momentId is required' })
      };
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Content is required' })
      };
    }

    // Fetch the moment to validate it exists and check who shared it
    const moment = await getMoment(momentId);
    if (!moment) {
      return {
        statusCode: 404,
        body: JSON.stringify({ success: false, error: 'Moment not found' })
      };
    }

    // Validate replier is the partner, not the original sharer
    if (repliedBy && moment.addedBy && repliedBy === moment.addedBy) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Cannot reply to your own moment' })
      };
    }

    const result = await createReply({
      momentId,
      userId,
      repliedBy: repliedBy || null,
      content: content.trim()
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        replyId: result.id
      })
    };

  } catch (error) {
    console.error('[moment-reply-save] ERROR:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Failed to save reply' })
    };
  }
};
