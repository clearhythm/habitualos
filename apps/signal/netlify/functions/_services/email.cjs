/**
 * Email service for Signal using Resend.
 * Sends verification codes and welcome emails.
 */

const { Resend } = require('resend');
const { SITE_BASE_URL } = require('./env-config.cjs');

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
          <p style="color:#7c3aed;font-size:1rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 1.5rem;">Signal</p>
          <div style="background:#1e293b;border-radius:12px;padding:2rem;">
            <p style="color:#f9fafb;font-size:1rem;margin:0 0 1rem;">Your verification code:</p>
            <p style="color:#7c3aed;font-size:2.5rem;font-weight:700;letter-spacing:0.2em;margin:0 0 1.5rem;font-family:monospace;">${code}</p>
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
          <p style="color:#7c3aed;font-size:1rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 1.5rem;">Signal</p>
          <div style="background:#1e293b;border-radius:12px;padding:2rem;">
            <p style="color:#f9fafb;font-size:1.125rem;font-weight:600;margin:0 0 0.75rem;">Welcome, ${displayName}.</p>
            <p style="color:#9ca3af;font-size:0.9rem;margin:0 0 1.5rem;">Your Signal is ready. Share it with anyone you want to screen for fit.</p>
            <p style="color:#9ca3af;font-size:0.875rem;margin:0 0 0.25rem;">Your widget link:</p>
            <a href="${widgetUrl}" style="color:#7c3aed;font-size:0.875rem;word-break:break-all;">${widgetUrl}</a>
            <div style="margin-top:1.5rem;">
              <a href="${dashUrl}" style="display:inline-block;padding:0.65rem 1.5rem;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:0.9rem;">Go to dashboard</a>
            </div>
          </div>
        </div>
      </div>
    `
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
  return data;
}

const LIGHT_WRAPPER = (content) => `
  <div style="background:#f0f7ff;padding:2.5rem 1.5rem;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="max-width:480px;margin:0 auto;">
      <p style="color:#7c3aed;font-size:1.25rem;font-weight:800;letter-spacing:-0.01em;margin:0 0 2rem;">Signal</p>
      <div style="background:#ffffff;border-radius:12px;padding:2rem;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        ${content}
      </div>
      <p style="color:#94a3b8;font-size:0.75rem;margin:1.5rem 0 0;text-align:center;"><a href="https://signal.habitualos.com" style="color:#94a3b8;text-decoration:none;"><img src="https://signal.habitualos.com/assets/favicon-32x32.png" alt="" width="16" height="16" style="display:inline-block;vertical-align:middle;margin-right:5px;opacity:0.5;">Signal · Real work, not résumés</a></p>
    </div>
  </div>
