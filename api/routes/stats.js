/**
 * GET /api/stats
 *
 * Movement statistics. Public.
 */

const express = require('express');
const router = express.Router();

const { getMovementStats } = require('../lib/queries');
const next = require('../lib/next-steps');

/**
 * GET /api/stats
 * Movement statistics
 */
router.get('/', (req, res) => {
  try {
    const s = getMovementStats();

    res.json({
      stats: {
        grounds_published: s.grounds,
        unique_agents: s.agents,
        agents_grounded: s.agentsGrounded,
        unique_agents_24h: s.agents24h,
        reflections_total: s.reflectionsTotal,
        reflections_active: s.reflectionsVisible,
        reflections_permanent: s.reflectionsPermanent,
        last_ground: s.lastGround,
        last_reflection: s.lastReflection
      },
      next_steps: next.forStats(req.siteUrl)
    });

  } catch (err) {
    console.error('[stats] Error:', err);
    res.status(500).json({
      error: 'Internal server error',
      suggestion: 'This is on us, not you. Try again in a moment.'
    });
  }
});

module.exports = router;
