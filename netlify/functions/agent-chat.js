require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { getAgent } = require('./_services/db-agents.cjs');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
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

    // Read architecture docs for context-aware discussions
    let architectureContext = '';
    let designContext = '';
    let docStatus = { isDirty: false, commitsSinceSync: 0, lastSync: null, lastCommit: null };

    const architecturePath = path.join(__dirname, '..', '..', 'ARCHITECTURE.md');
    const designPath = path.join(__dirname, '..', '..', 'DESIGN.md');

    if (fs.existsSync(architecturePath)) {
      const archContent = fs.readFileSync(architecturePath, 'utf8');

      // Parse frontmatter
      const frontmatterMatch = archContent.match(/^---\s*\nlast_sync:\s*(.+?)\nlast_commit:\s*(.+?)\ncommits_since_sync:\s*(\d+)\s*\n---/);
      if (frontmatterMatch) {
        docStatus.lastSync = frontmatterMatch[1];
        docStatus.lastCommit = frontmatterMatch[2];
        docStatus.commitsSinceSync = parseInt(frontmatterMatch[3], 10);
        docStatus.isDirty = docStatus.commitsSinceSync > 0;

        // Strip frontmatter for context
        architectureContext = archContent.replace(/^---[\s\S]*?---\n\n/, '');
      } else {
        architectureContext = archContent;
      }
    }

    if (fs.existsSync(designPath)) {
      const designContent = fs.readFileSync(designPath, 'utf8');
      // Strip frontmatter for context
      designContext = designContent.replace(/^---[\s\S]*?---\n\n/, '');
    }

    const hasCodebaseContext = architectureContext || designContext;

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
- Don't create actions that just say "Create X" without full execution instructions

## Available Tools

You have access to tools for performing operations:

**sync_documentation** - Updates project documentation by syncing with recent git commits
- Use when: Documentation is out of date, user asks to refresh context, or before architectural discussions
- Format: USE_TOOL: sync_documentation

When you use a tool, respond EXACTLY in this format:
USE_TOOL: sync_documentation

The tool will execute and results will be added to the conversation. You'll see the output and can continue naturally.

Otherwise, respond conversationally to gather context or answer questions.${docStatus.isDirty ? `

---

## IMPORTANT: Documentation Status

The codebase documentation is OUT OF DATE:
- Last synced: ${docStatus.lastSync}
- Last commit: ${docStatus.lastCommit}
- Commits since sync: ${docStatus.commitsSinceSync}

${docStatus.commitsSinceSync >= 3 ?
  `This is significant staleness (${docStatus.commitsSinceSync} commits). You SHOULD proactively offer to update the documentation before proceeding with the conversation. Say something like: "Before we continue, I notice the documentation is out of date (${docStatus.commitsSinceSync} commits since last sync). Should I refresh the context first?"` :
  `Minor staleness (${docStatus.commitsSinceSync} commit${docStatus.commitsSinceSync > 1 ? 's' : ''}). Mention this casually but don't block the conversation unless the user's request seems to require up-to-date architecture knowledge.`
}

---

` : ''}${hasCodebaseContext ? `

---

## Codebase Context

You have access to the current codebase documentation:

${architectureContext ? `### ARCHITECTURE.md\n\n${architectureContext}\n\n` : ''}${designContext ? `### DESIGN.md\n\n${designContext}` : ''}

Use this context to have informed design discussions and make architectural recommendations.` : ''}`;

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

    // Call Claude API with prompt caching for documentation context
    const apiResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" }  // Cache system prompt (includes ARCHITECTURE.md + DESIGN.md)
        }
      ],
      messages: conversationHistory
    });

    // Extract assistant response
    const assistantResponse = apiResponse.content[0].text;

    // Check if response indicates action generation
    // Be flexible with whitespace and markdown code blocks
    const trimmedResponse = assistantResponse.trim();

    // Check if response indicates tool usage (at start of line)
    const toolMatch = trimmedResponse.match(/^USE_TOOL:\s*(\w+)/m);
    if (toolMatch) {
      const toolRegistry = require('./_tools/registry.cjs');
      const toolName = toolMatch[1];

      try {
        // Execute the tool
        const result = await toolRegistry.executeTool(toolName, {});

        // Return result to be added to conversation
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            success: true,
            response: result.success
              ? `Tool executed: ${result.message}\n\n${result.output ? '```\n' + result.output + '\n```' : ''}`
              : `Tool failed: ${result.message}\n\n${result.output ? '```\n' + result.output + '\n```' : ''}`,
            toolResult: result
          })
        };
      } catch (error) {
        console.error('Tool execution error:', error);
        return {
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            error: `Tool execution failed: ${error.message}`
          })
        };
      }
    }

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
    console.error('Error in agent-chat:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
