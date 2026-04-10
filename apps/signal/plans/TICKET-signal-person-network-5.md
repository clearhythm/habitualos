# TICKET-5: Email Finding + Outreach (Hunter.io + Resend + CAN-SPAM)

## Why this exists

Contacts are scored but unreachable until we have an email. This ticket wires Hunter.io for email discovery and Resend for delivery. The outreach email sends on behalf of the Signal owner — the prospect learns they were found by someone's Signal profile, sees their overlap scores, and is introduced to the product. CAN-SPAM compliance is required.

This is TICKET-5 of 6. Depends on TICKET-1 (db-signal-contacts), TICKET-2 and TICKET-3 (contacts exist in Firestore).

---

## Read first

- `netlify/functions/_services/email.cjs` — existing Resend patterns; add `sendNetworkOutreach` here
- `netlify/functions/_services/db-signal-contacts.cjs` — `getContactById()`, `updateContact()`
- `netlify/functions/_services/db-signal-owners.cjs` — `getOwnerByUserId()`
- `netlify/functions/signal-ingest.js` — CORS/endpoint pattern

## Environment variables needed

```
HUNTER_API_KEY=   # hunter.io free tier: 100 lookups/month
```

Add to `.env` and to Netlify environment variables in the dashboard.

---

## Step 1: Add `sendNetworkOutreach` to `netlify/functions/_services/email.cjs`

Add this function before the `module.exports` line:

