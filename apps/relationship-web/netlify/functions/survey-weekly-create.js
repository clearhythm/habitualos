require('dotenv').config();
const { getOpenSurveyAction, createSurveyAction, getFocus } = require('@habitualos/survey-engine');
const { query } = require('@habitualos/db-core');

const SURVEY_DEFINITION_ID = 'survey-rel-v1';

/**
 * Netlify Scheduled Function — runs weekly.
 *
 * 1. Checks if an open survey action already exists (idempotent)
 * 2. If not, creates one with current focus dimensions
 * 3. Queries all users from the users table for email notifications
 * 4. Sends email notifications to each user with an email on file
 *
 * Schedule configured in netlify.toml:
 *   [functions."survey-weekly-create"]
 *     schedule = "0 16 * * 1"  # Monday 9am PT
 */
exports.handler = async (event) => {
  console.log('[survey-weekly-create] Running...');

  try {
    // Check for existing open action (idempotent)
    const existing = await getOpenSurveyAction(SURVEY_DEFINITION_ID);
    if (existing) {
      console.log(`[survey-weekly-create] Open action already exists: ${existing.id}. Skipping.`);
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, skipped: true, existingActionId: existing.id })
      };
    }

    // Get current focus dimensions
    const focus = await getFocus(SURVEY_DEFINITION_ID);
    if (!focus || !focus.focusDimensions || focus.focusDimensions.length === 0) {
      console.error('[survey-weekly-create] No focus dimensions found. Run seed script first.');
      return {
        statusCode: 200,
        body: JSON.stringify({ success: false, error: 'No focus dimensions configured' })
      };
    }

    // Create survey action
    const { id } = await createSurveyAction({
      surveyDefinitionId: SURVEY_DEFINITION_ID,
      type: 'weekly',
      focusDimensions: focus.focusDimensions
    });
    console.log(`[survey-weekly-create] Created action: ${id}`);

    // Send email notifications (skip if Resend not configured)
    let emailsSent = 0;
    const testEmailOnly = process.env.SURVEY_TEST_EMAIL;

    if (!process.env.RESEND_API_KEY) {
      console.log('[survey-weekly-create] RESEND_API_KEY not set, skipping emails');
    } else {
      const { sendSurveyNotification } = require('./_services/email.cjs');
      const users = await query({ collection: 'users' });

      for (const user of users) {
        const email = user._email;
        const name = user.profile?.firstName || 'there';

        if (!email) {
          console.warn(`[survey-weekly-create] User ${user.id} has no email, skipping`);
          continue;
        }

        // If SURVEY_TEST_EMAIL is set, only send to that address
        if (testEmailOnly && email !== testEmailOnly) {
          console.log(`[survey-weekly-create] Test mode: skipping ${name} (${email})`);
          continue;
        }

        try {
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
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        actionId: id,
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
