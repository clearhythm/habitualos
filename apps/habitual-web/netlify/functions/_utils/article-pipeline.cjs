//
// netlify/functions/_utils/article-pipeline.cjs
// ------------------------------------------------------
// Article Discovery Pipeline - Feedback-Informed Content Search
//
// Runs on behalf of an agent to find articles, essays, and thought
// leadership matching user interests. Mirrors discovery-pipeline.cjs
// structure but targets content, not companies.
//
// Exports:
//   - runArticleDiscovery({ agentId, userId }) - Main entry point
//
// Flow:
//   1. Build context (agent goal, feedback patterns, existing article URLs)
//   2. Generate search queries via Claude
//   3. Search via Tavily API (with raw content)
//   4. Extract articles via Claude tool_use
//   5. Create drafts + review action
// ------------------------------------------------------

const Anthropic = require('@anthropic-ai/sdk');
const { getAgent } = require('../_services/db-agents.cjs');
const { getDraftsByAgent, createDraft } = require('../_services/db-agent-drafts.cjs');
const { createAction } = require('../_services/db-actions.cjs');
const { generateActionId } = require('./data-utils.cjs');
const { getProfile } = require('../_services/db-preference-profile.cjs');

const { tavilySearch: _tavilySearch } = require('@habitualos/web-search');

const anthropic = new Anthropic();

async function tavilySearch(query) {
  console.log(`[article-discovery] Searching: "${query}"`);
  return _tavilySearch(query, { maxResults: 8, includeRawContent: true });
}

// -----------------------------------------------------------------------------
// Stage 1: Build Search Context
// -----------------------------------------------------------------------------

async function buildSearchContext(agentId, userId) {
  const agent = await getAgent(agentId);
  if (!agent) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  const goal = agent.instructions?.goal || '';
  const successCriteria = agent.instructions?.success_criteria || [];

  const preferenceProfile = await getProfile(agentId);

  // Fall back to raw feedback if no profile exists yet
  let likedPatterns = [];
  let dislikedPatterns = [];
  if (!preferenceProfile) {
    const reviewedDrafts = await getDraftsByAgent(agentId, userId, { status: 'reviewed' });
    const articleFeedback = reviewedDrafts
      .filter(d => d.type === 'article' && d.review)
      .map(d => ({ score: d.review.score, feedback: d.review.feedback, title: d.data?.title }));
    likedPatterns = articleFeedback.filter(f => f.score >= 7);
    dislikedPatterns = articleFeedback.filter(f => f.score <= 3);
  }

  // Dedup by URL (not name)
  const existingDrafts = await getDraftsByAgent(agentId, userId, {});
  const existingUrls = new Set(
    existingDrafts
      .filter(d => d.type === 'article')
      .map(d => d.data?.url)
      .filter(Boolean)
  );

  console.log(`[article-discovery] Context: goal=${goal.length}chars, profile=${!!preferenceProfile}, existingArticles=${existingUrls.size}`);

  return {
    agent,
    goal,
    successCriteria,
    preferenceProfile: preferenceProfile?.profile || null,
    likedPatterns,
    dislikedPatterns,
    existingUrls
  };
}

// -----------------------------------------------------------------------------
// Stage 1b: Generate Search Queries
// -----------------------------------------------------------------------------