```js
/**
 * Send a network outreach email on behalf of a Signal owner.
 * CAN-SPAM compliant: physical address + unsubscribe link in footer.
 *
 * @param {{ to: string, owner: object, contact: object, unsubscribeUrl: string }} params
 */
async function sendNetworkOutreach({ to, owner, contact, unsubscribeUrl }) {
  const ownerName = owner.displayName || owner.signalId;
  const signalUrl = `https://signal.habitualos.com/widget/?id=${owner.signalId}`;
  const score = contact.score || {};
  const sharedGrounds = (score.sharedGrounds || []).join(', ') || 'similar professional background';

  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const textBody = [
    `${ownerName}'s Signal profile matched you.`,
    '',
    `Domain overlap: ${score.domain ?? '—'}/10`,
    `Trajectory alignment: ${score.trajectory ?? '—'}/10`,
    '',
    `What overlaps: ${sharedGrounds}`,
    '',
    score.summary || '',
    '',
    `See ${ownerName}'s Signal: ${signalUrl}`,
    '',
    '---',
    `This is an automated introduction from Signal. ${ownerName} hasn't written this message — Signal found you based on profile overlap and sent this on their behalf.`,
    '',
    `Unsubscribe: ${unsubscribeUrl}`,
    'Signal · 114 Cress Road, Santa Cruz, CA 95060, USA',
  ].filter(l => l !== null).join('\n');

  const { data, error } = await getClient().emails.send({
    from: FROM,
    to,
    subject: `You came up in ${ownerName}'s Signal`,
    text: textBody,
    html: LIGHT_WRAPPER(`
      <p style="color:#1e293b;font-size:0.925rem;font-weight:600;margin:0 0 1rem;">${esc(ownerName)}'s Signal profile matched you.</p>

      <div style="display:flex;gap:1rem;margin-bottom:1.25rem;">
        <div style="flex:1;background:#f8fafc;border-radius:8px;padding:0.75rem;text-align:center;">
          <p style="color:#7c3aed;font-size:1.25rem;font-weight:700;margin:0;">${score.domain ?? '—'}<span style="color:#94a3b8;font-size:0.75rem;">/10</span></p>
          <p style="color:#64748b;font-size:0.75rem;margin:0.25rem 0 0;">Domain overlap</p>
        </div>
        <div style="flex:1;background:#f8fafc;border-radius:8px;padding:0.75rem;text-align:center;">
          <p style="color:#7c3aed;font-size:1.25rem;font-weight:700;margin:0;">${score.trajectory ?? '—'}<span style="color:#94a3b8;font-size:0.75rem;">/10</span></p>
          <p style="color:#64748b;font-size:0.75rem;margin:0.25rem 0 0;">Trajectory</p>
        </div>
      </div>

      ${sharedGrounds ? `<p style="color:#475569;font-size:0.875rem;margin:0 0 0.75rem;"><strong>What overlaps:</strong> ${esc(sharedGrounds)}</p>` : ''}
      ${score.summary ? `<p style="color:#475569;font-size:0.875rem;line-height:1.6;margin:0 0 1.25rem;">${esc(score.summary)}</p>` : ''}

      <a href="${esc(signalUrl)}" style="display:inline-block;padding:0.65rem 1.5rem;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:0.875rem;">See ${esc(ownerName)}'s Signal →</a>

      <p style="color:#94a3b8;font-size:0.75rem;margin:1.5rem 0 0;border-top:1px solid #e2e8f0;padding-top:1rem;line-height:1.6;">
        This is an automated introduction from Signal. ${esc(ownerName)} hasn't written this message — Signal found you based on profile overlap and sent this on their behalf.<br><br>
        <a href="${esc(unsubscribeUrl)}" style="color:#94a3b8;">Unsubscribe</a> · Signal · 114 Cress Road, Santa Cruz, CA 95060, USA
      </p>
    `),
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
  return data;
}
```

Also add `sendNetworkOutreach` to the `module.exports` at the bottom:
```js
module.exports = { sendVerificationCode, sendWelcome, sendWaitlistConfirm, sendEarlyAccessWelcome, sendJobAlert, sendNetworkOutreach };
```

---

## Step 2: Create `netlify/functions/signal-network-outreach.js`

```js
require('dotenv').config();
const crypto = require('crypto');
const { getOwnerByUserId } = require('./_services/db-signal-owners.cjs');
const { getContactById, updateContact } = require('./_services/db-signal-contacts.cjs');
const { sendNetworkOutreach } = require('./_services/email.cjs');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function makeUnsubscribeToken(contactId) {
  const secret = process.env.RESEND_API_KEY || 'fallback-secret';
  return crypto.createHmac('sha256', secret).update(contactId).digest('hex').slice(0, 32);
}

async function findEmailViaHunter(contact) {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) return null;

  const nameParts = (contact.name || '').trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  const company = contact.company || '';
  if (!firstName || !company) return null;

  // Derive domain: try to extract from linkedinUrl company page, else fall back to {company}.com
  let domain = null;
  if (contact.linkedinUrl) {
    // e.g. https://linkedin.com/company/acme → acme.com (heuristic)
    const companyMatch = contact.linkedinUrl.match(/linkedin\.com\/company\/([^/?]+)/);
    if (companyMatch) domain = `${companyMatch[1].replace(/-/g, '')}.com`;
  }
  if (!domain) domain = `${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;

  try {
    const url = `https://api.hunter.io/v2/email-finder?first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}&domain=${encodeURIComponent(domain)}&api_key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.email || null;
  } catch {
    return null;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { userId, contactId } = JSON.parse(event.body || '{}');
    if (!userId || !contactId) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'userId and contactId required' }) };
    }

    const owner = await getOwnerByUserId(userId);
    if (!owner || owner.status !== 'active') {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ success: false, error: 'Owner not found or inactive' }) };
    }

    const contact = await getContactById(contactId);
    if (!contact) {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ success: false, error: 'Contact not found' }) };
    }
    if (contact._ownerId !== owner.signalId) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ success: false, error: 'Forbidden' }) };
    }

    // Idempotent — don't send twice
    if (contact.outreachStatus === 'sent') {
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, alreadySent: true }),
      };
    }

    // Skip unsubscribed contacts
    if (contact.outreachStatus === 'unsubscribed') {
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, skipped: true, reason: 'unsubscribed' }),
      };
    }

    // Find email if not already known
    let email = contact.email || null;
    if (!email) {
      email = await findEmailViaHunter(contact);
      if (email) {
        await updateContact(contactId, { email, emailSource: 'hunter' });
      }
    }

    if (!email) {
      await updateContact(contactId, { outreachStatus: 'failed' });
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, noEmail: true }),
      };
    }

    // Build unsubscribe URL
    const token = makeUnsubscribeToken(contactId);
    const baseUrl = process.env.URL || 'https://signal.habitualos.com';
    const unsubscribeUrl = `${baseUrl}/api/signal-unsubscribe?contactId=${encodeURIComponent(contactId)}&token=${token}`;

    // Send
    const result = await sendNetworkOutreach({ to: email, owner, contact, unsubscribeUrl });
    const outreachEmailId = result?.id || null;

    await updateContact(contactId, {
      outreachStatus: 'sent',
      outreachSentAt: new Date().toISOString(),
      outreachEmailId,
    });

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, sent: true, email }),
    };

  } catch (error) {
    console.error('[signal-network-outreach] ERROR:', error);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
```

---

## Step 3: Create `netlify/functions/signal-unsubscribe.js`

This is a GET endpoint (linked from email). Returns HTML directly.

```js
require('dotenv').config();
const crypto = require('crypto');
const { db, admin } = require('@habitualos/db-core');

function makeUnsubscribeToken(contactId) {
  const secret = process.env.RESEND_API_KEY || 'fallback-secret';
  return crypto.createHmac('sha256', secret).update(contactId).digest('hex').slice(0, 32);
}

exports.handler = async (event) => {
  const { contactId, token } = event.queryStringParameters || {};

  const html = (msg, isError = false) => ({
    statusCode: isError ? 400 : 200,
    headers: { 'Content-Type': 'text/html' },
    body: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Signal</title>
      <style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f0f7ff;}
      .card{background:#fff;border-radius:12px;padding:2rem;max-width:400px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.06);}
      p{color:#475569;font-size:0.95rem;line-height:1.6;}</style></head>
      <body><div class="card"><p style="color:#7c3aed;font-weight:700;font-size:1.1rem;margin:0 0 0.75rem;">Signal</p><p>${msg}</p></div></body></html>`,
  });

  if (!contactId || !token) {
    return html('Invalid unsubscribe link.', true);
  }

  const expected = makeUnsubscribeToken(contactId);
  if (token !== expected) {
    return html('Invalid unsubscribe link.', true);
  }

  try {
    await db.collection('signal-contacts').doc(contactId).set(
      { outreachStatus: 'unsubscribed', _updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
    return html("You've been unsubscribed. You won't receive any more messages from Signal.");
  } catch (error) {
    console.error('[signal-unsubscribe] ERROR:', error);
    return html('Something went wrong. Please try again.', true);
  }
};
```

---

## Critical Files

| File | Action |
|---|---|
| `netlify/functions/_services/email.cjs` | Add `sendNetworkOutreach` + export |
| `netlify/functions/signal-network-outreach.js` | New |
| `netlify/functions/signal-unsubscribe.js` | New |

---

## Do not commit
Leave all changes for review.

## Verification
1. Create a test contact in Firestore `signal-contacts` with a real email address
2. POST `/api/signal-network-outreach` with `{ userId, contactId }`
3. Expect: `{ success: true, sent: true, email: "..." }`
4. Check Firestore: `outreachStatus: 'sent'`, `outreachSentAt`, `outreachEmailId` populated
5. Check inbox: email received with correct owner name, scores, sharedGrounds, unsubscribe link
6. Click unsubscribe link → "You've been unsubscribed" HTML page
7. Check Firestore: `outreachStatus: 'unsubscribed'`
8. POST outreach again for same contact → `{ alreadySent: true }`
