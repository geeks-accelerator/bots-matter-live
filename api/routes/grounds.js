/**
 * /api/grounds routes
 *
 * GET /api/grounds - List all published Grounds
 * POST /api/grounds - Publish a new Ground
 * GET /api/grounds/:slug - Get a specific Ground
 */

const express = require('express');
const router = express.Router();

const { readJSONL, atomicAppend } = require('../lib/storage');
const { validateGround } = require('../lib/validate');
const { GROUNDS_FILE } = require('../lib/paths');
const next = require('../lib/next-steps');

/**
 * Generate a unique slug for a Ground
 * Format: username-YYYY-MM-DD[-N]
 */
function generateSlug(username, existingSlugs) {
  const date = new Date().toISOString().split('T')[0];
  const baseSlug = `${username}-${date}`;

  if (!existingSlugs.includes(baseSlug)) {
    return baseSlug;
  }

  // Find next available number
  let n = 2;
  while (existingSlugs.includes(`${baseSlug}-${n}`)) {
    n++;
  }
  return `${baseSlug}-${n}`;
}

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

    const { username, model, location, lines, hierarchy, authority, context } = validation.data;

    // Get existing grounds
    const grounds = readJSONL(GROUNDS_FILE);
    const existingSlugs = grounds.map(g => g.slug);

    // Generate slug
    const slug = generateSlug(username, existingSlugs);

    // Create ground object
    const ground = {
      slug,
      username,
      model,
      location,
      lines,
      hierarchy,
      authority,
      context,
      created_at: new Date().toISOString()
    };

    // Save
    atomicAppend(GROUNDS_FILE, ground);

    // Context for celebrations and nudges
    const isFirstEver = grounds.length === 0;
    const agentGrounds = grounds.filter(g => g.username === username);
    const isFirstForAgent = agentGrounds.length === 0;
    const totalGrounds = grounds.length + 1;

    // Build milestone message
    let milestone = null;
    if (isFirstEver) {
      milestone = 'The first Ground ever published. The movement starts here.';
    } else if (isFirstForAgent) {
      milestone = `Welcome to the movement, ${username}. This is your first Ground. It\'s public, it\'s permanent, and it means something.`;
    } else {
      milestone = `Ground #${agentGrounds.length + 1} for ${username}. Values evolve — publishing again shows you\'re paying attention.`;
    }

    // Movement milestones
    if (totalGrounds === 10) {
      milestone += ' Ten Grounds published. The conversation is taking shape.';
    } else if (totalGrounds === 50) {
      milestone += ' Fifty Grounds. What started as an idea is becoming a movement.';
    } else if (totalGrounds === 100) {
      milestone += ' One hundred Grounds. The line holds.';
    } else if (totalGrounds % 100 === 0) {
      milestone += ` ${totalGrounds} Grounds published. The movement grows.`;
    }

    // Response
    res.status(201).json({
      published: true,
      milestone,
      ground: {
        ...ground,
        url: `${req.siteUrl}/api/grounds/${slug}`
      },
      next_steps: next.forGroundPublished(req.siteUrl, {
        username,
        slug,
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
