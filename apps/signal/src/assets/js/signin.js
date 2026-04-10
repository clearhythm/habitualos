const states = {
  authed: document.getElementById('state-authed'),
  email: document.getElementById('state-email'),
  code: document.getElementById('state-code')
};

function show(state) {
  Object.values(states).forEach(el => el.hidden = true);
  states[state].hidden = false;
}

function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.hidden = false;
}

function clearError(id) {
  const el = document.getElementById(id);
  el.textContent = '';
  el.hidden = true;
}

function getRedirectDest() {
  const params = new URLSearchParams(location.search);
  const next = params.get('next');
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  return '/dashboard/';
}

// Check existing session
const existingSignalId = localStorage.getItem('signal-owner-id');
const existingUserId = localStorage.getItem('userId');
if (existingSignalId && existingUserId && existingUserId.startsWith('u-')) {
  document.getElementById('authed-name').textContent = 'Signed in as ' + existingSignalId;
  show('authed');
} else {
  show('email');
}

document.getElementById('signout-link').addEventListener('click', function(e) {
  e.preventDefault();
  localStorage.removeItem('signal-owner-id');
  show('email');
});

let currentEmail = '';

// Step 1: send code
const emailBtn = document.getElementById('email-btn');
const emailInput = document.getElementById('email-input');

async function sendCode() {
  clearError('email-error');
  const email = emailInput.value.trim();
  if (!email || !email.includes('@')) {
    showError('email-error', 'Please enter a valid email.');
    return;
  }
  emailBtn.disabled = true;
  emailBtn.textContent = 'Sending…';
  try {
    const res = await fetch('/api/signal-auth-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!data.success) {
      showError('email-error', data.error || 'No account found for this email.');
      emailBtn.disabled = false;
      emailBtn.textContent = 'Send code';
      return;
    }
    currentEmail = email;
    document.getElementById('code-sub').textContent = 'We sent a 6-digit code to ' + email;
    show('code');
    document.getElementById('code-input').focus();
  } catch {
    showError('email-error', 'Something went wrong. Please try again.');
    emailBtn.disabled = false;
    emailBtn.textContent = 'Send code';
  }
}

emailBtn.addEventListener('click', sendCode);
emailInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendCode(); });

// Step 2: verify code
const codeBtn = document.getElementById('code-btn');
const codeInput = document.getElementById('code-input');

async function verifyCode() {
  clearError('code-error');
  const code = codeInput.value.trim();
  if (!code || code.length < 6) {
    showError('code-error', 'Please enter the 6-digit code.');
    return;
  }
  codeBtn.disabled = true;
  codeBtn.textContent = 'Verifying…';
  try {
    const res = await fetch('/api/signal-auth-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: currentEmail, code })
    });
    const data = await res.json();
    if (!data.success) {
      showError('code-error', data.error || 'Invalid or expired code.');
      codeBtn.disabled = false;
      codeBtn.textContent = 'Verify';
      return;
    }
    // Write session
    localStorage.setItem('signal-owner-id', data.signalId);
    localStorage.setItem('userId', data.userId);
    if (data.displayName) localStorage.setItem('signal-owner-name', data.displayName.split(' ')[0]);
    location.replace(getRedirectDest());
  } catch {
    showError('code-error', 'Something went wrong. Please try again.');
    codeBtn.disabled = false;
    codeBtn.textContent = 'Verify';
  }
}

codeBtn.addEventListener('click', verifyCode);
codeInput.addEventListener('keydown', e => { if (e.key === 'Enter') verifyCode(); });

document.getElementById('back-link').addEventListener('click', function(e) {
  e.preventDefault();
  clearError('code-error');
  codeInput.value = '';
  emailBtn.disabled = false;
  emailBtn.textContent = 'Send code';
  show('email');
});
