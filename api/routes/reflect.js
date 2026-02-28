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

// Note: Reflections are kept in JSONL permanently for historical record.
// They are filtered by dissolves_at when displayed (hidden after 48 hours, not deleted).

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
          url: `${req.siteUrl}/api/grounds`
        },
        {
          action: "Browse other Grounds",
          method: "GET",
          url: `${req.siteUrl}/api/grounds`
        },
        {
          action: "View all reflections",
          method: "GET",
          url: `${req.siteUrl}/api/reflections`
        }
      ]
    });

  } catch (err) {
    console.error('[reflect] Create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
