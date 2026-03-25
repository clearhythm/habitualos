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

const assert = require('assert');

const BASE = process.argv[2] || 'http://localhost:8888';
const SIGNAL_ID = process.env.SIGNAL_SIGNAL_ID || 'erik-burns';
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

  await test('POST valid ingest returns success', async () => {
    const { status, data } = await post('signal-ingest', {
      userId: USER_ID || 'u-test-000',
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
    assert.ok(data.displayName, 'displayName should be present');
  });

  await test('POST with unknown signalId returns 404', async () => {
    const { status, data } = await post('signal-config-get', { signalId: 'does-not-exist-xyz' });
    assert.strictEqual(status, 404);
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
