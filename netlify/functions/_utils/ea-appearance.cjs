/**
 * EA (Executive Assistant) appearance logic
 * Controls when Fox-EA appears with observations
 */
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * Decide if EA should appear (rarely)
 * @param {number} workLogCount - Total work logs before this one
 * @param {Array} recentLogs - Recent work logs (newest first)
 * @returns {{shouldAppear: boolean, reason: string|null}}
 */
function shouldEAAppear(workLogCount, recentLogs) {
  // First log ever - always appear
  if (workLogCount === 0) {
    return { shouldAppear: true, reason: 'first_log' };
  }

  // Return after 3+ day gap
  if (recentLogs.length >= 1) {
    const lastLog = recentLogs[0]._createdAt?.toDate?.() || new Date(recentLogs[0]._createdAt);
    const daysSince = (Date.now() - lastLog.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince >= 3) {
      return { shouldAppear: true, reason: 'return_after_gap' };
    }
  }

  // ~10% random chance
  if (Math.random() < 0.10) {
    return { shouldAppear: true, reason: 'random' };
  }

  return { shouldAppear: false, reason: null };
}

/**
 * Generate EA message using Claude
 * @param {string} reason - Why EA is appearing
 * @param {string} title - Work title
 * @param {number} workLogCount - Count before this log
 * @returns {Promise<string>} EA message
 */
async function generateEAMessage(reason, title, workLogCount) {
  const contextByReason = {
    first_log: 'This is their very first work log. They just started tracking.',
    return_after_gap: 'They returned after a few days away. They came back.',
    random: `Work session #${workLogCount + 1}. Just checking in occasionally.`
  };

  const prompt = `You are Fox-EA, a calm executive assistant who notices patterns in someone's work. You appear occasionally - not to celebrate, but to observe something worth noting. Your voice is:
- Calm, observational, present-tense
- Brief and understated - you notice patterns others miss
- No exclamation marks, no cheerleading, no "great job!"
- Speak like someone who's been watching quietly

Context: ${contextByReason[reason] || 'Routine work session.'}
Work title: "${title}"

Generate a brief observation (1-2 sentences max). Make it specific to their work, not generic.

Return as JSON: {"message": "..."}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }]
    });

    let text = response.content[0].text.trim();
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    return JSON.parse(text).message;
  } catch (error) {
    console.error('Error generating EA message:', error);
    return "I see you tracking your work.";
  }
}

module.exports = {
  shouldEAAppear,
  generateEAMessage
};
