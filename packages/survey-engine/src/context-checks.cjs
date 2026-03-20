const { getOpenSurveyAction } = require('../survey-actions.cjs');

function checkPendingSurvey(surveyDefinitionId) {
  return async function (userId) {
    const action = await getOpenSurveyAction(surveyDefinitionId, userId);
    if (!action) return null;
    return {
      priority: 'survey',
      data: { surveyActionId: action.id }
    };
  };
}

module.exports = { checkPendingSurvey };
