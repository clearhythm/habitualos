require('dotenv').config();
const { getOpenSurveyAction, createSurveyAction, getFocus } = require('@habitualos/survey-engine');
const { query } = require('@habitualos/db-core');

const SURVEY_DEFINITION_ID = 'survey-rel-v1';

/**
 * Netlify Scheduled Function — runs weekly.
 *
 * 1. Gets all users
 * 2. For each user, checks if they already have an open action (idempotent)
 * 3. If not, creates a per-user action with current focus dimensions
 * 4. Sends email notifications
 *
 * Schedule configured in netlify.toml:
 *   [functions."survey-weekly-create"]
 *     schedule = "0 16 * * 1"  # Monday 9am PT
 */
exports.handler = async (event) => {
  console.log('[survey-weekly-create] Running...');

  try {
    // Get current focus dimensions
    const focus = await getFocus(SURVEY_DEFINITION_ID);
    if (!focus || !focus.focusDimensions || focus.focusDimensions.length === 0) {
      console.error('[survey-weekly-create] No focus dimensions found. Run seed script first.');
      return {
        statusCode: 200,
        body: JSON.stringify({ success: false, error: 'No focus dimensions configured' })
      };
    }

    // Get all users
    const users = await query({ collection: 'users' });
    const testEmailOnly = process.env.SURVEY_TEST_EMAIL;

    let actionsCreated = 0;
    let actionsSkipped = 0;
    let emailsSent = 0;

    for (const user of users) {
      const userId = user.id;
      const email = user._email;
      const name = user.profile?.firstName || 'there';

      // Check if user already has an open action (idempotent)
      const existing = await getOpenSurveyAction(SURVEY_DEFINITION_ID, userId);
      if (existing) {
        console.log(`[survey-weekly-create] Open action exists for ${name} (${userId}): ${existing.id}. Skipping.`);
        actionsSkipped++;
        continue;
      }

      // Create per-user survey action
      const { id } = await createSurveyAction({
        _userId: userId,
        surveyDefinitionId: SURVEY_DEFINITION_ID,
        type: 'weekly',
        focusDimensions: focus.focusDimensions
      });
      console.log(`[survey-weekly-create] Created action ${id} for ${name} (${userId})`);
      actionsCreated++;

      // Send email notification
      if (!process.env.RESEND_API_KEY) continue;
      if (!email) {
        console.warn(`[survey-weekly-create] User ${userId} has no email, skipping notification`);
        continue;
      }
      if (testEmailOnly && email !== testEmailOnly) {
        console.log(`[survey-weekly-create] Test mode: skipping email for ${name} (${email})`);
        continue;
      }

      try {
        const { sendSurveyNotification } = require('./_services/email.cjs');
        await sendSurveyNotification({
          to: email,
          name,
          dimensions: focus.focusDimensions
        });
        emailsSent++;
        console.log(`[survey-weekly-create] Email sent to ${name} (${email})`);
      } catch (emailErr) {
        console.error(`[survey-weekly-create] Failed to email ${name}:`, emailErr.message);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        actionsCreated,
        actionsSkipped,
        emailsSent,
        focusDimensions: focus.focusDimensions
      })
    };

  } catch (error) {
    console.error('[survey-weekly-create] ERROR:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
