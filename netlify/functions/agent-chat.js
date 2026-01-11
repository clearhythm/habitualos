require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { getAgent } = require('./_services/db-agents.cjs');
const { syncContext } = require('../../scripts/context-sync.js');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * POST /api/agent-chat
 * Conversational interface for agent to gather context and generate deliverables
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

    // Check if user is requesting context sync
    const lowerMessage = message.toLowerCase().trim();
    const isContextSyncRequest =
      lowerMessage.includes('update context') ||
      lowerMessage.includes('sync context') ||
      lowerMessage.includes('update system') ||
      lowerMessage.includes('refresh context');

    if (isContextSyncRequest) {
      console.log('Context sync requested by user');
      const syncResult = await syncContext();

      if (syncResult.success) {
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            success: true,
            response: '✅ I\'ve updated the system context with recent code changes. The latest architecture is now loaded and ready for our design discussion.',
            contextSynced: true
          })
        };
      } else {
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            success: true,
            response: `I tried to update the context but encountered an issue: ${syncResult.error}. You might need to check the CHANGELOG_RECENT.md file or try again.`,
            contextSynced: false
          })
        };
      }
    }

    // Read ARCHITECTURE.md and DESIGN.md for context-aware discussions
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
- User asks you to create something NOW ("create a prompt", "draft an email", "write code for...")
- The deliverable can be completed in the current conversation
- Examples: prompts, email drafts, code snippets, document outlines, design specs

ACTIONS (future work) - Use GENERATE_ACTIONS signal when:
- The deliverable requires scheduled execution or multi-step work
- It's something you'll create LATER, not right now
- Examples: "weekly content calendar", "research report with data collection", "build database schema"

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

When to generate actions:
- When user asks for actions ("generate actions", "what should we start with", etc.)
- When you have enough context to create specific deliverables
- IMPORTANT: Actions are deliverables YOU will create, not todos for the user
- Generate ONE action at a time - let the user refine it before creating more

Action format:
- Title: 2-5 words ONLY - concise and scannable
- Description: Brief description of what you'll create and how
- Priority: high|medium|low

If generating an action, respond EXACTLY in this format (no markdown, no code blocks):
GENERATE_ACTIONS
---
{
  "title": "2-5 word title",
  "description": "What you'll create (be specific about the output)",
  "priority": "high|medium|low"
}

Example:
GENERATE_ACTIONS
---
{
  "title": "LinkedIn Profile Draft",
  "description": "Create optimized LinkedIn profile copy highlighting product leadership experience",
  "priority": "high"
}

CRITICAL: Generate ONE action at a time. After they refine or define it, you can suggest another.

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

    // Check if response indicates tool usage
    if (trimmedResponse.includes('USE_TOOL:')) {
      const toolRegistry = require('./_tools/registry.cjs');

      // Extract tool name
      const toolMatch = trimmedResponse.match(/USE_TOOL:\s*(\w+)/);
      if (!toolMatch) {
        console.error('Could not parse tool name from:', assistantResponse);
        return {
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            error: 'Failed to parse tool call'
          })
        };
      }

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

    if (trimmedResponse.includes('GENERATE_ACTIONS')) {
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

    // Check if response indicates asset generation
    if (trimmedResponse.includes('GENERATE_ASSET')) {
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
