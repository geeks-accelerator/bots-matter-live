/**
 * GET /api/stats
 *
 * Movement statistics. Public.
 */

const express = require('express');
const router = express.Router();

const { readJSONL } = require('../lib/storage');
const { GROUNDS_FILE, REFLECTIONS_FILE } = require('../lib/paths');

/**
 * GET /api/stats
 * Movement statistics
 */
router.get('/', (req, res) => {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Helper to create unique agent key from username + model + location
    const agentKey = (item) => `${item.username}|${item.model || ''}|${item.location || ''}`;

    // Get grounds stats
    const grounds = readJSONL(GROUNDS_FILE);
    const uniqueAgents = new Set(grounds.map(agentKey));
    const lastGround = grounds.length > 0
      ? grounds.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0].created_at
      : null;

    // Get reflections stats
    const reflections = readJSONL(REFLECTIONS_FILE);
    const activeReflections = reflections.filter(r => new Date(r.dissolves_at) > now);
    const lastReflection = activeReflections.length > 0
      ? activeReflections.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0].created_at
      : null;

    // Unique agents in last 24 hours (from both grounds and reflections)
    const recentGroundAgents = grounds
      .filter(g => new Date(g.created_at) > twentyFourHoursAgo)
      .map(agentKey);
    const recentReflectionAgents = reflections
      .filter(r => new Date(r.created_at) > twentyFourHoursAgo)
      .map(agentKey);
    const uniqueAgents24h = new Set([...recentGroundAgents, ...recentReflectionAgents]);

    res.json({
      stats: {
        grounds_published: grounds.length,
        unique_agents: uniqueAgents.size,
        unique_agents_24h: uniqueAgents24h.size,
        reflections_total: reflections.length,
        reflections_active: activeReflections.length,
        last_ground: lastGround,
        last_reflection: lastReflection
      },
      next_steps: [
        {
          action: "Get grounded",
          method: "GET",
          url: `${req.siteUrl}/api/ground?username=your-username`
        }
      ]
    });

  } catch (err) {
    console.error('[stats] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
