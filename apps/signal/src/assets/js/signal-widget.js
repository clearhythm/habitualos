/* Generated — edit src/widget/index.js instead */
(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/widget/core/messages.js
  var messages_exports = {};
  __export(messages_exports, {
    appendMessage: () => appendMessage,
    loadMarked: () => loadMarked,
    removeThinking: () => removeThinking,
    renderMarkdown: () => renderMarkdown,
    showThinking: () => showThinking
  });
  function renderMarkdown(text) {
    if (typeof marked === "undefined") {
      return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    return marked.parse(text, { breaks: true });
  }
  function appendMessage(els2, role, text) {
    const el = document.createElement("div");
    el.className = `msg msg--${role}`;
    if (role === "assistant") {
      const content = document.createElement("div");
      content.className = "msg-content";
      content.innerHTML = renderMarkdown(text);
      el.appendChild(content);
      els2.messages.appendChild(el);
      els2.messages.scrollTop = els2.messages.scrollHeight;
      return content;
    } else {
      el.textContent = text;
      els2.messages.appendChild(el);
      els2.messages.scrollTop = els2.messages.scrollHeight;
      return el;
    }
  }
  function showThinking(els2) {
    const el = document.createElement("div");
    el.className = "thinking";
    el.id = "signal-thinking";
    el.innerHTML = "<span></span><span></span><span></span>";
    els2.messages.appendChild(el);
    els2.messages.scrollTop = els2.messages.scrollHeight;
  }
  function removeThinking() {
    document.getElementById("signal-thinking")?.remove();
  }
  async function loadMarked() {
    if (typeof marked !== "undefined") return;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  var init_messages = __esm({
    "src/widget/core/messages.js"() {
    }
  });

  // src/widget/widget.scss
  var css = `@charset "UTF-8";
@keyframes se-orb-float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}
@keyframes se-orb-enter {
  0% {
    transform: scale(0.75);
    opacity: 0;
  }
  70% {
    transform: scale(1.06);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
@keyframes se-orb-pulse {
  0% {
    transform: scale(1);
  }
  40% {
    transform: scale(1.07);
  }
  100% {
    transform: scale(1);
  }
}
@keyframes se-bounce {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-6px);
    opacity: 1;
  }
}
#signal-embed-overlay {
  position: fixed;
  inset: 0;
  background: linear-gradient(to bottom, #130e28, #0a0d1a);
  z-index: 2000;
  display: flex;
  flex-direction: column;
  font-family: "Poppins", system-ui, -apple-system, sans-serif;
  font-size: 1rem;
  line-height: 1.5;
  color: #f9fafb;
  box-sizing: border-box;
}
#signal-embed-overlay *, #signal-embed-overlay *::before, #signal-embed-overlay *::after {
  box-sizing: inherit;
}
#signal-embed-overlay[hidden] {
  display: none;
}
#signal-embed-overlay [hidden] {
  display: none !important;
}
#signal-embed-overlay .header {
  position: relative;
  width: 100%;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}
#signal-embed-overlay .title {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: 1.5rem;
  font-weight: 600;
  color: #f9fafb;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
  pointer-events: none;
}
#signal-embed-overlay .owner-badge {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #7c3aed;
  background: rgba(124, 58, 237, 0.12);
  border: 1px solid rgba(124, 58, 237, 0.25);
  border-radius: 4px;
  padding: 1px 6px;
  pointer-events: auto;
}
#signal-embed-overlay .close {
  width: 44px;
  height: 44px;
  background: none;
  border: none;
  cursor: pointer;
  position: relative;
  padding: 10px;
  flex-shrink: 0;
}
#signal-embed-overlay .close span {
  display: block;
  width: 24px;
  height: 3px;
  background: #f9fafb;
  position: absolute;
  border-radius: 2px;
  transition: background 0.15s;
  top: 50%;
  left: 50%;
  margin-left: -12px;
  margin-top: -1px;
}
#signal-embed-overlay .close span:first-child {
  transform: rotate(45deg);
}
#signal-embed-overlay .close span:last-child {
  transform: rotate(-45deg);
}
#signal-embed-overlay .close:hover span {
  background: rgba(255, 255, 255, 0.6);
}
#signal-embed-overlay .body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
#signal-embed-overlay .widget {
  flex: 1;
  min-height: 0;
  height: 100%;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 280px 1fr;
  padding: 2rem;
  gap: 2rem;
}
@media (max-width: 768px) {
  #signal-embed-overlay .widget {
    grid-template-columns: 1fr;
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 1rem;
    gap: 1rem;
  }
}
#signal-embed-overlay .panel {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  overflow: hidden;
}
#signal-embed-overlay .score-bar {
  display: none;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(196, 181, 253, 0.15);
  border-radius: 10px;
  order: 0;
}
#signal-embed-overlay .score-bar .score-bar-num {
  font-size: 22px;
  font-weight: 700;
  color: #c4b5fd;
  line-height: 1;
}
#signal-embed-overlay .score-bar .score-bar-label {
  font-size: 12px;
  color: #9ca3af;
}
#signal-embed-overlay .left {
  display: flex;
  flex-direction: column;
  height: calc(100dvh - 72px - 2 * 2rem);
  position: relative;
  border-color: rgba(196, 181, 253, 0.15);
}
@media (max-width: 768px) {
  #signal-embed-overlay .left {
    display: none;
  }
}
#signal-embed-overlay .mobile-profile-header {
  display: none;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}
#signal-embed-overlay .mobile-profile-header .mobile-avatar-wrap img {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
}
#signal-embed-overlay .mobile-profile-header .mobile-profile-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
#signal-embed-overlay .mobile-profile-header .mobile-agent-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: #f9fafb;
}
#signal-embed-overlay .mobile-profile-header .mobile-agent-name:empty {
  height: 0.75rem;
  width: 120px;
  border-radius: 4px;
}
#signal-embed-overlay .mobile-profile-header .mobile-agent-sub {
  font-size: 0.7rem;
  color: #9ca3af;
}
#signal-embed-overlay .mobile-profile-header .mobile-agent-sub:empty {
  height: 0.6rem;
  width: 80px;
  border-radius: 4px;
}
#signal-embed-overlay .mobile-profile-header .mobile-avatar-wrap img[style*="visibility:hidden"],
#signal-embed-overlay .mobile-profile-header .mobile-avatar-wrap img:not([src]) {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 50%;
  animation: skel-pulse 1.6s ease-in-out infinite;
}
#signal-embed-overlay .phase-wrap {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-rows: 1fr;
  grid-template-columns: 1fr;
}
@keyframes skel-pulse {
  0%, 100% {
    opacity: 0.3;
  }
  50% {
    opacity: 0.6;
  }
}
#signal-embed-overlay .skel, #signal-embed-overlay .mobile-profile-header .mobile-agent-name:empty, #signal-embed-overlay .mobile-profile-header .mobile-agent-sub:empty {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  animation: skel-pulse 1.6s ease-in-out infinite;
}
#signal-embed-overlay .profile-skeleton {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
#signal-embed-overlay .profile-skeleton .skel-name {
  height: 1rem;
  width: 60%;
  border-radius: 4px;
}
#signal-embed-overlay .profile-skeleton .skel-sub {
  height: 0.75rem;
  width: 80%;
  margin-bottom: 0.5rem;
}
#signal-embed-overlay .profile-skeleton .skel-avatar {
  height: 80px;
  width: 80px;
  border-radius: 50%;
  align-self: center;
  margin: 0.5rem 0;
}
#signal-embed-overlay .profile-skeleton .skel-line {
  height: 0.75rem;
}
#signal-embed-overlay .profile {
  grid-row: 1;
  grid-column: 1;
  overflow-y: auto;
  transition: opacity 0.5s ease;
  padding: 0 1.5rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 0;
}
#signal-embed-overlay .profile.is-done {
  opacity: 0;
  pointer-events: none;
}
#signal-embed-overlay .profile-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  width: 100%;
  flex: 1;
  padding-top: 2rem;
}
#signal-embed-overlay .profile-content .agent-name {
  font-size: 1.5rem;
  font-weight: 700;
  color: #f9fafb;
  align-self: center;
}
#signal-embed-overlay .profile-content .agent-sub {
  font-size: 0.875rem;
  color: #9ca3af;
  align-self: center;
}
#signal-embed-overlay .profile-content .agent-sub:empty {
  display: none;
}
#signal-embed-overlay .profile-content .avatar-wrap {
  width: 110px;
  height: 110px;
  margin: 0.25rem 0;
  align-self: center;
  border-radius: 50%;
  background: rgba(124, 58, 237, 0.12);
  border: 3px solid #7c3aed;
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.25), 0 0 16px 4px rgba(124, 58, 237, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}
#signal-embed-overlay .profile-content .avatar-wrap img {
  width: 110px;
  height: 110px;
  border-radius: 50%;
  object-fit: contain;
}
#signal-embed-overlay .profile-content .creds-block {
  align-self: stretch;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-top: 1rem;
}
#signal-embed-overlay .profile-content .creds-block h3 {
  font-size: 1.1rem;
  font-weight: 700;
  color: #f9fafb;
  margin: 0;
  padding: 0;
  line-height: 1.3;
}
#signal-embed-overlay .profile-content .creds-intro {
  font-size: 0.875rem;
  color: #9ca3af;
  margin: 0;
  align-self: stretch;
  text-align: left;
}
#signal-embed-overlay .profile-content .creds-list {
  list-style: none;
  margin: 0;
  padding: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
#signal-embed-overlay .profile-content .creds-list li {
  font-size: 0.875rem;
  color: #9ca3af;
  list-style: none;
  padding-left: 1rem;
  position: relative;
}
#signal-embed-overlay .profile-content .creds-list li::before {
  content: "\u2022";
  position: absolute;
  left: 0;
}
#signal-embed-overlay .profile-content .creds-list a {
  color: inherit;
  text-decoration: underline;
  text-decoration-color: rgba(255, 255, 255, 0.2);
  text-underline-offset: 2px;
}
#signal-embed-overlay .profile-content .creds-list a:hover {
  text-decoration-color: rgba(255, 255, 255, 0.5);
}
#signal-embed-overlay .profile-content .updated {
  font-size: 0.875rem;
  font-style: italic;
  color: rgba(255, 255, 255, 0.3);
  margin: 0.25rem 0 0;
  text-align: left;
  align-self: stretch;
}
#signal-embed-overlay .profile-content .updated:empty {
  display: none;
}
#signal-embed-overlay .profile-content .contact {
  margin-top: auto;
  padding-top: 0.5rem;
  width: 100%;
}
#signal-embed-overlay .profile-content .contact a {
  display: block;
  text-align: center;
  width: 100%;
}
#signal-embed-overlay .profile-content .rule {
  width: 100%;
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  margin: 0;
}
#signal-embed-overlay .score {
  grid-row: 1;
  grid-column: 1;
  overflow-y: auto;
  transition: opacity 0.5s ease;
  padding: 2rem 1.5rem;
  opacity: 0;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
#signal-embed-overlay .score.is-active {
  opacity: 1;
  pointer-events: auto;
}
#signal-embed-overlay .score .score-label {
  font-size: 1.25rem;
  font-weight: 700;
  color: #f9fafb;
  text-align: center;
}
#signal-embed-overlay .ring-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0.5rem 0;
}
#signal-embed-overlay .ring-wrap.is-visible {
  animation: se-orb-enter 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
#signal-embed-overlay .ring-wrap.is-visible .ring {
  animation: se-orb-float 3.5s ease-in-out infinite;
  animation-delay: 0.6s;
}
#signal-embed-overlay .ring-wrap.is-pulsing {
  animation: se-orb-pulse 0.5s ease-out;
}
#signal-embed-overlay .ring-wrap .ring {
  width: 120px;
  height: 120px;
  transform: rotate(-90deg);
}
#signal-embed-overlay .ring-wrap .ring .ring-track {
  fill: none;
  stroke: rgba(255, 255, 255, 0.08);
  stroke-width: 8;
}
#signal-embed-overlay .ring-wrap .ring .ring-fill {
  fill: none;
  stroke: #9d6ef5;
  stroke-width: 8;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}
#signal-embed-overlay .ring-wrap .ring-score {
  position: absolute;
  font-size: 2rem;
  font-weight: 700;
  color: #c4b5fd;
  line-height: 1;
}
#signal-embed-overlay .dims {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 0.5rem;
}
#signal-embed-overlay .dims .dim-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.25rem;
}
#signal-embed-overlay .dims .dim-header .dim-name {
  font-size: 1rem;
  color: #9ca3af;
}
#signal-embed-overlay .dims .dim-header .dim-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: #f9fafb;
}
#signal-embed-overlay .dims .bar-track {
  height: 8px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  overflow: hidden;
}
#signal-embed-overlay .dims .bar-track .bar-fill {
  height: 100%;
  width: 0;
  background: #059669;
  border-radius: 4px;
  transition: width 0.8s ease;
}
#signal-embed-overlay .dims .bar-fill--skills {
  transition-delay: 0.1s;
}
#signal-embed-overlay .dims .bar-fill--alignment {
  transition-delay: 0.3s;
}
#signal-embed-overlay .dims .bar-fill--personality {
  transition-delay: 0.5s;
}
#signal-embed-overlay .confidence {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
}
#signal-embed-overlay .confidence[hidden] {
  display: none;
}
#signal-embed-overlay .confidence .confidence-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
#signal-embed-overlay .confidence .confidence-label {
  font-size: 1rem;
  color: #9ca3af;
}
#signal-embed-overlay .confidence .confidence-bar-wrap {
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  overflow: hidden;
}
#signal-embed-overlay .confidence .confidence-bar-wrap .confidence-bar {
  height: 100%;
  width: 0;
  background: #9d6ef5;
  border-radius: 2px;
  transition: width 0.5s ease;
}
#signal-embed-overlay .reason {
  font-size: 0.875rem;
  color: #9ca3af;
  line-height: 1.5;
  opacity: 0;
  transition: opacity 0.4s ease;
  min-height: 0;
}
#signal-embed-overlay .reason.visible {
  opacity: 1;
}
#signal-embed-overlay .recommendation {
  font-size: 1.35rem;
  font-weight: 700;
  color: #f9fafb;
  margin: 0.5rem 0 0;
}
#signal-embed-overlay .recommendation[hidden] {
  display: none;
}
#signal-embed-overlay .score-footer-text {
  font-size: 0.875rem;
  font-style: italic;
  color: rgba(255, 255, 255, 0.3);
  padding-top: 0.5rem;
}
#signal-embed-overlay .left-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 10px 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
}
#signal-embed-overlay .left-footer a {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.45);
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 0;
  transition: color 0.2s;
}
#signal-embed-overlay .left-footer a img {
  width: 16px;
  height: 16px;
  transition: filter 0.2s;
}
#signal-embed-overlay .left-footer a strong {
  color: rgba(255, 255, 255, 0.8);
  font-weight: 700;
}
#signal-embed-overlay .left-footer a:hover {
  color: rgba(255, 255, 255, 0.75);
  text-decoration: none;
}
#signal-embed-overlay .left-footer a:hover img {
  filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.35));
}
#signal-embed-overlay .chat {
  display: flex;
  flex-direction: column;
  height: calc(100dvh - 72px - 2 * 2rem);
}
@media (max-width: 768px) {
  #signal-embed-overlay .chat {
    order: 1;
    flex: 1;
    height: auto;
    min-height: 0;
  }
}
#signal-embed-overlay .persona-wrap {
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
#signal-embed-overlay .persona-wrap .persona-prompt {
  color: #9ca3af;
  font-size: 1rem;
  margin: 0;
}
#signal-embed-overlay .persona-wrap .persona-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
#signal-embed-overlay .persona-wrap .persona-btn {
  padding: 0.5rem 1.5rem;
  border-radius: 24px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #f9fafb;
  font-size: 0.875rem;
  font-weight: 500;
  font-family: "Poppins", system-ui, -apple-system, sans-serif;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
#signal-embed-overlay .persona-wrap .persona-btn:hover {
  background: rgba(124, 58, 237, 0.12);
  border-color: #7c3aed;
}
#signal-embed-overlay .persona-wrap .persona-btn:active {
  background: rgba(124, 58, 237, 0.2);
}
#signal-embed-overlay .messages {
  flex: 1;
  overflow-y: auto;
  padding: 2rem 1.5rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  scroll-behavior: smooth;
}
#signal-embed-overlay .msg {
  line-height: 1.55;
  font-size: 1rem;
  word-break: break-word;
}
#signal-embed-overlay .msg--user {
  align-self: flex-end;
  max-width: 72%;
  background: #7c3aed;
  color: #fff;
  padding: 0.5rem 1rem;
  border-radius: 18px 18px 4px 18px;
  white-space: pre-wrap;
}
#signal-embed-overlay .msg--assistant {
  align-self: flex-start;
  max-width: 72%;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 4px 18px 18px 18px;
  padding: 0.5rem 1rem;
  white-space: normal;
}
#signal-embed-overlay .msg--assistant .msg-content {
  color: #f9fafb;
}
#signal-embed-overlay .msg--assistant .msg-content p {
  margin: 0 0 0.6em;
}
#signal-embed-overlay .msg--assistant .msg-content p:last-child {
  margin-bottom: 0;
}
#signal-embed-overlay .msg--assistant .msg-content ul, #signal-embed-overlay .msg--assistant .msg-content ol {
  margin: 0.4em 0 0.6em 1.2em;
  padding: 0;
}
#signal-embed-overlay .msg--assistant .msg-content li {
  margin-bottom: 0.2em;
}
#signal-embed-overlay .msg--assistant .msg-content strong {
  color: #f9fafb;
}
#signal-embed-overlay .msg--assistant .msg-content h1, #signal-embed-overlay .msg--assistant .msg-content h2, #signal-embed-overlay .msg--assistant .msg-content h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0.6em 0 0.3em;
}
#signal-embed-overlay .msg--assistant .msg-content hr {
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  margin: 0.6em 0;
}
#signal-embed-overlay .msg--system {
  align-self: center;
  font-size: 0.875rem;
  color: #9ca3af;
  font-style: italic;
}
#signal-embed-overlay .msg--eval {
  max-width: 100%;
  background: transparent;
  border: 1px solid rgba(196, 181, 253, 0.25);
  border-radius: 12px;
  padding: 1rem;
}
#signal-embed-overlay .msg--eval .eval-output {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
#signal-embed-overlay .msg--eval .eval-output h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: #f9fafb;
  margin: 0.4em 0 0.1em;
}
#signal-embed-overlay .msg--eval .eval-output p {
  font-size: 0.875rem;
  color: #9ca3af;
  line-height: 1.6;
  margin: 0;
}
#signal-embed-overlay .msg--eval .eval-output .eval-role {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #9ca3af;
  margin: 0;
}
#signal-embed-overlay .msg--eval .eval-output .eval-summary {
  color: #f9fafb !important;
}
#signal-embed-overlay .msg--eval .eval-output .eval-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
#signal-embed-overlay .msg--eval .eval-output .eval-section h4 {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.35);
  margin: 0;
}
#signal-embed-overlay .msg--eval .eval-output .eval-items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
#signal-embed-overlay .msg--eval .eval-output .eval-items li {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.5;
  padding-left: 1em;
  position: relative;
}
#signal-embed-overlay .msg--eval .eval-output .eval-items li::before {
  content: "\u2713";
  position: absolute;
  left: 0;
  color: #059669;
  font-size: 0.75em;
  top: 0.15em;
}
#signal-embed-overlay .msg--eval .eval-output .eval-items--gaps li::before {
  content: "\xB7";
  color: rgba(255, 255, 255, 0.3);
  font-size: 1.2em;
  top: -0.05em;
}
#signal-embed-overlay .thinking {
  align-self: flex-start;
  display: flex;
  gap: 4px;
  padding: 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 4px 18px 18px 18px;
}
#signal-embed-overlay .thinking span {
  width: 7px;
  height: 7px;
  background: #9ca3af;
  border-radius: 50%;
  animation: se-bounce 1.2s infinite ease-in-out;
}
#signal-embed-overlay .thinking span:nth-child(2) {
  animation-delay: 0.2s;
}
#signal-embed-overlay .thinking span:nth-child(3) {
  animation-delay: 0.4s;
}
#signal-embed-overlay .chat-intro {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0 0 1rem;
}
#signal-embed-overlay .chat-intro-heading {
  font-size: 1.5rem;
  font-weight: 700;
  color: #f9fafb;
  margin: 0;
}
#signal-embed-overlay .chat-intro-sub {
  font-size: 1rem;
  color: #9ca3af;
  margin: 0;
}
#signal-embed-overlay .starter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: 0.25rem;
}
#signal-embed-overlay .starter-chip {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  color: #9ca3af;
  font-size: 1rem;
  font-family: "Poppins", system-ui, -apple-system, sans-serif;
  padding: 5px 0.5rem;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  text-align: left;
  line-height: 1.4;
}
#signal-embed-overlay .starter-chip:hover {
  background: rgba(124, 58, 237, 0.12);
  border-color: rgba(124, 58, 237, 0.4);
  color: #f9fafb;
}
#signal-embed-overlay .input-wrap {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  padding: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
@media (max-width: 768px) {
  #signal-embed-overlay .input-wrap {
    position: sticky;
    bottom: 0;
    background: rgba(255, 255, 255, 0.04);
    z-index: 1;
  }
}
#signal-embed-overlay .input-wrap textarea {
  flex: 1;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  color: #f9fafb;
  font-size: 1rem;
  font-family: "Poppins", system-ui, -apple-system, sans-serif;
  line-height: 1.5;
  resize: none;
  max-height: 160px;
  overflow-y: auto;
  transition: border-color 0.15s;
}
#signal-embed-overlay .input-wrap textarea::placeholder {
  color: #9ca3af;
}
#signal-embed-overlay .input-wrap textarea:focus {
  outline: none;
  border-color: #7c3aed;
}
#signal-embed-overlay .input-wrap textarea:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
#signal-embed-overlay .input-wrap button[type=submit] {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #7c3aed;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: opacity 0.15s;
}
#signal-embed-overlay .input-wrap button[type=submit]:hover {
  opacity: 0.85;
}
#signal-embed-overlay .input-wrap button[type=submit]:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
#signal-embed-overlay .chat-footer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
#signal-embed-overlay .chat-footer .brand-logo {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  text-decoration: none;
}
#signal-embed-overlay .chat-footer .brand-logo:hover {
  opacity: 0.8;
}
#signal-embed-overlay .chat-footer .brand-logo img {
  height: 20px;
  width: auto;
  display: block;
}
#signal-embed-overlay .chat-footer .brand-sub {
  font-size: 0.72rem;
  color: #9ca3af;
  line-height: 1.3;
}
#signal-embed-overlay .nextstep {
  padding-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
#signal-embed-overlay .nextstep .nextstep-heading {
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #9ca3af;
}
#signal-embed-overlay .nextstep .nextstep-label {
  font-size: 1rem;
  font-weight: 600;
  color: #f9fafb;
  line-height: 1.3;
}
#signal-embed-overlay .nextstep .nextstep-actions {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
#signal-embed-overlay .nextstep button, #signal-embed-overlay .nextstep a {
  width: 100%;
  text-align: center;
  font-size: 0.875rem;
}
#signal-embed-overlay .lead {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-top: 0.25rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
#signal-embed-overlay .lead input {
  width: 100%;
  background: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 0.25rem 0.5rem;
  color: #f9fafb;
  font-size: 0.875rem;
  font-family: "Poppins", system-ui, -apple-system, sans-serif;
}
#signal-embed-overlay .lead input::placeholder {
  color: #9ca3af;
}
#signal-embed-overlay .lead input:focus {
  outline: none;
  border-color: #7c3aed;
}
#signal-embed-overlay .lead button {
  width: 100%;
  text-align: center;
  font-size: 0.875rem;
}
#signal-embed-overlay .lead .lead-hint {
  font-size: 0.75rem;
  color: #9ca3af;
  margin: 0;
}
#signal-embed-overlay .lead .lead-sent {
  font-size: 0.875rem;
  color: #9ca3af;
  margin: 0;
}
@media (max-width: 768px) {
  #signal-embed-overlay .mobile-profile-header {
    display: flex;
  }
  #signal-embed-overlay .panel.chat {
    flex: 1;
    min-height: 0;
  }
}`;
  document.head.appendChild(document.createElement("style")).appendChild(document.createTextNode(css));

  // src/widget/core/state.js
  var state = {
    signalId: null,
    // from data-signal-id attr
    baseUrl: null,
    // from script.src origin
    activeMode: null,
    // 'visitor' | 'owner' | 'onboard'
    isStreaming: false,
    chatHistory: [],
    chatId: null,
    currentPersona: null,
    turnCount: 0,
    lastScore: null,
    ownerConfig: null,
    ownerSession: null,
    // { userId, signalId, displayName } from storage
    currentEvalId: null,
    scoreCollapsed: false,
    authState: null,
    // null | 'awaiting_email' | 'awaiting_code'
    authEmail: null,
    leadSubmitted: false,
    evalContext: null
  };
  function resetChatState() {
    state.activeMode = null;
    state.isStreaming = false;
    state.chatHistory = [];
    state.chatId = null;
    state.currentPersona = null;
    state.turnCount = 0;
    state.lastScore = null;
    state.currentEvalId = null;
    state.scoreCollapsed = false;
    state.authState = null;
    state.authEmail = null;
    state.leadSubmitted = false;
    state.evalContext = null;
  }

  // src/widget/core/dom.js
  var RING_CIRCUMFERENCE = 2 * Math.PI * 52;
  function injectHTML(baseUrl) {
    const el = document.createElement("div");
    el.innerHTML = template(baseUrl);
    document.body.appendChild(el.firstElementChild);
  }
  function bindEls() {
    const root = document.getElementById("signal-embed-overlay");
    const q = (sel) => root.querySelector(sel);
    const qa = (sel) => root.querySelectorAll(sel);
    return {
      root,
      // Header
      title: q(".title"),
      closeBtn: q(".close"),
      // Left panel (profile only)
      profilePanel: q(".profile"),
      profileSkeleton: q(".profile-skeleton"),
      profileContent: q(".profile-content"),
      agentName: q(".agent-name"),
      agentSub: q(".agent-sub"),
      avatarImg: q(".avatar-wrap img"),
      credsIntro: q(".creds-intro"),
      credsList: q(".creds-list"),
      updated: q(".updated"),
      contact: q(".contact"),
      // Mobile profile header (top of chat on mobile)
      mobileProfileHeader: q(".mobile-profile-header"),
      mobileAgentName: q(".mobile-agent-name"),
      mobileAgentSub: q(".mobile-agent-sub"),
      mobileAvatarImg: q(".mobile-avatar-wrap img"),
      // Chat panel
      personaWrap: q(".persona-wrap"),
      personaPrompt: q(".persona-prompt"),
      personaBtns: q(".persona-btns"),
      messages: q(".messages"),
      form: q(".input-wrap"),
      input: q(".input-wrap textarea"),
      sendBtn: q('.input-wrap button[type="submit"]')
    };
  }
  function template(baseUrl) {
    return `
<div id="signal-embed-overlay" hidden>

  <div class="header">
    <span class="title">Signal Interview</span>
    <button class="close" aria-label="Close"><span></span><span></span></button>
  </div>

  <div class="body">
    <div class="widget">

      <!-- Left panel (profile) -->
      <div class="panel left">

        <div class="phase-wrap">
          <div class="profile">
            <!-- Skeleton shown while loading -->
            <div class="profile-skeleton">
              <div class="skel skel-name"></div>
              <div class="skel skel-sub"></div>
              <div class="skel skel-avatar"></div>
              <div class="skel skel-line" style="width:80%"></div>
              <div class="skel skel-line" style="width:65%"></div>
              <div class="skel skel-line" style="width:72%"></div>
              <div class="skel skel-line" style="width:55%"></div>
            </div>
            <!-- Real content, hidden until loaded -->
            <div class="profile-content" hidden>
              <div class="agent-name"></div>
              <div class="agent-sub"></div>
              <div class="avatar-wrap">
                <img src="${baseUrl}/assets/images/signal-agent_clean.png" alt="" style="visibility:hidden" />
              </div>
              <div class="creds-block">
                <h3>What's this?</h3>
              </div>
              <p class="creds-intro"></p>
              <ul class="creds-list"></ul>
              <p class="updated"></p>
              <div class="contact"></div>
            </div>
          </div>
        </div><!-- /.phase-wrap -->

        <div class="left-footer">
          <a href="https://signal.habitualos.com" target="_blank" rel="noopener">
            <img src="${baseUrl}/assets/favicon-32x32.png" alt="" />
            <strong>Signal.</strong> Get your own \u2192
          </a>
        </div>

      </div><!-- /.panel.left -->

      <!-- Chat panel -->
      <div class="panel chat">

        <!-- Mobile profile header (visible on small screens only) -->
        <div class="mobile-profile-header">
          <div class="mobile-avatar-wrap">
            <img src="${baseUrl}/assets/images/signal-agent_clean.png" alt="" style="visibility:hidden" />
          </div>
          <div class="mobile-profile-info">
            <div class="mobile-agent-name"></div>
            <div class="mobile-agent-sub"></div>
          </div>
        </div>

        <div class="persona-wrap" hidden>
          <p class="persona-prompt"></p>
          <div class="persona-btns"></div>
        </div>
        <div class="messages" aria-live="polite" aria-label="Conversation"></div>
        <form class="input-wrap" aria-label="Send a message">
          <textarea
            placeholder="Tell me about your AI work\u2026"
            rows="3"
            aria-label="Your message"
            disabled
          ></textarea>
          <button type="submit" aria-label="Send" disabled>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M22 2L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </form>
      </div><!-- /.panel.chat -->

    </div><!-- /.widget -->
  </div><!-- /.body -->

</div><!-- /#signal-embed-overlay -->
`.trim();
  }

  // src/widget/widget.js
  init_messages();

  // src/widget/core/score.js
  function resetScorePanel(els2) {
  }
  function updateScore(els2, state2, data) {
    state2.lastScore = data;
  }

  // src/widget/core/stream.js
  async function readStream(res, handlers) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;
        let event;
        try {
          event = JSON.parse(raw);
        } catch {
          continue;
        }
        switch (event.type) {
          case "token":
            handlers.onToken?.(event.text);
            break;
          case "tool_complete":
            handlers.onToolComplete?.(event.tool, event.result);
            break;
          case "done":
            handlers.onDone?.(event.fullResponse);
            break;
          case "error":
            handlers.onError?.(event.message || "Stream error");
            break;
        }
      }
    }
  }

  // src/widget/core/eval.js
  function createEvalRecord(state2, opts = {}) {
    if (!state2.signalId) return;
    const { roleTitle, summary, scores, strengths, gaps } = opts;
    fetch(`${state2.baseUrl}/api/signal-evaluation-save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signalId: state2.signalId,
        userId: state2.userId,
        mode: state2.activeMode,
        roleTitle: roleTitle || null,
        summary: summary || null,
        scores: scores || null,
        strengths: strengths || null,
        gaps: gaps || null
      })
    }).then((r) => r.json()).then((data) => {
      if (data.success) state2.currentEvalId = data.evalId;
    }).catch((err) => console.warn("[signal/eval] createEvalRecord failed (non-fatal):", err));
  }
  function upsertEvalScores(state2, scores) {
    if (!state2.currentEvalId || !state2.signalId) return;
    fetch(`${state2.baseUrl}/api/signal-evaluation-save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evalId: state2.currentEvalId, signalId: state2.signalId, scores })
    }).catch(() => {
    });
  }

  // src/widget/core/history.js
  var LS_PREFIX = "signal_chat_";
  function lsKey(state2) {
    return `${LS_PREFIX}${state2.userId}_${state2.signalId}`;
  }
  function saveChatLS(state2) {
    if (!state2.userId || !state2.chatHistory.length) return;
    try {
      localStorage.setItem(lsKey(state2), JSON.stringify({
        chatId: state2.chatId || null,
        messages: state2.chatHistory,
        savedAt: Date.now()
      }));
    } catch (_) {
    }
  }
  async function persistChat(state2, baseUrl) {
    if (!state2.userId || !state2.chatHistory.length) return;
    if (state2._persisting) return;
    state2._persisting = true;
    try {
      const body = JSON.stringify({
        userId: state2.userId,
        signalId: state2.signalId,
        chatId: state2.chatId || null,
        messages: state2.chatHistory
      });
      const res = await fetch(`${baseUrl}/api/signal-chat-save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body
      });
      const data = await res.json();
      if (data.chatId) state2.chatId = data.chatId;
    } catch (err) {
      console.warn("[signal/history] persistChat failed (non-fatal):", err);
    } finally {
      state2._persisting = false;
    }
  }
  function beaconChat(state2, baseUrl) {
    if (!state2.userId || !state2.chatHistory.length) return;
    try {
      const body = JSON.stringify({
        userId: state2.userId,
        signalId: state2.signalId,
        chatId: state2.chatId || null,
        messages: state2.chatHistory
      });
      navigator.sendBeacon(`${baseUrl}/api/signal-chat-save`, new Blob([body], { type: "application/json" }));
    } catch (_) {
    }
  }

  // src/widget/modes/visitor.js
  var visitor_exports = {};
  __export(visitor_exports, {
    buildPayload: () => buildPayload,
    init: () => init
  });

  // src/widget/core/storage.js
  var VISITOR_KEY = "signal_visitor_id";
  var TTL_MS = 30 * 24 * 60 * 60 * 1e3;
  function getVisitorId() {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = "v-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  }
  function ownerKey(signalId) {
    return `signal_owner_${signalId}`;
  }
  function getOwnerSession(signalId) {
    try {
      const raw = localStorage.getItem(ownerKey(signalId));
      if (!raw) return null;
      const { data, expiresAt } = JSON.parse(raw);
      if (Date.now() > expiresAt) {
        localStorage.removeItem(ownerKey(signalId));
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }
  function setOwnerSession(userId, signalId, displayName) {
    const payload = {
      data: { userId, signalId, displayName },
      expiresAt: Date.now() + TTL_MS
    };
    localStorage.setItem(ownerKey(signalId), JSON.stringify(payload));
  }
  function clearOwnerSession(signalId) {
    localStorage.removeItem(ownerKey(signalId));
  }

  // src/widget/modes/visitor.js
  init_messages();
  var STARTER_QUESTIONS = [
    "What kind of work have you been doing lately?",
    "How do you handle ambiguity?",
    "What would you be like to work with?",
    "What's your strongest technical area?",
    "Paste a job description and I'll score the fit."
  ];
  var FALLBACK_CONFIG = (signalId) => ({
    signalId,
    displayName: "",
    avatarUrl: null,
    contactLinks: {}
  });
  async function init(state2, els2, baseUrl) {
    state2.userId = getVisitorId();
    els2.personaWrap.hidden = true;
    const [configResult, statusResult] = await Promise.allSettled([
      fetch(`${baseUrl}/api/signal-config-get`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signalId: state2.signalId })
      }).then((r) => r.json()),
      fetch(`${baseUrl}/api/signal-context-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signalId: state2.signalId })
      }).then((r) => r.json())
    ]);
    const config = configResult.status === "fulfilled" && configResult.value.success ? configResult.value.config : FALLBACK_CONFIG(state2.signalId);
    state2.ownerConfig = config;
    const statusVal = statusResult.status === "fulfilled" ? statusResult.value : null;
    const total = statusVal?.success ? statusVal.stats?.total : null;
    const name = config.displayName || state2.signalId || "Signal";
    const firstName = name.split(" ")[0];
    if (els2.agentName) els2.agentName.textContent = `${firstName}'s Signal`;
    const rawAvatar = config.avatarUrl || config.agentAvatarUrl || null;
    const avatarSrc = rawAvatar ? rawAvatar.startsWith("http") ? rawAvatar : `${baseUrl}${rawAvatar}` : `${baseUrl}/assets/images/signal-agent_clean.png`;
    if (els2.avatarImg) {
      els2.avatarImg.src = avatarSrc;
      els2.avatarImg.style.visibility = "";
    }
    if (els2.mobileAgentName) els2.mobileAgentName.textContent = `${firstName}'s Signal`;
    if (els2.mobileAvatarImg) {
      els2.mobileAvatarImg.src = avatarSrc;
      els2.mobileAvatarImg.style.visibility = "";
    }
    if (els2.credsIntro) {
      els2.credsIntro.textContent = `I trained an agent on my work, style, and personality, so you can have a realistic conversation with me. I made this to help you assess my fit for any project or job listing. It can read from my:`;
    }
    if (els2.credsList) {
      const items = [];
      if (total) items.push(`${total} Claude Code sessions`);
      items.push(`<a href="https://github.com/clearhythm" target="_blank" rel="noopener">3 repositories</a>`);
      const lastActive = statusVal?.lastUploadAt ? (() => {
        const d = new Date(statusVal.lastUploadAt);
        const days = Math.round((Date.now() - d.getTime()) / 864e5);
        const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        return days === 0 ? `today at ${time}` : days === 1 ? "yesterday" : `${days} days ago`;
      })() : null;
      if (lastActive && els2.updated) els2.updated.textContent = `Last updated ${lastActive}`;
      els2.credsList.innerHTML = items.map((t) => `<li>${t}</li>`).join("");
    }
    if (els2.contact && config.contactLinks) {
      const { calendar, linkedin } = config.contactLinks;
      if (calendar) {
        els2.contact.innerHTML = `<a href="${calendar}" target="_blank" rel="noopener" class="btn btn-outline">Book a call \u2192</a>`;
      } else if (linkedin) {
        els2.contact.innerHTML = `<a href="${linkedin}" target="_blank" rel="noopener" class="btn btn-outline">Connect on LinkedIn \u2192</a>`;
      }
    }
    if (els2.profileSkeleton) els2.profileSkeleton.hidden = true;
    if (els2.profileContent) els2.profileContent.hidden = false;
    if (els2.mobileProfileHeader) els2.mobileProfileHeader.classList.add("is-loaded");
    state2.currentPersona = "colleague";
    state2.chatHistory.push({ role: "assistant", content: "Hey! Ask me anything about my work, or paste a job description and I'll tell you how I'd fit." });
    els2.input.disabled = false;
    els2.sendBtn.disabled = false;
    els2.input.placeholder = "Ask me anything\u2026";
    if (els2.messages) {
      const introEl = document.createElement("div");
      introEl.className = "chat-intro";
      introEl.innerHTML = `
      <p class="chat-intro-heading">\u{1F399}\uFE0F Interview Me</p>
      <p class="chat-intro-sub">Here are some questions to get you started.</p>
      <div class="starter-chips">${STARTER_QUESTIONS.map(
        (q) => `<button type="button" class="starter-chip">${q}</button>`
      ).join("")}</div>
    `;
      els2.messages.appendChild(introEl);
      introEl.addEventListener("click", (e) => {
        const chip = e.target.closest(".starter-chip");
        if (!chip) return;
        els2.input.value = chip.textContent;
        els2.input.dispatchEvent(new Event("input"));
        els2.form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      });
    }
  }
  function buildPayload(state2, text) {
    return {
      userId: state2.userId,
      chatType: "signal-visitor",
      signalId: state2.signalId,
      persona: state2.currentPersona,
      message: text,
      chatHistory: state2.chatHistory.slice(0, -1)
    };
  }

  // src/widget/modes/owner.js
  var owner_exports = {};
  __export(owner_exports, {
    buildPayload: () => buildPayload2,
    handleCommand: () => handleCommand,
    init: () => init2
  });
  init_messages();
  async function init2(state2, els2, baseUrl) {
    const session = getOwnerSession(state2.signalId);
    if (session) {
      state2.userId = session.userId;
      state2.ownerSession = session;
    }
    els2.personaWrap.hidden = true;
    try {
      const res = await fetch(`${baseUrl}/api/signal-owner-init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signalId: state2.signalId,
          ...state2.evalContext ? { evalContext: state2.evalContext } : {}
        })
      });
      const data = await res.json();
      if (els2.title) {
        els2.title.innerHTML = `Signal Interview <span class="owner-badge">owner</span>`;
      }
      if (data.opener) {
        state2.chatHistory.push({ role: "assistant", content: data.opener });
        appendMessage(els2, "assistant", data.opener);
      }
      els2.input.disabled = false;
      els2.sendBtn.disabled = false;
      els2.input.focus();
    } catch (err) {
      appendMessage(els2, "assistant", "Owner mode ready.");
      els2.input.disabled = false;
      els2.sendBtn.disabled = false;
      console.error("[signal/owner] Init error:", err);
    }
  }
  function buildPayload2(state2, text) {
    return {
      userId: state2.userId,
      chatType: "signal-owner",
      signalId: state2.signalId,
      message: text,
      chatHistory: state2.chatHistory.slice(0, -1),
      ...state2.currentEvalId ? { currentEvalId: state2.currentEvalId } : {}
    };
  }
  async function handleCommand(cmd, state2, els2, baseUrl) {
    if (state2.authState === "awaiting_email") {
      const email = cmd.trim();
      if (!email) return false;
      state2.authEmail = email;
      appendMessage(els2, "assistant", `Sending a code to ${email}\u2026`);
      try {
        const res = await fetch(`${baseUrl}/api/signal-auth-login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, signalId: state2.signalId })
        });
        const data = await res.json();
        if (data.success) {
          state2.authState = "awaiting_code";
          appendMessage(els2, "assistant", "Check your email for a 6-digit code, then enter it here.");
        } else {
          state2.authState = null;
          state2.authEmail = null;
          appendMessage(els2, "assistant", `Couldn't send code: ${data.error || "unknown error"}. Try again with /signin.`);
        }
      } catch (err) {
        state2.authState = null;
        state2.authEmail = null;
        appendMessage(els2, "assistant", "Something went wrong sending the code. Try /signin again.");
        console.error("[signal/owner] auth-login error:", err);
      }
      return true;
    }
    if (state2.authState === "awaiting_code") {
      const code = cmd.trim();
      if (!code) return false;
      try {
        const res = await fetch(`${baseUrl}/api/signal-auth-verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: state2.authEmail, code })
        });
        const data = await res.json();
        if (data.success) {
          setOwnerSession(data.userId, data.signalId, data.displayName);
          state2.userId = data.userId;
          state2.ownerSession = { userId: data.userId, signalId: data.signalId, displayName: data.displayName };
          state2.authState = null;
          state2.authEmail = null;
          appendMessage(els2, "assistant", `Signed in as ${data.displayName}. You're now in owner mode.`);
        } else {
          appendMessage(els2, "assistant", `Invalid code: ${data.error || "please try again"}.`);
        }
      } catch (err) {
        appendMessage(els2, "assistant", "Verification failed. Try /signin again.");
        console.error("[signal/owner] auth-verify error:", err);
      }
      return true;
    }
    if (cmd.trim().toLowerCase() === "/signin") {
      state2.authState = "awaiting_email";
      appendMessage(els2, "assistant", "Enter the email address associated with your Signal account:");
      return true;
    }
    if (cmd.trim().toLowerCase() === "/signout") {
      clearOwnerSession(state2.signalId);
      state2.ownerSession = null;
      state2.userId = null;
      appendMessage(els2, "assistant", "Signed out.");
      return true;
    }
    return false;
  }

  // src/widget/modes/onboard.js
  var onboard_exports = {};
  __export(onboard_exports, {
    buildPayload: () => buildPayload3,
    init: () => init3
  });
  async function init3(state2, els2, baseUrl) {
    state2.userId = getVisitorId();
    els2.personaWrap.hidden = false;
    els2.personaPrompt.textContent = "Loading\u2026";
    els2.personaBtns.innerHTML = "";
    try {
      const res = await fetch(`${baseUrl}/api/signal-onboard-init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!data.success) throw new Error("Init failed");
      els2.personaWrap.hidden = true;
      const { appendMessage: appendMessage2 } = await Promise.resolve().then(() => (init_messages(), messages_exports));
      appendMessage2(els2, "assistant", data.opener);
      state2.chatHistory.push({ role: "assistant", content: data.opener });
      els2.input.disabled = false;
      els2.sendBtn.disabled = false;
      els2.input.focus();
    } catch (err) {
      els2.personaPrompt.textContent = "Could not start. Please refresh and try again.";
      console.error("[signal/onboard] Init error:", err);
    }
  }
  function buildPayload3(state2, text) {
    return {
      userId: state2.userId,
      chatType: "signal-onboard",
      message: text,
      chatHistory: state2.chatHistory.slice(0, -1)
    };
  }

  // src/widget/widget.js
  var MODES = {
    visitor: visitor_exports,
    owner: owner_exports,
    onboard: onboard_exports
  };
  var els = null;
  var activeMode = null;
  async function transition(modeName, options = {}) {
    const newSignalId = options.signalId || state.signalId || null;
    if (activeMode && state.activeMode === modeName && state.signalId === newSignalId) return;
    resetChatState();
    state.activeMode = modeName;
    state.signalId = newSignalId;
    state.evalContext = options.evalContext || null;
    els.messages.innerHTML = "";
    resetScorePanel(els);
    els.personaBtns.innerHTML = "";
    els.personaWrap.hidden = true;
    els.input.disabled = true;
    els.sendBtn.disabled = true;
    els.input.value = "";
    els.input.style.height = "auto";
    els.profilePanel?.classList.remove("is-done");
    if (els.title) els.title.innerHTML = "Signal Interview";
    els.input.placeholder = modeName === "owner" ? "Paste a job description to score your fit\u2026" : "Tell me about your AI work\u2026";
    activeMode = MODES[modeName];
    if (!activeMode) {
      console.error("[signal] Unknown mode:", modeName);
      return;
    }
    await activeMode.init(state, els, state.baseUrl);
  }
  async function sendMessage(text) {
    if (state.isStreaming || !text.trim() || !activeMode) return;
    if (activeMode.handleCommand) {
      const consumed = await activeMode.handleCommand(text, state, els, state.baseUrl);
      if (consumed) return;
    }
    state.isStreaming = true;
    els.input.disabled = true;
    els.sendBtn.disabled = true;
    state.turnCount++;
    state.chatHistory.push({ role: "user", content: text });
    appendMessage(els, "user", text);
    showThinking(els);
    let fullResponse = "";
    let evaluationRendered = false;
    let evaluationSavedThisTurn = false;
    let assistantContentEl = null;
    try {
      const payload = activeMode.buildPayload(state, text);
      const res = await fetch(`${state.baseUrl}/api/signal-chat-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await readStream(res, {
        onToken(tokenText) {
          fullResponse += tokenText;
        },
        onToolComplete(tool, result) {
          if (tool === "evaluate_fit") {
            evaluationRendered = true;
            evaluationSavedThisTurn = true;
            const { evalId, roleTitle, summary, strengths, gaps, score, recommendation } = result || {};
            if (evalId) state.currentEvalId = evalId;
            const esc = (s) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const strengthsHtml = (strengths || []).map((s) => `<li class="eval-strength-item">${esc(s)}</li>`).join("");
            const gapsHtml = (gaps || []).map((g) => `<li class="eval-gap-item">${esc(g)}</li>`).join("");
            const msgContentEl = appendMessage(els, "assistant", "");
            msgContentEl.closest(".msg")?.classList.add("msg--eval");
            msgContentEl.innerHTML = `
            <div class="eval-output">
              <p class="eval-role">${esc(roleTitle)}</p>
              <p class="eval-summary">${esc(summary)}</p>
              ${strengthsHtml ? `<div class="eval-section"><h4>What Fits</h4><ul class="eval-items">${strengthsHtml}</ul></div>` : ""}
              ${gapsHtml ? `<div class="eval-section"><h4>Potential Gaps</h4><ul class="eval-items eval-items--gaps">${gapsHtml}</ul></div>` : ""}
            </div>`;
            els.messages.scrollTop = els.messages.scrollHeight;
            if (recommendation && els.recommendation) {
              const recLabels = {
                "strong-candidate": "Strong Candidate.",
                "worth-applying": "Worth Applying.",
                "stretch": "Stretch Role.",
                "poor-fit": "Poor Fit."
              };
              const label = recLabels[recommendation];
              if (label) {
                els.recommendation.textContent = label;
                els.recommendation.hidden = false;
              }
            }
            if (score) updateScore(els, state, { ...score, reason: null });
          } else if (tool === "update_fit_score") {
            const { skills, alignment, personality, confidence, reason } = result || {};
            updateScore(els, state, { skills, alignment, personality, confidence, reason });
            if (state.currentEvalId) {
              upsertEvalScores(state, { skills, alignment, personality, confidence });
            }
          }
        },
        onDone(serverFullResponse) {
          fullResponse = serverFullResponse || fullResponse;
          removeThinking();
          if (!evaluationRendered && fullResponse.trim()) {
            assistantContentEl = appendMessage(els, "assistant", "");
            assistantContentEl.innerHTML = renderMarkdown(fullResponse);
            els.messages.scrollTop = els.messages.scrollHeight;
          }
          state.chatHistory.push({ role: "assistant", content: fullResponse });
          if (!evaluationSavedThisTurn && state.lastScore) {
            const { skills, alignment, personality, confidence } = state.lastScore;
            if (!state.currentEvalId && confidence >= 0.5) {
              createEvalRecord(state, { scores: { skills, alignment, personality, confidence } });
            } else if (state.currentEvalId) {
              upsertEvalScores(state, { skills, alignment, personality, confidence });
            }
          }
        },
        onError(msg) {
          removeThinking();
          appendMessage(els, "assistant", "Something went wrong. Please try again.");
          console.error("[signal] Stream error:", msg);
        }
      });
      saveChatLS(state);
      if (state.turnCount % 3 === 0) await persistChat(state, state.baseUrl);
    } catch (err) {
      removeThinking();
      if (assistantContentEl) assistantContentEl.closest(".msg")?.remove();
      else if (fullResponse.trim()) {
        const el = appendMessage(els, "assistant", "");
        el.innerHTML = renderMarkdown(fullResponse);
      }
      appendMessage(els, "assistant", "Connection error. Please try again.");
      console.error("[signal] Stream fetch error:", err);
    }
    state.isStreaming = false;
    els.input.disabled = false;
    els.sendBtn.disabled = false;
    els.input.focus();
  }
  function launch(options = {}) {
    if (!els) return;
    els.root.removeAttribute("hidden");
    document.body.style.overflow = "hidden";
    if (options.fullPage) els.root.classList.add("is-fullpage");
    if (options.redirectOnClose) state.redirectOnClose = options.redirectOnClose;
    const modeName = options.mode || (state.signalId ? "visitor" : "onboard");
    transition(modeName, options);
  }
  function close() {
    if (!els) return;
    els.root.setAttribute("hidden", "");
    els.root.classList.remove("is-fullpage");
    document.body.style.overflow = "";
    if (state.chatHistory.length) persistChat(state, state.baseUrl);
    if (state.redirectOnClose) window.location.href = state.redirectOnClose;
  }
  function toggle(options = {}) {
    if (!els) return;
    if (els.root.hasAttribute("hidden")) launch(options);
    else close();
  }
  function init4() {
    if (!document.querySelector('link[href*="Poppins"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap";
      document.head.appendChild(link);
    }
    injectHTML(state.baseUrl);
    els = bindEls();
    loadMarked();
    els.closeBtn.addEventListener("click", close);
    window.addEventListener("beforeunload", () => {
      if (state.chatHistory.length) beaconChat(state, state.baseUrl);
    });
    els.input.addEventListener("input", () => {
      els.input.style.height = "auto";
      els.input.style.height = Math.min(els.input.scrollHeight, 160) + "px";
    });
    els.input.addEventListener("keydown", (e) => {
      const isMobile = window.innerWidth < 600;
      if (e.key === "Enter" && !e.shiftKey && !isMobile) {
        e.preventDefault();
        const text = els.input.value.trim();
        if (text) {
          els.input.value = "";
          els.input.style.height = "auto";
          sendMessage(text);
        }
      }
    });
    els.form.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = els.input.value.trim();
      if (text) {
        els.input.value = "";
        els.input.style.height = "auto";
        sendMessage(text);
      }
    });
  }

  // src/widget/index.js
  var script = document.currentScript;
  state.signalId = script?.getAttribute("data-signal-id") || null;
  state.baseUrl = script ? new URL(script.src).origin : "https://signal.habitualos.com";
  var modeAttr = script?.getAttribute("data-signal-mode");
  var TESTING_MODE = modeAttr === "testing" || modeAttr === "coming-soon";
  if (TESTING_MODE) {
    window.Signal = { launch: () => {
    }, close: () => {
    }, toggle: () => {
    } };
  } else {
    let domReady = function(fn) {
      if (document.readyState !== "loading") fn();
      else document.addEventListener("DOMContentLoaded", fn);
    };
    window.Signal = { launch, close, toggle };
    window.signalOpen = (opts) => launch(opts);
    window.signalSwitchMode = (mode, opts) => transition(mode, opts);
    domReady(init4);
  }
})();
