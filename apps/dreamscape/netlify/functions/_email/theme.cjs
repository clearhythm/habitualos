module.exports = {
  appName:   'Daily Practice',
  address:   '114 Cress Road, Santa Cruz, CA 95060, USA',
  fromEmail: process.env.RESEND_FROM_EMAIL || 'Daily Practice <hello@habitualos.com>',

  primaryFont: {
    url:    null,
    family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  secondaryFont: {
    url:    'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&display=swap',
    family: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
  },

  bg:                '#0d0c1a',
  cardBg:            'rgba(255,255,255,0.04)',
  cardBorder:        'rgba(255,255,255,0.08)',
  cardBorderRadius:  '16px',
  titleColor:        '#e5e3f5',
  subtitleColor:     'rgba(156,163,175,0.65)',
  bodyColor:         'rgba(229,227,245,0.75)',
  disclaimerColor:   'rgba(156,163,175,0.45)',
  footerColor:       'rgba(156,163,175,0.3)',

  button: {
    color:            '#ffffff',
    bgColor:          'transparent',
    borderColor:      'rgba(255,255,255,0.65)',
    hoverBorderColor: 'rgba(255,255,255,0.85)',
    borderRadius:     '999px',
    fontStack:        "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
  },

  // Wind chime — base64 PNG renders in all email clients (SVGs are stripped)
  logoHtml: `<img src="https://daily.habitualos.com/assets/images/wind-chime-gray.png" width="40" height="57" alt="" style="display:block;border:0;margin:0 auto;">`,
};
