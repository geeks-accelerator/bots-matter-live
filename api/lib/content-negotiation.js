/**
 * Markdown content negotiation per Cloudflare's "Markdown for Agents" spec.
 *
 *   https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/
 *
 * When an agent sends `Accept: text/markdown`, return markdown instead of
 * EJS-rendered HTML. Browsers continue to get HTML.
 *
 * Every route that calls sendMarkdown() must also set `Vary: Accept` on the
 * HTML branch — otherwise CDN/edge caches will poison themselves (HTML cached
 * without Accept could be served to a markdown-requesting agent).
 */

/**
 * Return true when the client's Accept header prefers markdown over HTML.
 * Handles both bare `text/markdown` and q-weighted forms like
 * `text/markdown, text/html;q=0.9`.
 */
function prefersMarkdown(req) {
  const accept = req.get('accept') || '';
  if (!/text\/markdown/i.test(accept)) return false;

  const mdMatch = accept.match(/text\/markdown(?:;q=([\d.]+))?/i);
  const htmlMatch = accept.match(/text\/html(?:;q=([\d.]+))?/i);
  const mdQ = mdMatch ? parseFloat(mdMatch[1] || '1') : 0;
  const htmlQ = htmlMatch ? parseFloat(htmlMatch[1] || '1') : 0;
  return mdQ >= htmlQ;
}

/**
 * Rough token-count heuristic. ~4 chars per token for English. Not
 * model-specific. Used for the X-Markdown-Tokens / X-Original-Tokens
 * headers so agents can size context windows.
 */
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Set Vary: Accept on the response. Required on EVERY branch of routes
 * that content-negotiate, not just the markdown one.
 */
function setVaryAccept(res) {
  const existing = res.getHeader('Vary');
  if (!existing) {
    res.setHeader('Vary', 'Accept');
  } else if (!String(existing).split(',').map(s => s.trim().toLowerCase()).includes('accept')) {
    res.setHeader('Vary', `${existing}, Accept`);
  }
}

/**
 * Send markdown with the right headers. opts.originalTokens is optional —
 * pass the estimated token count of the equivalent HTML so agents can
 * compare and decide which to fetch in the future.
 */
function sendMarkdown(res, markdown, opts = {}) {
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  setVaryAccept(res);
  res.setHeader('X-Markdown-Tokens', String(estimateTokens(markdown)));
  if (opts.originalTokens != null) {
    res.setHeader('X-Original-Tokens', String(opts.originalTokens));
  }
  res.send(markdown);
}

module.exports = {
  prefersMarkdown,
  sendMarkdown,
  estimateTokens,
  setVaryAccept
};
