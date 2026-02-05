const fs = require('fs');
const path = require('path');

/**
 * Get content of a specific output file
 * GET /api/file-view/:actionId/:filename
 */
exports.handler = async (event) => {
  const pathParts = event.path.split('/');
  const filename = pathParts.pop();
  const actionId = pathParts.pop();

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
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: 'No outputs path configured'
        })
      };
    }

    // Security: Sanitize filename to prevent path traversal
    const sanitizedFilename = path.basename(filename);
    const filepath = path.join(config.outputs_path, sanitizedFilename);

    // Verify the file is within the outputs directory
    const resolvedPath = path.resolve(filepath);
    const resolvedOutputsPath = path.resolve(config.outputs_path);
    if (!resolvedPath.startsWith(resolvedOutputsPath)) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          error: 'Access denied'
        })
      };
    }

    // Check if file exists
    if (!fs.existsSync(filepath)) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: 'File not found'
        })
      };
    }

    // Read file content
    const content = fs.readFileSync(filepath, 'utf8');
    const stats = fs.statSync(filepath);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        filename: sanitizedFilename,
        content,
        size: stats.size,
        modified: stats.mtime.toISOString(),
        actionTitle: action.title
      })
    };

  } catch (error) {
    console.error('Error reading file:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
