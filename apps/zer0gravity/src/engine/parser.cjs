/**
 * Zero Gravity — Stamp Parser
 *
 * Pure JavaScript parser for Zero Gravity v0.1 stamps and full JSON.
 * No external dependencies. No API calls.
 */

// Matches the data block: ---BEGIN ZERO GRAVITY--- ... ---END ZERO GRAVITY---
const ZG_BLOCK_REGEX = /---BEGIN ZERO GRAVITY---\n([\s\S]*?)\n---END ZERO GRAVITY---/;

// Stamp required fields
const STAMP_REQUIRED_FIELDS = ['encoding', 'version', 'title', 'intent', 'indexes'];

// Full JSON required fields (from generator output)
const JSON_REQUIRED_FIELDS = ['id', 'intent', 'relevance', 'claims'];

// Controlled vocabularies
const VALID_INTENTS = ['proposal', 'critique', 'synthesis', 'report', 'design'];
const VALID_STANCES = ['speculative', 'empirical', 'prescriptive', 'exploratory'];

/**
 * Extract a data block from text.
 *
 * @param {string} text - Full document text
 * @returns {{ raw: string, body: string } | null}
 */
function extractBlock(text) {
  const match = text.match(ZG_BLOCK_REGEX);
  if (!match) return null;

  return {
    raw: match[0],
    body: match[1]
  };
}

/**
 * Strip surrounding quotes from a string value.
 *
 * @param {string} value
 * @returns {string}
 */
function stripQuotes(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Parse the body of a data block into fields.
 * YAML-style: key: "value" for strings, key:\n  - "item" for lists.
 *
 * @param {string} body - Block body (content between delimiters)
 * @returns {Object} Parsed fields
 */
function parseBlock(body) {
  const fields = {};
  const lines = body.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) { i++; continue; }

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) { i++; continue; }

    const key = trimmed.slice(0, colonIdx).trim();
    const afterColon = trimmed.slice(colonIdx + 1).trim();

    if (!key) { i++; continue; }

    // Check if this is a multi-line list (key: with nothing after, followed by - items)
    if (afterColon === '') {
      const items = [];
      i++;
      while (i < lines.length) {
        const nextLine = lines[i];
        const nextTrimmed = nextLine.trim();
        if (nextTrimmed.startsWith('- ')) {
          items.push(stripQuotes(nextTrimmed.slice(2)));
          i++;
        } else {
          break;
        }
      }
      if (items.length > 0) {
        fields[key] = items;
      }
      continue;
    }

    // Single-value field
    fields[key] = stripQuotes(afterColon);
    i++;
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
    } else if (Array.isArray(fields[field]) && fields[field].length === 0) {
      errors.push(`Required stamp field is empty: ${field}`);
    }
  }

  if (fields.encoding && fields.encoding !== 'zero-gravity') {
    errors.push(`Unexpected encoding: "${fields.encoding}" (expected "zero-gravity")`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate full JSON fields (from generator output).
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
 * Extract and parse a Zero Gravity stamp from text in one step.
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
    version: fields.version || '0.1',
    fields,
    raw: extracted.raw,
    validation
  };
}

/**
 * Format fields into a Zero Gravity stamp string (data block only).
 *
 * @param {Object} fields - Stamp fields (title, intent, indexes)
 * @param {string} [version='0.1']
 * @returns {string}
 */
function formatStamp(fields, version = '0.1') {
  const lines = [
    '---BEGIN ZERO GRAVITY---',
    'encoding: "zero-gravity"',
    `version: "${version}"`
  ];

  if (fields.title) {
    lines.push(`title: "${fields.title}"`);
  }
  if (fields.intent) {
    lines.push(`intent: "${fields.intent}"`);
  }
  if (Array.isArray(fields.indexes) && fields.indexes.length > 0) {
    lines.push('indexes:');
    for (const item of fields.indexes) {
      lines.push(`  - "${item}"`);
    }
  }

  lines.push('---END ZERO GRAVITY---');
  return lines.join('\n');
}

/**
 * Format a complete stamp with visual header.
 *
 * @param {Object} fields - Stamp fields
 * @param {string} [infoUrl] - URL for the "learn more" link
 * @param {string} [version='0.1']
 * @returns {string}
 */
function formatStampWithHeader(fields, infoUrl, version = '0.1') {
  const header = '🪐 Zero Gravity';
  const tagline = infoUrl
    ? `Semantic encoding for AI agents | [learn more](${infoUrl})`
    : 'Semantic encoding for AI agents';

  const dataBlock = formatStamp(fields, version);

  return `${header}\n${tagline}\n\n${dataBlock}`;
}

module.exports = {
  extractBlock,
  parseBlock,
  stripQuotes,
  parseZG,
  validateStamp,
  validateFullJSON,
  formatStamp,
  formatStampWithHeader,
  ZG_BLOCK_REGEX,
  STAMP_REQUIRED_FIELDS,
  JSON_REQUIRED_FIELDS,
  VALID_INTENTS,
  VALID_STANCES
};
