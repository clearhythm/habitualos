// Signal email theme — dark variant used for transactional auth emails.
// The existing _services/email.cjs handles all current send functions;
// migrate them here one by one as needed.
module.exports = {
  appName:   'Signal',
  address:   '114 Cress Road, Santa Cruz, CA 95060, USA',
  fromEmail: 'Signal <noreply@signal.habitualos.com>',

  primaryFont: {
    url:    null,
    family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  secondaryFont: {
    url:    null,
    family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  bg:                '#0f172a',
  cardBg:            '#1e293b',
  cardBorder:        'rgba(255,255,255,0.06)',
  cardBorderRadius:  '12px',
  titleColor:        '#f9fafb',
  subtitleColor:     '#9ca3af',
  bodyColor:         '#9ca3af',
  disclaimerColor:   '#6b7280',
  footerColor:       '#4b5563',

  button: {
    color:            '#ffffff',
    bgColor:          '#7c3aed',
    borderColor:      '#7c3aed',
    hoverBorderColor: '#6d28d9',
    borderRadius:     '8px',
    fontStack:        "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  logoHtml: null,
};
