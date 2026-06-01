function renderButton(url, label, color) {
  return `
    <style>.email-btn:hover, .email-btn:active { border-color: rgba(255,255,255,0.85) !important; }</style>
    <a href="${url}" class="email-btn"
       style="display: inline-block; padding: 0.6em 2.6em 0.8em; background: transparent; color: ${color}; text-decoration: none; border-radius: 999px; border: 1px solid rgba(255,255,255,0.65); font-family: 'Cormorant Garamond', Georgia, 'Times New Roman', serif; font-size: 1rem; font-weight: 400; letter-spacing: 0.08em;">
      ${label}
    </a>
  `;
}

function render({ appName, content, address = '114 Cress Road, Santa Cruz, CA 95060, USA' }) {
  return `
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&display=swap" rel="stylesheet">
    <div style="background: #0d0c1a; padding: 3rem 1.5rem; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      <div style="max-width: 440px; margin: 0 auto;">

        <div style="text-align: center; margin-bottom: 2rem;">
          <svg width="40" height="57" viewBox="0 0 56 80" aria-hidden="true" style="display:inline-block;">
            <circle cx="28" cy="3" r="2.5" fill="#e5e3f5" fill-opacity="0.45"/>
            <line x1="5" y1="10" x2="51" y2="10" stroke="#e5e3f5" stroke-opacity="0.40" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="10" y1="10" x2="10" y2="24" stroke="#e5e3f5" stroke-opacity="0.25" stroke-width="0.8"/>
            <line x1="20" y1="10" x2="20" y2="18" stroke="#e5e3f5" stroke-opacity="0.25" stroke-width="0.8"/>
            <line x1="30" y1="10" x2="30" y2="22" stroke="#e5e3f5" stroke-opacity="0.25" stroke-width="0.8"/>
            <line x1="40" y1="10" x2="40" y2="16" stroke="#e5e3f5" stroke-opacity="0.25" stroke-width="0.8"/>
            <line x1="50" y1="10" x2="50" y2="20" stroke="#e5e3f5" stroke-opacity="0.25" stroke-width="0.8"/>
            <rect x="8"  y="24" width="4" height="22" rx="2" fill="#e5e3f5" fill-opacity="0.52"/>
            <rect x="18" y="18" width="4" height="16" rx="2" fill="#e5e3f5" fill-opacity="0.45"/>
            <rect x="28" y="22" width="4" height="30" rx="2" fill="#e5e3f5" fill-opacity="0.60"/>
            <rect x="38" y="16" width="4" height="18" rx="2" fill="#e5e3f5" fill-opacity="0.45"/>
            <rect x="48" y="20" width="4" height="24" rx="2" fill="#e5e3f5" fill-opacity="0.50"/>
            <circle cx="28" cy="60" r="3.5" fill="#e5e3f5" fill-opacity="0.35"/>
            <line x1="30" y1="52" x2="28" y2="57" stroke="#e5e3f5" stroke-opacity="0.20" stroke-width="0.8"/>
          </svg>
        </div>

        <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 2rem 1.75rem; text-align: left;">
          <p style="font-family: 'Cormorant Garamond', Georgia, 'Times New Roman', serif; font-size: 1.625rem; font-weight: 300; color: #e5e3f5; margin: 0 0 0.25rem; letter-spacing: 0.02em;">${appName}</p>
          ${content}
        </div>

        <p style="font-size: 0.7rem; color: rgba(156,163,175,0.3); text-align: center; margin: 1.5rem 0 0; line-height: 1.6;">
          ${appName} · ${address}
        </p>

      </div>
    </div>
  `;
}

module.exports = { render, renderButton };
