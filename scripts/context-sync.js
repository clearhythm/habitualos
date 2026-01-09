#!/usr/bin/env node

/**
 * Context Sync Script
 *
 * Reads CHANGELOG_RECENT.md, uses Claude API to synthesize changes into SYSTEM.md update.
 * This script is triggered manually by the user via agent chat or CLI.
 *
 * Usage:
 *   node scripts/context-sync.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const CHANGELOG_PATH = path.join(__dirname, '..', 'CHANGELOG_RECENT.md');
const SYSTEM_PATH = path.join(__dirname, '..', 'SYSTEM.md');

async function syncContext() {
  console.log('🔄 Starting context sync...');

  // Read CHANGELOG_RECENT.md
  if (!fs.existsSync(CHANGELOG_PATH)) {
    console.log('📝 No recent changelog found. Creating empty CHANGELOG_RECENT.md...');
    fs.writeFileSync(CHANGELOG_PATH, '# Recent Changes\n\nNo changes yet.\n', 'utf8');
    return {
      success: true,
      message: 'No recent changes to sync'
    };
  }

  const recentChanges = fs.readFileSync(CHANGELOG_PATH, 'utf8').trim();

  if (!recentChanges || recentChanges === '# Recent Changes\n\nNo changes yet.') {
    console.log('📝 No recent changes to sync.');
    return {
      success: true,
      message: 'No recent changes to sync'
    };
  }

  // Read existing SYSTEM.md (or create if doesn't exist)
  let existingSystem = '';
  if (fs.existsSync(SYSTEM_PATH)) {
    existingSystem = fs.readFileSync(SYSTEM_PATH, 'utf8');
  } else {
    console.log('📝 No SYSTEM.md found. Creating new one...');
    existingSystem = '# HabitualOS System Overview\n\nThis document provides an up-to-date overview of the HabitualOS codebase.\n\n## Architecture\n\nTo be populated...\n';
  }

  // Call Claude API to synthesize changes into SYSTEM.md update
  console.log('🤖 Calling Claude API to synthesize changes...');

  const systemPrompt = `You are a technical documentation assistant. Your job is to update the SYSTEM.md file based on recent code changes.

SYSTEM.md is a living architecture document that helps developers (and AI assistants) quickly understand the codebase structure, key patterns, and current state.

You will receive:
1. The current SYSTEM.md content
2. A changelog of recent commits

Your task:
- Update SYSTEM.md to reflect the recent changes
- Keep it concise and scannable (developers should be able to read it in 2-3 minutes)
- Focus on architecture, file structure, key patterns, and important technical decisions
- Remove outdated information that's been superseded by changes
- Use clear headings and bullet points
- Include file paths in markdown link format when referencing specific files

Guidelines:
- Don't just append the changelog - integrate the changes meaningfully
- Preserve the overall structure of SYSTEM.md
- Be accurate and technical (this is for developers, not marketing)
- Focus on "what" and "how", not "why" (unless the why is architecturally important)`;

  const userPrompt = `Here's the current SYSTEM.md:

\`\`\`markdown
${existingSystem}
\`\`\`

Here are the recent changes:

\`\`\`markdown
${recentChanges}
\`\`\`

Please update SYSTEM.md to reflect these recent changes. Return ONLY the updated SYSTEM.md content (no explanations, no markdown code fences around it).`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ]
    });

    const updatedSystem = response.content[0].text.trim();

    // Write updated SYSTEM.md
    fs.writeFileSync(SYSTEM_PATH, updatedSystem, 'utf8');
    console.log('✅ Updated SYSTEM.md');

    // Clear CHANGELOG_RECENT.md
    fs.writeFileSync(CHANGELOG_PATH, '# Recent Changes\n\nNo changes yet.\n', 'utf8');
    console.log('✅ Cleared CHANGELOG_RECENT.md');

    return {
      success: true,
      message: 'Successfully updated SYSTEM.md with recent changes'
    };

  } catch (error) {
    console.error('❌ Error syncing context:', error);
    return {
      success: false,
      error: error.message || 'Failed to sync context'
    };
  }
}

// If run directly from CLI
if (require.main === module) {
  syncContext()
    .then(result => {
      if (result.success) {
        console.log('✨', result.message);
        process.exit(0);
      } else {
        console.error('Error:', result.error);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}

// Export for use in other scripts (like agent-chat.js)
module.exports = { syncContext };
