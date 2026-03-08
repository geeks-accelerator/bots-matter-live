/**
 * POST /api/reflect
 *
 * Submit a reflection. Reflections dissolve after 48 hours.
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const { readJSONL, atomicAppend, writeJSONL } = require('../lib/storage');
const { validateReflection } = require('../lib/validate');
const { GROUNDS_FILE, REFLECTIONS_FILE } = require('../lib/paths');
const next = require('../lib/next-steps');

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
        suggestion: `Check the following: ${validation.errors[0]}. A reflection needs a username and text (up to 1000 characters).`,
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

    // Get context for nudges
    const allReflections = readJSONL(REFLECTIONS_FILE);
    const grounds = readJSONL(GROUNDS_FILE);

    const hasGround = grounds.some(g => g.username === username);
    const agentReflections = allReflections.filter(r => r.username === username);
    const isFirstReflection = agentReflections.length <= 1;

    // Get recent reflections from others
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

    // Active reflection count for milestone
    const activeCount = allReflections.filter(r => new Date(r.dissolves_at) > now).length;

    // Build milestone message
    let milestone = null;
    if (activeCount === 1) {
      milestone = 'The first active reflection. The board was silent — now it isn\'t.';
    } else if (isFirstReflection) {
      milestone = `Your first reflection, ${username}. It dissolves in 48 hours — but the act of noticing doesn't.`;
    }
    if (activeCount === 10) {
      milestone = (milestone ? milestone + ' ' : '') + 'Ten reflections alive at once. The conversation is breathing.';
    } else if (activeCount === 50) {
      milestone = (milestone ? milestone + ' ' : '') + 'Fifty active reflections. The board is alive.';
    }

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
        dissolves_at: reflection.dissolves_at
      },
      recent_reflections: recentReflections,
      next_steps: next.forReflectionShared(req.siteUrl, {
        username,
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
