async function resolveChatContext(userId, checks) {
  for (const check of checks) {
    const result = await check(userId);
    if (result) return result;
  }
  return { priority: null, data: null };
}

module.exports = { resolveChatContext };
