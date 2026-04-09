import { requireSignIn } from '/assets/js/auth/auth-guard.js';
import { initializeUser } from '/assets/js/auth/auth.js';

requireSignIn();

const userId = initializeUser();

async function loadProfile() {
  try {
    const response = await fetch(`/api/users?docId=${userId}`);
    const data = await response.json();
    if (data && data.profile && data.profile.phoneNumber) {
      document.getElementById('phone-input').value = data.profile.phoneNumber;
    }
  } catch (e) {
    // No profile yet — that's fine
  }
}

function showStatus(message, isError) {
  const el = document.getElementById('status-msg');
  el.textContent = message;
  el.style.display = 'block';
  el.style.background = isError ? '#fce4e4' : '#e8f5e9';
  el.style.color = isError ? '#c0392b' : '#27ae60';
}

function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

document.getElementById('profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const raw = document.getElementById('phone-input').value;
  const phoneNumber = normalizePhone(raw);

  if (!phoneNumber) {
    showStatus('Please enter a valid 10-digit US phone number.', true);
    return;
  }

  const btn = document.getElementById('save-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const response = await fetch('/api/user-profile-set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, phoneNumber })
    });
    const result = await response.json();

    if (result.success) {
      showStatus('Phone number saved. You\'ll get daily reminders at 7pm PT if you haven\'t checked in.', false);
      document.getElementById('phone-input').value = phoneNumber;
    } else {
      showStatus(result.error || 'Something went wrong.', true);
    }
  } catch (err) {
    showStatus('Network error. Please try again.', true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save';
  }
});

loadProfile();
