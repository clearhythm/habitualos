// core/messages.js — message rendering helpers

export function renderMarkdown(text) {
  if (typeof marked === 'undefined') {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  return marked.parse(text, { breaks: true });
}

export function appendMessage(els, role, text) {
  const el = document.createElement('div');
  el.className = `msg msg--${role}`;
  if (role === 'assistant') {
    const content = document.createElement('div');
    content.className = 'msg-content';
    content.innerHTML = renderMarkdown(text);
    el.appendChild(content);
    els.messages.appendChild(el);
    els.messages.scrollTop = els.messages.scrollHeight;
    return content;
  } else {
    el.textContent = text;
    els.messages.appendChild(el);
    els.messages.scrollTop = els.messages.scrollHeight;
    return el;
  }
}

export function showThinking(els) {
  const el = document.createElement('div');
  el.className = 'thinking';
  el.id = 'signal-thinking';
  el.innerHTML = '<span></span><span></span><span></span>';
  els.messages.appendChild(el);
  els.messages.scrollTop = els.messages.scrollHeight;
}

export function removeThinking() {
  document.getElementById('signal-thinking')?.remove();
}

export async function loadMarked() {
  if (typeof marked !== 'undefined') return;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}
