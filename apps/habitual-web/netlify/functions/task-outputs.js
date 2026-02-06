const fs = require('fs');
const path = require('path');

/**
 * List output files for a scheduled task
 * GET /api/task-outputs/:actionId
 */
exports.handler = async (event) => {
  const actionId = event.path.split('/').pop();

  try {
    const { getAction } = require('./_services/db-actions.cjs');
    const action = await getAction(actionId);

    if (!action) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: 'Action not found'
        })
      };
    }

    if (action.taskType !== 'scheduled') {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Action is not a scheduled task'
        })
      };
    }

    const config = action.taskConfig || null;
    if (!config || !config.outputs_path) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          files: []
        })
      };
    }

    // Check if outputs directory exists
    if (!fs.existsSync(config.outputs_path)) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          files: []
        })
      };
    }

    // Read all files from outputs directory
    const files = fs.readdirSync(config.outputs_path)
      .filter(f => f.endsWith('.md'))
      .sort()
      .map(filename => {
        const filepath = path.join(config.outputs_path, filename);
        const stats = fs.statSync(filepath);
        return {
          filename,
          size: stats.size,
          modified: stats.mtime.toISOString()
        };
      });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        files,
        outputs_path: config.outputs_path
      })
    };

  } catch (error) {
    console.error('Error listing task outputs:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
