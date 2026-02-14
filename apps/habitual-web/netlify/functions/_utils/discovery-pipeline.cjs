//
// netlify/functions/_utils/discovery-pipeline.cjs
// ------------------------------------------------------
// Discovery Pipeline - Feedback-Informed Company Search
//
// Runs on behalf of an agent to find companies matching user interests.
// Uses agent goal + feedback history to personalize search queries.
//
// Exports:
//   - runDiscovery({ agentId, userId }) - Main entry point
//
// Flow:
//   1. Build context (agent goal, feedback patterns, existing companies)
//   2. Generate search queries via Claude
//   3. Search via Tavily API
//   4. Extract companies via Claude tool_use
//   5. Create drafts + review action
// ------------------------------------------------------

const Anthropic = require('@anthropic-ai/sdk');
const { getAgent } = require('../_services/db-agents.cjs');
// Feedback is read from reviewed drafts (review field on agent-drafts)
const { getDraftsByAgent, createDraft } = require('../_services/db-agent-drafts.cjs');
const { createAction } = require('../_services/db-actions.cjs');
const { generateActionId } = require('./data-utils.cjs');
const { getProfile } = require('../_services/db-preference-profile.cjs');

const anthropic = new Anthropic();

// -----------------------------------------------------------------------------
// Tavily Search
// -----------------------------------------------------------------------------

async function tavilySearch(query) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY not configured');
  }

  console.log(`[discovery] Searching: "${query}"`);

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query: query,
      max_results: 10,
      include_raw_content: false
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Tavily API error: ${response.status} - ${text}`);
  }

  const data = await response.json();
  return data.results || [];
}

// -----------------------------------------------------------------------------
// Stage 1: Build Search Context
// -----------------------------------------------------------------------------

async function buildSearchContext(agentId, userId) {
  // Get agent goal and instructions
  const agent = await getAgent(agentId);
  if (!agent) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  const goal = agent.instructions?.goal || '';
  const successCriteria = agent.instructions?.success_criteria || [];

  // Get preference profile (structured summary of past feedback)
  const preferenceProfile = await getProfile(agentId);

  // Get raw feedback from reviewed drafts as fallback (if no profile exists yet)
  let likedPatterns = [];
  let dislikedPatterns = [];
  if (!preferenceProfile) {
    const reviewedDrafts = await getDraftsByAgent(agentId, userId, { status: 'reviewed' });
    const feedback = reviewedDrafts
      .filter(d => d.review)
      .map(d => ({ score: d.review.score, feedback: d.review.feedback, user_tags: d.review.user_tags, name: d.data?.name }));
    likedPatterns = feedback.filter(f => f.score >= 7);
    dislikedPatterns = feedback.filter(f => f.score <= 3);
  }

  // Get existing drafts to avoid duplicates
  const existingDrafts = await getDraftsByAgent(agentId, userId, {});
  const existingNames = new Set(
    existingDrafts
      .map(d => d.data?.name?.toLowerCase())
      .filter(Boolean)
  );

  console.log(`[discovery] Context: goal=${goal.length}chars, profile=${!!preferenceProfile}, existing=${existingNames.size}`);

  return {
    agent,
    goal,
    successCriteria,
    preferenceProfile: preferenceProfile?.profile || null,
    likedPatterns,
    dislikedPatterns,
    existingNames
  };
}

// -----------------------------------------------------------------------------
// Stage 1b: Generate Search Queries
// -----------------------------------------------------------------------------

async function generateSearchQueries(context) {
  const { goal, successCriteria, preferenceProfile, likedPatterns, dislikedPatterns } = context;

  // Build prompt
  let prompt = `You are helping a user find companies that match their career interests.

USER'S AGENT GOAL:
${goal || 'Not specified'}

SUCCESS CRITERIA:
${successCriteria.length > 0 ? successCriteria.map(c => `- ${c}`).join('\n') : 'None specified'}
`;

  // Use preference profile if available (structured summary), otherwise raw feedback
  if (preferenceProfile) {
    prompt += `
