require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { Resend } = require('resend');
const { getOwnerBySignalId } = require('./_services/db-signal-owners.cjs');
const { decrypt } = require('./_services/crypto.cjs');
const { scoreOpportunity } = require('./_services/signal-score-opportunity.cjs');
const { saveJobAlert } = require('./_services/db-signal-job-alerts.cjs');
const { sendJobAlert } = require('./_services/email.cjs');

/**
 * POST /api/signal-job-alert-ingest
 * Resend inbound webhook — receives forwarded LinkedIn Job Alert emails.
 * Parses job listings, scores each one, saves to signal-job-alerts collection.
 * Notifies owner by email if any job scores ≥ 8.
 *
 * Inbound address format: jobs+{signalId}@teolunaams.resend.app
 */

const INBOUND_SECRET = process.env.RESEND_INBOUND_SECRET;

/**
 * Extract job listings from LinkedIn Job Alert email HTML.
 * LinkedIn alert emails contain one <table> per job listing with title, company, URL, snippet.
 * Falls back to text body if HTML parsing yields nothing.
 */
function extractJobsFromEmail(html, text) {
  const jobs = [];

  if (html) {
    // LinkedIn job alert links: href containing /jobs/view/ or linkedin.com/jobs/
    const jobBlockPattern = /href="(https:\/\/[^"]*linkedin\.com\/(?:comm\/)?jobs\/view\/[^"]*)"[^>]*>([^<]+)<\/a>/gi;
    const companyPattern = /<td[^>]*>\s*([A-Za-z][^<\n]{2,60})\s*<\/td>/g;

    // Extract all job URLs + titles from anchor tags
    let match;
    const seen = new Set();
    while ((match = jobBlockPattern.exec(html)) !== null) {
      const url = match[1].split('?')[0]; // strip tracking params
      const title = match[2].trim();
      if (!seen.has(url) && title.length > 3 && title.length < 150) {
        seen.add(url);
        jobs.push({ title, url, company: '', snippet: '' });
      }
    }

    // Try to extract company names — look for text nodes near each job entry
    // LinkedIn alert format: job title row followed by company/location row
    const rows = html.split(/<tr[\s>]/i);
    for (let i = 0; i < rows.length && i < jobs.length * 3; i++) {
      const row = rows[i];
      if (!row) continue;
      // Find which job this row belongs to by URL
      const urlMatch = row.match(/linkedin\.com\/jobs\/view\/(\d+)/);
      if (!urlMatch) continue;
      const jobUrl = `https://www.linkedin.com/jobs/view/${urlMatch[1]}`;
      const job = jobs.find(j => j.url.includes(urlMatch[1]));
      if (!job) continue;
      // Extract text content from this row block (next 2 rows) for company/location
      const block = rows.slice(i, i + 3).join(' ');
      const textNodes = block.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      // Company is usually the second line of text after the job title
      const lines = textNodes.split(/[·•\|]/).map(s => s.trim()).filter(s => s.length > 1 && s.length < 80);
      if (lines.length >= 2 && !job.company) job.company = lines[1] || '';
      if (lines.length >= 3 && !job.snippet) job.snippet = lines[2] || '';
    }
  }

  // Fallback: extract from plain text body
  if (jobs.length === 0 && text) {
    const urlPattern = /https:\/\/[^\s]*linkedin\.com\/(?:comm\/)?jobs\/view\/[^\s)>"]*/g;
    let match;
    const seen = new Set();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    while ((match = urlPattern.exec(text)) !== null) {
      const url = match[0].split('?')[0];
      if (seen.has(url)) continue;
      seen.add(url);
      // Find the line index containing this URL, use surrounding lines as title/company
      const idx = lines.findIndex(l => l.includes(url));
      const title = idx > 0 ? lines[idx - 1] : '';
      const company = idx > 1 ? lines[idx - 2] : '';
      if (title.length > 3 && title.length < 150) {
        jobs.push({ title, url, company, snippet: '' });
      }
    }
  }

  return jobs.slice(0, 20); // cap at 20 per email
}

