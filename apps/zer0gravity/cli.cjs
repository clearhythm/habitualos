#!/usr/bin/env node

/**
 * Zer0 Gr@vity — CLI Experiment Runner
 *
 * Usage:
 *   node cli.cjs run --level 1           Run Level 1 experiments
 *   node cli.cjs run --all               Run all levels
 *   node cli.cjs run --level 2 --encoding path/to/encoding.txt
 *   node cli.cjs run --all --output results.json
 */

const fs = require('fs');
const path = require('path');

// Load env from monorepo root
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { runExperiment } = require('./src/engine/experiment.cjs');

const DEFAULT_ENCODING = `VOWEL_DROP: Remove all vowels from words longer than 3 letters.
COMMON_SUBS: Replace common words: 'the'→'θ', 'is'→'=', 'and'→'&', 'to'→'→', 'of'→'∘', 'a'→'α', 'in'→'∈', 'that'→'∴', 'for'→'∀', 'with'→'⊕', 'this'→'⊙'.
PRESERVE: Keep numbers, proper nouns, and punctuation unchanged.
COMPACT: Remove unnecessary whitespace. Use '|' as word separator where ambiguous.`;

function parseArgs(argv) {
  const args = { command: null, level: null, all: false, encoding: null, output: null };
  let i = 2; // skip 'node' and script path

  if (argv[i]) args.command = argv[i++];

  while (i < argv.length) {
    const arg = argv[i];
    if (arg === '--level' && argv[i + 1]) {
      args.level = parseInt(argv[++i]);
    } else if (arg === '--all') {
      args.all = true;
    } else if (arg === '--encoding' && argv[i + 1]) {
      args.encoding = argv[++i];
    } else if (arg === '--output' && argv[i + 1]) {
      args.output = argv[++i];
    }
    i++;
  }

  return args;
}

function loadTestCases(level) {
  const testCaseDir = path.join(__dirname, 'src', 'test-cases');
  const files = {
    1: 'level-1-simple.json',
    2: 'level-2-brief.json',
    3: 'level-3-procedural.json'
  };

  if (level) {
    const file = files[level];
    if (!file) {
      console.error(`Unknown level: ${level}. Valid levels: 1, 2, 3`);
      process.exit(1);
    }
    return [JSON.parse(fs.readFileSync(path.join(testCaseDir, file), 'utf-8'))];
  }

  // Load all
  return Object.values(files).map(f =>
    JSON.parse(fs.readFileSync(path.join(testCaseDir, f), 'utf-8'))
  );
}

function loadEncoding(encodingPath) {
  if (!encodingPath) return DEFAULT_ENCODING;

  const resolved = path.resolve(__dirname, encodingPath);
  if (!fs.existsSync(resolved)) {
    console.error(`Encoding file not found: ${resolved}`);
    process.exit(1);
  }
  return fs.readFileSync(resolved, 'utf-8');
}

function printSummary(results) {
  console.error('\n========================================');
  console.error('  Zer0 Gr@vity Experiment Results');
  console.error('========================================\n');

  for (const result of results) {
    const textPreview = result.originalText.length > 40
      ? result.originalText.slice(0, 40) + '...'
      : result.originalText;

    console.error(`  ${result.testCaseId}: "${textPreview}"`);
    console.error(`    Compression: ${result.details.compressionPercent}% (${result.originalTokens} → ${result.encodedTokens} tokens)`);
    console.error(`    Efficiency:  ${result.scores.tokenEfficiency}/40`);
    console.error(`    Semantic:    ${result.scores.semanticPreservation}/40`);
    console.error(`    Learnability:${result.scores.learnability}/15`);
    console.error(`    Implement:   ${result.scores.implementability}/5`);
    console.error(`    TOTAL:       ${result.total}/100`);
    console.error('');
  }

  const avg = results.reduce((sum, r) => sum + r.total, 0) / results.length;
  console.error(`  Average Score: ${Math.round(avg * 10) / 10}/100`);
  console.error('========================================\n');
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.command !== 'run') {
    console.error('Usage: node cli.cjs run [--level N] [--all] [--encoding path] [--output path]');
    console.error('');
    console.error('Commands:');
    console.error('  run --level 1          Run Level 1 experiments');
    console.error('  run --level 2          Run Level 2 experiments');
    console.error('  run --level 3          Run Level 3 experiments');
    console.error('  run --all              Run all levels');
    console.error('');
    console.error('Options:');
    console.error('  --encoding <path>      Path to encoding system file (default: built-in)');
    console.error('  --output <path>        Write JSON results to file');
    process.exit(args.command ? 1 : 0);
  }

  if (!args.level && !args.all) {
    console.error('Specify --level N or --all');
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not found. Check your .env file.');
    process.exit(1);
  }

  const testCaseSets = loadTestCases(args.all ? null : args.level);
  const encodingSystem = loadEncoding(args.encoding);

  console.error(`[zer0gravity] Encoding system: ${args.encoding || '(default)'}`);
  console.error(`[zer0gravity] Levels: ${args.all ? 'all' : args.level}`);
  console.error('');

  const results = [];

  for (const testCaseSet of testCaseSets) {
    for (const testCase of testCaseSet.cases) {
      try {
        const result = await runExperiment({
          originalText: testCase.text,
          encodingSystem,
          testCaseId: testCase.id
        });
        results.push(result);
      } catch (e) {
        console.error(`[zer0gravity] ERROR on ${testCase.id}: ${e.message}`);
        results.push({
          testCaseId: testCase.id,
          error: e.message,
          originalText: testCase.text
        });
      }
    }
  }

  // Print summary to stderr
  const successResults = results.filter(r => !r.error);
  if (successResults.length > 0) {
    printSummary(successResults);
  }

  // Output JSON
  const jsonOutput = JSON.stringify(results, null, 2);

  if (args.output) {
    const outputPath = path.resolve(__dirname, args.output);
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(outputPath, jsonOutput);
    console.error(`[zer0gravity] Results written to: ${outputPath}`);
  } else {
    console.log(jsonOutput);
  }
}

main().catch(e => {
  console.error(`[zer0gravity] Fatal error: ${e.message}`);
  process.exit(1);
});
