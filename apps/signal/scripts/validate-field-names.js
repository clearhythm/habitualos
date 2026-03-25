#!/usr/bin/env node
/**
 * validate-field-names.js
 *
 * Scans netlify/functions/ for un-prefixed Firestore field names.
 * Checks for old-style .where('fieldName', ...) and .data().fieldName patterns.
 * Exits 1 if violations found, 0 if clean.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../netlify/functions');

// Patterns that indicate un-prefixed field names still used as Firestore keys
const PATTERNS = [
  // .where() with un-prefixed field name
  { re: /\.where\(['"`]signalId['"`]/, label: ".where('signalId'" },
  { re: /\.where\(['"`]userId['"`]/, label: ".where('userId'" },
  { re: /\.where\(['"`]evalId['"`]/, label: ".where('evalId'" },
  { re: /\.where\(['"`]conversationId['"`]/, label: ".where('conversationId'" },
  { re: /\.where\(['"`]visitorId['"`]/, label: ".where('visitorId'" },
  { re: /\.where\(['"`]resumeId['"`]/, label: ".where('resumeId'" },
  { re: /\.where\(['"`]coverId['"`]/, label: ".where('coverId'" },
  { re: /\.where\(['"`]evaluationId['"`]/, label: ".where('evaluationId'" },
  { re: /\.where\(['"`]email['"`]/, label: ".where('email'" },
  // .data().fieldName reads
  { re: /\.data\(\)\.signalId\b/, label: ".data().signalId" },
  { re: /\.data\(\)\.userId\b/, label: ".data().userId" },
  { re: /\.data\(\)\.evalId\b/, label: ".data().evalId" },
  { re: /\.data\(\)\.conversationId\b/, label: ".data().conversationId" },
  { re: /\.data\(\)\.visitorId\b/, label: ".data().visitorId" },
  { re: /\.data\(\)\.resumeId\b/, label: ".data().resumeId" },
  { re: /\.data\(\)\.coverId\b/, label: ".data().coverId" },
  { re: /\.data\(\)\.evaluationId\b/, label: ".data().evaluationId" },
  // data.fieldName reads (where data = snap.data())
  { re: /\bdata\.signalId\b/, label: "data.signalId" },
  { re: /\bdata\.userId\b/, label: "data.userId" },
  { re: /\bdata\.evalId\b/, label: "data.evalId" },
];

function collectFiles(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full, results);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.cjs'))) {
      results.push(full);
    }
  }
  return results;
}

const files = collectFiles(ROOT);
const violations = [];

for (const file of files) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const { re, label } of PATTERNS) {
      if (re.test(line)) {
        violations.push({ file: path.relative(ROOT, file), line: i + 1, label, text: line.trim() });
      }
    }
  });
}

if (violations.length === 0) {
  console.log('✓ No un-prefixed Firestore field names found.');
  process.exit(0);
} else {
  console.error(`✗ Found ${violations.length} violation(s):\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.label}]`);
    console.error(`    ${v.text}`);
  }
  process.exit(1);
}
