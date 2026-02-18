#!/usr/bin/env node

/**
 * Zer0 Gr@vity — Local Dashboard Server
 *
 * Usage: node server.cjs
 * Opens at http://localhost:3333
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { runExperiment } = require('./src/engine/experiment.cjs');

const PORT = 3333;
const RESULTS_DIR = path.join(__dirname, 'src', 'results');
const TEST_CASES_DIR = path.join(__dirname, 'src', 'test-cases');

// Ensure results dir exists
if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

function loadTestCases() {
  const files = fs.readdirSync(TEST_CASES_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => JSON.parse(fs.readFileSync(path.join(TEST_CASES_DIR, f), 'utf-8')));
}

function loadResults() {
  if (!fs.existsSync(RESULTS_DIR)) return [];
  const files = fs.readdirSync(RESULTS_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => ({
    filename: f,
    data: JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, f), 'utf-8'))
  })).sort((a, b) => b.filename.localeCompare(a.filename));
}

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// Active experiment tracking for SSE
let activeExperiment = null;

const server = http.createServer(async (req, res) => {
  // CORS for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Serve dashboard
  if (url.pathname === '/' && req.method === 'GET') {
    const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf-8');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }

  // API: Get test cases
  if (url.pathname === '/api/test-cases' && req.method === 'GET') {
    json(res, loadTestCases());
    return;
  }

  // API: Get saved results
  if (url.pathname === '/api/results' && req.method === 'GET') {
    json(res, loadResults());
    return;
  }

  // API: Run experiment
  if (url.pathname === '/api/run' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const { text, encodingSystem, testCaseId } = body;

      if (!text || !encodingSystem) {
        json(res, { error: 'text and encodingSystem are required' }, 400);
        return;
      }

      const result = await runExperiment({
        originalText: text,
        encodingSystem,
        testCaseId: testCaseId || 'manual'
      });

      // Auto-save result
      const filename = `${testCaseId || 'manual'}-${Date.now()}.json`;
      fs.writeFileSync(
        path.join(RESULTS_DIR, filename),
        JSON.stringify(result, null, 2)
      );

      json(res, { ...result, savedAs: filename });
    } catch (e) {
      console.error('[server] Experiment error:', e.message);
      json(res, { error: e.message }, 500);
    }
    return;
  }

  // API: Delete a result
  if (url.pathname === '/api/results' && req.method === 'DELETE') {
    // Not implemented yet
    json(res, { error: 'Not implemented' }, 501);
    return;
  }

  // 404
  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n  Zer0 Gr@vity Dashboard`);
  console.log(`  ─────────────────────`);
  console.log(`  http://localhost:${PORT}\n`);
});
