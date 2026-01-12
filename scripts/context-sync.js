#!/usr/bin/env node

/**
 * Context Sync Script
 *
 * Reads CHANGELOG_RECENT.md, uses Claude API to synthesize changes into
 * ARCHITECTURE.md and DESIGN.md updates.
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
const ARCHITECTURE_PATH = path.join(__dirname, '..', 'ARCHITECTURE.md');
const DESIGN_PATH = path.join(__dirname, '..', 'DESIGN.md');

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

  // Read existing ARCHITECTURE.md and DESIGN.md
  let existingArchitecture = '';
  let existingDesign = '';

  if (fs.existsSync(ARCHITECTURE_PATH)) {
    existingArchitecture = fs.readFileSync(ARCHITECTURE_PATH, 'utf8');
  } else {
    console.log('📝 No ARCHITECTURE.md found. Will create new one...');
  }

  if (fs.existsSync(DESIGN_PATH)) {
    existingDesign = fs.readFileSync(DESIGN_PATH, 'utf8');
  } else {
    console.log('📝 No DESIGN.md found. Will create new one...');
  }

  // Call Claude API to synthesize changes into documentation updates
  console.log('🤖 Calling Claude API to synthesize changes...');

  const systemPrompt = `You are a technical documentation assistant maintaining living architecture documentation for a codebase.

You maintain two complementary documents:
- **ARCHITECTURE.md**: High-level system design, core concepts, technology stack, data flow, deployment
- **DESIGN.md**: Implementation details, file structure, code patterns, workflows, debugging

You will receive:
1. Current ARCHITECTURE.md content
2. Current DESIGN.md content
3. A changelog of recent commits

Your task:
- Update BOTH documents to reflect recent changes
- ARCHITECTURE.md: Focus on system design, architecture patterns, high-level decisions
- DESIGN.md: Focus on file structure, code patterns, implementation details, workflows
- Keep both concise and scannable (2-3 minutes read time each)
- Remove outdated information superseded by changes
- Use clear headings, bullet points, code examples
- Include file paths in markdown link format when referencing files

Guidelines:
- Don't just append changelog - integrate changes meaningfully
- Preserve overall structure where it makes sense
- Be accurate and technical (for developers and AI assistants)
- Focus on "what" and "how", not "why" (unless architecturally important)
- If a change only affects one file, only update that file`;

  const userPrompt = `Here's the current ARCHITECTURE.md:

\`\`\`markdown
${existingArchitecture || 'No content yet.'}
\`\`\`

Here's the current DESIGN.md:

\`\`\`markdown
${existingDesign || 'No content yet.'}
\`\`\`

Here are the recent changes:

\`\`\`markdown
${recentChanges}
\`\`\`

Please update ARCHITECTURE.md and DESIGN.md to reflect these recent changes.

Return your response in this EXACT format:

===ARCHITECTURE===
[updated ARCHITECTURE.md content here]
===DESIGN===
[updated DESIGN.md content here]
===END===

Do not include any other text, explanations, or markdown code fences.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 16000,
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" }  // Cache synthesis instructions
        }
      ],
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ]
    });

    const fullResponse = response.content[0].text.trim();

    // Parse response to extract ARCHITECTURE.md and DESIGN.md
    const archMatch = fullResponse.match(/===ARCHITECTURE===([\s\S]*?)===DESIGN===/);
    const designMatch = fullResponse.match(/===DESIGN===([\s\S]*?)===END===/);

    if (!archMatch || !designMatch) {
      console.error('Failed to parse LLM response. Expected ===ARCHITECTURE=== and ===DESIGN=== markers.');
      console.error('Received response (first 500 chars):');
      console.error(fullResponse.substring(0, 500));
      console.error('\n...and last 500 chars:');
      console.error(fullResponse.substring(fullResponse.length - 500));
      return {
        success: false,
        error: 'Failed to parse documentation update from LLM'
      };
    }

    const updatedArchitecture = archMatch[1].trim();
    const updatedDesign = designMatch[1].trim();

    // Extract current last_commit from existing frontmatter (or use now if missing)
    const lastCommitMatch = existingArchitecture.match(/^---\s*\nlast_sync:.*?\nlast_commit:\s*(.+?)\n/s);
    const lastCommit = lastCommitMatch ? lastCommitMatch[1].trim() : new Date().toISOString();

    const currentTime = new Date().toISOString();

    const frontmatter = `---
last_sync: ${currentTime}
last_commit: ${lastCommit}
commits_since_sync: 0
---

`;

    // Prepend frontmatter to updated content (strip old frontmatter if exists)
    const cleanArchitecture = updatedArchitecture.replace(/^---[\s\S]*?---\n\n/, '');
    const cleanDesign = updatedDesign.replace(/^---[\s\S]*?---\n\n/, '');

    const finalArchitecture = frontmatter + cleanArchitecture;
    const finalDesign = frontmatter + cleanDesign;

    // Write updated files
    fs.writeFileSync(ARCHITECTURE_PATH, finalArchitecture, 'utf8');
    console.log('✅ Updated ARCHITECTURE.md');

    fs.writeFileSync(DESIGN_PATH, finalDesign, 'utf8');
    console.log('✅ Updated DESIGN.md');

    // Clear CHANGELOG_RECENT.md
    fs.writeFileSync(CHANGELOG_PATH, '# Recent Changes\n\nNo changes yet.\n', 'utf8');
    console.log('✅ Cleared CHANGELOG_RECENT.md');

    return {
      success: true,
      message: 'Successfully updated ARCHITECTURE.md and DESIGN.md with recent changes'
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
