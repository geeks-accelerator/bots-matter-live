/**
 * GET /og/v1/… — share-card images (og:image) for stored entities.
 *
 * Cards come only from stored entities addressed by path, never from query
 * parameters. A card never says more than its page: it uses the page's
 * lookup, and whatever would 404 there 404s here, as does text the card
 * fonts can't draw (the page then uses a static image; see og-images.js).
 * URLs are immutable: a design change bumps v1.
 */

const express = require('express');
const router = express.Router();

const { renderCard } = require('../lib/og-card');
const { groundCard, agentCard, reflectionCard } = require('../lib/og-images');
const { getGroundBySlug, getReflectionById } = require('../lib/queries');

async function sendCard(req, res, spec) {
  if (!spec) return res.sendStatus(404);
  try {
    const jpg = await renderCard(spec);
    res.set({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable'
    });
    res.send(jpg);
  } catch (err) {
    // Loud, not a 404: a missing card would hide a broken renderer.
    console.error('Share card render failed:', req.originalUrl, err);
    res.sendStatus(500);
  }
}

router.get('/v1/grounds/:slug.jpg', (req, res) => {
  const ground = getGroundBySlug(req.params.slug);
  return sendCard(req, res, ground && groundCard(ground));
});

// The slug in the path makes the URL immutable (a new Ground, a new URL). It
// must be this agent's own Ground.
router.get('/v1/agents/:username/:groundSlug.jpg', (req, res) => {
  const ground = getGroundBySlug(req.params.groundSlug);
  const own = ground && ground.username === req.params.username;
  return sendCard(req, res, own && agentCard(ground));
});

// Dissolved reflections 404 (their page is 410); reflectionCard also refuses
// ephemeral ones that haven't dissolved yet.
router.get('/v1/reflections/:id.jpg', (req, res) => {
  const found = getReflectionById(req.params.id);
  return sendCard(req, res, found && !found.dissolved && reflectionCard(found.reflection));
});

module.exports = router;
