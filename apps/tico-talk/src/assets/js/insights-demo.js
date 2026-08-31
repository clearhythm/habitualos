// /insights/demo/ — the sidebar view switch (Revenue Breakdown /
// Staff Performance / Answers), the Analytics/Raw Data tab switch
// within Staff Performance, the Day/Week range toggle, and the
// "Answers" chat threads.
//
// Chat uses the same streaming infra as Practice (/api/chat-stream, see
// netlify/edge-functions/chat-stream.ts's "insights" chatType) rather
// than a one-off single-shot endpoint — tokens render as they arrive,
// and the model pulls data itself via tool calls (get_server_performance
// etc., see insights-chat-init.cjs) instead of a huge data dump being
// force-fed into every request.
import { getOrCreateUserId } from './utils/user-id.js';
import { initAutoResizeTextarea, initEnterToSubmit, updateSendButtonState } from './utils/chat-composer.js';
import { initTooltips } from './utils/tooltip.js';

initTooltips();

// ─── Sidebar view switch ─────────────────────────────────────────────
const navItems = document.querySelectorAll('.insights-dash__nav-item');
const dashViews = document.querySelectorAll('.insights-dash__view');
const composerShell = document.querySelector('.insights-demo__input-shell');

function switchView(view) {
  navItems.forEach((n) => n.classList.toggle('is-active', n.dataset.view === view));
  dashViews.forEach((v) => {
    const active = v.dataset.view === view;
    v.hidden = !active;
    v.classList.toggle('is-active', active);
  });

  // The composer is the "ask from anywhere else" entry point — once
  // you're already on Answers, every thread has its own reply box,
  // so a second, redundant "ask a question" input is just clutter, not
  // a second way to do the same thing.
  if (composerShell) composerShell.hidden = view === 'your-insights';
}

navItems.forEach((navItem) => {
  navItem.addEventListener('click', () => switchView(navItem.dataset.view));
});

document.querySelectorAll('.insights-demo__range-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.insights-demo__range-btn').forEach((b) => {
      b.classList.toggle('is-active', b === btn);
    });
    document.querySelectorAll('[data-range-chart]').forEach((chart) => {
      chart.hidden = chart.dataset.rangeChart !== btn.dataset.range;
    });
  });
});

document.querySelectorAll('.insights-demo__tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.insights-demo__tab').forEach((t) => {
      t.classList.toggle('is-active', t === tab);
      t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
    });
    document.querySelectorAll('.insights-demo__panel').forEach((panel) => {
      panel.hidden = panel.dataset.panel !== tab.dataset.tab;
    });
  });
});

// ─── Answers: chat threads ───────────────────────────────────────
// The fixed composer (page-level, see insights-demo.njk) always starts a
// brand-new thread here — it's the "ask anything" entry point, not a way
// to continue a thread in progress. Each thread gets its own small reply
// form at the bottom of its transcript for follow-ups, and its own
// Anthropic-format history array, independent of every other thread.
const chatsResults = document.getElementById('insights-chats-results');
const chatsList = document.getElementById('insights-chats-list');
const composerForm = document.getElementById('insights-chats-form');
const composerInput = document.getElementById('insights-chats-input');
const composerSend = document.getElementById('insights-chats-send');

function appendBubble(transcript, role) {
  const line = document.createElement('p');
  line.className = `transcript-line transcript-line--${role === 'user' ? 'user' : 'answer'}`;
  transcript.appendChild(line);
  return line;
}

function appendLookup(transcript, toolName) {
  const line = document.createElement('p');
  line.className = 'transcript-line transcript-line--lookup';
  line.textContent = `Looking up ${toolName.replace('get_', '').replace(/_/g, ' ')}…`;
  transcript.appendChild(line);
  line.scrollIntoView({ behavior: 'smooth', block: 'end' });
  return line;
}