`;

/**
 * Send a waitlist confirmation email (double opt-in).
 */
async function sendWaitlistConfirm({ to, confirmToken }) {
  const confirmUrl = `${SITE_BASE_URL}/waitlist/?token=${confirmToken}`;
  const FOOTER = `
    <p style="color:#94a3b8;font-size:0.75rem;margin:2rem 0 0;border-top:1px solid #e2e8f0;padding-top:1rem;">
      Signal · 114 Cress Road, Santa Cruz, CA 95060, USA<br>
      To unsubscribe, reply to this email and let me know.
    </p>
  `;
  const { data, error } = await getClient().emails.send({
    from: 'Signal <erik@habitualos.com>',
    replyTo: 'erik@habitualos.com',
    to,
    subject: "Confirm your place on the Signal Waitlist",
    text: `Hey,\n\nThanks for joining the Signal Waitlist.\n\nConfirm your spot here:\n${confirmUrl}\n\nIf we haven’t met, I’m Erik. I started Signal because I think real work should be visible, not flattened into a resume.\n\nFeel free to reply if you want to say hello.\n\nErik\n\n---\nSignal · 114 Cress Road, Santa Cruz, CA 95060, USA\nTo unsubscribe, reply to this email.`,
    html: LIGHT_WRAPPER(`
      <p style="color:#1e293b;font-size:0.925rem;margin:0 0 1.25rem;">Hey,</p>
      <p style="color:#475569;font-size:0.925rem;line-height:1.6;margin:0 0 1.25rem;">Thanks for joining the Signal Waitlist.</p>
      <a href="${confirmUrl}" style="display:inline-block;margin:0 0 1.25rem;padding:0.7rem 1.5rem;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:0.925rem;">Confirm Your Spot</a>
      <p style="color:#475569;font-size:0.925rem;line-height:1.6;margin:0 0 1rem;">If we haven’t met, I’m Erik. I started Signal because I think real work should be visible, not flattened into a resume.</p>
      <p style="color:#475569;font-size:0.925rem;line-height:1.6;margin:0 0 1.5rem;">Feel free to reply if you want to say hello.</p>
      <p style="color:#475569;font-size:0.925rem;line-height:1.6;margin:0.75rem 0 0;">Erik</p>
      ${FOOTER}
    `)
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
  return data;
}

/**
 * Send a waitlist welcome email (light theme, personal). Sent after confirmation.
 */
async function sendWaitlistWelcome({ to }) {
  const { data, error } = await getClient().emails.send({
    from: 'Signal <erik@habitualos.com>',
    replyTo: 'erik@habitualos.com',
    to,
    subject: "You're on the Signal Waitlist",
    text: `Hey Signaler,\n\nThanks for joining the Signal Waitlist!\n\nIf I haven't met you before, I'm Erik. I started Signal because I believe great work should speak for itself. I'm also excited to help make your life easier. I'll reach out to you again again when Signal is ready to support a wider variety of users.\n\nIf you have any questions, ideas, or want to say hello, just hit reply.\n\nWelcome,\nErik\n\n---\nSignal · 114 Cress Road, Santa Cruz, CA 95060, USA\nTo unsubscribe, reply to this email.`,
    html: LIGHT_WRAPPER(`
      <p style="color:#1e293b;font-size:0.925rem;margin:0 0 1.25rem;">Hey Signaler,</p>
      <p style="color:#475569;font-size:0.925rem;line-height:1.6;margin:0 0 1rem;">Thanks for joining the Signal Waitlist!</p>
      <p style="color:#475569;font-size:0.925rem;line-height:1.6;margin:0 0 1rem;">If I haven't met you before, I'm Erik. I started Signal because I believe great work should speak for itself. I'm also excited to help make your life easier. I'll reach out to you again when Signal is ready to support a wider variety of users.</p>
      <p style="color:#475569;font-size:0.925rem;line-height:1.6;margin:0 0 1.5rem;">If you have any questions, ideas, or want to say hello, just hit reply.</p>
      <p style="color:#475569;font-size:0.925rem;line-height:1.6;margin:0.75rem 0 0;">Welcome,<br>Erik</p>
      <p style="color:#94a3b8;font-size:0.75rem;margin:2rem 0 0;border-top:1px solid #e2e8f0;padding-top:1rem;">
        Signal · 114 Cress Road, Santa Cruz, CA 95060, USA<br>
        To unsubscribe, reply to this email and let me know.
      </p>
    `)
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
  return data;
}

/**
 * Send an early-access confirmation email (light theme, personal).
 */
async function sendEarlyAccessWelcome({ to, name, slug, confirmToken }) {
  const firstName = (name || '').split(' ')[0] || null;
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,';
  const confirmUrl = `${SITE_BASE_URL}/early-access/?token=${confirmToken}`;
  const FOOTER = `
    <p style="color:#94a3b8;font-size:0.75rem;margin:2rem 0 0;border-top:1px solid #e2e8f0;padding-top:1rem;">
      Signal · 114 Cress Road, Santa Cruz, CA 95060, USA<br>
      To unsubscribe, reply to this email and let me know.
    </p>
  `;
  const { data, error } = await getClient().emails.send({
    from: 'Signal <erik@habitualos.com>',
    replyTo: 'erik@habitualos.com',
    to,
    subject: "Confirm your Signal",
    text: `${greeting}\n\nThanks for leaving a Signal.${slug ? `\nYour handle: ${slug}` : ''}\n\nConfirm here:\n${confirmUrl}\n\nIf we haven't met, I'm Erik. I started Signal because I think real work should be visible, not flattened into a resume.\n\nIf you're actively using AI in your workflow, I'd be curious to know what you're building.\n\nYou can just reply here.\n\nErik\n\n---\nSignal · 114 Cress Road, Santa Cruz, CA 95060, USA\nTo unsubscribe, reply to this email.`,
    html: LIGHT_WRAPPER(`
      <p style="color:#1e293b;font-size:0.925rem;margin:0 0 1.25rem;">${greeting}</p>
      <p style="color:#475569;font-size:0.925rem;line-height:1.6;margin:0 0 1.25rem;">Thanks for leaving a Signal.${slug ? `<br>Your handle: <span style="color:#7c3aed;font-weight:600;">${slug}</span>` : ''}</p>
      <a href="${confirmUrl}" style="display:inline-block;margin:0 0 1.25rem;padding:0.7rem 1.5rem;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:0.925rem;">Confirm Your Signal</a>
      <p style="color:#475569;font-size:0.925rem;line-height:1.6;margin:0 0 1rem;">If we haven't met, I'm Erik. I started Signal because I think real work should be visible, not flattened into a resume.</p>
      <p style="color:#475569;font-size:0.925rem;line-height:1.6;margin:0 0 1rem;">If you're actively using AI in your workflow, I’d be curious what you’re building.</p>
      <p style="color:#475569;font-size:0.925rem;line-height:1.6;margin:0 0 1.5rem;">You can just reply here.</p>
      <p style="color:#475569;font-size:0.925rem;line-height:1.6;margin:0.75rem 0 0;">Erik</p>
      ${FOOTER}
    `)
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
  return data;
}

module.exports = { sendVerificationCode, sendWelcome, sendWaitlistWelcome, sendWaitlistConfirm, sendEarlyAccessWelcome };
