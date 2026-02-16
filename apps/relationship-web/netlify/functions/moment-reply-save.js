require('dotenv').config();
const { getMoment } = require('./_services/db-moments.cjs');
const { createReply, getReplyForMoment } = require('./_services/db-replies.cjs');
const { addPoints, getTodayPoints } = require('./_services/db-sun-points.cjs');
const { applyDelta, getBonusTier } = require('./_services/db-weather.cjs');
const dbCore = require('@habitualos/db-core');
const { PARTNERS } = require('./_services/partners.cjs');

// Points by moment type
const POINTS_BY_TYPE = {
  happy: 5,
  sad: 5,
  hard: 10
};

/**
 * POST /api/moment-reply-save
 *
 * Saves a reply to a moment. Validates that the replier is the partner.
 * Awards sun points on first reply to a moment.
 * See: docs/plans/sunlight-replies-Phase1.md, Phase2.md
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

    // Check if this moment already has a reply (for points calculation)
    const existingReply = await getReplyForMoment(momentId);
    const isFirstReply = !existingReply;

    const result = await createReply({
      momentId,
      userId,
      repliedBy: repliedBy || null,
      content: content.trim()
    });

    // Award sun points only on first reply
    let sunPoints = 0;
    let pointsResult = null;
    if (isFirstReply && repliedBy && moment.addedBy) {
      sunPoints = POINTS_BY_TYPE[moment.type] || 5;
      pointsResult = await addPoints({
        replierName: repliedBy,
        sharerName: moment.addedBy,
        points: sunPoints
      });
      // Store sunPoints on the reply doc for display
      await dbCore.patch({ collection: 'moment-replies', id: result.id, data: { sunPoints } });
    }

    // Update weather based on today's cumulative sun points
    let weatherResult = null;
    if (pointsResult) {
      const todayTotal = await getTodayPoints();
      const bonus = getBonusTier(todayTotal);
      if (bonus > 0) {
        weatherResult = await applyDelta({ delta: bonus, source: 'sun-points' });
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        replyId: result.id,
        sunPoints,
        todayTotal: pointsResult?.todayTotal || 0,
        weather: weatherResult || null
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
