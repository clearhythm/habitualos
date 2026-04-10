var form = document.getElementById('waitlist-form');
var emailEl = document.getElementById('waitlist-email');
var submitBtn = document.getElementById('waitlist-submit');
var errorEl = document.getElementById('waitlist-error');
var successEl = document.getElementById('waitlist-success');
var confirmedEl = document.getElementById('waitlist-confirmed');

// Handle confirm token from email link
var token = new URLSearchParams(window.location.search).get('token');
if (token) {
  document.getElementById('waitlist-default').style.display = 'none';

  fetch('/api/early-access-confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: token, type: 'waitlist' })
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.success) confirmedEl.style.display = '';
      else successEl.style.display = ''; // fallback — already confirmed
    })
    .catch(function() { successEl.style.display = ''; })
    .finally(function() { window.history.replaceState({}, '', '/waitlist/'); });
}

form.addEventListener('submit', async function(e) {
  e.preventDefault();
  var email = emailEl.value.trim();
  if (!email) return;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending…';
  errorEl.style.display = 'none';

  try {
    var res = await fetch('/api/signal-waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, referrer: 'catch-all' })
    });
    var data = await res.json();
    if (data.success) {
      document.getElementById('waitlist-default').style.display = 'none';
      document.getElementById('waitlist-confirm-email').textContent = email;
      successEl.style.display = '';
    } else {
      throw new Error(data.error || 'Something went wrong');
    }
  } catch(err) {
    errorEl.textContent = err.message || 'Something went wrong. Try again.';
    errorEl.style.display = '';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Request access';
  }
});
