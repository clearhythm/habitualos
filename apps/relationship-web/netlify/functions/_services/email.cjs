/**
 * Email service using Resend.
 *
 * Sends transactional emails for survey notifications.
 * Requires RESEND_API_KEY and PIDGERTON_URL environment variables.
 */

const { Resend } = require('resend');

let resendClient = null;

function getClient() {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY not configured');
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

/**
 * Send a weekly survey notification email.
 *
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.name - Recipient's first name
 * @param {string[]} options.dimensions - Focus dimensions (first 3 are growth areas)
 */
async function sendSurveyNotification({ to, name, dimensions }) {
  const client = getClient();
  const chatUrl = 'https://relate.habitualos.com';
  const growthAreas = (dimensions || []).slice(0, 3);
  const dimensionList = growthAreas.map(d => `  - ${d}`).join('\n');

  const { data, error } = await client.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'Pidgerton <noreply@pidgerton.com>',
    to,
    subject: `Got a moment for your ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} check-in?`,
    text: `Hey ${name},

It's time for your weekly Pidgerton mini check-in. This week's focus areas:

${dimensionList}

When you're ready, just open a chat and we'll walk through them together.

${chatUrl}/chat/

– Pidgerton`,
    html: `
      <div style="background: #7c3aed; padding: 2.5rem 1.5rem; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
        <div style="max-width: 480px; margin: 0 auto;">
          <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 1.25rem;">
            <tr>
              <td style="vertical-align: middle; font-size: 2rem; line-height: 1;">&#x1F437;</td>
              <td style="vertical-align: middle; padding-left: 10px; font-size: 1.65rem; font-weight: 700; color: #ffffff; line-height: 1;">Pidgerton</td>
            </tr>
          </table>
          <div style="background: #f5f3ff; border-radius: 16px; padding: 2.5rem 2rem;">
            <p style="font-size: 1rem; color: #1f2937; margin: 0 0 1rem;">Hey ${name},</p>
            <p style="font-size: 1rem; color: #1f2937; margin: 0 0 1rem;">Your weekly relationship check-in is ready! This week's focus areas:</p>
            <ul style="color: #4b5563; font-size: 0.95rem; margin: 0 0 1.25rem; padding-left: 1.25rem;">
              ${growthAreas.map(d => `<li style="margin-bottom: 0.25rem;">${d}</li>`).join('')}
            </ul>
            <p style="font-size: 1rem; color: #1f2937; margin: 0 0 1.5rem;">When you're ready, just open a chat and we'll walk through them together.</p>
            <a href="${chatUrl}/chat/" style="display: inline-block; padding: 0.75rem 1.75rem; background: #3b0f80; color: white; text-decoration: none; border-radius: 24px; font-weight: 600; font-size: 0.95rem;">Start Check-in</a>
          </div>
          <p style="font-size: 0.8rem; color: rgba(255,255,255,0.6); margin: 1.5rem 0 0; text-align: center;">Pidgerton by HabitualOS</p>
        </div>
      </div>
    `
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  return data;
}

module.exports = { sendSurveyNotification };
