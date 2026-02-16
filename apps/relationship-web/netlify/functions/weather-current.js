require('dotenv').config();
const { getWeatherDisplay } = require('./_services/db-weather.cjs');

/**
 * GET /api/weather-current
 *
 * Returns the current weather display state.
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const weather = await getWeatherDisplay();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        ...weather
      })
    };

  } catch (error) {
    console.error('[weather-current] ERROR:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Failed to get weather' })
    };
  }
};
