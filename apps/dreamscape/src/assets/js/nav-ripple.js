// nav-ripple.js — manages the expanding ring on the nav toggle
// Multiple callers add/remove named reasons; ring shows while any reason is active.
//
// Usage:
//   addRipple('unread')      // start pulsing for this reason
//   removeRipple('unread')   // stop; hides ring if no other reasons remain

const _reasons = new Set();

function _sync() {
  document.getElementById('sidemenu-toggle')
    ?.classList.toggle('nav-ripple', _reasons.size > 0);
}

export function addRipple(reason) {
  _reasons.add(reason);
  _sync();
}

export function removeRipple(reason) {
  _reasons.delete(reason);
  _sync();
}