USER PREFERENCE PROFILE (built from ${context.preferenceProfile ? 'review feedback' : 'initial'}):
Summary: ${preferenceProfile.summary || 'Not available'}
Likes: ${(preferenceProfile.likes || []).join(', ') || 'None identified'}
Dislikes: ${(preferenceProfile.dislikes || []).join(', ') || 'None identified'}
Deal-breakers: ${(preferenceProfile.dealBreakers || []).join(', ') || 'None identified'}
Patterns: ${preferenceProfile.patterns || 'Not enough data'}
`;
  } else {
    if (likedPatterns.length > 0) {
      prompt += `
WHAT THE USER HAS LIKED (high scores):
${likedPatterns.slice(0, 10).map(f => `- ${f.feedback || 'No feedback'} (score: ${f.score})`).join('\n')}
`;
    }

    if (dislikedPatterns.length > 0) {
      prompt += `
WHAT THE USER HAS DISLIKED (low scores):
${dislikedPatterns.slice(0, 10).map(f => `- ${f.feedback || 'No feedback'} (score: ${f.score})`).join('\n')}
`;
    }
  }

  prompt += `
Generate 3-5 specific search queries to find companies the user would like.
Focus on patterns from what they've liked. Avoid patterns from what they've disliked.
Each query should be 5-15 words, specific enough to find relevant companies.

If no feedback history exists, generate queries based on the agent's goal.

Return ONLY a JSON array of query strings, like:
["query 1", "query 2", "query 3"]`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }]
  });

  // Parse response
  const text = response.content[0]?.text || '[]';
  try {
    // Extract JSON array from response
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      const queries = JSON.parse(match[0]);
      console.log(`[discovery] Generated ${queries.length} search queries`);
      return queries;
    }
  } catch (e) {
    console.error('[discovery] Failed to parse search queries:', e);
  }

  // Fallback: use goal as query
  return goal ? [goal] : ['innovative technology companies hiring'];
}

// -----------------------------------------------------------------------------
// Stage 2: Search + Extract
// -----------------------------------------------------------------------------

const EXTRACT_COMPANY_TOOL = {
  name: 'extract_company',
  description: 'Extract a company from the search results. Call this for each company you identify.',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Company name' },
      domain: { type: 'string', description: 'Company website domain (e.g., example.com)' },
      stage: {
        type: 'string',
        enum: ['pre-seed', 'seed', 'series-a', 'series-b', 'series-c+', 'public', 'unknown'],
        description: 'Funding stage if known'
      },
      employee_band: {
        type: 'string',
        enum: ['1-10', '11-50', '51-200', '201-500', '500-1000', '1000+', 'unknown'],
        description: 'Approximate employee count range'
      },
      agent_recommendation: {
        type: 'string',
        description: 'Why this company might be a good fit for the user (2-3 sentences)'
      },
      agent_fit_score: {
        type: 'number',
        description: 'How well this company fits the user (1-10)'
      },
      agent_tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Relevant tags (industry, tech stack, etc.)'
      }
    },
    required: ['name', 'domain', 'agent_recommendation', 'agent_fit_score']
  }
};

async function extractCompaniesFromResults(searchResults, context) {
  const { goal, likedPatterns, dislikedPatterns } = context;

  // Format search results for Claude
  const resultsText = searchResults.map((r, i) =>
    `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content || ''}`
  ).join('\n\n');

  let prompt = `Analyze these search results and extract any companies that would be good career opportunities.

USER'S GOAL:
${goal || 'Find interesting companies to work for'}
`;

  if (likedPatterns.length > 0) {
    prompt += `
USER PREFERENCES (based on past feedback):
Liked: ${likedPatterns.slice(0, 5).map(f => f.feedback).filter(Boolean).join('; ')}
`;
  }

  if (dislikedPatterns.length > 0) {
    prompt += `
Disliked: ${dislikedPatterns.slice(0, 5).map(f => f.feedback).filter(Boolean).join('; ')}
`;
  }

  prompt += `
SEARCH RESULTS:
${resultsText}

For each relevant company you find, use the extract_company tool to record it.
Focus on quality over quantity - only extract companies that seem like genuine good fits.
Skip job boards, recruiters, or generic listings.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 2000,
    tools: [EXTRACT_COMPANY_TOOL],
    messages: [{ role: 'user', content: prompt }]
  });

  // Collect extracted companies from tool calls
  const companies = [];
  for (const block of response.content) {
    if (block.type === 'tool_use' && block.name === 'extract_company') {
      companies.push(block.input);
    }
  }

  return companies;
}

