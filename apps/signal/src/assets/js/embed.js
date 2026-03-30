/* Generated — edit src/widget/index.js instead */
var Signal = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/widget/index.js
  var index_exports = {};
  __export(index_exports, {
    version: () => version
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
    overflow-y: auto;
    flex-shrink: 0;
    height: 42%;
  }
}
#signal-embed-overlay .mobile-header {
  display: none;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  cursor: pointer;
  min-height: 44px;
  user-select: none;
}
#signal-embed-overlay .mobile-header .mobile-agent-name {
  flex: 1;
  font-size: 0.875rem;
  font-weight: 600;
  color: #f9fafb;
}
#signal-embed-overlay .mobile-header .mobile-score {
  font-size: 0.875rem;
  font-weight: 700;
  color: #c4b5fd;
}
#signal-embed-overlay .mobile-header .mobile-score:empty {
  display: none;
}
#signal-embed-overlay .mobile-header .mobile-chevron {
  font-size: 0.875rem;
  color: #9ca3af;
  transition: transform 0.2s;
}
#signal-embed-overlay .tabs {
  display: flex;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}
#signal-embed-overlay .tab {
  flex: 1;
  background: none;
  border: none;
  padding: 1rem;
  font-size: 1rem;
  font-family: "Poppins", system-ui, -apple-system, sans-serif;
  color: #9ca3af;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  transition: color 0.2s;
}
#signal-embed-overlay .tab.is-active {
  color: #f9fafb;
  border-bottom: 2px solid #7c3aed;
  margin-bottom: -1px;
}
#signal-embed-overlay .tab .tab-badge {
  background: #7c3aed;
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 8px;
  min-width: 18px;
  text-align: center;
}
#signal-embed-overlay .tab .tab-badge:empty {
  display: none;
}
#signal-embed-overlay .phase-wrap {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-rows: 1fr;
  grid-template-columns: 1fr;
}
#signal-embed-overlay .profile {
  grid-row: 1;
  grid-column: 1;
  overflow-y: auto;
  transition: opacity 0.5s ease;
  padding: 2rem 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  text-align: center;
  gap: 1.5rem;
}
#signal-embed-overlay .profile.is-done {
  opacity: 0;
  pointer-events: none;
}
#signal-embed-overlay .profile .agent-name {
  font-size: 1.25rem;
  font-weight: 700;
  color: #f9fafb;
}
#signal-embed-overlay .profile .agent-sub {
  font-size: 0.875rem;
  color: #9ca3af;
}
#signal-embed-overlay .profile .avatar-wrap {
  width: 116px;
  height: 116px;
  border-radius: 50%;
  background: rgba(124, 58, 237, 0.12);
  border: 2px solid rgba(124, 58, 237, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}
#signal-embed-overlay .profile .avatar-wrap img {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  object-fit: contain;
}
#signal-embed-overlay .profile .creds-block {
  align-self: stretch;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
#signal-embed-overlay .profile .creds-block h3 {
  font-size: 1.1rem;
  font-weight: 700;
  color: #f9fafb;
  margin: 0;
  padding: 0;
  line-height: 1.3;
}
#signal-embed-overlay .profile .creds-intro {
  font-size: 0.875rem;
  color: #9ca3af;
  margin: 0;
  align-self: stretch;
  text-align: left;
}
#signal-embed-overlay .profile .creds-list {
  list-style: none;
  margin: 0;
  padding: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
#signal-embed-overlay .profile .creds-list li {
  font-size: 0.875rem;
  color: #9ca3af;
  list-style: none;
  padding-left: 1rem;
  position: relative;
}
#signal-embed-overlay .profile .creds-list li::before {
  content: "\u2022";
  position: absolute;
  left: 0;
}
#signal-embed-overlay .profile .creds-list a {
  color: inherit;
  text-decoration: underline;
  text-decoration-color: rgba(255, 255, 255, 0.2);
  text-underline-offset: 2px;
}
#signal-embed-overlay .profile .creds-list a:hover {
  text-decoration-color: rgba(255, 255, 255, 0.5);
}
#signal-embed-overlay .profile .updated {
  font-size: 0.875rem;
  font-style: italic;
  color: rgba(255, 255, 255, 0.3);
  margin: 0.25rem 0 0;
  text-align: left;
  align-self: stretch;
}
#signal-embed-overlay .profile .updated:empty {
  display: none;
}
#signal-embed-overlay .profile .contact {
  margin-top: auto;
  padding-top: 1.5rem;
  width: 100%;
}
#signal-embed-overlay .profile .contact a {
  display: block;
  text-align: center;
  width: 100%;
}
#signal-embed-overlay .profile .rule {
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
  max-height: 800px;
}
@media (max-width: 768px) {
  #signal-embed-overlay .chat {
    order: 1;
    flex: 1;
    height: auto;
    max-height: none;
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
  padding: 1.5rem;
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
    background: #0f172a;
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
  #signal-embed-overlay .left.is-compacted {
    height: auto;
    overflow: hidden;
    flex-shrink: 0;
  }
  #signal-embed-overlay .left.is-compacted .tabs,
  #signal-embed-overlay .left.is-compacted .phase-wrap,
  #signal-embed-overlay .left.is-compacted .left-footer {
    display: none;
  }
  #signal-embed-overlay .left.is-compacted .mobile-header {
    display: flex;
  }
  #signal-embed-overlay .left.is-compacted.is-expanded {
    position: fixed;
    inset: auto 0 0 0;
    height: 75vh;
    max-height: 75vh;
    overflow-y: auto;
    z-index: 2100;
    border-radius: 12px 12px 0 0;
    background: #1e293b;
  }
  #signal-embed-overlay .left.is-compacted.is-expanded .tabs {
    display: flex;
  }
  #signal-embed-overlay .left.is-compacted.is-expanded .phase-wrap {
    display: grid;
  }
  #signal-embed-overlay .left.is-compacted.is-expanded .left-footer {
    display: flex;
  }
  #signal-embed-overlay .left.is-compacted.is-expanded .mobile-chevron {
    transform: rotate(180deg);
  }
}`;
  document.head.appendChild(document.createElement("style")).appendChild(document.createTextNode(css));

  // src/widget/index.js
  console.log("[Signal widget] bundle loaded");
  var version = "2.0.0";
  return __toCommonJS(index_exports);
})();
