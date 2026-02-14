require('dotenv').config();
const { getAction, updateActionState } = require('./_services/db-actions.cjs');
const { generatePreferenceProfile } = require('./_utils/preference-profile-generator.cjs');

/**
 * POST /api/data-fix-debug-actions
 * Complete specific open review actions that have all drafts reviewed.
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const actionIds = ['action-mlldozwb4cxw', 'action-mlldm6c6uy6m'];
    const results = {};

    for (const id of actionIds) {
      const action = await getAction(id);
      if (!action) {
        results[id] = 'NOT FOUND';
        continue;
      }

      if (action.state === 'completed') {
        results[id] = { state: 'already completed' };
        continue;
      }

      await updateActionState(id, 'completed');

      // Trigger preference profile regen
      const sourceAgentId = action.taskConfig?.sourceAgentId;
      if (sourceAgentId && action._userId) {
        generatePreferenceProfile(sourceAgentId, action._userId).catch(err => {
          console.error(`[data-fix] Profile gen failed for ${sourceAgentId}:`, err.message);
        });
      }

      results[id] = { state: 'completed', title: action.title };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, results }, null, 2)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
