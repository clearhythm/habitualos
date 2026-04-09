/**
 * @habitualos/email-service
 *
 * Shared Resend-based email sending for HabitualOS apps.
 * Consolidates the Resend setup that was previously copy-pasted across apps.
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
 * Send a magic link sign-in email.
 *
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.verifyUrl - The magic link URL
 * @param {string} [options.appName='HabitualOS'] - App name shown in email
 * @param {string} [options.primaryColor='#3a7a10'] - CTA button color
 * @param {string} [options.fromEmail] - Override RESEND_FROM_EMAIL env var
 */
async function sendMagicLink({ to, verifyUrl, appName = 'HabitualOS', primaryColor = '#3a7a10', fromEmail }) {
  const client = getClient();
  const from = fromEmail || process.env.RESEND_FROM_EMAIL || `${appName} <noreply@habitualos.com>`;

  // Darken the primary color slightly for the button (use as-is — caller can override)
  const { data, error } = await client.emails.send({
    from,
    to,
    subject: `Your sign-in link for ${appName}`,
    text: `Sign in to ${appName}\n\nClick this link to sign in (expires in 15 minutes):\n\n${verifyUrl}\n\nIf you didn't request this, you can ignore this email.`,
    html: `
      <div style="background: #f3f4f6; padding: 2.5rem 1.5rem; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
        <div style="max-width: 480px; margin: 0 auto;">
          <div style="background: #ffffff; border-radius: 16px; padding: 2.5rem 2rem; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
            <p style="font-size: 1.5rem; font-weight: 700; color: #1f2937; margin: 0 0 0.5rem;">${appName}</p>
            <p style="font-size: 1rem; color: #6b7280; margin: 0 0 2rem;">Sign-in link</p>

            <p style="font-size: 1rem; color: #1f2937; margin: 0 0 1rem;">Click the button below to sign in. This link expires in 15 minutes and can only be used once.</p>

            <a href="${verifyUrl}"
               style="display: inline-block; padding: 0.875rem 2rem; background: ${primaryColor}; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 1rem; margin: 0.5rem 0 1.5rem;">
              Sign in to ${appName}
            </a>

            <p style="font-size: 0.875rem; color: #9ca3af; margin: 0;">If you didn't request this link, you can safely ignore this email.</p>
          </div>
          <p style="font-size: 0.75rem; color: #9ca3af; text-align: center; margin: 1.5rem 0 0;">
            ${appName} · HabitualOS
          </p>
        </div>
      </div>
    `
  });

  if (error) {
    throw new Error(`Email send failed: ${error.message}`);
  }

  return data;
}

module.exports = { sendMagicLink };
