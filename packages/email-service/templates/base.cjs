// Structural HTML email renderer — no hard-coded styles or branding.
// All visual identity comes from the `theme` object; all content from `slots`.

function buildPreheaderHtml(text) {
  const spacer = '&#8199;&#847; '.repeat(60) + '&shy; '.repeat(80) + '&nbsp;';
  return `
    <div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;max-height:0;max-width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;">${text}</div>
    <div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;max-height:0;max-width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;">${spacer}</div>
  `;
}

// theme shape:
// {
//   appName:        string
//   address:        string
//   primaryFont:    { url: string|null, family: string }   body/UI text
//   secondaryFont:  { url: string|null, family: string }   titles, buttons, display
//   bg:             string   outer background
//   cardBg:         string
//   cardBorder:     string
//   cardBorderRadius: string
//   titleColor:     string
//   subtitleColor:  string
//   bodyColor:      string
//   disclaimerColor: string
//   footerColor:    string
//   logoHtml:       string|null   raw HTML (inline SVG or <img>)
//   button: { color, bgColor, borderColor, borderRadius, fontStack }
// }

// slots shape:
// {
//   preheader:   string|null
//   subtitle:    string|null
//   body:        string|null   plain text (no HTML tags)
//   button:      { url, label } | null   visual props come from theme.button
//   disclaimer:  string|null
// }

function render(theme, slots = {}) {
  const { preheader, subtitle, body, button, disclaimer } = slots;

  const fontLinks = [theme.primaryFont, theme.secondaryFont]
    .filter((f, i, arr) => f?.url && arr.findIndex(x => x?.url === f.url) === i)
    .map(f => `<link href="${f.url}" rel="stylesheet">`)
    .join('\n    ');

  const preheaderHtml  = preheader  ? buildPreheaderHtml(preheader) : '';
  const logoHtml       = theme.logoHtml ? `<div style="text-align:center;margin-bottom:2rem;">${theme.logoHtml}</div>` : '';
  const subtitleHtml   = subtitle   ? `<p style="font-size:0.875rem;color:${theme.subtitleColor};margin:0 0 1.75rem;font-family:${theme.primaryFont.family};">${subtitle}</p>` : '';
  const bodyHtml       = body       ? `<p style="font-size:0.9375rem;color:${theme.bodyColor};margin:0 0 1.75rem;line-height:1.6;font-family:${theme.primaryFont.family};">${body}</p>` : '';
  const disclaimerHtml = disclaimer ? `<p style="font-size:0.8125rem;color:${theme.disclaimerColor};margin:1.75rem 0 0;line-height:1.5;font-family:${theme.primaryFont.family};">${disclaimer}</p>` : '';

  const buttonHtml = button ? `
    <style>.email-btn:hover,.email-btn:active{border-color:${theme.button.hoverBorderColor || theme.button.borderColor}!important;}</style>
    <a href="${button.url}" class="email-btn" style="display:inline-block;padding:0.6em 2.6em 0.8em;background:${theme.button.bgColor};color:${theme.button.color};text-decoration:none;border-radius:${theme.button.borderRadius};border:1px solid ${theme.button.borderColor};font-family:${theme.button.fontStack};font-size:1rem;font-weight:400;letter-spacing:0.08em;">${button.label}</a>
  ` : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  ${fontLinks}
</head>
<body style="margin:0;padding:0;background:${theme.bg};">
  ${preheaderHtml}
  <div style="background:${theme.bg};padding:3rem 1.5rem;font-family:${theme.primaryFont.family};">
    <div style="max-width:440px;margin:0 auto;">
      ${logoHtml}
      <div style="background:${theme.cardBg};border:1px solid ${theme.cardBorder};border-radius:${theme.cardBorderRadius};padding:2rem 1.75rem;text-align:left;">
        <p style="font-family:${theme.secondaryFont.family};font-size:1.625rem;font-weight:300;color:${theme.titleColor};margin:0 0 0.25rem;letter-spacing:0.02em;">${theme.appName}</p>
        ${subtitleHtml}
        ${bodyHtml}
        ${buttonHtml}
        ${disclaimerHtml}
      </div>
      <p style="font-size:0.7rem;color:${theme.footerColor};text-align:center;margin:1.5rem 0 0;line-height:1.6;font-family:${theme.primaryFont.family};">
        ${theme.appName} · ${theme.address}
      </p>
    </div>
  </div>
</body>
</html>`;
}

module.exports = { render };
