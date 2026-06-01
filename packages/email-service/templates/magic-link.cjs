const { render: baseRender, renderButton } = require('./base.cjs');

function render({ appName, verifyUrl, primaryColor, buttonColor = primaryColor }) {
  const content = `
    <p style="font-size: 0.875rem; color: rgba(156,163,175,0.65); margin: 0 0 1.75rem;">Your sign-in link</p>

    <p style="font-size: 0.9375rem; color: rgba(229,227,245,0.75); margin: 0 0 1.75rem; line-height: 1.6;">Click the button below to sign in. This link expires in 15 minutes and can only be used once.</p>

    ${renderButton(verifyUrl, 'sign in', buttonColor)}

    <p style="font-size: 0.8125rem; color: rgba(156,163,175,0.45); margin: 1.75rem 0 0; line-height: 1.5;">If you didn't request this link, you can safely ignore this email.</p>
  `;

  return {
    subject: `Your sign-in link for ${appName}`,
    text: `Sign in to practice.\n\nClick this link to sign in (expires in 15 minutes):\n\n${verifyUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
    html: baseRender({ appName, content }),
  };
}

module.exports = { render };
