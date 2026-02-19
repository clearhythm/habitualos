/**
 * Zer0 Gr@vity — ZG Block Parser
 *
 * Pure JavaScript parser for ZG v0.1 blocks.
 * No external dependencies. No API calls.
 */

const ZG_BLOCK_REGEX = /^---ZG:(\d+\.\d+)\s*\n([\s\S]*?)\n---\/ZG\s*$/m;

const REQUIRED_FIELDS = ['id', 'titl3', 'int3nt', 'th3me', 'r3levance', 'cl@ims'];

const LIST_FIELDS = ['cl@ims', 'nov3lty', 't@gs', 'rel@tions', 'audi3nce', '@ctions'];

const VALID_INTENTS = ['proposal', 'critique', 'synthesis', 'report', 'design'];

const VALID_STANCES = ['speculative', 'empirical', 'prescriptive', 'exploratory'];

/**
 * Extract a ZG block from text.
 *
 * @param {string} text - Full document text
 * @returns {{ raw: string, version: string, body: string } | null}
 */
function extractBlock(text) {
  const match = text.match(ZG_BLOCK_REGEX);
  if (!match) return null;

  return {
    raw: match[0],
    version: match[1],
    body: match[2]
  };
}

/**
 * Parse a list value: "[item1; item2; item3]" → ["item1", "item2", "item3"]
 *
 * @param {string} value
 * @returns {string[]}
 */
function parseList(value) {
  const trimmed = value.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
    return [trimmed];
  }
  const inner = trimmed.slice(1, -1);
  return inner.split(';').map(item => item.trim()).filter(item => item.length > 0);
}

/**
 * Parse the body of a ZG block into field key-value pairs.
 *
 * @param {string} body - Block body (content between delimiters)
 * @returns {Object} Parsed fields
 */
function parseBlock(body) {
  const fields = {};
  const lines = body.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();

    if (!key) continue;

    if (LIST_FIELDS.includes(key)) {
      fields[key] = parseList(value);
    } else {
      fields[key] = value;
    }
  }

  return fields;
}

/**
 * Validate a parsed ZG block.
 *
 * @param {Object} parsed - Parsed fields from parseBlock
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateBlock(parsed) {
  const errors = [];

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    if (!parsed[field]) {
      errors.push(`Missing required field: ${field}`);
    } else if (Array.isArray(parsed[field]) && parsed[field].length === 0) {
      errors.push(`Required field is empty: ${field}`);
    } else if (typeof parsed[field] === 'string' && parsed[field].trim() === '') {
      errors.push(`Required field is empty: ${field}`);
    }
  }

  // Validate int3nt values
  if (parsed['int3nt'] && !VALID_INTENTS.includes(parsed['int3nt'])) {
    errors.push(`Invalid int3nt value: "${parsed['int3nt']}". Must be one of: ${VALID_INTENTS.join(', ')}`);
  }

  // Validate st@nce values (if present)
  if (parsed['st@nce'] && !VALID_STANCES.includes(parsed['st@nce'])) {
    errors.push(`Invalid st@nce value: "${parsed['st@nce']}". Must be one of: ${VALID_STANCES.join(', ')}`);
  }

  // Validate cl@ims count
  if (Array.isArray(parsed['cl@ims'])) {
    if (parsed['cl@ims'].length < 3) {
      errors.push(`cl@ims should have at least 3 items (found ${parsed['cl@ims'].length})`);
    } else if (parsed['cl@ims'].length > 7) {
      errors.push(`cl@ims should have at most 7 items (found ${parsed['cl@ims'].length})`);
    }
  }

  // Validate id format
  if (parsed['id'] && !/^[a-z0-9-]+$/.test(parsed['id'])) {
    errors.push(`id must be lowercase alphanumeric with hyphens: "${parsed['id']}"`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Extract and parse a ZG block from text in one step.
 *
 * @param {string} text - Full document text
 * @returns {{ version: string, fields: Object, raw: string, validation: { valid: boolean, errors: string[] } } | null}
 */
function parseZG(text) {
  const extracted = extractBlock(text);
  if (!extracted) return null;

  const fields = parseBlock(extracted.body);
  const validation = validateBlock(fields);

  return {
    version: extracted.version,
    fields,
    raw: extracted.raw,
    validation
  };
}

/**
 * Format a fields object back into a ZG block string.
 *
 * @param {Object} fields - Parsed fields
 * @param {string} [version='0.1']
 * @returns {string}
 */
function formatBlock(fields, version = '0.1') {
  const fieldOrder = [
    'id', 'titl3', 'int3nt', 'th3me', 'r3levance', 'cl@ims',
    '@uthor', 'st@nce', 'nov3lty', 't@gs', 'rel@tions', 'audi3nce', '@ctions', '3mbed'
  ];

  // Find max field name length for alignment
  const presentFields = fieldOrder.filter(f => fields[f] !== undefined);
  const maxLen = Math.max(...presentFields.map(f => f.length));

  const lines = [`---ZG:${version}`];

  for (const key of fieldOrder) {
    const value = fields[key];
    if (value === undefined) continue;

    const padding = ' '.repeat(maxLen - key.length + 1);
    if (Array.isArray(value)) {
      lines.push(`${key}:${padding}[${value.join('; ')}]`);
    } else {
      lines.push(`${key}:${padding}${value}`);
    }
  }

  lines.push('---/ZG');
  return lines.join('\n');
}

module.exports = {
  extractBlock,
  parseBlock,
  parseList,
  parseZG,
  validateBlock,
  formatBlock,
  ZG_BLOCK_REGEX,
  REQUIRED_FIELDS,
  LIST_FIELDS,
  VALID_INTENTS,
  VALID_STANCES
};
