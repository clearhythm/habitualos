import { log } from '../utils/log.js';
import { getUserId, isSignedIn } from '../auth/auth.js';

const loadingEl = document.getElementById('invite-loading');
const errorEl   = document.getElementById('invite-error');
const contentEl = document.getElementById('invite-content');
const urlEl     = document.getElementById('invite-url');
const copyBtn   = document.getElementById('copy-btn');

async function init() {
  if (!isSignedIn()) {
    window.location.replace('/signin/');
    return;
  }

  const userId = getUserId();

  try {
    const res  = await fetch(`/api/user-profile-get?userId=${encodeURIComponent(userId)}`);
    const data = await res.json();

    if (!res.ok || !data.slug) {
      log('warn', '[invite] no slug in profile:', data);
      loadingEl.hidden = true;
      errorEl.hidden = false;
      return;
    }

    const inviteUrl = `${window.location.origin}/join/${data.slug}`;
    urlEl.textContent = inviteUrl;
    loadingEl.hidden = true;
    contentEl.hidden = false;
  } catch (err) {
    log('warn', '[invite] profile fetch failed:', err);
    loadingEl.hidden = true;
    errorEl.hidden = false;
  }
}

copyBtn?.addEventListener('click', async () => {
  const url = urlEl?.textContent;
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    copyBtn.textContent = 'copied';
    setTimeout(() => { copyBtn.textContent = 'copy link'; }, 2000);
  } catch (_) {
    const range = document.createRange();
    range.selectNode(urlEl);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  }
});

init();
