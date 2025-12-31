const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { getAction, updateActionState } = require('../db/helpers');
const { generateShiftReportPDF } = require('../scripts/generate-shift-report-pdf');
require('dotenv').config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * Execute a shift report generation task
 * @param {string} actionId - The action/task ID to execute
 * @returns {Promise<void>}
 */
async function executeShiftReportTask(actionId) {
  console.log(`[Shift Reports] Starting execution for task ${actionId}`);

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
    console.log(`[Shift Reports] Marked task ${actionId} as in_progress`);

    // Load context.md for report generation
    const contextPath = path.join(config.inputs_path, 'context.md');
    if (!fs.existsSync(contextPath)) {
      throw new Error(`Context file not found: ${contextPath}`);
    }
    const context = fs.readFileSync(contextPath, 'utf8');
    console.log(`[Shift Reports] Loaded context from ${contextPath}`);

    // Ensure output directory exists
    if (!fs.existsSync(config.outputs_path)) {
      fs.mkdirSync(config.outputs_path, { recursive: true });
    }

    let processed = 0;
    const users = config.users || [];

    if (users.length === 0) {
      console.warn('[Shift Reports] No users specified in task config');
    }

    // Process each user
    for (const userId of users) {
      console.log(`[Shift Reports] Processing user ${userId} (${processed + 1}/${users.length})`);

      try {
        // Load user data
        const userJsonPath = path.join(config.inputs_path, `${userId}.json`);
        if (!fs.existsSync(userJsonPath)) {
          console.warn(`[Shift Reports] User data not found: ${userJsonPath}`);
          continue;
        }

        const userData = JSON.parse(fs.readFileSync(userJsonPath, 'utf8'));

        // Call Claude API to generate shift report
        console.log(`[Shift Reports] Calling Claude API for user ${userId}...`);
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 16384, // Shift reports are longer than cards
          system: context,
          messages: [{
            role: 'user',
            content: `User data:\n${JSON.stringify(userData, null, 2)}\n\nGenerate a complete shift report for this user.`
          }]
        });

        const reportMarkdown = response.content[0].text;
        console.log(`[Shift Reports] Received report for user ${userId}`);

        // Save markdown report
        const reportMdPath = path.join(config.outputs_path, `${userId}-report.md`);
        fs.writeFileSync(reportMdPath, reportMarkdown);
        console.log(`[Shift Reports] Saved markdown report: ${reportMdPath}`);

        // Generate PDF if requested
        if (config.report_format === 'pdf') {
          console.log(`[Shift Reports] Generating PDF for user ${userId}...`);
          const pdfPath = await generateShiftReportPDF(userId, config.outputs_path);
          console.log(`[Shift Reports] Generated PDF: ${pdfPath}`);
        }

        processed++;

      } catch (userError) {
        console.error(`[Shift Reports] Error processing user ${userId}:`, userError);
        // Continue with next user rather than failing entire task
      }

      // Small delay to avoid rate limits
      if (processed < users.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Mark complete
    updateActionState(actionId, 'completed', {
      completed_at: new Date().toISOString()
    });
    console.log(`[Shift Reports] Task ${actionId} completed successfully. Processed ${processed}/${users.length} users.`);

  } catch (error) {
    console.error(`[Shift Reports] Task ${actionId} failed:`, error);
    updateActionState(actionId, 'open', {
      error_message: error.message
    });
    throw error;
  }
}

module.exports = executeShiftReportTask;
