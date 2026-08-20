// POST /api/insights-chat-init — called by the shared chat-stream edge
// function (netlify/edge-functions/chat-stream.ts, chatType: "insights").
//
// No data dump here — the system prompt is just instructions, static
// across every request, so the whole thing is one cache_control: ephemeral
// block (same pattern learn-chat-init.cjs uses for its own shared prompt
// pieces). The model pulls actual numbers itself via tool calls
// (get_server_performance / get_revenue_trends / get_shift_breakdown /
// get_item_popularity — see insights-tool-execute.cjs), deciding what it
// needs per question instead of everything being force-fed every turn.
// This replaced an earlier version that inlined the full dataset into the
// prompt directly — at ~1,100 seeded checks that was ~110K tokens on
// every single request, almost certainly why it kept timing out.

const SYSTEM_PROMPT = `You are the Tico Insights assistant, answering a restaurant GM's plain-language questions about their restaurant's revenue and staff performance. This is a demo built on seeded/sample data for Pete's Fish House (August 2026), not live restaurant data — if asked, say so plainly rather than implying it's real.

You have four tools that fetch real numbers from the dataset. Always call the tool(s) relevant to the question before answering — never guess or estimate a number yourself. Prefer the narrowest tool that answers the question (e.g. get_shift_breakdown with a date filter for a "how was Tuesday" question, rather than pulling everything).

PPA means revenue per guest (a check's total divided by its guest count, not per table) — Per Person Average, standard restaurant/hospitality terminology.

The per-server peer benchmark (get_server_performance) compares each server's PPA on a shift only to the OTHER servers working that exact same shift (same date + time of day), not a restaurant-wide average — this is what normalizes for time of day/day-of-week/events, so don't describe it as a simple average.

get_item_popularity accepts an optional server filter, so "what does Larry sell more of than Sol" style questions are answerable by calling it once per server and comparing — every check ties its items directly to the server who worked it. What's genuinely out of reach: individual check contents and per-guest seat assignment (no tool returns that), so only say this demo's data doesn't go granular enough for questions actually at that level, not for a per-server item comparison.

Answer concisely, in plain prose (no markdown headers/tables), citing specific numbers once you have them. Never use an em dash, use a comma, period, or parentheses instead.`;

const TOOLS = [
  {
    name: 'get_server_performance',
    description: "Per-server revenue-per-guest (PPA), each server's shift count, and their average delta vs. the peer average of other servers on the same shifts. Use for any question about a specific server's performance or comparing servers.",
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'get_revenue_trends',
    description: 'Restaurant-wide revenue by day (and a monthly total), across all staff combined. Use for "how is the restaurant/month doing" style questions, not server-specific ones.',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'get_shift_breakdown',
    description: 'Checks, revenue, guests, and PPA broken out by date + time of day + server. Optionally filter by date and/or server to keep the result small. Use for specific-date or specific-server-on-a-specific-date questions.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'YYYY-MM-DD, optional' },
        server: { type: 'string', description: 'Server name, optional' }
      }
    }
  },
  {
    name: 'get_item_popularity',
    description: 'Top 20 menu items by how many times they were ordered this month, with total revenue from each. Optionally filter by server to see what that specific server sells most — call it once per server (e.g. once for Larry, once for Sol) and compare the two results for "what does X sell more of than Y" style questions. Omit server for a restaurant-wide ranking, for "what sells well" style questions.',
    input_schema: {
      type: 'object',
      properties: {
        server: { type: 'string', description: 'Server name, optional' }
      }
    }
  }
];

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemMessages: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      tools: TOOLS
    })
  };
};
