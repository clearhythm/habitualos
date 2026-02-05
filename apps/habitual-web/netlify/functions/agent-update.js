require('dotenv').config();
const { getAgent, updateAgent } = require('./_services/db-agents.cjs');
const { getProject } = require('./_services/db-projects.cjs');

/**
 * POST /api/agent-update
 * Update agent configuration (status, model, instructions)
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
    const { agentId, status, model, instructions, localDataPath, capabilities, projectId } = JSON.parse(event.body);

    if (!agentId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Agent ID is required'
        })
      };
    }

    // Get userId from query parameters
    const { userId } = event.queryStringParameters || {};

    // Validate userId
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    // Check if agent exists and belongs to user
    const agent = await getAgent(agentId);

    if (!agent) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: 'Agent not found'
        })
      };
    }

    // Verify agent belongs to user
    if (agent._userId !== userId) {
      return {
        statusCode: 403,
        body: JSON.stringify({ success: false, error: 'Unauthorized' })
      };
    }

    // Validate projectId ownership if provided (null is allowed to unassign)
    if (projectId !== undefined && projectId !== null) {
      const project = await getProject(projectId);
      if (!project || project._userId !== userId) {
        return {
          statusCode: 403,
          body: JSON.stringify({ success: false, error: 'Invalid project' })
        };
      }
    }

    // Build updates object (only include provided fields)
    const updates = {};
    if (status !== undefined) updates.status = status;
    if (model !== undefined) updates.model = model;
    if (instructions !== undefined) updates.instructions = instructions;
    if (localDataPath !== undefined) updates.localDataPath = localDataPath;
    if (capabilities !== undefined) updates.capabilities = capabilities;
    if (projectId !== undefined) updates.projectId = projectId;

    // Update agent
    await updateAgent(agentId, updates);

    // Get updated agent
    const updatedAgent = await getAgent(agentId);

    // Convert Firestore Timestamps to ISO strings
    const agentWithDates = {
      ...updatedAgent,
      _createdAt: updatedAgent._createdAt?.toDate ? updatedAgent._createdAt.toDate().toISOString() : updatedAgent._createdAt,
      _updatedAt: updatedAgent._updatedAt?.toDate ? updatedAgent._updatedAt.toDate().toISOString() : updatedAgent._updatedAt,
      metrics: {
        ...updatedAgent.metrics,
        lastRunAt: updatedAgent.metrics?.lastRunAt || null
      }
    };

    // Return success response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        agent: agentWithDates
      })
    };

  } catch (error) {
    console.error('Error in agent-update:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
