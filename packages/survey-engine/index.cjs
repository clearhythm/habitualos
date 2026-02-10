/**
 * @habitualos/survey-engine
 *
 * Shared survey/measurement system for HabitualOS apps.
 * Provides survey definitions, response tracking, focus dimension
 * computation, and lightweight survey action management.
 */

const { createSurveyDefinition, getSurveyDefinition } = require('./survey-definitions.cjs');
const { createSurveyResponse, getResponsesBySurvey, getResponsesByUser, getLatestFullResponses } = require('./survey-responses.cjs');
const { createSurveyAction, getOpenSurveyAction, markUserCompleted, hasUserCompleted } = require('./survey-actions.cjs');
const { getFocus, recalculateFocus } = require('./survey-focus.cjs');
const { computeFocusDimensions } = require('./focus-algorithm.cjs');

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
  markUserCompleted,
  hasUserCompleted,

  // Focus
  getFocus,
  recalculateFocus,
  computeFocusDimensions
};
