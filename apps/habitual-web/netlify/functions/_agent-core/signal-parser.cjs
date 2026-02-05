/**
 * Signal Parser Module
 *
 * Parses agent signals from Claude responses:
 * - GENERATE_ACTIONS: Create a scheduled action
 * - GENERATE_ASSET: Create an immediate deliverable (manual action)
 * - STORE_MEASUREMENT: Record measurement check-in data
 */

/**
 * Extract JSON object from response text starting at a given line
 * @param {string[]} lines - Array of lines from response
 * @param {number} jsonStart - Index of line containing opening brace
 * @returns {string} JSON content string
 */
function extractJsonFromLines(lines, jsonStart) {
  let jsonEnd = jsonStart;
  let braceCount = 0;

  for (let i = jsonStart; i < lines.length; i++) {
    const line = lines[i];
    for (const char of line) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
    }
    if (braceCount === 0 && line.includes('}')) {
      jsonEnd = i;
      break;
    }
  }

  return lines.slice(jsonStart, jsonEnd + 1).join('\n');
}

/**
 * Find the start of a JSON object in lines array
 * @param {string[]} lines - Array of lines
 * @returns {number} Index of first line with '{', or -1 if not found
 */
function findJsonStart(lines) {
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('{')) {
      return i;
    }
  }
  return -1;
}

/**
 * Parse signals from Claude's response text
 * @param {string} responseText - The assistant's response text
 * @returns {Object|null} Parsed signal with type and data, or null if no signal
 */
function parseSignals(responseText) {
  const trimmedResponse = responseText.trim();
  const lines = responseText.split('\n');

  // Check for GENERATE_ACTIONS signal
  if (/^GENERATE_ACTIONS\s*\n---/m.test(trimmedResponse)) {
    const jsonStart = findJsonStart(lines);

    if (jsonStart === -1) {
      return {
        type: 'GENERATE_ACTIONS',
        error: 'Could not find JSON object in GENERATE_ACTIONS response',
        raw: responseText
      };
    }

    const jsonContent = extractJsonFromLines(lines, jsonStart);

    try {
      const action = JSON.parse(jsonContent);
      return {
        type: 'GENERATE_ACTIONS',
        data: action
      };
    } catch (parseError) {
      return {
        type: 'GENERATE_ACTIONS',
        error: 'Failed to parse action JSON',
        parseError: parseError.message,
        raw: jsonContent
      };
    }
  }

  // Check for GENERATE_ASSET signal
  if (/^GENERATE_ASSET\s*\n---/m.test(trimmedResponse)) {
    const jsonStart = findJsonStart(lines);

    if (jsonStart === -1) {
      return {
        type: 'GENERATE_ASSET',
        error: 'Could not find JSON object in GENERATE_ASSET response',
        raw: responseText
      };
    }

    const jsonContent = extractJsonFromLines(lines, jsonStart);

    try {
      const asset = JSON.parse(jsonContent);
      return {
        type: 'GENERATE_ASSET',
        data: asset
      };
    } catch (parseError) {
      return {
        type: 'GENERATE_ASSET',
        error: 'Failed to parse asset JSON',
        parseError: parseError.message,
        raw: jsonContent
      };
    }
  }

  // Check for STORE_MEASUREMENT signal
  if (/^STORE_MEASUREMENT\s*\n---/m.test(trimmedResponse)) {
    const jsonStart = findJsonStart(lines);

    if (jsonStart === -1) {
      return {
        type: 'STORE_MEASUREMENT',
        error: 'Could not find JSON object in STORE_MEASUREMENT response',
        raw: responseText
      };
    }

    const jsonContent = extractJsonFromLines(lines, jsonStart);

    try {
      const measurement = JSON.parse(jsonContent);
      return {
        type: 'STORE_MEASUREMENT',
        data: measurement
      };
    } catch (parseError) {
      return {
        type: 'STORE_MEASUREMENT',
        error: 'Failed to parse measurement JSON',
        parseError: parseError.message,
        raw: jsonContent
      };
    }
  }

  // No signal detected
  return null;
}

/**
 * Check if a response contains any signal
 * @param {string} responseText - The assistant's response text
 * @returns {boolean} True if response contains a signal
 */
function hasSignal(responseText) {
  const trimmed = responseText.trim();
  return /^GENERATE_ACTIONS\s*\n---/m.test(trimmed) ||
         /^GENERATE_ASSET\s*\n---/m.test(trimmed) ||
         /^STORE_MEASUREMENT\s*\n---/m.test(trimmed);
}

module.exports = {
  parseSignals,
  hasSignal
};
