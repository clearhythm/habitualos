const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { getAction, updateActionState } = require('../db/helpers');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * Execute a scheduled task
 * @param {string} actionId - The action/task ID to execute
 * @returns {Promise<void>}
 */
async function executeTask(actionId) {
  console.log(`[Task Executor] Starting execution for task ${actionId}`);

  try {
    // Get task details
    const action = getAction(actionId);
    if (!action) {
      throw new Error(`Action ${actionId} not found`);
    }

    if (!action.task_config) {
      throw new Error(`Action ${actionId} missing task_config`);
    }

    const config = JSON.parse(action.task_config);

    // Mark as running
    updateActionState(actionId, 'in_progress', {
      started_at: new Date().toISOString()
    });
    console.log(`[Task Executor] Marked task ${actionId} as in_progress`);

    // Load context.md
    const contextPath = path.join(config.inputs_path, 'context.md');
    if (!fs.existsSync(contextPath)) {
      throw new Error(`Context file not found: ${contextPath}`);
    }
    const context = fs.readFileSync(contextPath, 'utf8');
    console.log(`[Task Executor] Loaded context from ${contextPath}`);

    // Get all user JSON files
    const userFiles = fs.readdirSync(config.inputs_path)
      .filter(f => f.endsWith('.json'))
      .sort(); // Consistent ordering

    console.log(`[Task Executor] Found ${userFiles.length} user files to process`);

    // Ensure output directory exists
    if (!fs.existsSync(config.outputs_path)) {
      fs.mkdirSync(config.outputs_path, { recursive: true });
    }

    let processed = 0;

    // Process each user
    for (const userFile of userFiles) {
      const userId = userFile.replace('.json', '');
      console.log(`[Task Executor] Processing user ${userId} (${processed + 1}/${userFiles.length})`);

      try {
        // Load user data
        const userData = JSON.parse(
          fs.readFileSync(path.join(config.inputs_path, userFile), 'utf8')
        );

        // Call Claude API - generate all 3 cards at once
        console.log(`[Task Executor] Calling Claude API for user ${userId}...`);
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 8192,
          system: context,
          messages: [{
            role: 'user',
            content: `User data:\n${JSON.stringify(userData, null, 2)}\n\nGenerate ${config.cards_per_subject || 3} cards using the format:\n\n=== CARD 1 ===\n[content]\n\n=== CARD 2 ===\n[content]\n\n=== CARD 3 ===\n[content]`
          }]
        });

        const output = response.content[0].text;
        console.log(`[Task Executor] Received response for user ${userId}`);

        // Parse output and save each card
        const cardSections = output.split(/===\s*CARD\s*\d+\s*===/).slice(1);

        if (cardSections.length === 0) {
          // Fallback: if no delimiters found, save entire output as card 1
          console.warn(`[Task Executor] No card delimiters found for user ${userId}, saving as single card`);
          const filename = `${userId}_card1.md`;
          fs.writeFileSync(
            path.join(config.outputs_path, filename),
            output.trim()
          );
        } else {
          // Save each parsed card
          cardSections.forEach((card, index) => {
            const filename = `${userId}_card${index + 1}.md`;
            const sanitizedFilename = filename.replace(/[^a-z0-9_.-]/gi, '_');
            fs.writeFileSync(
              path.join(config.outputs_path, sanitizedFilename),
              card.trim()
            );
          });
          console.log(`[Task Executor] Saved ${cardSections.length} cards for user ${userId}`);
        }

        processed++;

      } catch (userError) {
        console.error(`[Task Executor] Error processing user ${userId}:`, userError);
        // Continue with next user rather than failing entire task
        // Log the error but don't throw
      }

      // Small delay to avoid rate limits
      if (processed < userFiles.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Mark complete
    updateActionState(actionId, 'completed', {
      completed_at: new Date().toISOString()
    });
    console.log(`[Task Executor] Task ${actionId} completed successfully. Processed ${processed}/${userFiles.length} users.`);

  } catch (error) {
    console.error(`[Task Executor] Task ${actionId} failed:`, error);
    updateActionState(actionId, 'open', {
      error_message: error.message
    });
    throw error;
  }
}

module.exports = executeTask;
