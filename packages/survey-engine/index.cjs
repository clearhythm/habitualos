/**
 * @habitualos/survey-engine
 *
 * Shared survey/measurement system for HabitualOS apps.
 * Provides survey definitions, response tracking, focus dimension
 * computation, and lightweight survey action management.
 */

const { createSurveyDefinition, getSurveyDefinition } = require('./survey-definitions.cjs');
const { createSurveyResponse, getResponsesBySurvey, getResponsesByUser, getLatestFullResponses } = require('./survey-responses.cjs');
const { createSurveyAction, getOpenSurveyAction, markActionCompleted } = require('./survey-actions.cjs');
const { getFocus, recalculateFocus } = require('./survey-focus.cjs');
const { computeFocusDimensions } = require('./focus-algorithm.cjs');
const { surveyTools } = require('./src/tools/schema.cjs');
const { handleSurveyTool, SURVEY_TOOL_NAMES } = require('./src/tools/handlers.cjs');
const { checkPendingSurvey } = require('./src/context-checks.cjs');

module.exports = {
  // Definitions
  createSurveyDefinition,
  getSurveyDefinition,

  // Responses
  createSurveyResponse,
  getResponsesBySurvey,
  getResponsesByUser,
  getLatestFullResponses,

  // Actions
  createSurveyAction,
  getOpenSurveyAction,
  markActionCompleted,

  // Focus
  getFocus,
  recalculateFocus,
  computeFocusDimensions,

  // Tool-based sub-agent API
  surveyTools,
  handleSurveyTool,
  SURVEY_TOOL_NAMES,

  // Context checks
  checkPendingSurvey
};
