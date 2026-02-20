/**
 * Zer0 Grav1ty — Stamp Parser
 *
 * Pure JavaScript parser for Zer0 Grav1ty v0.1 stamps and full JSON.
 * No external dependencies. No API calls.
 */

// Matches the data block: --zg:0.1 ... --/zg
const ZG_BLOCK_REGEX = /^--zg:(\d+\.\d+)\s*\n([\s\S]*?)\n--\/zg\s*$/m;

// Stamp fields
const STAMP_REQUIRED_FIELDS = ['title', 'theme', 'index'];

// Full JSON required fields
const JSON_REQUIRED_FIELDS = ['id', 'intent', 'theme', 'relevance', 'claims'];

// Fields that are lists in the stamp
const LIST_FIELDS = ['index', 'claims'];

// Controlled vocabularies
const VALID_INTENTS = ['proposal', 'critique', 'synthesis', 'report', 'design'];
const VALID_STANCES = ['speculative', 'empirical', 'prescriptive', 'exploratory'];

/**
 * Extract a data block from text.
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
 * Parse the body of a data block into fields.
 * Each line is: + fieldname: value
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

    // Strip the + prefix
    let fieldLine = trimmed;
    if (fieldLine.startsWith('+ ')) {
      fieldLine = fieldLine.slice(2);
    } else if (fieldLine.startsWith('+')) {
      fieldLine = fieldLine.slice(1).trim();
    }

    const colonIdx = fieldLine.indexOf(':');
    if (colonIdx === -1) continue;

    const key = fieldLine.slice(0, colonIdx).trim();
    const value = fieldLine.slice(colonIdx + 1).trim();

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
 * Validate a parsed stamp.
 *
 * @param {Object} fields - Parsed fields from parseBlock
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateStamp(fields) {
  const errors = [];

  for (const field of STAMP_REQUIRED_FIELDS) {
    if (!fields[field]) {
      errors.push(`Missing required stamp field: ${field}`);
    } else if (typeof fields[field] === 'string' && fields[field].trim() === '') {
      errors.push(`Required stamp field is empty: ${field}`);
    }
  }

  // Validate embed URL format (optional field)
  if (fields['embed'] && !fields['embed'].startsWith('http')) {
    errors.push(`embed should be a URL: "${fields['embed']}"`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate full JSON fields.
 *
 * @param {Object} json - Parsed full JSON
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateFullJSON(json) {
  const errors = [];

  for (const field of JSON_REQUIRED_FIELDS) {
    if (json[field] === undefined || json[field] === null) {
      errors.push(`Missing required field: ${field}`);
    } else if (typeof json[field] === 'string' && json[field].trim() === '') {
      errors.push(`Required field is empty: ${field}`);
    } else if (Array.isArray(json[field]) && json[field].length === 0) {
      errors.push(`Required field is empty: ${field}`);
    }
  }

  if (json.intent && !VALID_INTENTS.includes(json.intent)) {
    errors.push(`Invalid intent value: "${json.intent}". Must be one of: ${VALID_INTENTS.join(', ')}`);
  }

  if (json.stance && !VALID_STANCES.includes(json.stance)) {
    errors.push(`Invalid stance value: "${json.stance}". Must be one of: ${VALID_STANCES.join(', ')}`);
  }

  if (Array.isArray(json.claims)) {
    if (json.claims.length < 3) {
      errors.push(`claims should have at least 3 items (found ${json.claims.length})`);
    } else if (json.claims.length > 7) {
      errors.push(`claims should have at most 7 items (found ${json.claims.length})`);
    }
  }

  if (json.id && !/^[a-z0-9-]+$/.test(json.id)) {
    errors.push(`id must be lowercase alphanumeric with hyphens: "${json.id}"`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Extract and parse a Zer0 Grav1ty stamp from text in one step.
 *
 * @param {string} text - Full document text
 * @returns {{ version: string, fields: Object, raw: string, validation: { valid: boolean, errors: string[] } } | null}
 */
function parseZG(text) {
  const extracted = extractBlock(text);
  if (!extracted) return null;

  const fields = parseBlock(extracted.body);
  const validation = validateStamp(fields);

  return {
    version: extracted.version,
    fields,
    raw: extracted.raw,
    validation
  };
}

/**
 * Format fields into a Zer0 Grav1ty stamp string (data block only).
 *
 * @param {Object} fields - Stamp fields
 * @param {string} [version='0.1']
 * @returns {string}
 */
function formatStamp(fields, version = '0.1') {
  const fieldOrder = ['title', 'author', 'theme', 'index', 'embed', 'model'];

  const lines = [`--zg:${version}`];

  for (const key of fieldOrder) {
    const value = fields[key];
    if (value === undefined) continue;

    if (Array.isArray(value)) {
      lines.push(`+ ${key}: [${value.join('; ')}]`);
    } else {
      lines.push(`+ ${key}: ${value}`);
    }
  }

  lines.push('--/zg');
  return lines.join('\n');
}

/**
 * Format a complete stamp with visual header.
 *
 * @param {Object} fields - Stamp fields
 * @param {string} [infoUrl] - URL for the "what's this?" link
 * @param {string} [version='0.1']
 * @returns {string}
 */
function formatStampWithHeader(fields, infoUrl, version = '0.1') {
  const header = 'Zer0 Grav1ty';
  const tagline = infoUrl
    ? `Agent summary for the semantic web | [what's this?](${infoUrl})`
    : 'Agent summary for the semantic web';

  const dataBlock = formatStamp(fields, version);

  return `${header}\n${tagline}\n${dataBlock}`;
}

module.exports = {
  extractBlock,
  parseBlock,
  parseList,
  parseZG,
  validateStamp,
  validateFullJSON,
  formatStamp,
  formatStampWithHeader,
  ZG_BLOCK_REGEX,
  STAMP_REQUIRED_FIELDS,
  JSON_REQUIRED_FIELDS,
  LIST_FIELDS,
  VALID_INTENTS,
  VALID_STANCES
};
