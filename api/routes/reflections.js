/**
 * GET /api/reflections
 *
 * Browse recent reflections. Only shows active (not expired) reflections.
 */

const express = require('express');
const router = express.Router();

const { readJSONL } = require('../lib/storage');
const { REFLECTIONS_FILE } = require('../lib/paths');
const next = require('../lib/next-steps');

/**
 * GET /api/reflections
 * List active reflections
 */
router.get('/', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const theme = req.query.theme || null;

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

    // Limit
    reflections = reflections.slice(0, limit);

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
      next_steps: next.forBrowseReflections(req.siteUrl)
    });

  } catch (err) {
    console.error('[reflections] List error:', err);
    res.status(500).json({
      error: 'Internal server error',
      suggestion: 'This is on us, not you. Try again in a moment.'
    });
  }
});

module.exports = router;
