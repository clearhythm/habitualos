module.exports = {
  appName:   'Daily Practice',
  address:   '114 Cress Road, Santa Cruz, CA 95060, USA',
  fromEmail: 'Daily Practice <noreply@daily.habitualos.com>',

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
  logoHtml: `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADgAAABQCAYAAABMIbYpAAAACXBIWXMAAA7DAAAOwwHHb6hkAAAAGXRFWHRTb2Z0d2FyZQB3d3cuaW5rc2NhcGUub3Jnm+48GgAAAn9JREFUeJztm8Fq1FAUQM91BBWmHaug4kbpwnGhu36C7gbsXv0hF36AW/sBlrrrJ9ilm1FQ3EgVtMZqQXC4LvJk0ti06fjefXnhHRi4kxdyc3LfTdNMIqqKBSJyDhi7r1NV/WWS10LQyT0GRm5RATy3kDwTOoHjNnM5XDxuWNcrVoJHTROT3rASnFJOy798A95YJDbpQej5SSYmVlM0Gr0XPFtfICJ3gBsR9sUHH1T1dXVB2wpecp/k1mt1khGR6wCq+jG19Xrfg1kwdXov+M+fia4gIqvAfUBFZFtV3y+ynS5X8B4wBJYoRRfCWwV9HfEKSw3xqfBZQS9H3Dc+e9DLET8tInILmLh4S1XfVse73INtmQDL7jOpD5qfRUXkLvCIslc36hfHC7BciUf1wRgVfAhcBFYoRYNyYgVFZAysUx7xTVWd/mfOlYY4CG0q+IByGoxcnBRtBOv3M5OiD2fRY8mCqZMFU8en4H5DHHV7PgW33Y7su7gT2/N2Ler+/3vWte3lHkydLJg6WTB1smACfK/ERX2wD4JblJIF8LI+2OZKpuDwI1idwt0Hfdo03qaCm5RiBfDC036ZcWIF3V20Jwb7EoQ+9OCxZMHUiSG41xAHIYbgBuXjlHsuDkqUpw1F5CbwWVUPQucyr6CIDIALFnIQZ4peBr5YJYsl+NUqmZmgiAzdr7tXgPNmeY3em1gF1oABIMBvYEdV34XOHbyCIjJkLgfl6wQDYM2NBcViil5jLldlAFwNnTxfqnlgF5gdsXwGfAqdPLigqv4AdjgsOQNeubGgWL75MmTec7uq+tMkb37zJXGyYOpkwdTJgqmTBVMnC6ZOFkydLJg6fwAlnb9nuDJTKgAAAABJRU5ErkJggg==" width="56" height="80" alt="" style="display:block;border:0;">`,
};
