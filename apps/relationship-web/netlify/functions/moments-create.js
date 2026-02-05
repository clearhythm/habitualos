/**
 * POST /api/moments-create
 *
 * Create a new moment.
 *
 * Request body:
 *   - userId (required): User ID
 *   - personName (optional): Name of the person
 *   - type (optional): 'conversation', 'gift', 'milestone', 'memory', 'note'
 *   - content (required): Description of the moment
 *   - occurredAt (optional): ISO date string (defaults to now)
 *
 * Response:
 *   { success: true, moment: { id, ... } }
 */

require('dotenv').config();
const { createMoment, getMoment } = require('./_services/db-moments.cjs');

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  // Parse request body
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Invalid JSON body' })
    };
  }

  const { userId, personName, type, content, occurredAt } = body;

  // Validate required fields
  if (!userId || !userId.startsWith('u-')) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Valid userId required' })
    };
  }

  if (!content || typeof content !== 'string' || content.trim() === '') {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Content is required' })
    };
  }

  try {
    const { id } = await createMoment({
      userId,
      personName,
      type,
      content: content.trim(),
      occurredAt
    });

    // Fetch the created moment to return full object
    const moment = await getMoment(id);

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, moment })
    };
  } catch (error) {
    console.error('moments-create error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    };
  }
};
