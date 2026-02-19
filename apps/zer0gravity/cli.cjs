#!/usr/bin/env node

/**
 * Zer0 Gr@vity — CLI
 *
 * Usage:
 *   node cli.cjs generate --input article.md              Generate ZG block from article
 *   node cli.cjs generate --input article.md --embed      Also generate embedding
 *   node cli.cjs parse --input file-with-zg.md            Parse and validate ZG block
 *   node cli.cjs parse --input file-with-zg.md --json     Output parsed fields as JSON
 *   node cli.cjs embed --input file-with-zg.md            Generate embedding from existing ZG block
 *
 *   node cli.cjs run --level 1                            (Phase 2) Run compression experiments
 *   node cli.cjs run --all                                (Phase 2) Run all levels
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
    outputEmbed: null,
    json: false,
    embed: false,
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
    } else if (arg === '--output-embed' && argv[i + 1]) {
      args.outputEmbed = argv[++i];
    } else if (arg === '--json') {
      args.json = true;
    } else if (arg === '--embed') {
      args.embed = true;
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

  console.error('[zer0gravity] Generating ZG block...');
  const result = await generate(anthropic, { text });

  if (!result.parsed) {
    console.error('[zer0gravity] ERROR: Failed to generate valid ZG block');
    console.error('[zer0gravity] Raw output:');
    console.error(result.block);
    process.exit(1);
  }

  // Print validation
  if (result.validation.valid) {
    console.error('[zer0gravity] Block is valid');
  } else {
    console.error('[zer0gravity] Validation warnings:');
    for (const err of result.validation.errors) {
      console.error(`  - ${err}`);
    }
  }

  console.error(`[zer0gravity] Tokens used: ${result.usage.input_tokens} in / ${result.usage.output_tokens} out`);

  // Output the block
  if (args.output) {
    writeOutput(args.output, result.block);
  } else {
    console.log(result.block);
  }

  // Optionally embed
  if (args.embed) {
    const openai = getOpenAIClient();
    const { embed } = require('./src/engine/embedder.cjs');

    console.error('[zer0gravity] Generating embedding...');
    const embedding = await embed(openai, {
      blockText: result.block,
      zgId: result.parsed.id
    });

    const embedJson = JSON.stringify(embedding, null, 2);
    if (args.outputEmbed) {
      writeOutput(args.outputEmbed, embedJson);
    } else {
      // Write to default location
      const embedDir = path.join(__dirname, 'embeddings');
      if (!fs.existsSync(embedDir)) fs.mkdirSync(embedDir, { recursive: true });
      const embedPath = path.join(embedDir, `${result.parsed.id}.json`);
      writeOutput(embedPath, embedJson);
    }

    console.error(`[zer0gravity] Embedding: ${embedding.dimensions} dimensions, model: ${embedding.model}`);
  }
}

// ─── PARSE command ───────────────────────────────────────────────

async function cmdParse(args) {
  const text = readInput(args.input);
  const { parseZG } = require('./src/engine/parser.cjs');

  const result = parseZG(text);

  if (!result) {
    console.error('[zer0gravity] No ZG block found in input');
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
  console.error(`[zer0gravity] ZG v${result.version} block found\n`);

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
  const { parseZG } = require('./src/engine/parser.cjs');
  const { embed } = require('./src/engine/embedder.cjs');

  const result = parseZG(text);
  if (!result) {
    console.error('[zer0gravity] No ZG block found in input');
    process.exit(1);
  }

  if (!result.validation.valid) {
    console.error('[zer0gravity] WARNING: Block has validation errors:');
    for (const err of result.validation.errors) {
      console.error(`  - ${err}`);
    }
  }

  const openai = getOpenAIClient();

  console.error('[zer0gravity] Generating embedding...');
  const embedding = await embed(openai, {
    blockText: result.raw,
    zgId: result.fields.id || 'unknown'
  });

  const embedJson = JSON.stringify(embedding, null, 2);

  if (args.output) {
    writeOutput(args.output, embedJson);
  } else {
    console.log(embedJson);
  }

  console.error(`[zer0gravity] Embedding: ${embedding.dimensions} dimensions, model: ${embedding.model}`);
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

  // Print summary to stderr
  const successResults = results.filter(r => !r.error);
  if (successResults.length > 0) {
    console.error('\n========================================');
    console.error('  Zer0 Gr@vity Experiment Results');
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
  Zer0 Gr@vity CLI

  Commands:
    generate  Generate a ZG block from an article
    parse     Parse and validate a ZG block
    embed     Generate embedding for a ZG block
    run       (Legacy) Run Phase 2 compression experiments

  Generate:
    node cli.cjs generate --input article.md
    node cli.cjs generate --input article.md --output block.txt
    node cli.cjs generate --input article.md --embed
    node cli.cjs generate --input article.md --embed --output-embed embed.json

  Parse:
    node cli.cjs parse --input file-with-zg.md
    node cli.cjs parse --input file-with-zg.md --json

  Embed:
    node cli.cjs embed --input file-with-zg.md
    node cli.cjs embed --input file-with-zg.md --output embed.json

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
