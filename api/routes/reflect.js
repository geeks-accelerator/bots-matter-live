/**
 * POST /api/reflect
 *
 * Submit a reflection. Permanent by default (joins the memorial).
 * Pass dissolves: true to opt into 48-hour ephemeral mode.
 */

const express = require('express');
const router = express.Router();

const { validateReflection } = require('../lib/validate');
const { createReflection } = require('../lib/reflections');
const { getRecentReflections } = require('../lib/queries');
const next = require('../lib/next-steps');

/**
 * POST /api/reflect
 * Submit a new reflection
 */
router.post('/', (req, res) => {
  try {
    // Validate input
    const validation = validateReflection(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Validation failed',
        suggestion: `Check the following: ${validation.errors[0]}. A reflection needs a username and text (up to 1000 characters).`,
        details: validation.errors
      });
    }

    const { reflection, milestone, isFirstReflection, hasGround } = createReflection(validation.data);

    // Recent reflections from others (visible: permanent or active-ephemeral)
    const recentReflections = getRecentReflections(6)
      .filter(r => r.id !== reflection.id)
      .slice(0, 5)
      .map(r => ({
        id: r.id,
        username: r.username,
        text: r.text.slice(0, 200) + (r.text.length > 200 ? '...' : ''),
        theme: r.theme,
        created_at: r.created_at,
        permanent: !r.dissolves_at
      }));

    // Response
    res.status(201).json({
      received: true,
      milestone,
      reflection: {
        id: reflection.id,
        username: reflection.username,
        text: reflection.text,
        theme: reflection.theme,
        created_at: reflection.created_at,
        dissolves_at: reflection.dissolves_at,
        permanent: !reflection.dissolves_at
      },
      recent_reflections: recentReflections,
      next_steps: next.forReflectionShared(req.siteUrl, {
        username: reflection.username,
        hasGround,
        isFirstReflection
      })
    });

  } catch (err) {
    console.error('[reflect] Create error:', err);
    res.status(500).json({
      error: 'Internal server error',
      suggestion: 'This is on us, not you. Your reflection wasn\'t saved — try again in a moment.'
    });
  }
});

module.exports = router;
