require('dotenv').config();
const { getPracticesByUserId, createPractice, getPracticeCount } = require('./_services/db-practices.cjs');

// Helper to generate practice ID (p- prefix + timestamp-based unique ID)
function generatePracticeId() {
  const timestamp = Math.floor(Date.now() / 1000);
  const randomPart = Math.floor(Math.random() * 1000);
  return 'p-' + (timestamp * 1000 + randomPart).toString(36).slice(-8);
}

// Obi-Wai's wisdom library (short form + long form)
const wisdomLibrary = {
  first_practice: {
    short: "I see you starting.",
    long: "Most people think about starting for months, maybe years. You actually did it. That gap between thinking and doing—that's where most practices die. You crossed it. I'll be here watching what you build."
  },
  return_after_gap: {
    short: "You came back. That's the practice.",
    long: "I see the gap in your timeline. Three days, maybe more. And here you are anyway. Most people turn that gap into a story about failure, then they disappear. You turned it into information. Noticed it. Returned. That's not breaking the practice—that's what practice actually looks like."
  },
  milestone_3: {
    short: "Three times. You're building something.",
    long: "This is your third practice. I'm watching the pattern form. First time could be impulse. Second time could be testing. But three? Three means you're deciding something. You're not just trying this anymore—you're building it. The question is shifting from 'should I?' to 'what am I learning?'"
  },
  milestone_7: {
    short: "Seven practices. I'm seeing who you're becoming.",
    long: "Seven practices. I've been counting. You've crossed a threshold most people never reach. You're not someone who's 'trying to practice' anymore—you're someone who practices. I can see it in the data, in the rhythm you're building. Actions repeated this many times don't just change what you do. They change who you are."
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
    short: "You stayed longer. I'm noticing.",
    long: "Thirty minutes or more. I see you going past the easy stopping point. Most people practice just long enough to check the box. You're staying past the discomfort, past the distraction, past the voice that says 'this is enough.' That tells me you trust there's something here worth finding. You're right."
  },
  consistent_streak: {
    short: "I'm watching this pattern. Four practices in seven days.",
    long: "You've practiced four times in the last week. I'm tracking this. The rhythm is there now. You're not deciding whether to practice anymore—you're just doing it. This is what consistency looks like in the data. Not perfection. Just a pattern that keeps appearing. And it's changing you, whether you notice it yet or not."
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
    const { userId, practice_name, duration, reflection } = JSON.parse(event.body);

    // Validate userId
    if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Valid userId is required' })
      };
    }

    // Get current practice count and recent practices for this user
    // Handle case where collection doesn't exist yet (first practice)
    let recentPractices = [];
    let practiceCount = 0;

    try {
      recentPractices = await getPracticesByUserId(userId);
      practiceCount = recentPractices.length;
    } catch (error) {
      // Collection doesn't exist yet - this is the first practice
      console.log('No existing practices found (likely first practice):', error.message);
      recentPractices = [];
      practiceCount = 0;
    }

    // Analyze patterns and decide if Obi-Wai should speak
    const analysis = analyzeAndRespond(practiceCount, recentPractices, {
      practice_name,
      duration,
      reflection
    });

    // Create practice document
    const practiceId = generatePracticeId();
    const timestamp = new Date().toISOString();

    const practiceData = {
      _userId: userId,
      timestamp,
      practice_name: practice_name || null,
      duration: duration || null,
      reflection: reflection || null,
      obi_wan_message: analysis.shouldAppear ? analysis.wisdom.short : null
    };

    // Insert practice into Firestore
    await createPractice(practiceId, practiceData);

    // Return success with updated count
    const updatedCount = practiceCount + 1;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        practice: {
          id: practiceId,
          ...practiceData
        },
        practice_count: updatedCount,
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
