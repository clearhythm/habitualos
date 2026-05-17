exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

  // TODO: query sessions collection, order by startedAt desc, limit 20
  return {
    statusCode: 200,
    body: JSON.stringify({ sessions: [] }),
  };
};
