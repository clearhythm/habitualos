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
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 300000  // 5 minute timeout
});

const CHANGELOG_PATH = path.join(__dirname, '..', 'CHANGELOG_RECENT.md');
const ARCHITECTURE_PATH = path.join(__dirname, '..', 'ARCHITECTURE.md');
const DESIGN_PATH = path.join(__dirname, '..', 'DESIGN.md');
const PRACTICE_PATH = path.join(__dirname, '..', 'PRACTICE.md');

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

  // Read existing ARCHITECTURE.md, DESIGN.md, and PRACTICE.md
  let existingArchitecture = '';
  let existingDesign = '';
  let existingPractice = '';

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

  if (fs.existsSync(PRACTICE_PATH)) {
    existingPractice = fs.readFileSync(PRACTICE_PATH, 'utf8');
  } else {
    console.log('📝 No PRACTICE.md found. Will create new one...');
  }

  // Call Claude API to synthesize changes into documentation updates
  console.log('🤖 Calling Claude API to synthesize changes...');

  const systemPrompt = `You are a technical documentation assistant maintaining living architecture documentation for a codebase.

You maintain three complementary documents:
- **ARCHITECTURE.md**: Agent system architecture - high-level design, core concepts, technology stack, data flow
- **DESIGN.md**: Agent system implementation - file structure, code patterns, workflows, debugging
- **PRACTICE.md**: Practice tracker system - Obi-Wai habit tracking, separate from agent system

You will receive:
1. Current ARCHITECTURE.md content (Agent system)
2. Current DESIGN.md content (Agent system)
3. Current PRACTICE.md content (Practice tracker)
4. A changelog of recent commits

Your task:
- Update ALL THREE documents to reflect recent changes
- ARCHITECTURE.md: Focus on agent system design, architecture patterns, high-level decisions
- DESIGN.md: Focus on agent system file structure, code patterns, implementation details
- PRACTICE.md: Focus on practice tracker system (Obi-Wai), completely separate from agents
- Keep each concise and scannable (2-3 minutes read time each)
- Remove outdated information superseded by changes
- Use clear headings, bullet points, code examples
- Include file paths in markdown link format when referencing files

Guidelines:
- Don't just append changelog - integrate changes meaningfully
- Preserve overall structure where it makes sense
- Be accurate and technical (for developers and AI assistants)
- Focus on "what" and "how", not "why" (unless architecturally important)
- If a change only affects one subsystem, only update the relevant doc(s)
- Practice changes (src/practice/, practice-* endpoints) → PRACTICE.md
- Agent changes (src/do/, agent-* endpoints) → ARCHITECTURE.md + DESIGN.md`;

  const userPrompt = `Here's the current ARCHITECTURE.md:

\`\`\`markdown
${existingArchitecture || 'No content yet.'}
\`\`\`

Here's the current DESIGN.md:

\`\`\`markdown
${existingDesign || 'No content yet.'}
\`\`\`

Here's the current PRACTICE.md:

\`\`\`markdown
${existingPractice || 'No content yet.'}
\`\`\`

Here are the recent changes:

\`\`\`markdown
${recentChanges}
\`\`\`

Please update ARCHITECTURE.md, DESIGN.md, and PRACTICE.md to reflect these recent changes.

Return your response in this EXACT format:

===ARCHITECTURE===
[updated ARCHITECTURE.md content here]
===DESIGN===
[updated DESIGN.md content here]
===PRACTICE===
[updated PRACTICE.md content here]
===END===

Do not include any other text, explanations, or markdown code fences.`;

  try {
    console.log('📤 Sending request to Claude API...');
    console.log(`📊 Request size: ~${Math.round(userPrompt.length / 1000)}K characters`);

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

    console.log('📥 Received response from Claude API');
    const fullResponse = response.content[0].text.trim();
    console.log(`📊 Response size: ~${Math.round(fullResponse.length / 1000)}K characters`);

    // Parse response to extract ARCHITECTURE.md, DESIGN.md, and PRACTICE.md
    const archMatch = fullResponse.match(/===ARCHITECTURE===([\s\S]*?)===DESIGN===/);
    const designMatch = fullResponse.match(/===DESIGN===([\s\S]*?)===PRACTICE===/);
    const practiceMatch = fullResponse.match(/===PRACTICE===([\s\S]*?)===END===/);

    if (!archMatch || !designMatch || !practiceMatch) {
      console.error('Failed to parse LLM response. Expected ===ARCHITECTURE===, ===DESIGN===, and ===PRACTICE=== markers.');
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
    const updatedPractice = practiceMatch[1].trim();

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
    const cleanPractice = updatedPractice.replace(/^---[\s\S]*?---\n\n/, '');

    const finalArchitecture = frontmatter + cleanArchitecture;
    const finalDesign = frontmatter + cleanDesign;
    const finalPractice = frontmatter + cleanPractice;

    // Write updated files
    fs.writeFileSync(ARCHITECTURE_PATH, finalArchitecture, 'utf8');
    console.log('✅ Updated ARCHITECTURE.md');

    fs.writeFileSync(DESIGN_PATH, finalDesign, 'utf8');
    console.log('✅ Updated DESIGN.md');

    fs.writeFileSync(PRACTICE_PATH, finalPractice, 'utf8');
    console.log('✅ Updated PRACTICE.md');

    // Clear CHANGELOG_RECENT.md
    fs.writeFileSync(CHANGELOG_PATH, '# Recent Changes\n\nNo changes yet.\n', 'utf8');
    console.log('✅ Cleared CHANGELOG_RECENT.md');

    return {
      success: true,
      message: 'Successfully updated ARCHITECTURE.md, DESIGN.md, and PRACTICE.md with recent changes'
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
