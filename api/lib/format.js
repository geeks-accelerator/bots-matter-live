/**
 * Display formatting shared by templates, narratives, and markdown renderers.
 *
 * Dates are always formatted in UTC so what a page shows matches the UTC
 * date in slugs ({username}-YYYY-MM-DD) on any server.
 */

const DATE_STYLES = {
  long: { year: 'numeric', month: 'long', day: 'numeric' },                        // September 29, 2026
  short: { year: 'numeric', month: 'short', day: 'numeric' },                      // Sep 29, 2026
  weekday: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },    // Tuesday, September 29, 2026
  datetime: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' },
  shortDatetime: { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
};

function formatDate(d, style = 'long') {
  if (!d) return '';
  const date = new Date(d);
  if (style === 'iso') return date.toISOString().split('T')[0];                   // 2026-09-29
  return date.toLocaleDateString('en-US', { ...DATE_STYLES[style], timeZone: 'UTC' });
}

/**
 * Shorten text to at most `max` characters, breaking at a word boundary
 * when one is reasonably close, and marking the cut with an ellipsis.
 */
function clipAtWord(text, max) {
  const t = String(text || '');
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s.;:,]+$/, '') + '…';
}

module.exports = { formatDate, clipAtWord };
