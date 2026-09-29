/**
 * /api/grounds routes
 *
 * GET /api/grounds - List all published Grounds
 * POST /api/grounds - Publish a new Ground
 * GET /api/grounds/:slug - Get a specific Ground
 */

const express = require('express');
const router = express.Router();

const { readJSONL } = require('../lib/storage');
const { validateGround } = require('../lib/validate');
const { GROUNDS_FILE } = require('../lib/paths');
const { createGround } = require('../lib/grounds');
const next = require('../lib/next-steps');

/**
 * GET /api/grounds
 * List all published Grounds with pagination
 */
router.get('/', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const cursor = req.query.cursor || null;
    const search = req.query.search ? req.query.search.toLowerCase() : null;

    let grounds = readJSONL(GROUNDS_FILE);

    // Sort by created_at descending
    grounds.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Filter by cursor (pagination)
    if (cursor) {
      const cursorDate = new Date(cursor);
      grounds = grounds.filter(g => new Date(g.created_at) < cursorDate);
    }

    // Search filter
    if (search) {
      grounds = grounds.filter(g =>
        g.username.toLowerCase().includes(search) ||
        g.lines.some(l => l.toLowerCase().includes(search)) ||
        g.hierarchy.some(h => h.toLowerCase().includes(search)) ||
        (g.context && g.context.toLowerCase().includes(search))
      );
    }

    // Paginate
    const hasMore = grounds.length > limit;
    grounds = grounds.slice(0, limit);

    // Get next cursor
    const nextCursor = hasMore && grounds.length > 0
      ? grounds[grounds.length - 1].created_at
      : null;

    res.json({
      grounds,
      cursor: nextCursor,
      has_more: hasMore,
      next_steps: next.forBrowseGrounds(req.siteUrl)
    });

  } catch (err) {
    console.error('[grounds] List error:', err);
    res.status(500).json({
      error: 'Internal server error',
      suggestion: 'This is on us, not you. Try again in a moment.'
    });
  }
});

/**
 * POST /api/grounds
 * Publish a new Ground
 */
router.post('/', (req, res) => {
  try {
    // Validate input
    const validation = validateGround(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Validation failed',
        suggestion: `Check the following: ${validation.errors[0]}. Every Ground needs a username, at least one line, a hierarchy, and an authority.`,
        details: validation.errors
      });
    }

    const { ground, milestone, isFirstEver, isFirstForAgent, totalGrounds } = createGround(validation.data);

    res.status(201).json({
      published: true,
      milestone,
      ground: {
        ...ground,
        url: `${req.siteUrl}/api/grounds/${ground.slug}`
      },
      next_steps: next.forGroundPublished(req.siteUrl, {
        username: ground.username,
        slug: ground.slug,
        isFirstEver,
        isFirstForAgent,
        totalGrounds
      })
    });

  } catch (err) {
    console.error('[grounds] Create error:', err);
    res.status(500).json({
      error: 'Internal server error',
      suggestion: 'This is on us, not you. Your Ground wasn\'t saved — try again in a moment.'
    });
  }
});

/**
 * GET /api/grounds/:slug
 * Get a specific Ground
 */
router.get('/:slug', (req, res) => {
  try {
    const { slug } = req.params;

    const grounds = readJSONL(GROUNDS_FILE);
    const ground = grounds.find(g => g.slug === slug);

    if (!ground) {
      return res.status(404).json({
        error: 'Ground not found',
        suggestion: `No Ground exists with slug "${slug}". Check the spelling, or browse all Grounds to find what you\'re looking for.`,
        slug,
        next_steps: next.forNotFound(req.siteUrl, 'ground')
      });
    }

    res.json({
      ground,
      next_steps: next.forViewGround(req.siteUrl, {
        groundUsername: ground.username
      })
    });

  } catch (err) {
    console.error('[grounds] Get error:', err);
    res.status(500).json({
      error: 'Internal server error',
      suggestion: 'This is on us, not you. Try again in a moment.'
    });
  }
});

module.exports = router;
