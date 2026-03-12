/**
 * signal-embed.js
 * Drop-in embed script for Signal widgets.
 *
 * Usage:
 *   <script src="https://signal.habitualos.com/assets/js/signal-embed.js"
 *           data-signal-id="your-signal-id"></script>
 *
 * Creates a floating "Signal" button in the bottom-right corner.
 * On click: opens an iframe modal with the Signal widget.
 */

(function () {
  const BASE_URL = 'https://signal.habitualos.com';

  // Read signalId from the script tag that loaded this file
  const scriptTag = document.currentScript
    || Array.from(document.querySelectorAll('script[data-signal-id]')).pop();

  const signalId = scriptTag ? scriptTag.getAttribute('data-signal-id') : null;
  if (!signalId) return;

  const widgetUrl = `${BASE_URL}/widget/?id=${encodeURIComponent(signalId)}&embed=1`;

  // ─── Styles ────────────────────────────────────────────────────────────────

  const css = `
    #signal-embed-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9998;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      background: #6366f1;
      color: #fff;
      border: none;
      border-radius: 24px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(99,102,241,0.4);
      transition: opacity 0.15s, transform 0.15s;
    }
    #signal-embed-btn:hover { opacity: 0.9; transform: translateY(-1px); }
    #signal-embed-btn:active { transform: translateY(0); }

    #signal-embed-overlay {
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }

    #signal-embed-modal {
      position: relative;
      width: 100%;
      max-width: 960px;
      height: 90vh;
      max-height: 700px;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 24px 80px rgba(0,0,0,0.5);
    }

    #signal-embed-iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }

    #signal-embed-close {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(255,255,255,0.1);
      border: none;
      color: #fff;
      font-size: 18px;
      line-height: 1;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
      z-index: 1;
    }
    #signal-embed-close:hover { background: rgba(255,255,255,0.2); }

    @media (max-width: 600px) {
      #signal-embed-modal { height: 100vh; max-height: none; border-radius: 0; }
      #signal-embed-overlay { padding: 0; }
    }
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ─── Floating button ───────────────────────────────────────────────────────

  const btn = document.createElement('button');
  btn.id = 'signal-embed-btn';
  btn.setAttribute('aria-label', 'Open Signal widget');
  btn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" fill="currentColor"/>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"
        stroke="currentColor" stroke-width="2" fill="none"/>
    </svg>
    Get Fit Score
  `;

  // ─── Modal overlay ────────────────────────────────────────────────────────

  let overlay = null;

  function openModal() {
    overlay = document.createElement('div');
    overlay.id = 'signal-embed-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Signal widget');

    const modal = document.createElement('div');
    modal.id = 'signal-embed-modal';

    const closeBtn = document.createElement('button');
    closeBtn.id = 'signal-embed-close';
    closeBtn.setAttribute('aria-label', 'Close Signal widget');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', closeModal);

    const iframe = document.createElement('iframe');
    iframe.id = 'signal-embed-iframe';
    iframe.src = widgetUrl;
    iframe.title = 'Signal';
    iframe.allow = 'clipboard-write';

    modal.appendChild(closeBtn);
    modal.appendChild(iframe);
    overlay.appendChild(modal);

    // Close on backdrop click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    // Close on Escape
    document.addEventListener('keydown', onKeydown);

    document.body.appendChild(overlay);
    btn.setAttribute('aria-expanded', 'true');
  }

  function closeModal() {
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
    document.removeEventListener('keydown', onKeydown);
    btn.setAttribute('aria-expanded', 'false');
  }

  function onKeydown(e) {
    if (e.key === 'Escape') closeModal();
  }

  btn.setAttribute('aria-expanded', 'false');
  btn.addEventListener('click', () => {
    overlay ? closeModal() : openModal();
  });

  document.body.appendChild(btn);
})();