function formatMoney(value, decimals = 0) {
  return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function deltaCell(delta) {
  const span = document.createElement('span');
  span.className = `insights-demo__delta insights-demo__delta--${delta > 0 ? 'up' : 'down'}`;
  span.textContent = `${delta > 0 ? '▲' : '▼'} ${delta > 0 ? '+' : ''}${formatMoney(delta, 2)}`;
  return span;
}

function buildTable(headers, rows) {
  const wrap = document.createElement('div');
  wrap.className = 'insights-demo__table-wrap insights-chats__visual';

  const table = document.createElement('table');
  table.className = 'insights-demo__table insights-demo__table--raw';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headers.forEach((h) => {
    const th = document.createElement('th');
    th.textContent = h;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  const tbody = document.createElement('tbody');
  rows.forEach((cells) => {
    const tr = document.createElement('tr');
    cells.forEach((cell) => {
      const td = document.createElement('td');
      if (cell instanceof Node) td.appendChild(cell);
      else td.textContent = cell;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.append(thead, tbody);
  wrap.appendChild(table);
  return wrap;
}

// Turns one tool's raw result into a small, real visual — reusing the
// exact table/stat-tile classes the dashboard views already use, so an
// answer's data reads as the same kind of thing you'd see browsing
// Revenue Breakdown/Staff Performance directly, not a special chat-only
// format. Returns null for empty/unrecognized results (no visual, just
// the prose answer).
function renderToolVisual(toolName, result) {
  if (!result) return null;

  if (toolName === 'get_server_performance' && Array.isArray(result) && result.length) {
    return buildTable(
      ['Server', 'Shifts', 'Avg PPA', 'vs. peers'],
      result.map((s) => [
        s.server + (s.lowSample ? ' (low sample)' : ''),
        String(s.shifts),
        formatMoney(s.avgPPA, 2),
        s.avgDelta == null ? '—' : deltaCell(s.avgDelta)
      ])
    );
  }

  if (toolName === 'get_item_popularity' && Array.isArray(result) && result.length) {
    return buildTable(
      ['Item', 'Orders', 'Revenue'],
      result.slice(0, 10).map((i) => [i.name, String(i.count), formatMoney(i.revenue)])
    );
  }

  if (toolName === 'get_shift_breakdown' && Array.isArray(result) && result.length) {
    return buildTable(
      ['Date', 'Shift', 'Server', 'Checks', 'Revenue', 'PPA'],
      result.slice(0, 20).map((s) => [s.date, s.period, s.server, String(s.checkCount), formatMoney(s.revenue), formatMoney(s.ppa, 2)])
    );
  }

  if (toolName === 'get_revenue_trends' && result.monthly) {
    const wrap = document.createElement('div');
    wrap.className = 'insights-demo__stats insights-chats__visual';
    [
      ['Total revenue', formatMoney(result.monthly.revenue)],
      ['Checks', String(result.monthly.checkCount)],
      ['Avg PPA', formatMoney(result.monthly.avgPPA, 2)]
    ].forEach(([label, value]) => {
      const stat = document.createElement('div');
      stat.className = 'insights-demo__stat';
      const l = document.createElement('span');
      l.className = 'insights-demo__stat-label';
      l.textContent = label;
      const v = document.createElement('span');
      v.className = 'insights-demo__stat-value';
      v.textContent = value;
      stat.append(l, v);
      wrap.appendChild(stat);
    });
    return wrap;
  }

  return null;
}

// Streams one reply into `transcript`, appending to `apiHistory` in place
// on success — shared by both a thread's first question (from the fixed
// composer) and its own reply form's follow-ups. The answer bubble isn't
// created until the first token/result arrives, so any tool-result
// visuals (rendered at tool_complete) land in the transcript BEFORE the
// prose that references them, not after.
async function streamReply(transcript, apiHistory, apiMessage) {
  let answerLine = null;
  let lookupLine = null;
  let fullText = '';

  const ensureAnswerLine = () => {
    if (!answerLine) answerLine = appendBubble(transcript, 'answer');
    return answerLine;
  };

  try {
    const response = await fetch('/api/chat-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatType: 'insights',
        userId: getOrCreateUserId(),
        message: apiMessage,
        chatHistory: apiHistory
      })
    });

    if (!response.ok || !response.body) {
      ensureAnswerLine().textContent = 'Something went wrong answering that — try again in a moment.';
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const evt = JSON.parse(line.slice(6));

        if (evt.type === 'tool_start') {
          lookupLine = appendLookup(transcript, evt.tool);
        } else if (evt.type === 'tool_complete') {
          lookupLine?.remove();
          lookupLine = null;
          const visual = renderToolVisual(evt.tool, evt.result);
          if (visual) {
            transcript.appendChild(visual);
            visual.scrollIntoView({ behavior: 'smooth', block: 'end' });
          }
        } else if (evt.type === 'token') {
          fullText += evt.text;
          const line = ensureAnswerLine();
          line.textContent = fullText;
          line.scrollIntoView({ behavior: 'smooth', block: 'end' });
        } else if (evt.type === 'done') {
          lookupLine?.remove();
          ensureAnswerLine().textContent = evt.fullResponse || fullText;
          apiHistory.push({ role: 'user', content: apiMessage });
          apiHistory.push({ role: 'assistant', content: evt.fullResponse || fullText });
        } else if (evt.type === 'error') {
          lookupLine?.remove();
          ensureAnswerLine().textContent = 'Something went wrong answering that — try again in a moment.';
        }
      }
    }
  } catch {
    lookupLine?.remove();
    ensureAnswerLine().textContent = 'Something went wrong answering that — try again in a moment.';
  }
}

// Builds one collapsible thread: summary (first question + time), the
// transcript, and its own reply form for follow-ups.
function createThread(question) {
  const details = document.createElement('details');
  details.className = 'insights-chats__thread';
  details.open = true;

  const summary = document.createElement('summary');
  summary.className = 'insights-chats__thread-summary';

  const questionSpan = document.createElement('span');
  questionSpan.className = 'insights-chats__thread-question';
  questionSpan.textContent = question.length > 80 ? `${question.slice(0, 80)}…` : question;

  const timeSpan = document.createElement('span');
  timeSpan.className = 'insights-chats__thread-time';
  timeSpan.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  summary.append(questionSpan, timeSpan);

  const transcript = document.createElement('div');
  transcript.className = 'transcript insights-chats__thread-transcript';

  const replyForm = document.createElement('form');
  replyForm.className = 'insights-chats__thread-reply learn-input-row';
  replyForm.innerHTML = `
    <div class="learn-input-wrap">
      <textarea class="learn-textarea" rows="1" placeholder="Reply…" aria-label="Reply"></textarea>
      <div class="learn-input-toolbar">
        <button type="submit" class="learn-send-btn" disabled aria-label="Send">
          <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14" aria-hidden="true">
            <path d="M8 1.5L12.5 9H10V14.5H6V9H3.5L8 1.5Z" transform="rotate(90 8 8)"></path>
          </svg>
        </button>
      </div>
    </div>
  `;

  details.append(summary, transcript, replyForm);

  const apiHistory = [];
  let awaitingReply = false;

  const replyInput = replyForm.querySelector('textarea');
  const replySend = replyForm.querySelector('button');
  initAutoResizeTextarea(replyInput, () => updateSendButtonState(replyInput, replySend));
  initEnterToSubmit(replyInput, replyForm);
  replyInput.addEventListener('input', () => updateSendButtonState(replyInput, replySend));

  replyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const followUp = replyInput.value.trim();
    if (!followUp || replySend.disabled || awaitingReply) return;

    appendBubble(transcript, 'user').textContent = followUp;
    replyInput.value = '';
    replyInput.style.height = 'auto';
    replySend.disabled = true;
    awaitingReply = true;

    await streamReply(transcript, apiHistory, followUp);

    awaitingReply = false;
    updateSendButtonState(replyInput, replySend);
  });

  details._apiHistory = apiHistory;
  details._transcript = transcript;
  return details;
}

if (composerForm && composerInput && composerSend && chatsResults && chatsList) {
  initAutoResizeTextarea(composerInput, () => updateSendButtonState(composerInput, composerSend));
  initEnterToSubmit(composerInput, composerForm);
  composerInput.addEventListener('input', () => updateSendButtonState(composerInput, composerSend));

  let awaitingFirst = false;

  composerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const question = composerInput.value.trim();
    if (!question || composerSend.disabled || awaitingFirst) return;

    switchView('your-insights');
    chatsResults.hidden = false;

    const thread = createThread(question);
    chatsList.prepend(thread);
    thread.scrollIntoView({ behavior: 'smooth', block: 'start' });

    appendBubble(thread._transcript, 'user').textContent = question;
    composerInput.value = '';
    composerInput.style.height = 'auto';
    composerSend.disabled = true;
    awaitingFirst = true;

    await streamReply(thread._transcript, thread._apiHistory, question);

    awaitingFirst = false;
    updateSendButtonState(composerInput, composerSend);
  });
}
