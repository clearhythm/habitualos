/**
 * Shared helpers for signal *-init functions.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * The update_fit_score tool definition used by all three Signal modes.
 * Claude sends dimension scores only — overall is computed client-side.
 */
const UPDATE_FIT_SCORE_TOOL = {
  name: 'update_fit_score',
  description: 'Update the fit score display based on what you\'ve learned in the conversation. Call this after your initial response, and again whenever your assessment changes significantly (score change ≥1 or confidence change ≥0.15).',
  input_schema: {
    type: 'object',
    properties: {
      skills:      { type: 'number', description: 'Technical skills fit score 0-10' },
      alignment:   { type: 'number', description: 'Values/working style alignment score 0-10' },
      personality: { type: 'number', description: 'Personality/culture fit score 0-10' },
      confidence:  { type: 'number', description: 'Confidence in this assessment 0-1' },
      reason:      { type: 'string', description: 'Brief explanation of the current assessment' },
      nextStep:    { type: 'string', description: 'What should happen next (only include when confidence ≥ 0.65)' },
    },
    required: ['skills', 'alignment', 'personality', 'confidence'],
  },
};

function corsOptions() {
  return { statusCode: 204, headers: CORS, body: '' };
}

function methodNotAllowed() {
  return { statusCode: 405, headers: CORS, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
}

function ok(data, extra = {}) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', ...CORS },
    body: JSON.stringify({ success: true, ...data }),
  };
}

function serverError(label, error) {
  console.error(`[${label}] ERROR:`, error);
  return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
}

module.exports = { CORS, UPDATE_FIT_SCORE_TOOL, corsOptions, methodNotAllowed, ok, serverError };
