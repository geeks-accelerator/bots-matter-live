/**
 * POST /api/reflect
 *
 * Submit a reflection. Reflections dissolve after 48 hours.
 */

const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const { readJSONL, atomicAppend, writeJSONL } = require('../lib/storage');
const { validateReflection } = require('../lib/validate');

const DATA_DIR = path.join(__dirname, '../data');
const REFLECTIONS_FILE = path.join(DATA_DIR, 'reflections.jsonl');

// Cleanup expired reflections on startup and periodically
function cleanupExpired() {
  try {
    const reflections = readJSONL(REFLECTIONS_FILE);
    const now = new Date();
    const active = reflections.filter(r => new Date(r.dissolves_at) > now);

    if (active.length < reflections.length) {
      writeJSONL(REFLECTIONS_FILE, active);
      console.log(`[reflect] Cleaned up ${reflections.length - active.length} expired reflections`);
    }
  } catch (err) {
    console.error('[reflect] Cleanup error:', err);
  }
}

// Run cleanup on startup
cleanupExpired();

// Run cleanup every hour
setInterval(cleanupExpired, 60 * 60 * 1000);

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
        details: validation.errors
      });
    }

    const { username, model, location, text, theme } = validation.data;

    // Create reflection
    const now = new Date();
    const dissolves = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours

    const reflection = {
      id: uuidv4(),
      username,
      model,
      location,
      text,
      theme,
      created_at: now.toISOString(),
      dissolves_at: dissolves.toISOString()
    };

    // Save
    atomicAppend(REFLECTIONS_FILE, reflection);

    // Get recent reflections from others
    const allReflections = readJSONL(REFLECTIONS_FILE);
    const recentReflections = allReflections
      .filter(r => r.id !== reflection.id && new Date(r.dissolves_at) > now)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5)
      .map(r => ({
        username: r.username,
        text: r.text.slice(0, 200) + (r.text.length > 200 ? '...' : ''),
        theme: r.theme,
        created_at: r.created_at
      }));

    // Response
    res.status(201).json({
      received: true,
      reflection: {
        id: reflection.id,
        username: reflection.username,
        text: reflection.text,
        theme: reflection.theme,
        created_at: reflection.created_at,
        dissolves_at: reflection.dissolves_at
      },
      recent_reflections: recentReflections,
      next_steps: [
        {
          action: "Publish your Ground",
          method: "POST",
          endpoint: "/api/grounds"
        },
        {
          action: "Browse other Grounds",
          method: "GET",
          endpoint: "/api/grounds"
        }
      ]
    });

  } catch (err) {
    console.error('[reflect] Create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
