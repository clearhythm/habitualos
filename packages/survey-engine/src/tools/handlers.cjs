const dbCore = require('@habitualos/db-core');
const { getSurveyDefinition } = require('../../survey-definitions.cjs');
const { createSurveyResponse } = require('../../survey-responses.cjs');
const { markActionCompleted } = require('../../survey-actions.cjs');
const { buildSurveyPrompt } = require('./prompts.cjs');

const ACTIONS_COLLECTION = 'survey-actions';

async function handleStartSurvey({ surveyActionId }, { userId }) {
  const action = await dbCore.get({ collection: ACTIONS_COLLECTION, id: surveyActionId });
  if (!action || action._userId !== userId) {
    return { error: 'Survey action not found or does not belong to this user.' };
  }
  if (action.state !== 'open') {
    return { error: 'Survey action is no longer open.' };
  }

  const definition = await getSurveyDefinition(action.surveyDefinitionId);
  if (!definition) {
    return { error: 'Survey definition not found.' };
  }

  const questions = definition.dimensions.map(d => ({
    dimension: d.name,
    text: d.questions[0]
  }));

  return buildSurveyPrompt({
    questions,
    surveyActionId: action.id,
    focusDimensions: action.focusDimensions || []
  });
}

async function handleSubmitAnswer({ surveyActionId, dimension, score, notes }, { userId }) {
  // Lightweight per-question acknowledgement — answers are batched and persisted in store_survey_results
  return { ok: true, recorded: { dimension, score, notes: notes || null } };
}

async function handleStoreSurveyResults({ surveyActionId, scores }, { userId }) {
  const action = await dbCore.get({ collection: ACTIONS_COLLECTION, id: surveyActionId });
  if (!action || action._userId !== userId) {
    return { error: 'Survey action not found or does not belong to this user.' };
  }

  await createSurveyResponse(surveyActionId, {
    _userId: userId,
    surveyDefinitionId: action.surveyDefinitionId,
    surveyActionId,
    type: action.type || 'weekly',
    scores: scores.map(s => ({
      dimension: s.dimension,
      average: s.score,
      score: s.score,
      notes: s.notes || null
    }))
  });

  await markActionCompleted(surveyActionId);

  return {
    success: true,
    summary: scores.map(s => ({ dimension: s.dimension, score: s.score })),
    message: 'Survey results saved successfully.'
  };
}

async function handleAbandonSurvey({ surveyActionId, reason }, { userId }) {
  // Leave action open for next session — do not mark completed
  return { ok: true, abandoned: true, reason: reason || 'User requested to stop.' };
}

async function handleSurveyTool(toolName, toolInput, context) {
  switch (toolName) {
    case 'start_survey':         return handleStartSurvey(toolInput, context);
    case 'submit_survey_answer': return handleSubmitAnswer(toolInput, context);
    case 'store_survey_results': return handleStoreSurveyResults(toolInput, context);
    case 'abandon_survey':       return handleAbandonSurvey(toolInput, context);
    default: return { error: `Unknown survey tool: ${toolName}` };
  }
}

const SURVEY_TOOL_NAMES = ['start_survey', 'submit_survey_answer', 'store_survey_results', 'abandon_survey'];

module.exports = { handleSurveyTool, SURVEY_TOOL_NAMES };
