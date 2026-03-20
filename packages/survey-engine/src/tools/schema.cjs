const surveyTools = [
  {
    name: 'start_survey',
    description: 'Begin a survey conversation. Returns the survey questions and instructions for how to conduct the survey conversationally. Call this when the user has consented to take a survey.',
    input_schema: {
      type: 'object',
      properties: {
        surveyActionId: {
          type: 'string',
          description: 'The ID of the open survey action (sa-...) for this user'
        }
      },
      required: ['surveyActionId']
    }
  },
  {
    name: 'submit_survey_answer',
    description: "Record the user's answer to a single survey question. Call this after the user answers each question.",
    input_schema: {
      type: 'object',
      properties: {
        surveyActionId: { type: 'string' },
        dimension: { type: 'string', description: 'The dimension name being answered' },
        score: { type: 'number', description: 'Numeric score 1-10' },
        notes: { type: 'string', description: "Any qualitative notes from the user's answer" }
      },
      required: ['surveyActionId', 'dimension', 'score']
    }
  },
  {
    name: 'store_survey_results',
    description: 'Save all collected survey answers to the database. Only call this AFTER verbally confirming with the user that they are ready to save. Returns a summary of what was stored.',
    input_schema: {
      type: 'object',
      properties: {
        surveyActionId: { type: 'string' },
        scores: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              dimension: { type: 'string' },
              score: { type: 'number' },
              notes: { type: 'string' }
            },
            required: ['dimension', 'score']
          }
        }
      },
      required: ['surveyActionId', 'scores']
    }
  },
  {
    name: 'abandon_survey',
    description: 'Cancel the current survey without saving. Call this if the user asks to stop, skip, or come back later.',
    input_schema: {
      type: 'object',
      properties: {
        surveyActionId: { type: 'string' },
        reason: { type: 'string', description: 'Why the survey is being abandoned' }
      },
      required: ['surveyActionId']
    }
  }
];

module.exports = { surveyTools };
