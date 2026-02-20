#!/usr/bin/env node

/**
 * Zer0 Grav1ty — CLI
 *
 * Usage:
 *   node cli.cjs generate --input article.md                   Generate full JSON from article
 *   node cli.cjs generate --input article.md --embed           Also generate embedding
 *   node cli.cjs generate --input article.md --stamp           Also output a stamp
 *   node cli.cjs parse --input file-with-stamp.md              Parse stamp from document
 *   node cli.cjs parse --input file-with-stamp.md --json       Output as JSON
 *   node cli.cjs embed --input full.zg.json                    Add embedding to full JSON
 *
 *   node cli.cjs run --level 1                                 (Phase 2) Run compression experiments
 *   node cli.cjs run --all                                     (Phase 2) Run all levels
 */

const fs = require('fs');
const path = require('path');

// Load env from monorepo root
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

function parseArgs(argv) {
  const args = {
    command: null,
    input: null,
    output: null,
    json: false,
    embed: false,
    stamp: false,
    embedUrl: null,
    infoUrl: null,
    // articleUrl removed — url lives in full JSON only
    // Legacy run command args
    level: null,
    all: false,
    encoding: null
  };
  let i = 2; // skip 'node' and script path

  if (argv[i]) args.command = argv[i++];

  while (i < argv.length) {
    const arg = argv[i];
    if (arg === '--input' && argv[i + 1]) {
      args.input = argv[++i];
    } else if (arg === '--output' && argv[i + 1]) {
      args.output = argv[++i];
    } else if (arg === '--json') {
      args.json = true;
    } else if (arg === '--embed') {
      args.embed = true;
    } else if (arg === '--stamp') {
      args.stamp = true;
    } else if (arg === '--embed-url' && argv[i + 1]) {
      args.embedUrl = argv[++i];
    } else if (arg === '--info-url' && argv[i + 1]) {
      args.infoUrl = argv[++i];
    } else if (arg === '--level' && argv[i + 1]) {
      args.level = parseInt(argv[++i]);
    } else if (arg === '--all') {
      args.all = true;
    } else if (arg === '--encoding' && argv[i + 1]) {
      args.encoding = argv[++i];
    }
    i++;
  }

  return args;
}

