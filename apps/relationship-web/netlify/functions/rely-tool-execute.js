require('dotenv').config();
const { handleSurveyTool, SURVEY_TOOL_NAMES } = require('@habitualos/survey-engine');
const { createMoment } = require('./_services/db-moments.cjs');
const { createReply, getReplyForMoment } = require('./_services/db-replies.cjs');
const { addPoints, getTodayPoints } = require('./_services/db-sun-points.cjs');
const { applyDelta, getBonusTier } = require('./_services/db-weather.cjs');

const POINTS_BY_TYPE = {
  happy: 5,
  sad: 5,
  hard: 10
};

/**
 * POST /api/rely-tool-execute
 *
 * Executes tool calls from Claude for the Relly chat.
 * Handles: save_moment, send_reply, and survey tools.
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const { userId, toolUse } = JSON.parse(event.body);
  const { name: toolName, input: toolInput } = toolUse;

  try {
    // Survey tools
    if (SURVEY_TOOL_NAMES.includes(toolName)) {
      const result = await handleSurveyTool(toolName, toolInput, { userId });
      return { statusCode: 200, body: JSON.stringify({ result }) };
    }

    switch (toolName) {
      case 'save_moment': {
        const { type, content, addedBy, occurredAt } = toolInput;
        const { id } = await createMoment({
          userId,
          addedBy: addedBy || null,
          type: type || 'happy',
          content: content || '',
          occurredAt: occurredAt || new Date().toISOString()
        });
        return {
          statusCode: 200,
          body: JSON.stringify({ result: { success: true, momentId: id } })
        };
      }

      case 'send_reply': {
        const { momentId, content, repliedBy } = toolInput;

        const moment = await require('./_services/db-moments.cjs').getMoment(momentId);
        if (!moment) {
          return {
            statusCode: 200,
            body: JSON.stringify({ result: { success: false, error: 'Moment not found' } })
          };
        }

        const existingReply = await getReplyForMoment(momentId);
        const isFirstReply = !existingReply;

        const result = await createReply({
          momentId,
          userId,
          repliedBy: repliedBy || null,
          content: (content || '').trim()
        });

        let sunPoints = 0;
        if (isFirstReply && repliedBy && moment.addedBy) {
          sunPoints = POINTS_BY_TYPE[moment.type] || 5;
          const pointsResult = await addPoints({
            replierName: repliedBy,
            sharerName: moment.addedBy,
            points: sunPoints
          });
          const dbCore = require('@habitualos/db-core');
          await dbCore.patch({ collection: 'moment-replies', id: result.id, data: { sunPoints } });

          if (pointsResult) {
            const todayTotal = await getTodayPoints();
            const bonus = getBonusTier(todayTotal);
            if (bonus > 0) {
              await applyDelta({ delta: bonus, source: 'sun-points' });
            }
          }
        }

        return {
          statusCode: 200,
          body: JSON.stringify({ result: { success: true, replyId: result.id, sunPoints } })
        };
      }

      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ result: { error: `Unknown tool: ${toolName}` } })
        };
    }
  } catch (err) {
    console.error('[rely-tool-execute] error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ result: { error: err.message } })
    };
  }
};
