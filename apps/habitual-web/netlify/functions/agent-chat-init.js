require('dotenv').config();
const fs = require('fs');
const path = require('path');

const { getAgent } = require('./_services/db-agents.cjs');
const { getActionsByUserId } = require('./_services/db-actions.cjs');
const { getDraftsByAgent } = require('./_services/db-agent-drafts.cjs');
const agentFilesystem = require('./_utils/agent-filesystem.cjs');
const { log } = require('./_utils/log.cjs');

const { buildSystemMessages, buildTools } = require('./_agent-core');

/**
 * POST /api/agent-chat-init
 *
 * Returns system prompt and tools configuration for streaming chat.
 * Called by edge function to initialize a streaming session.
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { userId, agentId, actionContext = null, reviewContext: rawReviewContext = null } = JSON.parse(event.body);

    // Validate inputs
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    if (!agentId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'agentId is required' })
      };
    }

    // If actionContext is a review-type action, treat it as review context
    const reviewContext = rawReviewContext || (actionContext?.taskType === 'review' ? actionContext : null);

    // Fetch agent details
    const agent = await getAgent(agentId);

    if (!agent || agent._userId !== userId) {
      return {
        statusCode: 404,
        body: JSON.stringify({ success: false, error: 'Agent not found or access denied' })
      };
    }

    // Fetch all active actions for user
    const allUserActions = await getActionsByUserId(userId);
    const openActions = allUserActions.filter(a =>
      ['open', 'defined', 'scheduled', 'in_progress'].includes(a.state)
    );

    // Load agent overview doc
    const agentOverviewPath = path.join(__dirname, '..', '..', 'docs', 'architecture', 'agent-overview.md');
    let agentOverview = '';
    if (fs.existsSync(agentOverviewPath)) {
      agentOverview = fs.readFileSync(agentOverviewPath, 'utf-8');
    }

    // Check if filesystem tools should be available
    const isLocalhost = agentFilesystem.isFilesystemAvailable();
    const includeFilesystem = isLocalhost && agent.capabilities?.filesystem && agent.localDataPath;

    // Fetch pending drafts if review context
    let pendingDrafts = [];
    if (reviewContext) {
      const draftType = reviewContext.taskConfig?.draftType;
      pendingDrafts = await getDraftsByAgent(agentId, userId, { status: 'pending', type: draftType });
    }

    // Build system messages
    const systemMessages = buildSystemMessages({
      agent,
      agentOverview,
      openActions,
      actionContext,
      reviewContext,
      pendingDrafts,
      includeFilesystem
    });

    // Build tools
    const tools = buildTools({
      includeFilesystem,
      includeReview: reviewContext && pendingDrafts.length > 0
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        systemMessages,
        tools,
        agent: {
          id: agent.id,
          name: agent.name,
          localDataPath: agent.localDataPath,
          capabilities: agent.capabilities
        }
      })
    };

  } catch (error) {
    log('error', '[agent-chat-init] ERROR:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    };
  }
};