function readInput(inputPath) {
  if (!inputPath) {
    console.error('Error: --input <path> is required');
    process.exit(1);
  }
  const resolved = path.resolve(inputPath);
  if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`);
    process.exit(1);
  }
  return fs.readFileSync(resolved, 'utf-8');
}

function writeOutput(outputPath, content) {
  const resolved = path.resolve(outputPath);
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(resolved, content);
  console.error(`Written to: ${resolved}`);
}

function getAnthropicClient() {
  const apiKey = process.env.ZER0GRAVITY_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('No Anthropic API key found. Set ZER0GRAVITY_API_KEY or ANTHROPIC_API_KEY in .env');
    process.exit(1);
  }
  const Anthropic = require('@anthropic-ai/sdk');
  return new Anthropic({ apiKey });
}

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('No OpenAI API key found. Set OPENAI_API_KEY in .env');
    process.exit(1);
  }
  const OpenAI = require('openai');
  return new OpenAI({ apiKey });
}

// ─── GENERATE command ────────────────────────────────────────────

async function cmdGenerate(args) {
  const text = readInput(args.input);
  const anthropic = getAnthropicClient();
  const { generate } = require('./src/engine/generator.cjs');
  const { validateFullJSON } = require('./src/engine/parser.cjs');
  const { embed, buildFullJSON } = require('./src/engine/embedder.cjs');

  console.error('[zer0gravity] Generating Zer0 Grav1ty fields...');
  const result = await generate(anthropic, { text });

  if (!result.fields) {
    console.error('[zer0gravity] ERROR: Failed to generate valid fields');
    console.error('[zer0gravity] Raw output:');
    console.error(result.raw);
    process.exit(1);
  }

  // Validate
  const validation = validateFullJSON(result.fields);
  if (validation.valid) {
    console.error('[zer0gravity] Fields are valid');
  } else {
    console.error('[zer0gravity] Validation warnings:');
    for (const err of validation.errors) {
      console.error(`  - ${err}`);
    }
  }

  console.error(`[zer0gravity] Tokens used: ${result.usage.input_tokens} in / ${result.usage.output_tokens} out`);

  // Optionally embed
  let embeddingResult = null;
  if (args.embed) {
    const openai = getOpenAIClient();
    console.error('[zer0gravity] Generating embedding...');
    embeddingResult = await embed(openai, { fields: result.fields });
    console.error(`[zer0gravity] Embedding: ${embeddingResult.dimensions} dimensions, model: ${embeddingResult.model}`);
  }

  // Build and write full JSON
  const fullJSON = buildFullJSON({
    fields: result.fields,
    embedding: embeddingResult
  });

  const jsonStr = JSON.stringify(fullJSON, null, 2);
  const jsonPath = args.output ||
    path.join(__dirname, 'data', `${result.fields.id || 'output'}.zg.json`);
  const jsonDir = path.dirname(path.resolve(jsonPath));
  if (!fs.existsSync(jsonDir)) fs.mkdirSync(jsonDir, { recursive: true });
  writeOutput(jsonPath, jsonStr);

  // Output stamp if requested
  if (args.stamp) {
    const { formatStampWithHeader } = require('./src/engine/parser.cjs');
    const stampFields = {
      title: result.fields.title,
      theme: result.fields.theme,
      index: result.fields.index || []
    };
    if (result.fields.author) {
      stampFields.author = result.fields.author;
    }
    if (args.embedUrl) {
      stampFields['embed'] = args.embedUrl;
    }
    stampFields['model'] = require('./src/engine/generator.cjs').DEFAULT_MODEL;

    const stamp = formatStampWithHeader(stampFields, args.infoUrl);
    console.error('\n[zer0gravity] Compact stamp:\n');
    console.log(stamp);
  }
}

// ─── PARSE command ───────────────────────────────────────────────

async function cmdParse(args) {
  const text = readInput(args.input);
  const { parseZG } = require('./src/engine/parser.cjs');

  const result = parseZG(text);

  if (!result) {
    console.error('[zer0gravity] No Zer0 Grav1ty stamp found in input');
    process.exit(1);
  }

  if (args.json) {
    console.log(JSON.stringify({
      version: result.version,
      fields: result.fields,
      validation: result.validation
    }, null, 2));
    return;
  }

  // Human-readable output
  console.error(`[zer0gravity] Zer0 Grav1ty v${result.version} stamp found\n`);

  for (const [key, value] of Object.entries(result.fields)) {
    if (Array.isArray(value)) {
      console.error(`  ${key}: [${value.length} items]`);
      for (const item of value) {
        console.error(`    - ${item}`);
      }
    } else {
      console.error(`  ${key}: ${value}`);
    }
  }

  console.error('');
  if (result.validation.valid) {
    console.error('  Status: VALID');
  } else {
    console.error('  Status: INVALID');
    for (const err of result.validation.errors) {
      console.error(`    - ${err}`);
    }
  }
}

// ─── EMBED command ───────────────────────────────────────────────

async function cmdEmbed(args) {
  const text = readInput(args.input);
  const { embed, buildFullJSON } = require('./src/engine/embedder.cjs');

  // Input can be either a .zg.json file or a document with a stamp
  let fields;
  try {
    const json = JSON.parse(text);
    // It's a JSON file — use the fields directly
    const { embedding, zg_version, created_at, ...rest } = json;
    fields = rest;
  } catch {
    // Not JSON — try to parse as a document with a stamp
    const { parseZG } = require('./src/engine/parser.cjs');
    const result = parseZG(text);
    if (!result) {
      console.error('[zer0gravity] No Zer0 Grav1ty stamp or JSON found in input');
      process.exit(1);
    }
    fields = {
      title: result.fields.title,
      theme: result.fields.theme
    };
    console.error('[zer0gravity] WARNING: Stamp has limited fields. For best embeddings, use the full .zg.json file as input.');
  }

  const openai = getOpenAIClient();
  console.error('[zer0gravity] Generating embedding...');
  const embeddingResult = await embed(openai, { fields });

  const fullJSON = buildFullJSON({ fields, embedding: embeddingResult });
  const jsonStr = JSON.stringify(fullJSON, null, 2);

  if (args.output) {
    writeOutput(args.output, jsonStr);
  } else {
    console.log(jsonStr);
  }

  console.error(`[zer0gravity] Embedding: ${embeddingResult.dimensions} dimensions, model: ${embeddingResult.model}`);
}

// ─── RUN command (legacy Phase 2 experiments) ────────────────────

async function cmdRun(args) {
  const { runExperiment } = require('./src/engine/experiment.cjs');

  const DEFAULT_ENCODING = `VOWEL_DROP: Remove all vowels from words longer than 3 letters.
COMMON_SUBS: Replace common words: 'the'→'θ', 'is'→'=', 'and'→'&', 'to'→'→', 'of'→'∘', 'a'→'α', 'in'→'∈', 'that'→'∴', 'for'→'∀', 'with'→'⊕', 'this'→'⊙'.
PRESERVE: Keep numbers, proper nouns, and punctuation unchanged.
COMPACT: Remove unnecessary whitespace. Use '|' as word separator where ambiguous.`;

  if (!args.level && !args.all) {
    console.error('Specify --level N or --all');
    process.exit(1);
  }

  const apiKey = process.env.ZER0GRAVITY_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('No API key found. Set ZER0GRAVITY_API_KEY or ANTHROPIC_API_KEY in .env');
    process.exit(1);
  }
  console.error(`[zer0gravity] Using ${process.env.ZER0GRAVITY_API_KEY ? 'ZER0GRAVITY_API_KEY' : 'ANTHROPIC_API_KEY (shared)'}`);

  const testCaseDir = path.join(__dirname, 'src', 'test-cases');
  const files = { 1: 'level-1-simple.json', 2: 'level-2-brief.json', 3: 'level-3-procedural.json' };

  let testCaseSets;
  if (args.level) {
    const file = files[args.level];
    if (!file) { console.error(`Unknown level: ${args.level}`); process.exit(1); }
    testCaseSets = [JSON.parse(fs.readFileSync(path.join(testCaseDir, file), 'utf-8'))];
  } else {
    testCaseSets = Object.values(files).map(f => JSON.parse(fs.readFileSync(path.join(testCaseDir, f), 'utf-8')));
  }

  let encodingSystem = DEFAULT_ENCODING;
  if (args.encoding) {
    const resolved = path.resolve(__dirname, args.encoding);
    if (!fs.existsSync(resolved)) { console.error(`Encoding file not found: ${resolved}`); process.exit(1); }
    encodingSystem = fs.readFileSync(resolved, 'utf-8');
  }

  console.error(`[zer0gravity] Encoding system: ${args.encoding || '(default)'}`);
  console.error(`[zer0gravity] Levels: ${args.all ? 'all' : args.level}`);
  console.error('');

  const results = [];
  for (const testCaseSet of testCaseSets) {
    for (const testCase of testCaseSet.cases) {
      try {
        const result = await runExperiment({ originalText: testCase.text, encodingSystem, testCaseId: testCase.id });
        results.push(result);
      } catch (e) {
        console.error(`[zer0gravity] ERROR on ${testCase.id}: ${e.message}`);
        results.push({ testCaseId: testCase.id, error: e.message, originalText: testCase.text });
      }
    }
  }

  const successResults = results.filter(r => !r.error);
  if (successResults.length > 0) {
    console.error('\n========================================');
    console.error('  Zer0 Grav1ty Experiment Results');
    console.error('========================================\n');
    for (const result of successResults) {
      const textPreview = result.originalText.length > 40 ? result.originalText.slice(0, 40) + '...' : result.originalText;
      console.error(`  ${result.testCaseId}: "${textPreview}"`);
      console.error(`    Compression: ${result.details.compressionPercent}% (${result.originalTokens} → ${result.encodedTokens} tokens)`);
      console.error(`    Efficiency:  ${result.scores.tokenEfficiency}/40`);
      console.error(`    Semantic:    ${result.scores.semanticPreservation}/40`);
      console.error(`    Learnability:${result.scores.learnability}/15`);
      console.error(`    Implement:   ${result.scores.implementability}/5`);
      console.error(`    TOTAL:       ${result.total}/100\n`);
    }
    const avg = successResults.reduce((sum, r) => sum + r.total, 0) / successResults.length;
    console.error(`  Average Score: ${Math.round(avg * 10) / 10}/100`);
    console.error('========================================\n');
  }

  const jsonOutput = JSON.stringify(results, null, 2);
  if (args.output) {
    writeOutput(args.output, jsonOutput);
  } else {
    console.log(jsonOutput);
  }
}

// ─── HELP ────────────────────────────────────────────────────────

function printHelp() {
  console.error(`
  Zer0 Grav1ty CLI

  Commands:
    generate  Generate Zer0 Grav1ty fields from an article
    parse     Parse a Zer0 Grav1ty stamp from a document
    embed     Add embedding to a .zg.json file
    run       (Legacy) Run Phase 2 compression experiments

  Generate:
    node cli.cjs generate --input article.md
    node cli.cjs generate --input article.md --embed
    node cli.cjs generate --input article.md --stamp --embed-url URL --info-url URL
    node cli.cjs generate --input article.md --output path/to/output.zg.json

  Parse:
    node cli.cjs parse --input file-with-stamp.md
    node cli.cjs parse --input file-with-stamp.md --json

  Embed:
    node cli.cjs embed --input full.zg.json --output full-with-embedding.zg.json

  Run (Legacy):
    node cli.cjs run --level 1
    node cli.cjs run --all
    node cli.cjs run --all --encoding path/to/encoding.txt --output results.json
`);
}

// ─── MAIN ────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);

  switch (args.command) {
    case 'generate':
      return cmdGenerate(args);
    case 'parse':
      return cmdParse(args);
    case 'embed':
      return cmdEmbed(args);
    case 'run':
      return cmdRun(args);
    default:
      printHelp();
      process.exit(args.command ? 1 : 0);
  }
}

main().catch(e => {
  console.error(`[zer0gravity] Fatal error: ${e.message}`);
  process.exit(1);
});
