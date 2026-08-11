const { getRestaurant } = require('./_services/db-restaurants.cjs');
const { findSection, derivePass, openTargets, mergeFactResult } = require('./_services/learn-coverage-logic.cjs');
const { log } = require('./_utils/log.cjs');

// The model reports its own free pick (nextItemId/nextFactType) here —
// this endpoint doesn't compute "what's next" itself, it validates that
// pick against real coverage and falls back to the first open item if
// it's ever missing/stale/invalid. What it DOES decide itself: whether
// there's a next question at all — a pass boundary or full coverage always
// wins over whatever the model proposed, the app has final say on that.
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { toolUse, restaurantId, section: sectionName, factCoverage, target, reviewMode } = JSON.parse(event.body || '{}');
    if (toolUse?.name !== 'record_fact_result') {
      return { statusCode: 400, body: JSON.stringify({ error: `Unknown tool: ${toolUse?.name}` }) };
    }
    if (!restaurantId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'restaurantId is required' }) };
    }
    if (!sectionName) {
      return { statusCode: 400, body: JSON.stringify({ error: 'section is required' }) };
    }

    const restaurant = await getRestaurant(restaurantId);
    const section = findSection(restaurant, sectionName);
    if (!section) {
      return { statusCode: 400, body: JSON.stringify({ error: `Unknown section: ${sectionName}` }) };
    }

    // reviewMode forces 'review' for both — see learn-chat-init.cjs, same
    // reasoning. pass and newPass are always equal in review mode, so the
    // passComplete branch below naturally never fires, no separate skip
    // needed.
    const pass = reviewMode ? 'review' : derivePass(section, factCoverage);
    const { result, nextItemId, nextFactType } = toolUse.input || {};

    // Nothing to merge on the kickoff turn (no target, no result yet).
    const updatedCoverage = (target && result) ? mergeFactResult(factCoverage, target.itemId, target.factType, result) : factCoverage;
    const newPass = reviewMode ? 'review' : derivePass(section, updatedCoverage);

    const toolResult = {};
    if (result) toolResult.result = result;

    if (pass === 'basics' && newPass === 'complete') {
      toolResult.stop = 'passComplete';
    } else {
      const openList = openTargets(section, updatedCoverage, newPass);
      if (openList.length === 0) {
        toolResult.stop = 'covered';
      } else {
        const proposed = nextItemId && nextFactType ? { itemId: nextItemId, factType: nextFactType } : null;
        const isValid = proposed && openList.some((t) => t.itemId === proposed.itemId && t.factType === proposed.factType);
        const next = isValid ? proposed : openList[0];
        const nextItem = section.items.find((i) => i.id === next.itemId);
        toolResult.next = { itemId: next.itemId, itemName: nextItem?.name || next.itemId, factType: next.factType };
      }
    }

    log('debug', '[learn-tool-execute] record_fact_result', { result, target, proposed: { nextItemId, nextFactType }, toolResult });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result: toolResult })
    };
  } catch (error) {
    log('error', '[learn-tool-execute] failed', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Internal server error' }) };
  }
};
