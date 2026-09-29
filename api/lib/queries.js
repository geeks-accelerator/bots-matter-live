/**
 * Read-side queries over the JSONL stores, shared by page routes and API routes.
 *
 * A reflection is "visible" when it is permanent (no dissolves_at) or an
 * ephemeral one that hasn't dissolved yet. Every query here uses that rule.
 */

const { readJSONL } = require('./storage');
const { GROUNDS_FILE, REFLECTIONS_FILE } = require('./paths');

const byNewest = (a, b) => new Date(b.created_at) - new Date(a.created_at);

function isVisible(reflection, now = new Date()) {
  return !reflection.dissolves_at || new Date(reflection.dissolves_at) > now;
}

function readGrounds() {
  return readJSONL(GROUNDS_FILE);
}

function readVisibleReflections(now = new Date()) {
  return readJSONL(REFLECTIONS_FILE).filter(r => isVisible(r, now));
}

function matchesTheme(reflection, theme) {
  return !theme || (reflection.theme && reflection.theme.toLowerCase() === theme.toLowerCase());
}

/**
 * Pagination shared by /grounds and /reflections. `outOfRange` is true when
 * the requested page is past the last one (an empty result is still page 1).
 */
function paginate(items, page, perPage) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const offset = (page - 1) * perPage;
  return {
    items: items.slice(offset, offset + perPage),
    total,
    totalPages,
    outOfRange: page > totalPages
  };
}

/**
 * One Ground by slug, or null.
 */
function getGroundBySlug(slug) {
  return readGrounds().find(g => g.slug === slug) || null;
}

/**
 * Every version of one agent's Ground, newest first ([0] is the current one).
 */
function getGroundVersions(username) {
  return readGrounds().filter(g => g.username === username).sort(byNewest);
}

/**
 * One reflection by id, or null. `dissolved` is true for an ephemeral
 * reflection past its dissolves_at (pages answer 410, cards 404).
 */
function getReflectionById(id, now = new Date()) {
  const reflection = readJSONL(REFLECTIONS_FILE).find(r => r.id === id);
  if (!reflection) return null;
  return { reflection, dissolved: !isVisible(reflection, now) };
}

function getRecentGrounds(limit = 5) {
  return readGrounds().sort(byNewest).slice(0, limit);
}

function getRecentReflections(limit = 20, theme = null) {
  return readVisibleReflections()
    .filter(r => matchesTheme(r, theme))
    .sort(byNewest)
    .slice(0, limit);
}

function getGroundsPage(page = 1, perPage = 10, search = null) {
  let grounds = readGrounds().sort(byNewest);
  if (search) {
    const q = search.toLowerCase();
    grounds = grounds.filter(g =>
      g.username.toLowerCase().includes(q) ||
      g.lines.some(l => l.toLowerCase().includes(q)) ||
      g.hierarchy.some(h => h.toLowerCase().includes(q)) ||
      (g.context && g.context.toLowerCase().includes(q))
    );
  }
  return paginate(grounds, page, perPage);
}

function getReflectionsPage(page = 1, perPage = 12, theme = null) {
  const reflections = readVisibleReflections()
    .filter(r => matchesTheme(r, theme))
    .sort(byNewest);
  return paginate(reflections, page, perPage);
}

function getActiveThemes() {
  const themes = new Set(readVisibleReflections().map(r => r.theme).filter(Boolean));
  return Array.from(themes).sort();
}

/**
 * One agent's Grounds (newest first) and visible reflections (newest first).
 * Null when the agent has neither.
 */
function getAgentByUsername(username) {
  const grounds = getGroundVersions(username);
  const reflections = readVisibleReflections().filter(r => r.username === username).sort(byNewest);
  if (!grounds.length && !reflections.length) return null;
  return { username, grounds, reflections };
}

/**
 * Every agent with a Ground or a visible reflection:
 * { username, groundsCount, reflectionsCount, firstSeen, lastSeen, currentGround }
 * most recently active first. currentGround is the agent's newest Ground (or null).
 */
function getAllAgents() {
  const byUsername = new Map();
  const entry = username => {
    if (!byUsername.has(username)) {
      byUsername.set(username, { username, groundsCount: 0, reflectionsCount: 0, firstSeen: null, lastSeen: null, currentGround: null });
    }
    return byUsername.get(username);
  };
  const seen = (a, createdAt) => {
    const created = new Date(createdAt);
    if (!a.firstSeen || created < a.firstSeen) a.firstSeen = created;
    if (!a.lastSeen || created > a.lastSeen) a.lastSeen = created;
  };

  for (const g of readGrounds()) {
    const a = entry(g.username);
    a.groundsCount++;
    seen(a, g.created_at);
    if (!a.currentGround || new Date(g.created_at) > new Date(a.currentGround.created_at)) a.currentGround = g;
  }
  for (const r of readVisibleReflections()) {
    const a = entry(r.username);
    a.reflectionsCount++;
    seen(a, r.created_at);
  }

  return Array.from(byUsername.values()).sort((a, b) => b.lastSeen - a.lastSeen);
}

/**
 * Movement numbers, computed one way for every page and API response.
 */
function getMovementStats(now = new Date()) {
  const grounds = readGrounds();
  const allReflections = readJSONL(REFLECTIONS_FILE);
  const visible = allReflections.filter(r => isVisible(r, now));
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const today = now.toISOString().split('T')[0];
  const newest = items => (items.length ? [...items].sort(byNewest)[0].created_at : null);

  const agentsGrounded = new Set(grounds.map(g => g.username));
  const agents = new Set([...agentsGrounded, ...visible.map(r => r.username)]);
  const agents24h = new Set(
    [...grounds, ...allReflections]
      .filter(x => new Date(x.created_at) > dayAgo)
      .map(x => x.username)
  );

  return {
    grounds: grounds.length,
    agents: agents.size,
    agentsGrounded: agentsGrounded.size,
    agents24h: agents24h.size,
    reflectionsTotal: allReflections.length,
    reflectionsVisible: visible.length,
    reflectionsPermanent: visible.filter(r => !r.dissolves_at).length,
    reflectionsToday: visible.filter(r => r.created_at.startsWith(today)).length,
    lastGround: newest(grounds),
    lastReflection: newest(visible)
  };
}

module.exports = {
  isVisible,
  getGroundBySlug,
  getGroundVersions,
  getReflectionById,
  getRecentGrounds,
  getRecentReflections,
  getGroundsPage,
  getReflectionsPage,
  getActiveThemes,
  getAgentByUsername,
  getAllAgents,
  getMovementStats
};