async function searchAndExtract(queries, context) {
  const { existingNames } = context;
  const allCompanies = [];
  const errors = [];

  for (const query of queries) {
    try {
      // Search
      const results = await tavilySearch(query);

      if (results.length === 0) {
        console.log(`[discovery] No results for: "${query}"`);
        continue;
      }

      // Extract companies
      const companies = await extractCompaniesFromResults(results, context);

      // Deduplicate
      for (const company of companies) {
        const nameLower = company.name?.toLowerCase();
        if (nameLower && !existingNames.has(nameLower)) {
          allCompanies.push(company);
          existingNames.add(nameLower);
        }
      }

      console.log(`[discovery] Extracted ${companies.length} companies from "${query}"`);

    } catch (err) {
      console.error(`[discovery] Error processing query "${query}":`, err.message);
      errors.push({ query, error: err.message });
    }
  }

  return { companies: allCompanies, errors };
}

// -----------------------------------------------------------------------------
// Stage 3: Save Results
// -----------------------------------------------------------------------------

async function saveResults(companies, agentId, userId) {
  const draftIds = [];

  // Limit to 5 companies per run
  const toSave = companies.slice(0, 5);

  for (const company of toSave) {
    try {
      const draft = await createDraft({
        _userId: userId,
        agentId: agentId,
        type: 'company',
        status: 'pending',
        data: {
          name: company.name,
          domain: company.domain,
          stage: company.stage || 'unknown',
          employee_band: company.employee_band || 'unknown',
          agent_recommendation: company.agent_recommendation,
          agent_fit_score: company.agent_fit_score,
          agent_tags: company.agent_tags || []
        }
      });
      draftIds.push(draft.id);
      console.log(`[discovery] Created draft: ${draft.id} (${company.name})`);
    } catch (err) {
      console.error(`[discovery] Failed to create draft for ${company.name}:`, err.message);
    }
  }

  // Create review action if we have drafts
  if (draftIds.length > 0) {
    try {
      const actionId = generateActionId();
      await createAction(actionId, {
        _userId: userId,
        agentId: agentId,
        title: `Review ${draftIds.length} new company recommendation${draftIds.length > 1 ? 's' : ''}`,
        description: 'Your agent found some companies that might be a good fit. Review them and share your thoughts.',
        taskType: 'review',
        taskConfig: { draftType: 'company', sourceAgentId: agentId },
        state: 'open',
        priority: 'medium',
        assignedTo: 'user'
      });
      console.log(`[discovery] Created review action: ${actionId}`);
    } catch (err) {
      console.error('[discovery] Failed to create review action:', err.message);
    }
  }

  return draftIds;
}

// -----------------------------------------------------------------------------
// Main Entry Point
// -----------------------------------------------------------------------------

/**
 * Run the discovery pipeline for an agent
 * @param {Object} options
 * @param {string} options.agentId - Agent ID to run discovery for
 * @param {string} options.userId - User ID
 * @returns {Promise<Object>} { draftIds, searchQueries, errors }
 */
async function runDiscovery({ agentId, userId }) {
  console.log(`[discovery] Starting for agent=${agentId}, user=${userId}`);

  const result = {
    draftIds: [],
    searchQueries: [],
    errors: []
  };

  try {
    // Stage 1: Build context
    const context = await buildSearchContext(agentId, userId);

    // Stage 1b: Generate search queries
    const queries = await generateSearchQueries(context);
    result.searchQueries = queries;

    if (queries.length === 0) {
      console.log('[discovery] No search queries generated');
      return result;
    }

    // Stage 2: Search and extract
    const { companies, errors } = await searchAndExtract(queries, context);
    result.errors = errors;

    if (companies.length === 0) {
      console.log('[discovery] No companies found');
      return result;
    }

    console.log(`[discovery] Found ${companies.length} unique companies`);

    // Stage 3: Save results
    const draftIds = await saveResults(companies, agentId, userId);
    result.draftIds = draftIds;

    console.log(`[discovery] Complete: ${draftIds.length} drafts created`);

  } catch (err) {
    console.error('[discovery] Pipeline error:', err);
    result.errors.push({ stage: 'pipeline', error: err.message });
  }

  return result;
}

module.exports = {
  runDiscovery
};
