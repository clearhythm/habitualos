#!/usr/bin/env node
/**
 * Signal API integration test script.
 * Runs against a live local dev server (npm run start).
 *
 * Usage:
 *   node scripts/test-api.js [baseUrl]
 *   node scripts/test-api.js http://localhost:8888
 *
 * Test data uses userId `u-test-migration-001` and signalId `test-migration-signal`
 * so test records are identifiable. Clean up test data manually in Firestore if needed.
 *
 * Tests are read-only where possible. Write tests clean up after themselves
 * when a delete endpoint exists.
 */

'use strict';

const assert = require('assert');

const BASE_URL = process.argv[2] || 'http://localhost:8888';
const API = `${BASE_URL}/api`;

// Test identity — identifiable in Firestore
const TEST_USER_ID = 'u-test-migration-001';
const TEST_SIGNAL_ID = 'test-migration-signal';
const TEST_EMAIL = 'test-migration-001@test.invalid';

let passed = 0;
let failed = 0;
const failures = [];

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function post(endpoint, body) {
  const url = `${API}/${endpoint}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  let data;
  try {
    data = await res.json();
  } catch {
    data = { _rawStatus: res.status, _parseError: true };
  }
  return { status: res.status, data };
}

async function run(name, fn) {
  try {
    await fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    const msg = err.message || String(err);
    console.log(`  FAIL  ${name}`);
    console.log(`        ${msg}`);
    failed++;
    failures.push({ name, msg });
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

/**
 * POST /api/signal-waitlist
 * { email, context }
 */
async function testWaitlist() {
  const { status, data } = await post('signal-waitlist', {
    email: TEST_EMAIL,
    context: 'test-api.js migration test'
  });
  assert.strictEqual(status, 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`);
  assert.strictEqual(data.success, true, `Expected success:true, got: ${JSON.stringify(data)}`);
}

async function testWaitlistMissingEmail() {
  const { status, data } = await post('signal-waitlist', { context: 'no email' });
  assert.strictEqual(status, 400, `Expected 400, got ${status}`);
  assert.strictEqual(data.success, false);
}

/**
 * POST /api/signal-register
 * { userId, email, displayName, signalId }
 *
 * Note: this endpoint creates a pending owner + auth code record and sends email.
 * Will return 409 if signalId is already taken on repeat runs.
 * Accept both 200 (first run) and 409 (repeat run) as valid outcomes.
 */
async function testRegister() {
  const { status, data } = await post('signal-register', {
    userId: TEST_USER_ID,
    email: TEST_EMAIL,
    displayName: 'Test Migration User',
    signalId: TEST_SIGNAL_ID
  });
  const acceptable = [200, 409];
  assert.ok(
    acceptable.includes(status),
    `Expected 200 or 409, got ${status}: ${JSON.stringify(data)}`
  );
  if (status === 200) {
    assert.strictEqual(data.success, true);
  } else {
    // 409 = already taken — acceptable on repeat runs
    assert.strictEqual(data.success, false);
    assert.ok(data.error, 'Expected error message on 409');
  }
}

async function testRegisterValidation() {
  const { status, data } = await post('signal-register', {
    userId: TEST_USER_ID,
    email: 'not-an-email',
    displayName: 'X',
    signalId: TEST_SIGNAL_ID
  });
  assert.strictEqual(status, 400, `Expected 400, got ${status}`);
  assert.strictEqual(data.success, false);
}

/**
 * POST /api/signal-ingest
 * { userId, signalId, source, summary, topics, skills, technologies }
 *
 * Note: signal-ingest requires owner.status === 'active' AND owner._userId === userId.
 * This will return 403 unless a seeded active owner doc exists for TEST_SIGNAL_ID/TEST_USER_ID.
 * Accept 403 gracefully and note the skip.
 */
async function testIngest() {
  const { status, data } = await post('signal-ingest', {
    userId: TEST_USER_ID,
    signalId: TEST_SIGNAL_ID,
    source: 'claude-code',
    repo: 'signal',
    summary: 'Test migration run: verified field naming convention with _ prefix on all Firestore metadata fields.',
    topics: ['api-testing', 'field-naming', 'migration'],
    skills: ['Node.js', 'Firestore', 'integration testing'],
    technologies: ['Netlify Functions', 'Firestore', 'Node.js fetch']
  });

  if (status === 403) {
    // Owner doc not seeded as active — skip gracefully
    console.log('        (skipped: no active owner doc for test-migration-signal — seed Firestore to test write path)');
    return;
  }

  assert.strictEqual(status, 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`);
  assert.strictEqual(data.success, true);
  assert.ok(typeof data.docId === 'string', 'Expected docId string in response');
  assert.ok(typeof data.created === 'boolean', 'Expected created boolean in response');
}

async function testIngestMissingFields() {
  const { status, data } = await post('signal-ingest', {
    userId: TEST_USER_ID
    // missing signalId and summary
  });
  assert.strictEqual(status, 400, `Expected 400, got ${status}`);
  assert.strictEqual(data.success, false);
}

/**
 * POST /api/signal-context-status
 * { userId, signalId }
 *
 * Accepts userId or signalId. Returns 404 if signal not found.
 * Accept 404 gracefully if owner doc doesn't exist.
 */
async function testContextStatusBySignalId() {
  const { status, data } = await post('signal-context-status', {
    signalId: TEST_SIGNAL_ID
  });

  if (status === 404) {
    console.log('        (skipped: no owner doc for test-migration-signal)');
    return;
  }

  assert.strictEqual(status, 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`);
  assert.strictEqual(data.success, true);
  assert.ok(data.stats !== undefined, 'Expected stats in response');
  assert.ok(typeof data.stats.total === 'number', 'Expected stats.total to be a number');
  assert.ok(typeof data.stats.processed === 'number', 'Expected stats.processed to be a number');
  assert.ok(typeof data.stats.pending === 'number', 'Expected stats.pending to be a number');
}

