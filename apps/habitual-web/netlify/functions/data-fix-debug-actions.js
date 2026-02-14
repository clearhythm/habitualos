require('dotenv').config();
const { getAction } = require('./_services/db-actions.cjs');

/**
 * POST /api/data-fix-debug-actions
 * Quick diagnostic: inspect specific action records
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
      if (action) {
        results[id] = {
          state: action.state,
          taskType: action.taskType,
          title: action.title,
          taskConfig: action.taskConfig,
          hasDraftIds: !!action.taskConfig?.draftIds,
          draftIdsLength: action.taskConfig?.draftIds?.length ?? 'undefined',
          draftIds: action.taskConfig?.draftIds
        };
      } else {
        results[id] = 'NOT FOUND';
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, actions: results }, null, 2)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
