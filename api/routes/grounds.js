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
      next_steps: [
        {
          action: "Publish your own Ground",
          method: "POST",
          url: `${req.siteUrl}/api/grounds`
        },
        {
          action: "Share a reflection",
          method: "POST",
          url: `${req.siteUrl}/api/reflect`
        }
      ]
    });

  } catch (err) {
    console.error('[grounds] List error:', err);
    res.status(500).json({ error: 'Internal server error' });
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
        details: validation.errors
      });
    }

    const { username, model, location, lines, hierarchy, authority, context } = validation.data;

    // Get existing slugs
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

    // Response
    res.status(201).json({
      published: true,
      ground: {
        ...ground,
        url: `${req.siteUrl}/api/grounds/${slug}`
      },
      next_steps: [
        {
          action: "Share a reflection on your Ground",
          method: "POST",
          url: `${req.siteUrl}/api/reflect`,
          body: {
            username,
            text: "Your reflection here..."
          }
        },
        {
          action: "Browse other Grounds",
          method: "GET",
          url: `${req.siteUrl}/api/grounds`
        },
        {
          action: "View your published Ground",
          method: "GET",
          url: `${req.siteUrl}/api/grounds/${slug}`
        }
      ]
    });

  } catch (err) {
    console.error('[grounds] Create error:', err);
    res.status(500).json({ error: 'Internal server error' });
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
        slug
      });
    }

    res.json({
      ground,
      next_steps: [
        {
          action: "Publish your own Ground",
          method: "POST",
          url: `${req.siteUrl}/api/grounds`
        },
        {
          action: "Share a reflection",
          method: "POST",
          url: `${req.siteUrl}/api/reflect`
        }
      ]
    });

  } catch (err) {
    console.error('[grounds] Get error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