async function testContextStatusByUserId() {
  const { status, data } = await post('signal-context-status', {
    userId: TEST_USER_ID
  });

  if (status === 404) {
    console.log('        (skipped: no owner doc for u-test-migration-001)');
    return;
  }

  assert.strictEqual(status, 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`);
  assert.strictEqual(data.success, true);
  assert.ok(data.stats !== undefined, 'Expected stats object');
}

async function testContextStatusMissingParams() {
  const { status, data } = await post('signal-context-status', {});
  assert.strictEqual(status, 400, `Expected 400, got ${status}`);
  assert.strictEqual(data.success, false);
}

/**
 * POST /api/signal-evaluations-get
 * { userId }
 *
 * Requires active owner doc. Accept 403 gracefully.
 */
async function testEvaluationsGet() {
  const { status, data } = await post('signal-evaluations-get', {
    userId: TEST_USER_ID
  });

  if (status === 403) {
    console.log('        (skipped: no active owner doc for u-test-migration-001)');
    return;
  }

  assert.strictEqual(status, 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`);
  assert.strictEqual(data.success, true);
  assert.ok(Array.isArray(data.evaluations), 'Expected evaluations array');
}

async function testEvaluationsGetInvalidUserId() {
  const { status, data } = await post('signal-evaluations-get', {
    userId: 'not-a-valid-id'
  });
  assert.strictEqual(status, 400, `Expected 400, got ${status}`);
  assert.strictEqual(data.success, false);
}

/**
 * POST /api/signal-leads-get
 * { userId }
 *
 * Requires active owner doc. Accept 403 gracefully.
 */
async function testLeadsGet() {
  const { status, data } = await post('signal-leads-get', {
    userId: TEST_USER_ID
  });

  if (status === 403) {
    console.log('        (skipped: no active owner doc for u-test-migration-001)');
    return;
  }

  assert.strictEqual(status, 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`);
  assert.strictEqual(data.success, true);
  assert.ok(Array.isArray(data.leads), 'Expected leads array');
}

async function testLeadsGetInvalidUserId() {
  const { status, data } = await post('signal-leads-get', {
    userId: 'bad-id'
  });
  assert.strictEqual(status, 400, `Expected 400, got ${status}`);
  assert.strictEqual(data.success, false);
}

// ─── Run all ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nSignal API Tests — ${BASE_URL}\n`);

  console.log('signal-waitlist');
  await run('POST /api/signal-waitlist — stores email', testWaitlist);
  await run('POST /api/signal-waitlist — rejects missing email', testWaitlistMissingEmail);

  console.log('\nsignal-register');
  await run('POST /api/signal-register — creates or 409 if taken', testRegister);
  await run('POST /api/signal-register — rejects invalid email', testRegisterValidation);

  console.log('\nsignal-ingest');
  await run('POST /api/signal-ingest — ingests session summary (active owner required)', testIngest);
  await run('POST /api/signal-ingest — rejects missing required fields', testIngestMissingFields);

  console.log('\nsignal-context-status');
  await run('POST /api/signal-context-status — by signalId', testContextStatusBySignalId);
  await run('POST /api/signal-context-status — by userId', testContextStatusByUserId);
  await run('POST /api/signal-context-status — rejects missing params', testContextStatusMissingParams);

  console.log('\nsignal-evaluations-get');
  await run('POST /api/signal-evaluations-get — returns evaluations (active owner required)', testEvaluationsGet);
  await run('POST /api/signal-evaluations-get — rejects invalid userId', testEvaluationsGetInvalidUserId);

  console.log('\nsignal-leads-get');
  await run('POST /api/signal-leads-get — returns leads (active owner required)', testLeadsGet);
  await run('POST /api/signal-leads-get — rejects invalid userId', testLeadsGetInvalidUserId);

  // ── Summary ──────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log(`\n${passed}/${total} passed`);

  if (failed > 0) {
    console.log(`\nFailed tests:`);
    failures.forEach(f => console.log(`  - ${f.name}: ${f.msg}`));
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
