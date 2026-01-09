require('dotenv').config();
const { getAgent } = require('./_services/db-agents.cjs');
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'db', 'habitualos.db');
const db = new Database(dbPath);

/**
 * POST /api/action-define
 * Convert a draft action to a defined action (persist to database)
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
    const { userId, agentId, title, description, priority } = JSON.parse(event.body);

    // Validate inputs
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Valid userId is required'
        })
      };
    }

    if (!agentId || !title || !description) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'agentId, title, and description are required'
        })
      };
    }

    // Verify agent ownership
    const agent = await getAgent(agentId);
    if (!agent || agent._userId !== userId) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: 'Agent not found or access denied'
        })
      };
    }

    // Create action in database
    const actionId = `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO actions (
        id, _userId, agentId, title, description, state, priority, taskType, _createdAt, _updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      actionId,
      userId,
      agentId,
      title,
      description,
      'defined',  // State is 'defined' - ready for scheduling
      priority || 'medium',
      'scheduled',  // Default task type
      now,
      now
    );

    // Fetch the created action
    const createdAction = db.prepare('SELECT * FROM actions WHERE id = ?').get(actionId);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        action: createdAction
      })
    };

  } catch (error) {
    console.error('Error in action-define:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
