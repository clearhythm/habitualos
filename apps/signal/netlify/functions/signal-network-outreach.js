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
    if (contact._ownerId !== owner.id) {
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