async function generateSearchQueries(context) {
  const { goal, successCriteria, preferenceProfile, likedPatterns, dislikedPatterns } = context;

  let prompt = `You are helping a user find high-quality articles, essays, and thought leadership relevant to their career interests.

USER'S GOAL:
${goal || 'Not specified'}

SUCCESS CRITERIA:
${successCriteria.length > 0 ? successCriteria.map(c => `- ${c}`).join('\n') : 'None specified'}
`;

  if (preferenceProfile) {
    prompt += `
USER PREFERENCE PROFILE (built from review feedback):
Summary: ${preferenceProfile.summary || 'Not available'}
Likes: ${(preferenceProfile.likes || []).join(', ') || 'None identified'}
Dislikes: ${(preferenceProfile.dislikes || []).join(', ') || 'None identified'}
`;
  } else {
    if (likedPatterns.length > 0) {
      prompt += `
ARTICLES THE USER HAS LIKED (high scores):
${likedPatterns.slice(0, 8).map(f => `- ${f.feedback || f.title || 'No feedback'} (score: ${f.score})`).join('\n')}
`;
    }
    if (dislikedPatterns.length > 0) {
      prompt += `
ARTICLES THE USER HAS DISLIKED (low scores):
${dislikedPatterns.slice(0, 8).map(f => `- ${f.feedback || f.title || 'No feedback'} (score: ${f.score})`).join('\n')}
`;
    }
  }

  prompt += `
Generate 3-5 search queries to find articles the user would find valuable.
Target: industry analysis, thought leadership essays, company engineering/product blogs, Substack newsletters, trade publications.
Avoid: job listings, company homepages, generic news roundups.
Each query should be 5-15 words. Bias toward depth and insight over recency.

Return ONLY a JSON array of query strings, like:
["query 1", "query 2", "query 3"]`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0]?.text || '[]';
  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      const queries = JSON.parse(match[0]);
      console.log(`[article-discovery] Generated ${queries.length} search queries`);
      return queries;
    }
  } catch (e) {
    console.error('[article-discovery] Failed to parse search queries:', e);
  }

  return goal ? [goal] : ['technology industry thought leadership essays'];
}

// -----------------------------------------------------------------------------
// Stage 2: Search + Extract
// -----------------------------------------------------------------------------

const EXTRACT_ARTICLE_TOOL = {
  name: 'extract_article',
  description: 'Extract an article from search results. Call for each article worth reading.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      url: { type: 'string' },
      publication: { type: 'string', description: 'Publication name or domain' },
      author: { type: 'string' },
      summary: { type: 'string', description: '2-3 sentence summary of the article' },
      topics: { type: 'array', items: { type: 'string' } },
      content_type: {
        type: 'string',
        enum: ['essay', 'analysis', 'interview', 'report', 'news', 'tutorial'],
        description: 'Type of content'
      },
      relevance_score: { type: 'number', description: '1-10 fit to the user goal' },
      recommendation: { type: 'string', description: 'Why this is worth reading (1-2 sentences)' }
    },
    required: ['title', 'url', 'summary', 'relevance_score', 'recommendation']
  }
};

