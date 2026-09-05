// Placeholder request-access flow — no backend, no email service wired
// up yet (see Erik's call: not worth building until this is a real
// flow). Submitting just swaps the form for a "reach out directly"
// message with a mailto fallback, so the page still feels functional
// rather than dead-ending.
const form = document.getElementById('demo-request-form');
const thanks = document.getElementById('demo-request-thanks');

if (form && thanks) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    form.hidden = true;
    thanks.hidden = false;
  });
}
