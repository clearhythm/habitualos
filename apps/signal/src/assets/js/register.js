/**
 * register.js — Signal registration flow (2-step: form → verify code)
 */

const stepRegister = document.getElementById('step-register');
const stepVerify   = document.getElementById('step-verify');
const registerForm = document.getElementById('register-form');
const verifyForm   = document.getElementById('verify-form');
const registerErr  = document.getElementById('register-error');
const verifyErr    = document.getElementById('verify-error');
const verifySub    = document.getElementById('verify-sub');
const slugPreview  = document.getElementById('slug-preview');
const slugInput    = document.getElementById('field-slug');
const nameInput    = document.getElementById('field-name');
const emailInput   = document.getElementById('field-email');
const registerBtn  = document.getElementById('register-btn');
const verifyBtn    = document.getElementById('verify-btn');
const backBtn      = document.getElementById('back-btn');

let pendingEmail = '';

// ─── Slug auto-fill from name ─────────────────────────────────────────────────

nameInput.addEventListener('input', () => {
  if (!slugInput.dataset.manuallyEdited) {
    const slug = nameInput.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    slugInput.value = slug;
    slugPreview.textContent = slug || 'your-name';
  }
});

slugInput.addEventListener('input', () => {
  slugInput.dataset.manuallyEdited = '1';
  const slug = slugInput.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
  slugInput.value = slug;
  slugPreview.textContent = slug || 'your-name';
});

// ─── Step 1: Register ────────────────────────────────────────────────────────

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  registerErr.hidden = true;
  registerBtn.disabled = true;
  registerBtn.textContent = 'Sending…';

  const displayName = nameInput.value.trim();
  const email       = emailInput.value.trim();
  const signalId    = slugInput.value.trim();

  try {
    const res = await fetch('/api/signal-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: window.__userId, email, displayName, signalId })
    });
    const data = await res.json();

    if (!data.success) {
      showError(registerErr, data.error || 'Something went wrong. Please try again.');
    } else {
      pendingEmail = email;
      verifySub.textContent = `We sent a 6-digit code to ${email}.`;
      stepRegister.hidden = true;
      stepVerify.hidden = false;
      document.getElementById('field-code').focus();
    }
  } catch {
    showError(registerErr, 'Network error. Please try again.');
  }

  registerBtn.disabled = false;
  registerBtn.textContent = 'Continue';
});

// ─── Step 2: Verify ──────────────────────────────────────────────────────────

verifyForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  verifyErr.hidden = true;
  verifyBtn.disabled = true;
  verifyBtn.textContent = 'Verifying…';

  const code = document.getElementById('field-code').value.trim();

  try {
    const res = await fetch('/api/signal-auth-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: pendingEmail, code })
    });
    const data = await res.json();

    if (!data.success) {
      showError(verifyErr, data.error || 'Verification failed. Please try again.');
    } else {
      // Store signalId in localStorage for dashboard session
      localStorage.setItem('signal-owner-id', data.signalId);
      window.location.href = '/dashboard/';
    }
  } catch {
    showError(verifyErr, 'Network error. Please try again.');
  }

  verifyBtn.disabled = false;
  verifyBtn.textContent = 'Verify & create Signal';
});

// ─── Back button ─────────────────────────────────────────────────────────────

backBtn.addEventListener('click', () => {
  stepVerify.hidden = true;
  stepRegister.hidden = false;
  verifyErr.hidden = true;
});

// ─── Helper ──────────────────────────────────────────────────────────────────

function showError(el, msg) {
  el.textContent = msg;
  el.hidden = false;
}

// ─── Check if already registered ─────────────────────────────────────────────

(async () => {
  const existingSignalId = localStorage.getItem('signal-owner-id');
  if (existingSignalId) {
    // Verify it's still valid
    try {
      const res = await fetch('/api/signal-config-get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signalId: existingSignalId })
      });
      const data = await res.json();
      if (data.success && data.config.status === 'active') {
        window.location.href = '/dashboard/';
      }
    } catch {}
  }
})();
