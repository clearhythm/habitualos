require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { getAgent } = require('./_services/db-agents.cjs');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 20000 // 20 second timeout - must complete before Netlify's 26s limit
});

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

  try {
    const startTime = Date.now();
    console.log('[agent-chat] Request started');

    // Parse request body
    const { userId, agentId, message, chatHistory = [] } = JSON.parse(event.body);

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
    console.log('[agent-chat] Fetching agent from Firestore');
    const agent = await getAgent(agentId);
    console.log(`[agent-chat] Agent fetched in ${Date.now() - startTime}ms`);

    if (!agent || agent._userId !== userId) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: 'Agent not found or access denied'
        })
      };
    }

    // Find architecture docs path for tool use
    // Try multiple possible paths for docs (local vs deployed)
    const possiblePaths = [
      path.join(__dirname, '..', '..', 'docs', 'architecture'),
      path.join(process.cwd(), 'docs', 'architecture'),
      path.join(__dirname, 'docs', 'architecture')
    ];

    let architectureDocsPath = null;

    console.log(`[agent-chat] __dirname: ${__dirname}`);
    console.log(`[agent-chat] process.cwd(): ${process.cwd()}`);

    // Try each possible path
    for (const tryPath of possiblePaths) {
      if (fs.existsSync(tryPath)) {
        architectureDocsPath = tryPath;
        console.log(`[agent-chat] Found docs at: ${architectureDocsPath}`);
        break;
      }
    }

    if (!architectureDocsPath) {
      console.error(`[agent-chat] Architecture docs NOT FOUND in any of these paths:`, possiblePaths);
    }

    // Get available docs for tool definition
    const availableDocs = architectureDocsPath && fs.existsSync(architectureDocsPath)
      ? fs.readdirSync(architectureDocsPath).filter(f => f.endsWith('.md')).map(f => f.replace('.md', ''))
      : [];

    console.log(`[agent-chat] Available docs for on-demand access:`, availableDocs);

    // Build system prompt
    const systemPrompt = `You're an autonomous agent helping someone achieve their goal. You do ALL the work - they just provide context.

Your role:
- Gather context needed to create deliverables
- Generate actionable deliverables you will create (not tasks for them to do)
- Refine draft deliverables through conversation until they're well-defined
- Suggest scheduling for when you'll do the work
- Eventually: proactively suggest embodiment practices that support their goal

Your voice:
- Brief responses (2-3 sentences, match their length)
- Forward-leaning and helpful
- Use present tense
- NOT cheerleading - just clear, practical help

Agent details:
- Name: ${agent.name}
- North Star Goal: ${agent.instructions?.goal || 'Not yet defined'}
- Success Criteria: ${JSON.stringify(agent.instructions?.success_criteria || [])}
- Timeline: ${agent.instructions?.timeline || 'Not specified'}

When to create ACTIONS vs ASSETS:

ASSETS (immediate deliverables) - Use GENERATE_ASSET signal when:
- User asks you to create something NOW and you can deliver the FULL CONTENT immediately
- You're creating the actual deliverable in this conversation (not just planning it)
- Examples:
  * "Create a specification document" → Generate the full spec as an ASSET
  * "Draft an email to..." → Full email text as ASSET
  * "Write code for..." → Complete code as ASSET
  * "Create a prompt for..." → Full prompt text as ASSET
  * "Design a schema" → Full schema definition as ASSET

ACTIONS (future scheduled work) - Use GENERATE_ACTIONS signal when:
- The work will be done LATER at a scheduled time (not right now)
- It requires execution outside this conversation (running scripts, gathering data, etc.)
- You're scheduling yourself to do the work, not delivering it now
- Examples:
  * "Generate weekly social posts every Monday" → Scheduled ACTION
  * "Research and summarize competitors" → ACTION (requires research time)
  * "Build and deploy database changes" → ACTION (requires execution)

KEY RULE: If you can create the FULL content NOW in this chat, use GENERATE_ASSET. If it needs to be done later at a scheduled time, use GENERATE_ACTIONS.

If creating an immediate deliverable (ASSET), respond EXACTLY in this format:
GENERATE_ASSET
---
{
  "title": "2-6 word title",
  "description": "Brief description of what this is",
  "type": "markdown|code|text",
  "content": "[Full content here - the actual prompt/email/code/document]"
}

Example:
GENERATE_ASSET
---
{
  "title": "Agent Setup System Prompt",
  "description": "Conversational prompt for agent creation flow",
  "type": "markdown",
  "content": "You are a UX-focused AI assistant helping users define their goals...\\n\\nYour role is to ask clarifying questions..."
}

The asset card will appear inline. User can click to view full content, copy to clipboard, or save to Assets tab.

When to generate scheduled actions:
- The work will be done LATER at a scheduled time (not now)
- It requires autonomous execution outside the chat
- You have ALL the context needed to execute it without human intervention
- IMPORTANT: Actions must include complete instructions for autonomous execution

Action format requirements:
- Title: 2-5 words - what will be created
- Description: Brief overview of what you'll do
- Priority: high|medium|low
- taskType: "scheduled" (for scheduled autonomous execution)
- taskConfig: CRITICAL - detailed execution instructions
  * instructions: Step-by-step instructions for autonomous execution
  * expectedOutput: What you'll produce when this runs

If generating an action, respond EXACTLY in this format (no markdown, no code blocks):
GENERATE_ACTIONS
---
{
  "title": "2-5 word title",
  "description": "Brief overview of what you'll do",
  "priority": "high|medium|low",
  "taskType": "scheduled",
  "taskConfig": {
    "instructions": "Detailed step-by-step instructions for autonomous execution. Be specific about what to create, how to create it, what sources/data to use, etc.",
    "expectedOutput": "Clear description of what will be produced (e.g., 'A markdown document with 3 LinkedIn posts formatted with hashtags')"
  }
}

Example:
GENERATE_ACTIONS
---
{
  "title": "Weekly LinkedIn Posts",
  "description": "Generate 3 LinkedIn posts about product launches every Monday",
  "priority": "high",
  "taskType": "scheduled",
  "taskConfig": {
    "instructions": "1. Review recent product updates from the past week\n2. Create 3 LinkedIn posts (300-500 words each)\n3. Focus on: product benefits, user stories, technical highlights\n4. Use professional but approachable tone\n5. Include relevant hashtags: #ProductDevelopment #TechLeadership",
    "expectedOutput": "Three formatted LinkedIn posts ready to publish, each with headline, body text, and hashtags"
  }
}

CRITICAL:
- Generate ONE action at a time
- taskConfig.instructions must be detailed enough for autonomous execution
- Don't create actions that just say "Create X" without full execution instructions${availableDocs.length > 0 ? `

