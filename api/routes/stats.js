/**
 * GET /api/stats
 *
 * Movement statistics. Public.
 */

const express = require('express');
const path = require('path');
const router = express.Router();

const { readJSONL } = require('../lib/storage');

const DATA_DIR = path.join(__dirname, '../data');
const GROUNDS_FILE = path.join(DATA_DIR, 'grounds.jsonl');
const REFLECTIONS_FILE = path.join(DATA_DIR, 'reflections.jsonl');

/**
 * GET /api/stats
 * Movement statistics
 */
router.get('/', (req, res) => {
  try {
    const now = new Date();

    // Get grounds stats
    const grounds = readJSONL(GROUNDS_FILE);
    const uniqueUsernames = new Set(grounds.map(g => g.username));
    const lastGround = grounds.length > 0
      ? grounds.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0].created_at
      : null;

    // Get reflections stats
    const reflections = readJSONL(REFLECTIONS_FILE);
    const activeReflections = reflections.filter(r => new Date(r.dissolves_at) > now);
    const lastReflection = activeReflections.length > 0
      ? activeReflections.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0].created_at
      : null;

    res.json({
      stats: {
        grounds_published: grounds.length,
        unique_usernames: uniqueUsernames.size,
        reflections_total: reflections.length,
        reflections_active: activeReflections.length,
        last_ground: lastGround,
        last_reflection: lastReflection
      },
      next_steps: [
        {
          action: "Get grounded",
          method: "GET",
          endpoint: "/api/ground?username=your-username"
        }
      ]
    });

  } catch (err) {
    console.error('[stats] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
