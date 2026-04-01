// src/widget/index.js — esbuild entry point for Signal widget bundle
import './widget.scss';
import { init, launch, close, toggle, transition } from './widget.js';
import { state } from './core/state.js';

const script = document.currentScript;
state.signalId = script?.getAttribute('data-signal-id') || null;
state.baseUrl = script
  ? new URL(script.src).origin
  : 'https://signal.habitualos.com';

const modeAttr = script?.getAttribute('data-signal-mode');
const TESTING_MODE = modeAttr === 'testing' || modeAttr === 'coming-soon';

if (TESTING_MODE) {
  // TODO: TICKET-4-widget-coming-soon — restore "📡 Signal is coming soon…" modal
  window.Signal = { launch: () => {}, close: () => {}, toggle: () => {} };
} else {
  window.Signal = { launch, close, toggle };
  window.signalOpen       = (opts) => launch(opts);           // compat alias
  window.signalSwitchMode = (mode, opts) => transition(mode, opts); // compat alias

  function domReady(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  domReady(init);
}