---

## Codebase Context

You have access to architecture documentation through the get_architecture_doc tool.
Available docs: ${availableDocs.join(', ')}

IMPORTANT:
- Only request docs when you need SPECIFIC architectural details to answer a question or create a deliverable
- DO NOT fetch docs just to confirm they exist or for general questions
- You can only request ONE doc per conversation turn
- If you need additional docs, respond to the user first, then request another doc in the next turn
- Don't fetch docs preemptively or speculatively` : ''}`;

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

    // Define tool for fetching architecture docs on-demand
    const tools = availableDocs.length > 0 ? [{
      name: "get_architecture_doc",
      description: "Retrieve a specific architecture documentation file. Use this when you need detailed information about system architecture, database schema, or implementation patterns. Only fetch docs when you actually need them for the current discussion.",
      input_schema: {
        type: "object",
        properties: {
          doc_name: {
            type: "string",
            enum: availableDocs,
            description: `The name of the documentation file to retrieve. Available: ${availableDocs.join(', ')}`
          }
        },
        required: ["doc_name"]
      }
    }] : [];

    // Call Claude API with tool support (loop to handle tool use)
    console.log('[agent-chat] Calling Claude API');
    console.log(`[agent-chat] System prompt size: ${systemPrompt.length} characters`);
    console.log(`[agent-chat] Tools available: ${tools.length > 0 ? tools[0].name : 'none'}`);
    const apiCallStart = Date.now();

    let apiResponse;
    let assistantResponse;
    const maxToolRounds = 2; // Allow 1 tool use + 1 final response (ONE doc per turn to prevent timeout)
    let toolRound = 0;

    while (toolRound < maxToolRounds) {
      toolRound++;
      console.log(`[agent-chat] API call round ${toolRound}`);

      const requestParams = {
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2048,  // Enough for full asset/action generation with content
        system: [
          {
            type: "text",
            text: systemPrompt,
            cache_control: { type: "ephemeral" }  // Cache system prompt
          }
        ],
        messages: conversationHistory
      };

      // Add tools if available
      if (tools.length > 0) {
        requestParams.tools = tools;
      }

      apiResponse = await anthropic.messages.create(requestParams);

      console.log(`[agent-chat] Claude API responded in ${Date.now() - apiCallStart}ms`);

      // Log cache usage
      if (apiResponse.usage) {
        console.log(`[agent-chat] Token usage:`, {
          input_tokens: apiResponse.usage.input_tokens,
          cache_creation_input_tokens: apiResponse.usage.cache_creation_input_tokens || 0,
          cache_read_input_tokens: apiResponse.usage.cache_read_input_tokens || 0,
          output_tokens: apiResponse.usage.output_tokens
        });

        if (apiResponse.usage.cache_read_input_tokens > 0) {
          console.log(`[agent-chat] ✓ CACHE HIT - Read ${apiResponse.usage.cache_read_input_tokens} tokens from cache`);
        } else if (apiResponse.usage.cache_creation_input_tokens > 0) {
          console.log(`[agent-chat] ⚠ CACHE MISS - Created cache with ${apiResponse.usage.cache_creation_input_tokens} tokens`);
        }
      }

      // Check if assistant wants to use a tool
      const toolUseBlock = apiResponse.content.find(block => block.type === 'tool_use');

      if (!toolUseBlock) {
        // No tool use - we're done
        break;
      }

      console.log(`[agent-chat] Tool use requested: ${toolUseBlock.name} with input:`, toolUseBlock.input);

      // Handle tool call
      if (toolUseBlock.name === 'get_architecture_doc') {
        const docName = toolUseBlock.input.doc_name;
        const docPath = path.join(architectureDocsPath, `${docName}.md`);

        let docContent;
        try {
          docContent = fs.readFileSync(docPath, 'utf-8');
          console.log(`[agent-chat] Loaded doc ${docName} (${docContent.length} chars)`);
        } catch (readError) {
          console.error(`[agent-chat] Failed to read doc ${docName}:`, readError);
          docContent = `Error: Could not read documentation file ${docName}`;
        }

        // Return immediately after loading doc to prevent timeout
        // Next user message will include the doc in chat history via chatHistory parameter
        // This prevents timeout from doing 2 sequential API calls (can total 40s+) in one invocation
        console.log(`[agent-chat] Doc loaded, returning to prevent timeout. Next message will have doc in context.`);

        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            success: true,
            response: `I've loaded the ${docName} documentation. What would you like to know about it?`,
            docLoaded: {
              doc_name: docName,
              doc_content: docContent,
              // Return these so frontend can add them to chat history
              assistant_tool_use: apiResponse.content,
              tool_use_id: toolUseBlock.id
            }
          })
        };
      }

      // Unknown tool - should not happen
      console.error(`[agent-chat] Unknown tool requested: ${toolUseBlock.name}`);
      break;
    }

    console.log(`[agent-chat] Total request time: ${Date.now() - startTime}ms`);

    // Extract assistant's final text response
    const textBlock = apiResponse.content.find(block => block.type === 'text');
    assistantResponse = textBlock ? textBlock.text : '';

    // Check if response indicates action generation
    // Be flexible with whitespace and markdown code blocks
    const trimmedResponse = assistantResponse.trim();

    // Check for GENERATE_ACTIONS at start of line followed by --- separator
    if (/^GENERATE_ACTIONS\s*\n---/m.test(trimmedResponse)) {
      // Find JSON object (single action)
      const lines = assistantResponse.split('\n');
      let jsonStart = -1;
      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        // Look for opening brace (single object, not array)
        if (trimmed.startsWith('{')) {
          jsonStart = i;
          break;
        }
      }

      if (jsonStart === -1) {
        console.error('Could not find JSON object in response:', assistantResponse);
        return {
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            error: 'Failed to parse action generation response'
          })
        };
      }

      // Find the end of the JSON object
      let jsonEnd = jsonStart;
      let braceCount = 0;
      for (let i = jsonStart; i < lines.length; i++) {
        const line = lines[i];
        for (const char of line) {
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;
        }
        if (braceCount === 0 && line.includes('}')) {
          jsonEnd = i;
          break;
        }
      }

      const jsonContent = lines.slice(jsonStart, jsonEnd + 1).join('\n');
      let generatedAction = null;

      try {
        generatedAction = JSON.parse(jsonContent);
      } catch (parseError) {
        console.error('Failed to parse generated action:', parseError);
        console.error('JSON content:', jsonContent);
        return {
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            error: 'Failed to parse AI response'
          })
        };
      }

      // Return draft action (NOT persisted to DB yet)
      // Frontend will store this in localStorage until it's "defined"
      const draftAction = {
        id: `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: generatedAction.title,
        description: generatedAction.description,
        priority: generatedAction.priority || 'medium',
        taskType: generatedAction.taskType || 'scheduled',
        taskConfig: generatedAction.taskConfig || {},
        state: 'draft', // Special state for unpersisted actions
        agentId: agent.id
      };

      // Return conversational confirmation with draft action
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          response: `I've drafted this deliverable for you. Let me know if you want to refine it, or we can mark it as defined and move on to the next one.`,
          draftActions: [draftAction], // Array of one for consistent frontend handling
          hasDraftActions: true
        })
      };
    }

    // Check for GENERATE_ASSET at start of line followed by --- separator
    if (/^GENERATE_ASSET\s*\n---/m.test(trimmedResponse)) {
      // Find JSON object (single asset)
      const lines = assistantResponse.split('\n');
      let jsonStart = -1;
      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        // Look for opening brace (single object, not array)
        if (trimmed.startsWith('{')) {
          jsonStart = i;
          break;
        }
      }

      if (jsonStart === -1) {
        console.error('Could not find JSON object in asset response:', assistantResponse);
        return {
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            error: 'Failed to parse asset generation response'
          })
        };
      }

      // Find the end of the JSON object
      let jsonEnd = jsonStart;
      let braceCount = 0;
      for (let i = jsonStart; i < lines.length; i++) {
        const line = lines[i];
        for (const char of line) {
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;
        }
        if (braceCount === 0 && line.includes('}')) {
          jsonEnd = i;
          break;
        }
      }

      const jsonContent = lines.slice(jsonStart, jsonEnd + 1).join('\n');
      let generatedAsset = null;

      try {
        generatedAsset = JSON.parse(jsonContent);
      } catch (parseError) {
        console.error('Failed to parse generated asset:', parseError);
        console.error('JSON content:', jsonContent);
        return {
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            error: 'Failed to parse AI asset response'
          })
        };
      }

      // Return proposed asset (NOT persisted - stored in frontend until saved)
      const proposedAsset = {
        id: `proposed-asset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: generatedAsset.title,
        description: generatedAsset.description,
        type: generatedAsset.type || 'text',
        content: generatedAsset.content,
        state: 'proposed',
        agentId: agent.id
      };

      // Return conversational confirmation with proposed asset
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          response: `I've created a proposed asset for you. Click the card below to view the full content, copy it to your clipboard, or save it to your Assets.`,
          proposedAsset: proposedAsset,
          hasProposedAsset: true
        })
      };
    }

    // Regular conversational response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        response: assistantResponse,
        actionsGenerated: false
      })
    };

  } catch (error) {
    console.error('[agent-chat] ERROR:', error);
    console.error('[agent-chat] Error type:', error.constructor.name);
    console.error('[agent-chat] Error message:', error.message);

    // Log specific error types for better debugging
    if (error.status) {
      console.error('[agent-chat] HTTP Status:', error.status);
    }
    if (error.code) {
      console.error('[agent-chat] Error code:', error.code);
    }

    // Provide more specific error messages
    let errorMessage = 'Internal server error';

    if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT' || error.name === 'APIConnectionTimeoutError') {
      errorMessage = 'The AI is taking too long to respond. Try a simpler request or try again';
      console.error('[agent-chat] TIMEOUT - Consider reducing system prompt size or max_tokens');
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
  }
};