exports.handler = async (event) => {
  // Resend sends inbound as POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  // Verify shared secret
  if (INBOUND_SECRET) {
    const sig = event.headers['x-resend-signature'] || event.headers['x-webhook-secret'] || '';
    if (sig !== INBOUND_SECRET) {
      console.warn('[signal-job-alert-ingest] Invalid webhook secret');
      return { statusCode: 401, body: 'Unauthorized' };
    }
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  // Resend wraps event data under payload.data
  const eventData = payload.data || payload;
  const { from, to, subject, date, email_id } = eventData;

  // Extract signalId from to address: jobs+erik@... → "erik"
  const toAddr = Array.isArray(to) ? to[0] : (to || '');
  const plusMatch = toAddr.match(/jobs\+([^@]+)@/i);
  if (!plusMatch) {
    console.warn('[signal-job-alert-ingest] No signalId in to address:', toAddr);
    return { statusCode: 200, body: JSON.stringify({ success: false, reason: 'no-signal-id' }) };
  }
  const signalId = plusMatch[1].toLowerCase();

  // Load owner
  const owner = await getOwnerBySignalId(signalId);
  if (!owner || owner.status !== 'active') {
    console.warn('[signal-job-alert-ingest] Owner not found or inactive:', signalId);
    // Return 200 to prevent Resend retry
    return { statusCode: 200, body: JSON.stringify({ success: false, reason: 'owner-not-found' }) };
  }

  // Fetch email body from Resend (webhooks only include metadata)
  let html = '';
  let text = '';
  if (email_id) {
    try {
      const resendClient = new Resend(process.env.RESEND_API_KEY);
      const { data: emailBody } = await resendClient.emails.receiving.get(email_id);
      html = emailBody?.html || '';
      text = emailBody?.text || '';
      console.log('[signal-job-alert-ingest] body lengths — html:', html.length, 'text:', text.length);
      console.log('[signal-job-alert-ingest] text preview:', text.slice(0, 500));
    } catch (err) {
      console.warn('[signal-job-alert-ingest] Failed to fetch email body:', err.message);
    }
  }

  // Get API key
  let apiKey = process.env.ANTHROPIC_API_KEY;
  if (owner.anthropicApiKey) {
    try { apiKey = decrypt(owner.anthropicApiKey); } catch (_) {}
  }
  if (!apiKey) {
    console.error('[signal-job-alert-ingest] No Anthropic API key for:', signalId);
    return { statusCode: 200, body: JSON.stringify({ success: false, reason: 'no-api-key' }) };
  }

  // Parse jobs from email
  const rawJobs = extractJobsFromEmail(html, text);
  if (rawJobs.length === 0) {
    console.warn('[signal-job-alert-ingest] No jobs found in email for:', signalId);
    return { statusCode: 200, body: JSON.stringify({ success: true, alertId: null, jobCount: 0, highScoreCount: 0 }) };
  }

  console.log(`[signal-job-alert-ingest] Scoring ${rawJobs.length} jobs for ${signalId}`);

  const anthropicClient = new Anthropic({ apiKey });
  const scoredJobs = [];

  for (const job of rawJobs) {
    try {
      const content = [
        job.title,
        job.company ? `Company: ${job.company}` : '',
        job.snippet || '',
        job.url ? `URL: ${job.url}` : '',
      ].filter(Boolean).join('\n');

      const { parsed, jdSummary } = await scoreOpportunity({
        owner,
        opportunity: { title: job.title, type: 'jd', content },
        anthropicClient,
      });

      scoredJobs.push({
        title: job.title,
        company: job.company || (jdSummary?.company || ''),
        url: job.url || '',
        snippet: job.snippet || '',
        score: parsed.score || {},
        recommendation: parsed.recommendation || '',
        summary: parsed.summary || '',
        strengths: parsed.strengths || [],
        gaps: parsed.gaps || [],
      });
    } catch (err) {
      console.error(`[signal-job-alert-ingest] Failed to score job "${job.title}":`, err.message);
      scoredJobs.push({
        title: job.title,
        company: job.company || '',
        url: job.url || '',
        snippet: job.snippet || '',
        score: {},
        recommendation: 'error',
        summary: '',
        strengths: [],
        gaps: [],
      });
    }
  }

  const highScoreJobs = scoredJobs.filter(j => (j.score?.overall ?? 0) >= 8);
  const alertId = await saveJobAlert({
    signalId,
    emailSubject: subject || '',
    emailDate: date || new Date().toISOString(),
    source: 'linkedin-job-alert',
    jobs: scoredJobs,
    highScoreCount: highScoreJobs.length,
  });

  // Notify if any job hit 8+
  if (highScoreJobs.length > 0 && owner._email) {
    try {
      await sendJobAlert({ to: owner._email, signalId, jobs: highScoreJobs });
    } catch (err) {
      console.warn('[signal-job-alert-ingest] Email notification failed (non-fatal):', err.message);
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, alertId, jobCount: scoredJobs.length, highScoreCount: highScoreJobs.length }),
  };
};
