/**
 * Email service for Signal using Resend.
 * Sends verification codes and welcome emails.
 */

const { Resend } = require('resend');

let client = null;

function getClient() {
  if (!client) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY not configured');
    client = new Resend(apiKey);
  }
  return client;
}

const FROM = process.env.RESEND_FROM_EMAIL || 'Signal <noreply@signal.habitualos.com>';

/**
 * Send a 6-digit verification code email.
 */
async function sendVerificationCode({ to, code }) {
  const { data, error } = await getClient().emails.send({
    from: FROM,
    to,
    subject: `Your Signal verification code: ${code}`,
    text: `Your Signal verification code is: ${code}\n\nThis code expires in 15 minutes.\n\n— Signal`,
    html: `
      <div style="background:#0f172a;padding:2.5rem 1.5rem;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <div style="max-width:440px;margin:0 auto;">
          <p style="color:#6366f1;font-size:1rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 1.5rem;">Signal</p>
          <div style="background:#1e293b;border-radius:12px;padding:2rem;">
            <p style="color:#f9fafb;font-size:1rem;margin:0 0 1rem;">Your verification code:</p>
            <p style="color:#6366f1;font-size:2.5rem;font-weight:700;letter-spacing:0.2em;margin:0 0 1.5rem;font-family:monospace;">${code}</p>
            <p style="color:#9ca3af;font-size:0.875rem;margin:0;">Expires in 15 minutes. If you didn't request this, ignore this email.</p>
          </div>
        </div>
      </div>
    `
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
  return data;
}

/**
 * Send a welcome email after verification.
 */
async function sendWelcome({ to, signalId, displayName }) {
  const widgetUrl = `https://signal.habitualos.com/widget/?id=${signalId}`;
  const dashUrl = `https://signal.habitualos.com/dashboard/`;

  const { data, error } = await getClient().emails.send({
    from: FROM,
    to,
    subject: `Your Signal is ready, ${displayName}`,
    text: `Welcome to Signal, ${displayName}.\n\nYour Signal ID: ${signalId}\nWidget URL: ${widgetUrl}\nDashboard: ${dashUrl}\n\n— Signal`,
    html: `
      <div style="background:#0f172a;padding:2.5rem 1.5rem;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <div style="max-width:440px;margin:0 auto;">
          <p style="color:#6366f1;font-size:1rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 1.5rem;">Signal</p>
          <div style="background:#1e293b;border-radius:12px;padding:2rem;">
            <p style="color:#f9fafb;font-size:1.125rem;font-weight:600;margin:0 0 0.75rem;">Welcome, ${displayName}.</p>
            <p style="color:#9ca3af;font-size:0.9rem;margin:0 0 1.5rem;">Your Signal is ready. Share it with anyone you want to screen for fit.</p>
            <p style="color:#9ca3af;font-size:0.875rem;margin:0 0 0.25rem;">Your widget link:</p>
            <a href="${widgetUrl}" style="color:#6366f1;font-size:0.875rem;word-break:break-all;">${widgetUrl}</a>
            <div style="margin-top:1.5rem;">
              <a href="${dashUrl}" style="display:inline-block;padding:0.65rem 1.5rem;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:0.9rem;">Go to dashboard</a>
            </div>
          </div>
        </div>
      </div>
    `
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
  return data;
}

module.exports = { sendVerificationCode, sendWelcome };
