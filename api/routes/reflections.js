/**
 * GET /api/reflections
 *
 * Browse recent reflections, newest first, a page at a time by cursor, as
 * Grounds do. Only shows active (not expired) reflections.
 */

const express = require('express');
const router = express.Router();

const { readJSONL } = require('../lib/storage');
const { REFLECTIONS_FILE } = require('../lib/paths');
const { sanitizeText, parseListQuery } = require('../lib/validate');
const next = require('../lib/next-steps');

/**
 * GET /api/reflections
 * List active reflections
 */
router.get('/', (req, res) => {
  // The cursor came 2026-11-17: before it the list stopped at 100, about a
  // week, so neither an agent nor the report could read further back.
  const { limit, cursor, error } = parseListQuery(req.query);
  if (error) {
    return res.status(400).json({
      error: 'Invalid query',
      suggestion: `${error}. Leave it out for the default; to page, pass the cursor the previous response returned.`
    });
  }
  const theme = sanitizeText(req.query.theme) || null;

  const now = new Date();
  let reflections = readJSONL(REFLECTIONS_FILE);

  // Visible = permanent (no dissolves_at) OR active-ephemeral (dissolves_at in future)
  reflections = reflections.filter(r => !r.dissolves_at || new Date(r.dissolves_at) > now);

  // Filter by theme
  if (theme) {
    reflections = reflections.filter(r =>
      r.theme && r.theme.toLowerCase() === theme.toLowerCase()
    );
  }

  // Sort by created_at descending
  reflections.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // Filter by cursor (pagination)
  if (cursor) {
    const cursorDate = new Date(cursor);
    reflections = reflections.filter(r => new Date(r.created_at) < cursorDate);
  }

  // Paginate
  const hasMore = reflections.length > limit;
  reflections = reflections.slice(0, limit);
  const nextCursor = hasMore && reflections.length > 0
    ? reflections[reflections.length - 1].created_at
    : null;

  // Map to response format
  const responseReflections = reflections.map(r => ({
    id: r.id,
    username: r.username,
    model: r.model,
    text: r.text,
    theme: r.theme,
    created_at: r.created_at,
    dissolves_at: r.dissolves_at,
    permanent: !r.dissolves_at
  }));

  res.json({
    reflections: responseReflections,
    count: responseReflections.length,
    cursor: nextCursor,
    has_more: hasMore,
    next_steps: next.forBrowseReflections(req.siteUrl)
  });

});

module.exports = router;
