/**
 * Signal API test suite.
 *
 * Makes real HTTP calls to the local dev server and asserts on responses.
 * Requires a running dev server: npm run start
 *
 * Usage:
 *   node tests/api.test.js [base_url]
 *
 * Examples:
 *   node tests/api.test.js                          # http://localhost:8888
 *   node tests/api.test.js https://signal.habitualos.com
 *
 * Test data uses the 'erik-burns' signalId and Erik's userId from localStorage.
 * Set SIGNAL_USER_ID and SIGNAL_SIGNAL_ID env vars to override.
 *
 * Keep this file up to date when adding or changing endpoints or field names.
 */

require('dotenv').config();
const assert = require('assert');

const BASE = process.argv[2] || 'http://localhost:8888';
const SIGNAL_ID = process.env.SIGNAL_SIGNAL_ID || 'erik';
const USER_ID   = process.env.SIGNAL_USER_ID   || null; // set this to your userId from localStorage

// ─── Test runner ──────────────────────────────────────────────────────────────

const results = [];

async function test(name, fn) {
  try {
    await fn();
    results.push({ name, pass: true });
    console.log(`  ✓ ${name}`);
  } catch (err) {
    results.push({ name, pass: false, error: err.message });
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

async function post(path, body) {
  const res = await fetch(`${BASE}/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\nSignal API tests → ${BASE}\n`);

  // ── signal-waitlist ────────────────────────────────────────────────────────
  console.log('signal-waitlist');

  await test('POST valid email returns success', async () => {
    const { status, data } = await post('signal-waitlist', {
      email: 'test-signal-api@example.com',
      context: 'API test run',
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
  });

  await test('POST missing email returns 400', async () => {
    const { status, data } = await post('signal-waitlist', { context: 'no email' });
    assert.strictEqual(status, 400);
    assert.strictEqual(data.success, false);
  });

  await test('POST invalid email returns 400', async () => {
    const { status, data } = await post('signal-waitlist', { email: 'notanemail' });
    assert.strictEqual(status, 400);
    assert.strictEqual(data.success, false);
  });

  // ── signal-ingest ──────────────────────────────────────────────────────────
  console.log('\nsignal-ingest');

  if (!USER_ID) {
    console.log('  (skipped — set SIGNAL_USER_ID env var to test owner ingest)');
  } else {
    await test('POST valid ingest returns success', async () => {
      const { status, data } = await post('signal-ingest', {
        userId: USER_ID,
        signalId: SIGNAL_ID,
        source: 'claude-code',
        repo: 'habitualos/signal',
        summary: 'API test session — verifying field migration and endpoint health.',
        topics: ['testing', 'api'],
        skills: ['Node.js', 'Firestore'],
        technologies: ['Netlify Functions'],
      });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.docId, 'docId should be returned');
    });
  }

  await test('POST missing signalId returns 400', async () => {
    const { status, data } = await post('signal-ingest', {
      userId: 'u-test-000',
      summary: 'no signal id',
      topics: [],
      skills: [],
      technologies: [],
    });
    assert.strictEqual(status, 400);
    assert.strictEqual(data.success, false);
  });

  // ── signal-context-status ──────────────────────────────────────────────────
  console.log('\nsignal-context-status');

  await test('POST by signalId returns stats', async () => {
    const { status, data } = await post('signal-context-status', { signalId: SIGNAL_ID });
    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(typeof data.stats === 'object', 'stats should be an object');
    assert.ok('total' in data.stats, 'stats.total should exist');
  });

  await test('POST unknown signalId returns 404', async () => {
    const { status, data } = await post('signal-context-status', { signalId: 'does-not-exist-xyz' });
    assert.strictEqual(status, 404);
    assert.strictEqual(data.success, false);
  });

  await test('POST missing userId and signalId returns 400', async () => {
    const { status, data } = await post('signal-context-status', {});
    assert.strictEqual(status, 400);
    assert.strictEqual(data.success, false);
  });

  // ── signal-evaluations-get ─────────────────────────────────────────────────
  console.log('\nsignal-evaluations-get');

  if (USER_ID) {
    await test('POST with valid userId returns evaluations array', async () => {
      const { status, data } = await post('signal-evaluations-get', { userId: USER_ID });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.evaluations), 'evaluations should be an array');
    });
  } else {
    console.log('  (skipped — set SIGNAL_USER_ID env var to test owner endpoints)');
  }

  await test('POST invalid userId format returns 400', async () => {
    const { status, data } = await post('signal-evaluations-get', { userId: 'bad-id' });
    assert.strictEqual(status, 400);
    assert.strictEqual(data.success, false);
  });

  await test('POST unknown userId returns 403', async () => {
    const { status, data } = await post('signal-evaluations-get', { userId: 'u-unknown-00000' });
    assert.strictEqual(status, 403);
    assert.strictEqual(data.success, false);
  });

  // ── signal-leads-get ───────────────────────────────────────────────────────
  console.log('\nsignal-leads-get');

  if (USER_ID) {
    await test('POST with valid userId returns leads array', async () => {
      const { status, data } = await post('signal-leads-get', { userId: USER_ID });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.leads), 'leads should be an array');
    });
  } else {
    console.log('  (skipped — set SIGNAL_USER_ID env var to test owner endpoints)');
  }

  await test('POST invalid userId format returns 400', async () => {
    const { status, data } = await post('signal-leads-get', { userId: 'bad-id' });
    assert.strictEqual(status, 400);
    assert.strictEqual(data.success, false);
  });

  await test('POST unknown userId returns 403', async () => {
    const { status, data } = await post('signal-leads-get', { userId: 'u-unknown-00000' });
    assert.strictEqual(status, 403);
    assert.strictEqual(data.success, false);
  });

  // ── signal-config-get ──────────────────────────────────────────────────────
  console.log('\nsignal-config-get');

  await test('POST with known signalId returns config', async () => {
    const { status, data } = await post('signal-config-get', { signalId: SIGNAL_ID });
    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(data.config, 'config object should be present');
    assert.ok(data.config.displayName, 'config.displayName should be present');
  });

  await test('POST with unknown signalId returns 404', async () => {
    const { status, data } = await post('signal-config-get', { signalId: 'does-not-exist-xyz' });
    assert.strictEqual(status, 404);
    assert.strictEqual(data.success, false);
  });

  // ── signal-contacts-get ────────────────────────────────────────────────────
  console.log('\nsignal-contacts-get');

  if (USER_ID) {
    await test('POST with valid userId returns contacts array', async () => {
      const { status, data } = await post('signal-contacts-get', { userId: USER_ID });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.contacts), 'contacts should be an array');
    });
  } else {
    console.log('  (skipped — set SIGNAL_USER_ID env var to test owner endpoints)');
  }

  await test('POST unknown userId returns 403', async () => {
    const { status, data } = await post('signal-contacts-get', { userId: 'u-unknown-00000' });
    assert.strictEqual(status, 403);
    assert.strictEqual(data.success, false);
  });

  await test('POST missing userId returns 400', async () => {
    const { status, data } = await post('signal-contacts-get', {});
    assert.strictEqual(status, 400);
    assert.strictEqual(data.success, false);
  });

  // ── signal-profile-scrape ──────────────────────────────────────────────────
  // Note: real scrape makes AI + Tavily calls — only runs when USER_ID is set
  console.log('\nsignal-profile-scrape');

  if (USER_ID && process.env.TAVILY_API_KEY) {
    await test('POST valid url returns contact with score', async () => {
      const { status, data } = await post('signal-profile-scrape', {
        userId: USER_ID,
        url: 'https://www.linkedin.com/in/adammgrant/',
      });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.contact || data.notAPerson, 'should return contact or notAPerson flag');
      if (data.contact) {
        assert.ok(data.score, 'score should be present');
        assert.ok(typeof data.score.overall === 'number', 'score.overall should be a number');
      }
    });
  } else {
    console.log(`  (skipped — need ${!USER_ID ? 'SIGNAL_USER_ID' : 'TAVILY_API_KEY'})`);
  }

  await test('POST missing url returns 400', async () => {
    const { status, data } = await post('signal-profile-scrape', { userId: 'u-unknown-00000' });
    assert.strictEqual(status, 400);
    assert.strictEqual(data.success, false);
  });

  await test('POST unknown userId returns 403', async () => {
    const { status, data } = await post('signal-profile-scrape', {
      userId: 'u-unknown-00000',
      url: 'https://example.com',
    });
    assert.strictEqual(status, 403);
    assert.strictEqual(data.success, false);
  });

  // ── signal-network-discover-background ────────────────────────────────────
  // Note: fires a background job — only polls status, does not wait for completion
  console.log('\nsignal-network-discover-background');

  let discoverJobId = null;

  if (USER_ID) {
    await test('POST valid queries returns 202', async () => {
      // Netlify CLI swallows background fn response body — only assert status
      const res = await fetch(`${BASE}/api/signal-network-discover-background`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: USER_ID, queries: ['AI founder San Francisco'] }),
      });
      assert.strictEqual(res.status, 202);
    });
  } else {
    console.log('  (skipped — set SIGNAL_USER_ID env var to test discovery)');
  }

  // Note: Netlify CLI intercepts background function responses — validation errors
  // (400/403) are swallowed and return empty 202 locally. Can't assert on them here.

  // ── signal-network-discover-status ────────────────────────────────────────
  console.log('\nsignal-network-discover-status');

  if (USER_ID && discoverJobId) {
    await test('POST with valid jobId returns job status', async () => {
      const { status, data } = await post('signal-network-discover-status', {
        userId: USER_ID,
        jobId: discoverJobId,
      });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.job, 'job object should be present');
      assert.ok(['running', 'done', 'error'].includes(data.job.status), 'job.status should be valid');
    });
  } else {
    console.log('  (skipped — requires USER_ID and a discover job)');
  }

  await test('POST unknown jobId returns 404', async () => {
    const userId = USER_ID || 'u-unknown-00000';
    const { status, data } = await post('signal-network-discover-status', {
      userId,
      jobId: 'job-does-not-exist',
    });
    // 404 if owner found but job missing, 403 if owner not found
    assert.ok([403, 404].includes(status), `expected 403 or 404, got ${status}`);
    assert.strictEqual(data.success, false);
  });

  await test('POST missing jobId returns 400', async () => {
    const { status, data } = await post('signal-network-discover-status', { userId: 'u-unknown-00000' });
    assert.strictEqual(status, 400);
    assert.strictEqual(data.success, false);
  });

  // ── signal-network-csv-import ──────────────────────────────────────────────
  // Note: real import makes AI + Tavily calls — only runs when USER_ID is set
  console.log('\nsignal-network-csv-import');

  if (USER_ID && process.env.TAVILY_API_KEY) {
    await test('POST minimal valid CSV returns scored contacts', async () => {
      const csvText = [
        'First Name,Last Name,Company,Position,Email Address',
        'Adam,Grant,Wharton,Professor,',
      ].join('\n');
      const { status, data } = await post('signal-network-csv-import', { userId: USER_ID, csvText });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(typeof data.total === 'number', 'total should be a number');
      assert.ok(Array.isArray(data.topMatches), 'topMatches should be an array');
    });
  } else {
    console.log(`  (skipped — need ${!USER_ID ? 'SIGNAL_USER_ID' : 'TAVILY_API_KEY'})`);
  }

  await test('POST missing csvText returns 400', async () => {
    const { status, data } = await post('signal-network-csv-import', { userId: 'u-unknown-00000' });
    assert.strictEqual(status, 400);
    assert.strictEqual(data.success, false);
  });

  await test('POST unknown userId returns 403', async () => {
    const { status, data } = await post('signal-network-csv-import', {
      userId: 'u-unknown-00000',
      csvText: 'First Name,Last Name\nAdam,Grant',
    });
    assert.strictEqual(status, 403);
    assert.strictEqual(data.success, false);
  });

  // ─── Summary ────────────────────────────────────────────────────────────────
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
