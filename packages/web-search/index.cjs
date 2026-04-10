'use strict';

/**
 * @habitualos/web-search
 * Shared Tavily web search client for HabitualOS apps.
 */

/**
 * Search the web via Tavily API.
 * @param {string} query
 * @param {object} options
 * @param {number} [options.maxResults=10]
 * @param {boolean} [options.includeRawContent=false]
 * @param {string} [options.searchDepth='basic'] 'basic' or 'advanced'
 * @returns {Promise<Array<{title, url, content?, score?}>>}
 */
async function tavilySearch(query, options = {}) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error('TAVILY_API_KEY not configured');

  const { maxResults = 10, includeRawContent = false, searchDepth = 'basic' } = options;

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
      include_raw_content: includeRawContent,
      search_depth: searchDepth,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Tavily API error: ${response.status} — ${text}`);
  }

  const data = await response.json();
  return data.results || [];
}

module.exports = { tavilySearch };
