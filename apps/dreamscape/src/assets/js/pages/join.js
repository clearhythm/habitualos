import { log } from '../utils/log.js';
import { startSignupFlow, show } from './signup.js';

function getSlug() {
  const parts = window.location.pathname.replace(/\/$/, '').split('/');
  return parts[parts.length - 1] || '';
}

async function init() {
  const slug = getSlug();
  if (!slug) { show('step-error'); return; }

  try {
    const res  = await fetch(`/api/slug-lookup?slug=${encodeURIComponent(slug)}`);
    const data = await res.json();
    if (!res.ok || !data.userId) { show('step-error'); return; }
    startSignupFlow({ sharerName: data.name, connectUserId: data.userId, connectName: data.name });
  } catch (err) {
    log('warn', '[join] slug lookup failed:', err);
    show('step-error');
  }
}

init();
