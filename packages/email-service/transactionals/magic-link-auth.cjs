const { render: baseRender } = require('../templates/base.cjs');

// Generic sign-in magic link email.
// Copy and subject are standard across all apps; app identity comes from theme.
// Returns { subject, text, html }
function render(theme, { verifyUrl }) {
  return {
    subject: `Your sign-in link for ${theme.appName}`,
    text: `Sign in to ${theme.appName}.\n\nClick this link to sign in (expires in 15 minutes):\n\n${verifyUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
    html: baseRender(theme, {
      preheader:  `Click to sign in to ${theme.appName} — this link expires in 15 minutes.`,
      subtitle:   'Your sign-in link',
      body:       `Click the button below to sign in to ${theme.appName}. This link expires in 15 minutes and can only be used once.`,
      button:     { url: verifyUrl, label: 'sign in' },
      disclaimer: "If you didn't request this link, you can safely ignore this email.",
    }),
  };
}

module.exports = { render };
