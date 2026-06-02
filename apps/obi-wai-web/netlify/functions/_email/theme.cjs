module.exports = {
  appName:   'Daily Practice',
  address:   '114 Cress Road, Santa Cruz, CA 95060, USA',
  fromEmail: process.env.RESEND_FROM_EMAIL || 'Daily Practice <hello@habitualos.com>',

  primaryFont: {
    url:    null,
    family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  secondaryFont: {
    url:    null,
    family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  bg:                '#0d1a0d',
  cardBg:            'rgba(255,255,255,0.04)',
  cardBorder:        'rgba(255,255,255,0.10)',
  cardBorderRadius:  '12px',
  titleColor:        '#f0fdf4',
  subtitleColor:     'rgba(156,163,175,0.70)',
  bodyColor:         'rgba(209,250,229,0.80)',
  disclaimerColor:   'rgba(156,163,175,0.50)',
  footerColor:       'rgba(156,163,175,0.35)',

  button: {
    color:            '#ffffff',
    bgColor:          '#3a7a10',
    borderColor:      '#3a7a10',
    hoverBorderColor: '#4d9618',
    borderRadius:     '8px',
    fontStack:        "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  logoHtml: null,
};
