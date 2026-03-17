/**
 * Signal Embed Widget
 * Drop-in JS snippet for embedding Signal on any site.
 *
 * Usage:
 *   <script src="https://signal.habitualos.com/assets/js/embed.js"
 *           data-signal-id="your-signal-id" defer></script>
 *   <button onclick="Signal.open()">View My Signal</button>
 *
 * Owner commands (typed in chat):
 *   /signin  — start email auth flow
 *   /signout — end owner session
 */
(function () {
  'use strict';

  const script = document.currentScript;
  const SIGNAL_ID = (script && script.getAttribute('data-signal-id')) || 'erik-burns';
  const BASE_URL = script ? new URL(script.src).origin : 'https://signal.habitualos.com';

  const VISITOR_KEY = 'signal_visitor_id';
  const OWNER_SESSION_KEY = `signal_owner_${SIGNAL_ID}`;
  const CHAT_HISTORY_KEY = `signal_chat_${SIGNAL_ID}`;
  const CHAT_ID_KEY = `signal_chatid_${SIGNAL_ID}`;
  const SESSION_TTL = 30 * 24 * 60 * 60 * 1000;
  const RING_CIRCUMFERENCE = 2 * Math.PI * 52;

  // ── Storage helpers ────────────────────────────────────────────────────────

  function getVisitorId() {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = 'v-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  }

  function getOwnerSession() {
    try {
      const raw = localStorage.getItem(OWNER_SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (Date.now() - s.authedAt > SESSION_TTL) { localStorage.removeItem(OWNER_SESSION_KEY); return null; }
      return s;
    } catch { return null; }
  }

  function setOwnerSession(userId, signalId) {
    localStorage.setItem(OWNER_SESSION_KEY, JSON.stringify({ userId, signalId, authedAt: Date.now() }));
  }

  function clearOwnerSession() {
    localStorage.removeItem(OWNER_SESSION_KEY);
  }

  // ── State ──────────────────────────────────────────────────────────────────

  let isOpen = false;
  let isStreaming = false;
  let chatHistory = [];
  let chatId = null;
  let currentPersona = null;
  let turnCount = 0;
  let lastScore = null;
  let leadSubmitted = false;
  let ownerConfig = null;
  let ownerSession = null;
  let authState = null;   // null | 'awaiting_email' | 'awaiting_code'
  let authEmail = null;
  let scoreCollapsed = false;

  // ── CSS injection ──────────────────────────────────────────────────────────

  function injectStyles() {
    const style = document.createElement('style');
    style.id = 'signal-embed-styles';
    style.textContent = `
.se-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:999999;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif}
.se-overlay.is-open{display:flex}
.se-modal{background:#0f172a;border:1px solid rgba(196,181,253,.2);border-radius:16px;width:900px;max-width:calc(100vw - 32px);height:600px;max-height:calc(100vh - 32px);display:flex;flex-direction:column;overflow:hidden;position:relative}
.se-header{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0}
.se-logo{height:22px;width:auto}
.se-close{background:none;border:none;color:#fff;font-size:20px;cursor:pointer;line-height:1;padding:4px 8px;opacity:.6;transition:opacity .15s}
.se-close:hover{opacity:1}
.se-body{display:flex;flex:1;overflow:hidden}
.se-score{width:240px;flex-shrink:0;border-right:1px solid rgba(255,255,255,.06);padding:20px 16px;display:flex;flex-direction:column;align-items:center;gap:14px;overflow-y:auto}
.se-ring-wrap{position:relative;width:120px;height:120px;opacity:0;transform:scale(.8);transition:opacity .4s,transform .4s}
.se-ring-wrap.is-visible{opacity:1;transform:scale(1)}
.se-ring-wrap.is-pulsing{animation:se-pulse .5s ease}
@keyframes se-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
.se-ring-svg{width:120px;height:120px}
.se-score-num{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:700;color:#fff}
.se-dims{width:100%;display:flex;flex-direction:column;gap:8px}
.se-dim-row{display:flex;flex-direction:column;gap:3px}
.se-dim-label{display:flex;justify-content:space-between;font-size:11px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.05em}
.se-dim-track{height:4px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden}
.se-dim-fill{height:100%;width:0;border-radius:2px;transition:width .8s ease}
.se-dim-fill--skills{background:#059669}
.se-dim-fill--alignment{background:rgba(5,150,105,.65)}
.se-dim-fill--personality{background:rgba(5,150,105,.35)}
.se-confidence{width:100%}
.se-conf-label{font-size:10px;color:rgba(255,255,255,.4);margin-bottom:3px;display:flex;justify-content:space-between}
.se-conf-track{height:3px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden}
.se-conf-fill{height:100%;width:0;background:rgba(196,181,253,.5);border-radius:2px;transition:width .6s ease}
.se-reason{font-size:11px;color:rgba(255,255,255,.4);line-height:1.5;text-align:center;display:none}
.se-reason.visible{display:block}
.se-score-bar{display:none;align-items:center;gap:10px;padding:8px 16px;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0}
.se-score-bar-num{font-size:20px;font-weight:700;color:#c4b5fd}
.se-score-bar-label{font-size:12px;color:rgba(255,255,255,.45)}
.se-chat{flex:1;display:flex;flex-direction:column;overflow:hidden}
.se-persona-wrap{padding:20px;display:flex;flex-direction:column;gap:10px}
.se-persona-prompt{font-size:14px;color:rgba(255,255,255,.7)}
.se-persona-btns{display:flex;flex-wrap:wrap;gap:8px}
.se-persona-btn{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#fff;padding:8px 14px;border-radius:20px;cursor:pointer;font-size:13px;transition:background .2s,border-color .2s}
.se-persona-btn:hover{background:rgba(196,181,253,.12);border-color:rgba(196,181,253,.3)}
.se-messages{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:10px}
.se-msg{max-width:85%;padding:10px 14px;border-radius:12px;font-size:14px;line-height:1.5;white-space:pre-wrap}
.se-msg--user{background:rgba(196,181,253,.15);color:#fff;align-self:flex-end;border-radius:12px 12px 2px 12px}
.se-msg--assistant{background:rgba(255,255,255,.05);color:rgba(255,255,255,.9);align-self:flex-start;border-radius:12px 12px 12px 2px}
.se-msg--system{background:rgba(196,181,253,.07);color:rgba(196,181,253,.7);align-self:center;font-size:12px;font-style:italic;border-radius:8px;padding:6px 12px;max-width:100%;text-align:center}
.se-thinking{display:flex;gap:4px;padding:10px 14px;background:rgba(255,255,255,.05);border-radius:12px 12px 12px 2px;align-self:flex-start}
.se-thinking span{width:6px;height:6px;background:rgba(255,255,255,.4);border-radius:50%;animation:se-dot 1.2s infinite}
.se-thinking span:nth-child(2){animation-delay:.2s}
.se-thinking span:nth-child(3){animation-delay:.4s}
@keyframes se-dot{0%,80%,100%{transform:scale(.7);opacity:.4}40%{transform:scale(1);opacity:1}}
.se-input-wrap{display:flex;align-items:flex-end;gap:8px;padding:10px 14px;border-top:1px solid rgba(255,255,255,.06);flex-shrink:0}
.se-input{flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#fff;font-size:14px;padding:9px 12px;resize:none;min-height:38px;max-height:120px;font-family:inherit;line-height:1.4;box-sizing:border-box}
.se-input:focus{outline:none;border-color:rgba(196,181,253,.4)}
.se-input::placeholder{color:rgba(255,255,255,.3)}
.se-input:disabled{opacity:.5}
.se-send{background:#6366f1;color:#fff;border:none;border-radius:8px;padding:9px 16px;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap;transition:background .2s;flex-shrink:0}
.se-send:hover{background:#4f46e5}
.se-send:disabled{background:rgba(99,102,241,.4);cursor:default}
.se-nextstep{padding:10px 14px;border-top:1px solid rgba(255,255,255,.06);background:rgba(196,181,253,.04);flex-shrink:0}
.se-nextstep-label{font-size:13px;color:rgba(255,255,255,.75);margin-bottom:8px}
.se-nextstep-actions{display:flex;flex-wrap:wrap;gap:8px}
.se-nextstep-btn{background:rgba(99,102,241,.18);border:1px solid rgba(99,102,241,.35);color:#c4b5fd;padding:6px 12px;border-radius:6px;text-decoration:none;font-size:12px;cursor:pointer;transition:background .15s}
.se-nextstep-btn:hover{background:rgba(99,102,241,.3)}
.se-lead{padding:10px 14px;border-top:1px solid rgba(255,255,255,.06);flex-shrink:0}
.se-lead input{width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:6px;color:#fff;padding:8px 10px;font-size:13px;margin-bottom:6px;font-family:inherit;box-sizing:border-box}
.se-lead input:focus{outline:none;border-color:rgba(196,181,253,.4)}
.se-lead input::placeholder{color:rgba(255,255,255,.3)}
.se-lead-sent{font-size:12px;color:rgba(255,255,255,.45);padding-top:4px}
@media (max-width:599px){
  .se-overlay{align-items:flex-end}
  .se-modal{width:100%;max-width:100%;height:100%;max-height:100%;border-radius:0;border:none}
  .se-score{display:none}
  .se-score-bar{display:flex}
  .se-body{flex-direction:column}
  .se-chat{flex:1;overflow:hidden;display:flex;flex-direction:column}
  .se-messages{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch}
  .se-input-wrap{position:sticky;bottom:0;background:#0f172a;z-index:1}
}
    `;
    document.head.appendChild(style);
  }

  // ── Modal HTML ─────────────────────────────────────────────────────────────

  function buildModal() {
    const overlay = document.createElement('div');
    overlay.className = 'se-overlay';
    overlay.id = 'signal-embed-overlay';
    overlay.innerHTML = `
<div class="se-modal" id="se-modal">
  <div class="se-header">
    <img class="se-logo" src="${BASE_URL}/assets/img/signal-logo.png" alt="Signal" onerror="this.parentNode.innerHTML='<span style=\\'color:rgba(255,255,255,.6);font-size:13px;font-weight:600;letter-spacing:.05em\\'>SIGNAL</span>'">
    <button class="se-close" id="se-close" aria-label="Close">&#x2715;</button>
  </div>
  <div class="se-score-bar" id="se-score-bar">
    <span class="se-score-bar-num" id="se-score-bar-num">&#x2014;</span>
    <span class="se-score-bar-label" id="se-score-bar-label">Assessing fit&hellip;</span>
  </div>
  <div class="se-body">
    <div class="se-score" id="se-score-panel">
      <div class="se-ring-wrap" id="se-ring-wrap">
        <svg class="se-ring-svg" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="8"/>
          <circle id="se-ring" cx="60" cy="60" r="52" fill="none" stroke="#9d6ef5" stroke-width="8" stroke-linecap="round" transform="rotate(-90 60 60)"/>
        </svg>
        <div class="se-score-num" id="se-score-num">?</div>
      </div>
      <div class="se-dims">
        <div class="se-dim-row">
          <div class="se-dim-label"><span>Skills</span><span id="se-skills-val">&#x2014;</span></div>
          <div class="se-dim-track"><div class="se-dim-fill se-dim-fill--skills" id="se-skills-bar"></div></div>
        </div>
        <div class="se-dim-row">
          <div class="se-dim-label"><span>Alignment</span><span id="se-align-val">&#x2014;</span></div>
          <div class="se-dim-track"><div class="se-dim-fill se-dim-fill--alignment" id="se-align-bar"></div></div>
        </div>
        <div class="se-dim-row">
          <div class="se-dim-label"><span>Personality</span><span id="se-pers-val">&#x2014;</span></div>
          <div class="se-dim-track"><div class="se-dim-fill se-dim-fill--personality" id="se-pers-bar"></div></div>
        </div>
      </div>
      <div class="se-confidence">
        <div class="se-conf-label"><span>Confidence</span><span id="se-conf-pct">0%</span></div>
        <div class="se-conf-track"><div class="se-conf-fill" id="se-conf-bar"></div></div>
      </div>
      <div class="se-reason" id="se-reason"></div>
    </div>
    <div class="se-chat">
      <div class="se-persona-wrap" id="se-persona-wrap">
        <div class="se-persona-prompt" id="se-persona-prompt">I&rsquo;m an AI built on this person&rsquo;s work history. Who are you?</div>
        <div class="se-persona-btns" id="se-persona-btns"></div>
      </div>
      <div class="se-messages" id="se-messages"></div>
      <div class="se-nextstep" id="se-nextstep" style="display:none">
        <div class="se-nextstep-label" id="se-nextstep-label"></div>
        <div class="se-nextstep-actions" id="se-nextstep-actions"></div>
      </div>
      <div class="se-lead" id="se-lead" style="display:none">
        <input type="text" id="se-lead-name" placeholder="Your name (optional)">
        <input type="email" id="se-lead-email" placeholder="Your email to connect">
        <button class="se-send" id="se-lead-submit">Send &#x2192;</button>
        <div class="se-lead-sent" id="se-lead-sent" style="display:none">Got it &mdash; you&rsquo;ll hear back soon.</div>
      </div>
      <div class="se-input-wrap">
        <textarea class="se-input" id="se-input" placeholder="Type a message&hellip;" rows="1" disabled></textarea>
        <button class="se-send" id="se-send" disabled>Send</button>
      </div>
    </div>
  </div>
</div>`;
    return overlay;
  }

  // ── DOM refs ───────────────────────────────────────────────────────────────

  let els = {};

  function bindEls() {
    const ids = ['overlay','close','score-bar','score-bar-num','score-bar-label',
      'ring-wrap','ring','score-num','skills-bar','align-bar','pers-bar',
      'skills-val','align-val','pers-val','conf-bar','conf-pct','reason',
      'persona-wrap','persona-prompt','persona-btns','messages',
      'nextstep','nextstep-label','nextstep-actions',
      'lead','lead-name','lead-email','lead-submit','lead-sent','input','send'];
    ids.forEach(id => {
      const key = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      els[key] = document.getElementById('se-' + id);
    });
    els.overlay = document.getElementById('signal-embed-overlay');
  }

  function initRing() {
    if (!els.ring) return;
    els.ring.style.strokeDasharray = RING_CIRCUMFERENCE;
    els.ring.style.strokeDashoffset = RING_CIRCUMFERENCE;
  }

  // ── Message helpers ────────────────────────────────────────────────────────

  function appendMessage(role, text) {
    const el = document.createElement('div');
    el.className = 'se-msg se-msg--' + role;
    el.textContent = text;
    els.messages.appendChild(el);
    els.messages.scrollTop = els.messages.scrollHeight;
    return el;
  }

  function showThinking() {
    const el = document.createElement('div');
    el.className = 'se-thinking'; el.id = 'se-thinking';
    el.innerHTML = '<span></span><span></span><span></span>';
    els.messages.appendChild(el);
    els.messages.scrollTop = els.messages.scrollHeight;
  }

  function removeThinking() { document.getElementById('se-thinking')?.remove(); }

  // ── Score panel ────────────────────────────────────────────────────────────

  function updateScore(data) {
    const { skills, alignment, personality, overall, confidence, reason, nextStep, nextStepLabel: label } = data;
    lastScore = data;

    const rw = els.ringWrap;
    if (rw) {
      if (!rw.classList.contains('is-visible')) {
        rw.classList.add('is-visible');
      } else {
        rw.classList.add('is-pulsing');
        rw.addEventListener('animationend', () => rw.classList.remove('is-pulsing'), { once: true });
      }
    }

    const pct = v => ((v / 10) * 100) + '%';
    if (els.skillsBar) els.skillsBar.style.width = pct(skills);
    if (els.alignBar) els.alignBar.style.width = pct(alignment);
    if (els.persBar) els.persBar.style.width = pct(personality);
    if (els.skillsVal) els.skillsVal.textContent = skills;
    if (els.alignVal) els.alignVal.textContent = alignment;
    if (els.persVal) els.persVal.textContent = personality;

    const offset = RING_CIRCUMFERENCE - (overall / 10) * RING_CIRCUMFERENCE;
    if (els.ring) els.ring.style.strokeDashoffset = offset;
    if (els.scoreNum) els.scoreNum.textContent = overall;

    if (els.confBar) els.confBar.style.width = Math.round(confidence * 100) + '%';
    if (els.confPct) els.confPct.textContent = Math.round(confidence * 100) + '%';

    if (els.scoreBbarNum) els.scoreBbarNum.textContent = overall;
    if (els.scoreBarNum) els.scoreBarNum.textContent = overall;
    if (els.scoreBarLabel) els.scoreBarLabel.textContent = Math.round(confidence * 100) + '% confidence';

    if (reason && confidence >= 0.4 && els.reason) {
      els.reason.textContent = reason;
      els.reason.classList.add('visible');
    }

    if (nextStep && label && confidence >= 0.65 && turnCount >= 4) {
      renderNextStep(nextStep, label);
    }
  }

  function renderNextStep(step, label) {
    if (!els.nextstep) return;
    if (els.nextstepLabel) els.nextstepLabel.textContent = label;
    const links = ownerConfig && ownerConfig.contactLinks ? ownerConfig.contactLinks : {};
    if (els.nextstepActions) els.nextstepActions.innerHTML = '';

    if ((step === 'schedule' || step === 'connect') && links.calendar) {
      const a = document.createElement('a');
      a.href = links.calendar; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.className = 'se-nextstep-btn'; a.textContent = 'Book time →';
      els.nextstepActions.appendChild(a);
    }
    if (links.linkedin) {
      const a = document.createElement('a');
      a.href = links.linkedin; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.className = 'se-nextstep-btn'; a.textContent = 'LinkedIn →';
      els.nextstepActions.appendChild(a);
    }
    els.nextstep.style.display = '';
    if ((step === 'schedule' || step === 'connect') && els.lead && !leadSubmitted) {
      els.lead.style.display = '';
    }
  }

  // ── Persona ────────────────────────────────────────────────────────────────

  function renderPersonaButtons(personas) {
    if (!els.personaBtns) return;
    els.personaBtns.innerHTML = '';
    (personas || []).forEach(function (p) {
      const btn = document.createElement('button');
      btn.className = 'se-persona-btn';
      btn.textContent = p.label;
      btn.addEventListener('click', function () { selectPersona(p.key); });
      els.personaBtns.appendChild(btn);
    });
  }

  async function selectPersona(persona) {
    currentPersona = persona;
    if (els.personaWrap) els.personaWrap.style.display = 'none';
    enableInput();
    const userId = ownerSession ? ownerSession.userId : getVisitorId();
    try {
      const res = await fetch(BASE_URL + '/api/signal-chat-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId, signalId: SIGNAL_ID, persona: persona })
      });
      const data = await res.json();
      if (data.opener) {
        chatHistory.push({ role: 'assistant', content: data.opener });
        appendMessage('assistant', data.opener);
        saveHistory();
      }
    } catch (e) {
      appendMessage('assistant', "I'm ready. What brings you here?");
    }
  }

  // ── /signin command flow ───────────────────────────────────────────────────

  async function handleCommand(cmd) {
    const lower = cmd.trim().toLowerCase();

    if (lower === '/signin' || lower === '/auth') {
      authState = 'awaiting_email';
      appendMessage('system', 'Enter your email address:');
      return true;
    }

    if (lower === '/signout') {
      clearOwnerSession();
      ownerSession = null;
      appendMessage('system', 'Signed out.');
      return true;
    }

    if (authState === 'awaiting_email') {
      authEmail = cmd.trim().toLowerCase();
      authState = 'awaiting_code';
      appendMessage('system', 'Sending code to ' + authEmail + '…');
      try {
        const res = await fetch(BASE_URL + '/api/signal-auth-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: authEmail, signalId: SIGNAL_ID })
        });
        const data = await res.json();
        if (data.success) {
          appendMessage('system', 'Check your email for a 6-digit code:');
        } else {
          appendMessage('system', data.error || 'Email not found.');
          authState = null; authEmail = null;
        }
      } catch (e) {
        appendMessage('system', 'Could not send code. Try again.');
        authState = null; authEmail = null;
      }
      return true;
    }

    if (authState === 'awaiting_code') {
      const code = cmd.trim();
      try {
        const res = await fetch(BASE_URL + '/api/signal-auth-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: authEmail, code: code })
        });
        const data = await res.json();
        if (data.success) {
          setOwnerSession(data.userId, data.signalId);
          ownerSession = getOwnerSession();
          authState = null; authEmail = null;
          appendMessage('system', 'Signed in. Owner mode active.');
        } else {
          appendMessage('system', 'Invalid code. Try again:');
        }
      } catch (e) {
        appendMessage('system', 'Verification failed. Try again.');
      }
      return true;
    }

    return false;
  }

  // ── Send message ───────────────────────────────────────────────────────────

  function stripScoreBlock(text) {
    return text.replace(/\n*FIT_SCORE_UPDATE\s*\n---\s*\n\{[\s\S]*?\}/m, '').trim();
  }

  async function sendMessage(text) {
    if (isStreaming || !text.trim()) return;

    if (text.startsWith('/')) {
      const handled = await handleCommand(text);
      if (handled) return;
    }

    isStreaming = true;
    disableInput();

    // Collapse score panel on mobile after first message
    if (!scoreCollapsed && turnCount === 0) {
      scoreCollapsed = true;
      if (els.scoreBar) els.scoreBar.style.display = 'flex';
    }

    turnCount++;
    chatHistory.push({ role: 'user', content: text });
    appendMessage('user', text);
    saveHistory();

    const historyForApi = chatHistory.slice(0, -1);
    showThinking();

    const userId = ownerSession ? ownerSession.userId : getVisitorId();

    try {
      const res = await fetch(BASE_URL + '/api/signal-chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          chatType: 'signal',
          signalId: SIGNAL_ID,
          persona: currentPersona,
          message: text,
          chatHistory: historyForApi
        })
      });

      if (!res.ok) throw new Error('HTTP ' + res.status);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantEl = null;
      let fullResponse = '';

      removeThinking();
      assistantEl = appendMessage('assistant', '');

      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          let event;
          try { event = JSON.parse(raw); } catch (e) { continue; }

          if (event.type === 'token') {
            fullResponse += event.text;
            assistantEl.textContent = stripScoreBlock(fullResponse);
            els.messages.scrollTop = els.messages.scrollHeight;
          } else if (event.type === 'done') {
            fullResponse = event.fullResponse || fullResponse;
            if (event.hasSignal && event.signal && event.signal.type === 'FIT_SCORE_UPDATE') {
              updateScore(event.signal.data);
            }
            const clean = stripScoreBlock(fullResponse);
            assistantEl.textContent = clean;
            chatHistory.push({ role: 'assistant', content: clean });
            saveHistory();
            saveChat(chatHistory);
          } else if (event.type === 'error') {
            removeThinking();
            appendMessage('assistant', 'Something went wrong. Please try again.');
          }
        }
      }

    } catch (err) {
      removeThinking();
      if (assistantEl) assistantEl.remove();
      appendMessage('assistant', 'Connection error. Please try again.');
      console.error('[signal-embed] Stream error:', err);
    }

    isStreaming = false;
    enableInput();
  }

  // ── Input helpers ──────────────────────────────────────────────────────────

  function enableInput() {
    if (els.input) { els.input.disabled = false; els.input.focus(); }
    if (els.send) els.send.disabled = false;
  }

  function disableInput() {
    if (els.input) els.input.disabled = true;
    if (els.send) els.send.disabled = true;
  }

  // ── History persistence ────────────────────────────────────────────────────

  function saveHistory() {
    try { localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify({ persona: currentPersona, messages: chatHistory })); } catch (e) {}
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(CHAT_HISTORY_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw);
      if (!saved.messages || !saved.messages.length) return false;
      currentPersona = saved.persona;
      chatHistory = saved.messages;
      chatId = localStorage.getItem(CHAT_ID_KEY) || null;
      return true;
    } catch (e) { return false; }
  }

  function clearHistory() {
    localStorage.removeItem(CHAT_HISTORY_KEY);
    localStorage.removeItem(CHAT_ID_KEY);
  }

  async function saveChat(messages) {
    try {
      const userId = ownerSession ? ownerSession.userId : getVisitorId();
      const mode = chatId ? 'append' : 'create';
      const body = { userId: userId, messages: messages, mode: mode };
      if (chatId) body.chatId = chatId;
      const res = await fetch(BASE_URL + '/api/signal-chat-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.chatId && !chatId) { chatId = data.chatId; localStorage.setItem(CHAT_ID_KEY, chatId); }
    } catch (e) {
      console.warn('[signal-embed] Chat save failed (non-fatal):', e);
    }
  }

  // ── Config loading ─────────────────────────────────────────────────────────

  async function loadConfig() {
    try {
      const res = await fetch(BASE_URL + '/api/signal-config-get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signalId: SIGNAL_ID })
      });
      const data = await res.json();
      if (data.success) return data.config;
    } catch (e) {}
    return {
      signalId: SIGNAL_ID,
      displayName: 'Signal',
      personas: [
        { key: 'recruiter', label: 'Recruiter' },
        { key: 'founder', label: 'Founder' },
        { key: 'colleague', label: 'Colleague' },
        { key: 'curious', label: 'Just curious' }
      ]
    };
  }

  // ── Open / close ───────────────────────────────────────────────────────────

  function open() {
    if (!els.overlay) return;
    els.overlay.classList.add('is-open');
    isOpen = true;
    document.body.style.overflow = 'hidden';
  }

  function close() {
    if (!els.overlay) return;
    els.overlay.classList.remove('is-open');
    isOpen = false;
    document.body.style.overflow = '';
  }

  function toggle() { isOpen ? close() : open(); }

  // ── Event binding ──────────────────────────────────────────────────────────

  function bindEvents() {
    if (els.close) els.close.addEventListener('click', close);

    if (els.overlay) {
      els.overlay.addEventListener('click', function (e) { if (e.target === els.overlay) close(); });
    }

    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen) close(); });

    if (els.input) {
      els.input.addEventListener('input', function () {
        els.input.style.height = 'auto';
        els.input.style.height = Math.min(els.input.scrollHeight, 120) + 'px';
      });
      els.input.addEventListener('keydown', function (e) {
        const isMobile = window.innerWidth < 600;
        if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
          e.preventDefault();
          const text = els.input.value.trim();
          if (text) { els.input.value = ''; els.input.style.height = 'auto'; sendMessage(text); }
        }
      });
    }

    if (els.send) {
      els.send.addEventListener('click', function () {
        if (!els.input) return;
        const text = els.input.value.trim();
        if (text) { els.input.value = ''; els.input.style.height = 'auto'; sendMessage(text); }
      });
    }

    if (els.leadSubmit) {
      els.leadSubmit.addEventListener('click', async function () {
        if (leadSubmitted) return;
        els.leadSubmit.disabled = true;
        els.leadSubmit.textContent = 'Sending…';
        try {
          await fetch(BASE_URL + '/api/signal-lead-save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              signalId: SIGNAL_ID,
              visitorId: getVisitorId(),
              persona: currentPersona,
              score: lastScore ? lastScore.overall : null,
              reason: lastScore ? lastScore.reason : '',
              nextStep: lastScore ? lastScore.nextStep : '',
              name: els.leadName ? els.leadName.value.trim() : '',
              email: els.leadEmail ? els.leadEmail.value.trim() : ''
            })
          });
        } catch (e) { console.warn('[signal-embed] Lead save failed:', e); }
        leadSubmitted = true;
        if (els.lead) els.lead.style.display = 'none';
        if (els.leadSent) els.leadSent.style.display = '';
      });
    }
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  async function init() {
    injectStyles();
    document.body.appendChild(buildModal());
    bindEls();
    initRing();
    bindEvents();

    ownerConfig = await loadConfig();
    ownerSession = getOwnerSession();

    const restored = loadHistory();

    if (restored && chatHistory.length > 0) {
      if (els.personaWrap) els.personaWrap.style.display = 'none';
      enableInput();
      chatHistory.forEach(function (msg) { appendMessage(msg.role, msg.content); });

      const resetBtn = document.createElement('button');
      resetBtn.className = 'se-persona-btn';
      resetBtn.textContent = 'Start new conversation';
      resetBtn.style.cssText = 'margin:6px 16px;font-size:12px;opacity:.7';
      resetBtn.addEventListener('click', function () {
        clearHistory();
        chatHistory = []; chatId = null; currentPersona = null;
        scoreCollapsed = false; turnCount = 0;
        els.messages.innerHTML = '';
        if (els.personaWrap) els.personaWrap.style.display = '';
        if (els.scoreBar) els.scoreBar.style.display = 'none';
        disableInput();
        renderPersonaButtons(ownerConfig.personas || []);
      });
      els.messages.prepend(resetBtn);
    } else {
      renderPersonaButtons(ownerConfig.personas || []);
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  window.Signal = { open: open, close: close, toggle: toggle };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
