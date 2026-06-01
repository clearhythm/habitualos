const { getPracticeLogsForUser } = require('./collections/practice-logs.cjs');
const { handle } = require('./_utils/api.cjs');
const { log } = require('./_utils/log.cjs');

exports.handler = handle('reflect.tool.execute', 'POST', async (event, { userId, toolUse }) => {
  if (!userId) throw new Error('userId required');
  if (!toolUse?.name) throw new Error('toolUse.name required');

  const { name: tool, input = {} } = toolUse;

  log('debug', '[reflect-tool-execute] tool:', tool, 'input:', input);

  if (tool === 'get_session_history') {
    const sessions = await getPracticeLogsForUser(userId);

    // Sort descending by start time
    let results = (sessions || []).sort((a, b) => {
      const at = a._startedAt?.seconds ?? (typeof a._startedAt === 'number' ? a._startedAt : 0);
      const bt = b._startedAt?.seconds ?? (typeof b._startedAt === 'number' ? b._startedAt : 0);
      return bt - at;
    });

    if (input.practice_name) {
      const filter = input.practice_name.toLowerCase();
      results = results.filter(s =>
        s.practiceName && s.practiceName.toLowerCase().includes(filter)
      );
    }

    const limit = Math.min(Number(input.limit) || 15, 50);
    results = results.slice(0, limit);

    return {
      result: results.map(s => {
        const startMs = s._startedAt?.seconds
          ? s._startedAt.seconds * 1000
          : (typeof s._startedAt === 'number' ? s._startedAt : null);
        return {
          practiceName: s.practiceName || 'Practice',
          duration: s.durationSeconds ? `${Math.max(1, Math.round(s.durationSeconds / 60))} minutes` : null,
          note: s.note || null,
          when: startMs
            ? new Date(startMs).toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric',
              })
            : null,
        };
      }),
    };
  }

  if (tool === 'go_to_practice') {
    return {
      result: {
        practiceName: input.practiceName,
        durationSecs: input.durationSecs,
      },
    };
  }

  if (tool === 'end_conversation') {
    log('debug', '[reflect-tool-execute] end_conversation userId:', userId);
    return { result: { ok: true } };
  }

  throw Object.assign(new Error(`Unknown tool: ${tool}`), { statusCode: 400 });
});
