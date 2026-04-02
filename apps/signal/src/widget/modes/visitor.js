// modes/visitor.js — visitor mode: fits the visitor against the owner's Signal profile

import { getVisitorId } from '../core/storage.js';
import { appendMessage } from '../core/messages.js';

const STARTER_QUESTIONS = [
  'What kind of work have you been doing lately?',
  'How do you handle ambiguity?',
  'What would you be like to work with?',
  'What\'s your strongest technical area?',
  'Paste a job description and I\'ll score the fit.',
];

const FALLBACK_CONFIG = (signalId) => ({
  signalId,
  displayName: '',
  avatarUrl: null,
  contactLinks: {},
});

export async function init(state, els, baseUrl) {
  state.userId = getVisitorId();
  els.personaWrap.hidden = true;

  // Fetch config + context-status in parallel
  const [configResult, statusResult] = await Promise.allSettled([
    fetch(`${baseUrl}/api/signal-config-get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signalId: state.signalId }),
    }).then((r) => r.json()),
    fetch(`${baseUrl}/api/signal-context-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signalId: state.signalId }),
    }).then((r) => r.json()),
  ]);

  const config =
    configResult.status === 'fulfilled' && configResult.value.success
      ? configResult.value.config
      : FALLBACK_CONFIG(state.signalId);
  state.ownerConfig = config;

  const statusVal = statusResult.status === 'fulfilled' ? statusResult.value : null;
  const total = statusVal?.success ? statusVal.stats?.total : null;

  // Populate left panel
  const name = config.displayName || state.signalId || 'Signal';
  const firstName = name.split(' ')[0];

  if (els.agentName) els.agentName.textContent = `${firstName}'s Signal`;

  const avatarSrc = config.avatarUrl || config.agentAvatarUrl || `${baseUrl}/assets/images/signal-agent_clean.png`;
  if (els.avatarImg) {
    els.avatarImg.src = avatarSrc;
    els.avatarImg.style.visibility = '';
  }

  // Mobile profile header
  if (els.mobileAgentName) els.mobileAgentName.textContent = `${firstName}'s Signal`;
  if (els.mobileAvatarImg) {
    els.mobileAvatarImg.src = avatarSrc;
    els.mobileAvatarImg.style.visibility = '';
  }

  if (els.credsIntro) {
    els.credsIntro.textContent = `I trained an agent on my work, style, and personality, so you can have a realistic conversation with me. I made this to help you assess my fit for any project or job listing. It can read from my:`;
  }

  if (els.credsList) {
    const items = [];
    if (total) items.push(`${total} Claude Code sessions`);
    items.push(`<a href="https://github.com/clearhythm" target="_blank" rel="noopener">3 repositories</a>`);
    const lastActive =
      statusVal?.lastUploadAt
        ? (() => {
            const d = new Date(statusVal.lastUploadAt);
            const days = Math.round((Date.now() - d.getTime()) / 86400000);
            const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            return days === 0 ? `today at ${time}` : days === 1 ? 'yesterday' : `${days} days ago`;
          })()
        : null;
    if (lastActive && els.updated) els.updated.textContent = `Last updated ${lastActive}`;
    els.credsList.innerHTML = items.map((t) => `<li>${t}</li>`).join('');
  }

  if (els.contact && config.contactLinks) {
    const { calendar, linkedin } = config.contactLinks;
    if (calendar) {
      els.contact.innerHTML = `<a href="${calendar}" target="_blank" rel="noopener" class="btn btn-outline">Book a call →</a>`;
    } else if (linkedin) {
      els.contact.innerHTML = `<a href="${linkedin}" target="_blank" rel="noopener" class="btn btn-outline">Connect on LinkedIn →</a>`;
    }
  }

  // Reveal profile, hide skeleton
  if (els.profileSkeleton) els.profileSkeleton.hidden = true;
  if (els.profileContent) els.profileContent.hidden = false;
  if (els.mobileProfileHeader) els.mobileProfileHeader.classList.add('is-loaded');

  state.currentPersona = 'colleague';
  // Seed greeting into history for API context (not rendered — intro UI replaces it)
  state.chatHistory.push({ role: 'assistant', content: 'Hey! Ask me anything about my work, or paste a job description and I\'ll tell you how I\'d fit.' });

  els.input.disabled = false;
  els.sendBtn.disabled = false;
  els.input.placeholder = 'Ask me anything…';

  // Pre-chat intro with starter chips
  if (els.messages) {
    const introEl = document.createElement('div');
    introEl.className = 'chat-intro';
    introEl.innerHTML = `
      <p class="chat-intro-heading">🎙️ Interview Me</p>
      <p class="chat-intro-sub">Here are some questions to get you started.</p>
      <div class="starter-chips">${STARTER_QUESTIONS.map(
        (q) => `<button type="button" class="starter-chip">${q}</button>`
      ).join('')}</div>
    `;
    els.messages.appendChild(introEl);

    introEl.addEventListener('click', (e) => {
      const chip = e.target.closest('.starter-chip');
      if (!chip) return;
      els.input.value = chip.textContent;
      els.input.dispatchEvent(new Event('input'));
      els.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
  }
}

export function buildPayload(state, text) {
  return {
    userId: state.userId,
    chatType: 'signal-visitor',
    signalId: state.signalId,
    persona: state.currentPersona,
    message: text,
    chatHistory: state.chatHistory.slice(0, -1),
  };
}