async function extractArticlesFromResults(searchResults, context) {
  const { goal } = context;

  const resultsText = searchResults.map((r, i) =>
    `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content || ''}`
  ).join('\n\n');

  const prompt = `Analyze these search results and extract articles worth reading based on the user's goal.

USER'S GOAL:
${goal || 'Find valuable industry content'}

SEARCH RESULTS:
${resultsText}

For each article that provides genuine value (insight, analysis, depth), use the extract_article tool to record it.
Skip: news aggregators, listicles, SEO spam, paywalled articles without enough content to judge, job listings.
Focus on quality over quantity — 2-4 strong articles beats 8 mediocre ones.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    tools: [EXTRACT_ARTICLE_TOOL],
    messages: [{ role: 'user', content: prompt }]
  });

  // Build URL → raw_content lookup
  const rawContentByUrl = {};
  for (const r of searchResults) {
    if (r.url && r.raw_content) {
      rawContentByUrl[r.url] = r.raw_content;
    }
  }

  const articles = [];
  for (const block of response.content) {
    if (block.type === 'tool_use' && block.name === 'extract_article') {
      const article = block.input;
      // Attach raw content if available, truncated to stay under Firestore 1MB doc limit
      const rawContent = rawContentByUrl[article.url];
      if (rawContent) {
        article.content = rawContent.slice(0, 10000);
      }
      articles.push(article);
    }
  }

  return articles;
}

async function searchAndExtract(queries, context) {
  const { existingUrls } = context;
  const allArticles = [];
  const errors = [];

  for (const query of queries) {
    try {
      const results = await tavilySearch(query);

      if (results.length === 0) {
        console.log(`[article-discovery] No results for: "${query}"`);
        continue;
      }

      const articles = await extractArticlesFromResults(results, context);

      for (const article of articles) {
        if (article.url && !existingUrls.has(article.url)) {
          allArticles.push(article);
          existingUrls.add(article.url);
        }
      }

      console.log(`[article-discovery] Extracted ${articles.length} articles from "${query}"`);

    } catch (err) {
      console.error(`[article-discovery] Error processing query "${query}":`, err.message);
      errors.push({ query, error: err.message });
    }
  }

  return { articles: allArticles, errors };
}

// -----------------------------------------------------------------------------
// Stage 3: Save Results
// -----------------------------------------------------------------------------

async function saveResults(articles, agentId, userId) {
  const draftIds = [];
  const toSave = articles.slice(0, 5);

  for (const article of toSave) {
    try {
      const draft = await createDraft({
        _userId: userId,
        agentId,
        type: 'article',
        status: 'pending',
        data: {
          title: article.title,
          url: article.url,
          publication: article.publication || '',
          author: article.author || '',
          summary: article.summary,
          content: article.content || '',
          topics: article.topics || [],
          content_type: article.content_type || 'essay',
          relevance_score: article.relevance_score,
          recommendation: article.recommendation
        }
      });
      draftIds.push(draft.id);
      console.log(`[article-discovery] Created draft: ${draft.id} ("${article.title}")`);
    } catch (err) {
      console.error(`[article-discovery] Failed to create draft for "${article.title}":`, err.message);
    }
  }

  if (draftIds.length > 0) {
    try {
      const titles = toSave.map(a => a.title).filter(Boolean);
      const actionId = generateActionId();
      await createAction(actionId, {
        _userId: userId,
        agentId,
        title: `Review ${draftIds.length} new article${draftIds.length > 1 ? 's' : ''}`,
        description: titles.slice(0, 3).join(', ') + (titles.length > 3 ? '...' : ''),
        taskType: 'review',
        taskConfig: { draftType: 'article', sourceAgentId: agentId, draftIds },
        state: 'open',
        priority: 'medium',
        assignedTo: 'user'
      });
      console.log(`[article-discovery] Created review action: ${actionId}`);
    } catch (err) {
      console.error('[article-discovery] Failed to create review action:', err.message);
    }
  }

  return draftIds;
}

// -----------------------------------------------------------------------------
// Main Entry Point
// -----------------------------------------------------------------------------

/**
 * Run the article discovery pipeline for an agent
 * @param {Object} options
 * @param {string} options.agentId - Agent ID to run discovery for
 * @param {string} options.userId - User ID
 * @returns {Promise<Object>} { draftIds, searchQueries, errors }
 */
async function runArticleDiscovery({ agentId, userId }) {
  console.log(`[article-discovery] Starting for agent=${agentId}, user=${userId}`);

  const result = {
    draftIds: [],
    searchQueries: [],
    errors: []
  };

  try {
    const context = await buildSearchContext(agentId, userId);

    const queries = await generateSearchQueries(context);
    result.searchQueries = queries;

    if (queries.length === 0) {
      console.log('[article-discovery] No search queries generated');
      return result;
    }

    const { articles, errors } = await searchAndExtract(queries, context);
    result.errors = errors;

    if (articles.length === 0) {
      console.log('[article-discovery] No articles found');
      return result;
    }

    console.log(`[article-discovery] Found ${articles.length} unique articles`);

    const draftIds = await saveResults(articles, agentId, userId);
    result.draftIds = draftIds;

    console.log(`[article-discovery] Complete: ${draftIds.length} drafts created`);

  } catch (err) {
    console.error('[article-discovery] Pipeline error:', err);
    result.errors.push({ stage: 'pipeline', error: err.message });
  }

  return result;
}

module.exports = { runArticleDiscovery };
