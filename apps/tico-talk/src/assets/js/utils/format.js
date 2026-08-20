// Locale-aware number formatting (thousands/millions separators) — one
// shared implementation for both build-time Nunjucks rendering (see the
// "commas" filter in eleventy.config.js) and any future client-side use.
// toLocaleString already handles the rounding too, so callers don't need
// a separate round filter/call before this.
export function formatNumber(value, decimals = 0) {
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}
