function buildSurveyPrompt({ questions, surveyActionId, focusDimensions }) {
  const questionList = questions.map((q, i) => `${i + 1}. **${q.dimension}**: ${q.text}`).join('\n');
  const focusNote = focusDimensions && focusDimensions.length > 0
    ? `\nPrioritize these dimensions first (areas for growth): ${focusDimensions.join(', ')}.`
    : '';

  return {
    surveyActionId,
    questions,
    instructions: `You are now conducting a check-in survey. Follow these guidelines carefully:

**Conversation style:**
- Ask ONE question at a time. Never batch questions.
- After the user answers, briefly reflect back what you heard in 1 sentence before moving on.
- Ask a short follow-up only if the answer was very brief or unclear — not every time.
- Keep the whole survey feeling like a natural conversation, not a form.

**Off-ramp:**
- If at any point the user seems reluctant, rushed, or says anything like "not now", "skip", "later", or "stop" — offer to abandon the survey with abandon_survey. Never push through resistance.

**Saving results:**
- When all questions are answered, briefly summarize what you heard across all dimensions.
- Ask the user: "Does that feel right? I can save this check-in now."
- Only call store_survey_results AFTER the user confirms.
- If they want to change something, let them before saving.

**Questions to ask:**
${questionList}
${focusNote}

Begin by asking the first question naturally.`
  };
}

module.exports = { buildSurveyPrompt };
