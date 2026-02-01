require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Service layer imports
const { getAgent } = require('./_services/db-agents.cjs');
const { getActionsByUserId } = require('./_services/db-actions.cjs');
const { getDraftsByAgent } = require('./_services/db-agent-drafts.cjs');
const agentFilesystem = require('./_utils/agent-filesystem.cjs');
const { log } = require('./_utils/log.cjs');
const { createAgentTracker } = require('./_utils/agent-tracker.cjs');

// Agent core modules
const {
  createClient,
  sendMessage,
  handleToolCall,
  buildSystemMessages,
  buildTools,
  parseSignals
} = require('./_agent-core');

// Create Anthropic client
const anthropic = createClient({ timeout: 20000 });

/**
 * POST /api/agent-chat
 *
 * Conversational interface for agents to generate deliverables (assets and actions).
 * See: docs/endpoints/agent-chat.md
 */
exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  // Activity tracker - accumulates events, flushes one doc to Firestore in finally
  const tracker = createAgentTracker({ source: 'agent-chat' });

  try {
    const startTime = Date.now();
    log('info', '[agent-chat] Request started');

    // Parse request body
    const { userId, agentId, message, chatHistory = [], actionContext = null, reviewContext: rawReviewContext = null } = JSON.parse(event.body);
    tracker.setContext({ userId, agentId, actionId: actionContext?.actionId || null });

    // If actionContext is a review-type action, treat it as review context
    const reviewContext = rawReviewContext || (actionContext?.taskType === 'review' ? actionContext : null);

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

    if (!agentId || !message || !message.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'agentId and message are required'
        })
      };
    }

    // Fetch agent details
    log('info', '[agent-chat] Fetching agent from Firestore');
    const agent = await getAgent(agentId);
    log('info', `[agent-chat] Agent fetched in ${Date.now() - startTime}ms`);

    if (!agent || agent._userId !== userId) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: 'Agent not found or access denied'
        })
      };
    }

    // Fetch all active actions for user (to include in system prompt)
    log('info', '[agent-chat] Fetching active actions');
    const allUserActions = await getActionsByUserId(userId);
    const openActions = allUserActions.filter(a =>
      ['open', 'defined', 'scheduled', 'in_progress'].includes(a.state)
    );
    log('info', `[agent-chat] Found ${openActions.length} open actions for user`);
    tracker.context('open_actions', { count: openActions.length });

    // Load agent overview doc for strategic context
    const agentOverviewPath = path.join(__dirname, '..', '..', 'docs', 'architecture', 'agent-overview.md');
    let agentOverview = '';
    if (fs.existsSync(agentOverviewPath)) {
      agentOverview = fs.readFileSync(agentOverviewPath, 'utf-8');
      log('info', `[agent-chat] Loaded agent-overview.md (${agentOverview.length} chars)`);
    } else {
      log('error', `[agent-chat] agent-overview.md NOT FOUND at: ${agentOverviewPath}`);
    }

    // Check if filesystem tools should be available
    const isLocalhost = agentFilesystem.isFilesystemAvailable();
    const includeFilesystem = isLocalhost && agent.capabilities?.filesystem && agent.localDataPath;

    // Fetch pending drafts if review context
    let pendingDrafts = [];
    if (reviewContext) {
      const draftType = reviewContext.taskConfig?.draftType;
      pendingDrafts = await getDraftsByAgent(agentId, userId, { status: 'pending', type: draftType });
      log('info', `[agent-chat] Review context: found ${pendingDrafts.length} pending drafts (type: ${draftType || 'all'})`);
      tracker.context('review_context', { draftType: draftType || 'all', pendingDraftCount: pendingDrafts.length });
    }

    // Track action context
    if (actionContext) {
      log('info', `[agent-chat] Added action context for: ${actionContext.actionId} (${actionContext.taskType})`);
      tracker.context('action_context', { actionId: actionContext.actionId, taskType: actionContext.taskType, title: actionContext.title });
    }

    // Build system messages using extracted module
    const systemMessages = buildSystemMessages({
      agent,
      agentOverview,
      openActions,
      actionContext,
      reviewContext,
      pendingDrafts,
      includeFilesystem
    });

    // Build tools using extracted module
    const tools = buildTools({
      includeFilesystem,
      includeReview: reviewContext && pendingDrafts.length > 0
    });

    if (includeFilesystem) {
      log('info', `[agent-chat] Adding filesystem tools for agent with localDataPath: ${agent.localDataPath}`);
    }
    if (reviewContext && pendingDrafts.length > 0) {
      log('info', `[agent-chat] Adding review tools for ${pendingDrafts.length} pending drafts`);
    }

    // Build conversation history for Claude
    const conversationHistory = chatHistory.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));

    // Add current user message
    conversationHistory.push({
      role: 'user',
      content: message
    });

    // Call Claude API
    log('info', '[agent-chat] Calling Claude API');
    const apiCallStart = Date.now();

    const requestParams = {
      system: systemMessages,
      messages: conversationHistory,
      tools: tools
    };

    let apiResponse = await sendMessage(anthropic, requestParams);

    log('info', `[agent-chat] Claude API responded in ${Date.now() - apiCallStart}ms`);

    // Log cache usage
    if (apiResponse.usage) {
      log('info', `[agent-chat] Token usage:`, {
        input_tokens: apiResponse.usage.input_tokens,
        cache_creation_input_tokens: apiResponse.usage.cache_creation_input_tokens || 0,
        cache_read_input_tokens: apiResponse.usage.cache_read_input_tokens || 0,
        output_tokens: apiResponse.usage.output_tokens
      });

      if (apiResponse.usage.cache_read_input_tokens > 0) {
        log('info', `[agent-chat] CACHE HIT - Read ${apiResponse.usage.cache_read_input_tokens} tokens from cache`);
      } else if (apiResponse.usage.cache_creation_input_tokens > 0) {
        log('info', `[agent-chat] CACHE MISS - Created cache with ${apiResponse.usage.cache_creation_input_tokens} tokens`);
      }
    }

    // Record API call event
    tracker.apiCall({ model: 'claude-sonnet-4-5-20250929', usage: apiResponse.usage, duration_ms: Date.now() - apiCallStart, stop_reason: apiResponse.stop_reason });

    // Handle tool calls if present
    let assistantResponse = '';
    const toolUseBlocks = apiResponse.content.filter(block => block.type === 'tool_use');

    if (toolUseBlocks.length > 0) {
      log('info', `[agent-chat] Processing ${toolUseBlocks.length} tool call(s)`);

      // Execute tool calls and collect results
      const toolResults = [];
      for (const toolBlock of toolUseBlocks) {
        log('info', `[agent-chat] Tool call: ${toolBlock.name}`, toolBlock.input);
        tracker.toolCall(toolBlock.name, toolBlock.input);
        const toolResult = await handleToolCall(toolBlock, userId, agentId, agent);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolBlock.id,
          content: JSON.stringify(toolResult)
        });
        log('info', `[agent-chat] Tool result: ${toolBlock.name}`, toolResult);
        tracker.toolResult(toolBlock.name, toolResult);
      }

      // Add assistant's tool use to conversation
      conversationHistory.push({
        role: 'assistant',
        content: apiResponse.content
      });

      // Add tool results to conversation
      conversationHistory.push({
        role: 'user',
        content: toolResults
      });

      // Make follow-up call to get final response
      log('info', '[agent-chat] Making follow-up API call after tool use');
      const followUpResponse = await sendMessage(anthropic, {
        ...requestParams,
        messages: conversationHistory
      });

      // Extract text from follow-up response
      const followUpText = followUpResponse.content.find(b => b.type === 'text');
      assistantResponse = followUpText ? followUpText.text : '';

      // Log follow-up usage
      if (followUpResponse.usage) {
        log('info', `[agent-chat] Follow-up token usage:`, {
          input_tokens: followUpResponse.usage.input_tokens,
          cache_read_input_tokens: followUpResponse.usage.cache_read_input_tokens || 0,
          output_tokens: followUpResponse.usage.output_tokens
        });
        tracker.apiCall({ model: 'claude-sonnet-4-5-20250929', usage: followUpResponse.usage, stop_reason: followUpResponse.stop_reason });
      }

      // Use follow-up response for signal detection
      apiResponse = followUpResponse;
    } else {
      // No tool calls - extract text directly
      const textBlock = apiResponse.content.find(block => block.type === 'text');
      assistantResponse = textBlock ? textBlock.text : '';
    }

    log('info', `[agent-chat] Total request time: ${Date.now() - startTime}ms`);

    // Parse signals from response using extracted module
    const signal = parseSignals(assistantResponse);

    if (signal) {
      if (signal.error) {
        log('error', `[agent-chat] Signal parse error: ${signal.error}`, signal.raw);
        return {
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            error: `Failed to parse ${signal.type} response`
          })
        };
      }

      // Handle GENERATE_ACTIONS signal
      if (signal.type === 'GENERATE_ACTIONS') {
        log('info', '[agent-chat] GENERATE_ACTIONS parsed:', { title: signal.data.title, taskType: signal.data.taskType, priority: signal.data.priority });
        tracker.signal('GENERATE_ACTIONS', { title: signal.data.title, taskType: signal.data.taskType, priority: signal.data.priority });

        const draftAction = {
          id: `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: signal.data.title,
          description: signal.data.description,
          priority: signal.data.priority || 'medium',
          taskType: signal.data.taskType || 'scheduled',
          taskConfig: signal.data.taskConfig || {},
          state: 'draft',
          agentId: agent.id
        };

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            response: `I've drafted this deliverable for you. Let me know if you want to refine it, or we can mark it as defined and move on to the next one.`,
            draftActions: [draftAction],
            hasDraftActions: true
          })
        };
      }

      // Handle GENERATE_ASSET signal
      if (signal.type === 'GENERATE_ASSET') {
        log('info', '[agent-chat] GENERATE_ASSET parsed:', { title: signal.data.title, type: signal.data.type });
        tracker.signal('GENERATE_ASSET', { title: signal.data.title, type: signal.data.type });

        const draftAction = {
          id: `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: signal.data.title,
          description: signal.data.description,
          taskType: 'manual',
          type: signal.data.type || 'text',
          content: signal.data.content,
          priority: 'medium',
          state: 'draft',
          agentId: agent.id
        };

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            response: `I've created this deliverable for you. Let me know if you want to refine it, or we can mark it as defined.`,
            draftActions: [draftAction],
            hasDraftActions: true
          })
        };
      }

      // Handle STORE_MEASUREMENT signal
      if (signal.type === 'STORE_MEASUREMENT') {
        log('info', `[agent-chat] STORE_MEASUREMENT signal detected with ${signal.data.dimensions?.length || 0} dimensions`);
        tracker.signal('STORE_MEASUREMENT', { dimensionCount: signal.data.dimensions?.length || 0 });

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            response: `Got it! I've recorded your check-in. Keep up the great work!`,
            hasMeasurement: true,
            measurementData: {
              dimensions: signal.data.dimensions || [],
              notes: signal.data.notes || null
            }
          })
        };
      }
    }

    // Regular conversational response
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        response: assistantResponse,
        actionsGenerated: false
      })
    };

  } catch (error) {
    log('error', '[agent-chat] ERROR:', error);
    log('error', '[agent-chat] Error type:', error.constructor.name);
    log('error', '[agent-chat] Error message:', error.message);
    tracker.error(error);

    if (error.status) {
      log('error', '[agent-chat] HTTP Status:', error.status);
    }
    if (error.code) {
      log('error', '[agent-chat] Error code:', error.code);
    }

    let errorMessage = 'Internal server error';

    if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT' || error.name === 'APIConnectionTimeoutError') {
      errorMessage = 'The AI is taking too long to respond. Try a simpler request or try again';
      log('error', '[agent-chat] TIMEOUT - Consider reducing system prompt size or max_tokens');
    } else if (error.status === 429) {
      errorMessage = 'Rate limit exceeded - please wait a moment';
    } else if (error.status >= 500) {
      errorMessage = 'Service temporarily unavailable';
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: errorMessage
      })
    };
  } finally {
    await tracker.flush();
  }
};
