require('dotenv').config();
const { insertPractice, getPracticeCount, getRecentPractices } = require('../../db/helpers');

// Obi-Wai's wisdom library (short form + long form)
const wisdomLibrary = {
  first_practice: {
    short: "I see you starting.",
    long: "Most people think about starting for months, maybe years. You actually did it. That gap between thinking and doing—that's where most practices die. You crossed it. I'll be here watching what you build."
  },
  return_after_gap: {
    short: "You came back. That's the practice.",
    long: "Stopping isn't failure. Stopping is information. You stopped, you noticed, and you returned. That cycle—falling away and coming back—is the actual practice. Most people think the practice is perfect consistency. It's not. The practice is returning."
  },
  milestone_3: {
    short: "Three times. You're building something.",
    long: "Three practices means it's not a fluke anymore. The first time is curiosity. The second time is testing. The third time is the beginning of a pattern. You're not just trying something—you're building something. The question now isn't whether to practice, but what you're learning from it."
  },
  milestone_7: {
    short: "Seven practices. You're becoming someone who does this.",
    long: "Seven times is when identity starts to shift. You're not someone who's 'trying' to practice anymore—you're someone who practices. The difference is subtle but profound. Actions repeated become character. You're not the same person who started this."
  },
  wrote_reflection: {
    short: "I see you wrote something. You're paying attention.",
    long: "Most people do the thing and move on. You stopped to notice what happened. That's different. When you write what you observe, you're not just practicing—you're learning from it. The reflection is often more valuable than the practice itself."
  },
  early_morning: {
    short: "You're practicing early. Before everything else.",
    long: `It's ${new Date().toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'})}. Most people are still asleep. You claimed this time before the day could take it. That choice—practicing before obligations arrive—that tells me something about what this means to you.`
  },
  late_night: {
    short: "Late practice. You didn't let today win.",
    long: `It's ${new Date().toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'})}. The day tried to consume everything. And here you are anyway. You took time back. Most people would say 'tomorrow.' You said 'now.' That difference compounds.`
  },
  long_practice: {
    short: "You stayed longer. You're going deeper.",
    long: "Duration isn't just about time—it's about trust. Staying longer means you trust the practice enough to keep going past the discomfort, past the distraction, past the voice that says 'this is enough.' When you stay, you're saying: I believe there's something here worth finding. And you're right."
  },
  consistent_streak: {
    short: "You're showing up. The consistency is changing you.",
    long: "When practice becomes consistent, something shifts. It stops being a thing you 'do' and becomes part of how you move through the world. You don't have to decide anymore—you just practice. That's when the real transformation happens: not in any single practice, but in the accumulated weight of showing up."
  }
};

// Detect meaningful patterns and decide if Obi-Wai should speak
function analyzeAndRespond(practiceCount, recentPractices, currentPractice) {
  // First practice - always meaningful
  if (practiceCount === 0) {
    return {
      shouldAppear: true,
      pattern: 'first_practice',
      wisdom: wisdomLibrary.first_practice
    };
  }

  const now = new Date();
  const hour = now.getHours();

  // Check for gap (last practice was 3+ days ago)
  if (recentPractices.length >= 1) {
    const lastPractice = new Date(recentPractices[0].timestamp);
    const daysSinceLastPractice = (now - lastPractice) / (1000 * 60 * 60 * 24);

    if (daysSinceLastPractice >= 3) {
      return {
        shouldAppear: true,
        pattern: 'return_after_gap',
        wisdom: wisdomLibrary.return_after_gap
      };
    }
  }

  // Milestone: 3rd practice
  if (practiceCount === 2) {
    return {
      shouldAppear: true,
      pattern: 'milestone_3',
      wisdom: wisdomLibrary.milestone_3
    };
  }

  // Milestone: 7th practice
  if (practiceCount === 6) {
    return {
      shouldAppear: true,
      pattern: 'milestone_7',
      wisdom: wisdomLibrary.milestone_7
    };
  }

  // User wrote a reflection (meaningful engagement)
  if (currentPractice.reflection && currentPractice.reflection.length > 20) {
    return {
      shouldAppear: true,
      pattern: 'wrote_reflection',
      wisdom: wisdomLibrary.wrote_reflection
    };
  }

  // Early morning practice (before 6am)
  if (hour >= 4 && hour < 6) {
    return {
      shouldAppear: true,
      pattern: 'early_morning',
      wisdom: wisdomLibrary.early_morning
    };
  }

  // Late night practice (after 10pm)
  if (hour >= 22 || hour < 4) {
    return {
      shouldAppear: true,
      pattern: 'late_night',
      wisdom: wisdomLibrary.late_night
    };
  }

  // Longer practice (30+ minutes)
  if (currentPractice.duration && currentPractice.duration >= 30) {
    return {
      shouldAppear: true,
      pattern: 'long_practice',
      wisdom: wisdomLibrary.long_practice
    };
  }

  // Check for consistency (practiced 4+ times in last 7 days)
  if (recentPractices.length >= 4) {
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const practicesLastWeek = recentPractices.filter(p =>
      new Date(p.timestamp) >= sevenDaysAgo
    ).length;

    if (practicesLastWeek >= 4 && practiceCount >= 10) {
      return {
        shouldAppear: true,
        pattern: 'consistent_streak',
        wisdom: wisdomLibrary.consistent_streak
      };
    }
  }

  // No meaningful pattern detected - silence is wisdom too
  return {
    shouldAppear: false,
    pattern: null,
    wisdom: null
  };
}

/**
 * POST /api/practice
 * Submit a new practice entry
 */
exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    // Parse request body
    const { practice_name, duration, reflection } = JSON.parse(event.body);

    // Get current practice count and recent practices
    const practiceCount = getPracticeCount();
    const recentPractices = getRecentPractices(10);

    // Analyze patterns and decide if Obi-Wai should speak
    const analysis = analyzeAndRespond(practiceCount, recentPractices, {
      practice_name,
      duration,
      reflection
    });

    // Insert practice
    const practice = insertPractice({
      practice_name,
      duration,
      reflection,
      obi_wan_message: analysis.shouldAppear ? analysis.wisdom.short : null
    });

    // Return success
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        practice,
        obi_wan_appeared: analysis.shouldAppear,
        obi_wan_message: analysis.shouldAppear ? analysis.wisdom.short : null,
        obi_wan_expanded: analysis.shouldAppear ? analysis.wisdom.long : null,
        pattern_detected: analysis.pattern
      })
    };

  } catch (error) {
    console.error('Error in practice-submit:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
