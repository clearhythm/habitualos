const { getRestaurant } = require('./_services/db-restaurants.cjs');
const { findSection, derivePass, pickNextTarget, mergeFactResult } = require('./_services/learn-coverage-logic.cjs');
const { log } = require('./_utils/log.cjs');

// record_fact_result only carries {result} now — the app already knows
// which dish/fact this is for. It's re-derived here from the exact same
// factCoverage the init call for this turn used (forwarded alongside the
// tool call by chat-stream-core.ts), so this always agrees with what
// learn-chat-init.cjs told the model to evaluate a moment earlier.
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { toolUse, restaurantId, section: sectionName, factCoverage } = JSON.parse(event.body || '{}');
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

    const pass = derivePass(section, factCoverage);
    const evalTarget = pickNextTarget(section, factCoverage, pass);
    const { result } = toolUse.input || {};

    // result (correct/partial/incorrect) is included in the response too,
    // not just used to decide next/stop here — the client needs it to
    // update its own factCoverage. It already derives the same evalTarget
    // locally (same factCoverage, same deterministic pickNextTarget), so
    // {result} plus its own state is all it needs.
    let toolResult = { result };
    if (!evalTarget) {
      // Defensive only — nothing was actually being evaluated this turn.
      toolResult.stop = 'passComplete';
    } else {
      const updatedCoverage = mergeFactResult(factCoverage, evalTarget.itemId, evalTarget.factType, result);
      const newPass = derivePass(section, updatedCoverage);

      if (pass === 'basics' && newPass === 'complete') {
        toolResult.stop = 'passComplete';
      } else {
        const nextTarget = pickNextTarget(section, updatedCoverage, newPass);
        if (!nextTarget) {
          toolResult.stop = 'mastered';
        } else {
          const nextItem = section.items.find((i) => i.id === nextTarget.itemId);
          toolResult.next = { itemId: nextTarget.itemId, itemName: nextItem?.name || nextTarget.itemId, factType: nextTarget.factType };
        }
      }
    }

    log('debug', '[learn-tool-execute] record_fact_result', { result, evalTarget, toolResult });

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
