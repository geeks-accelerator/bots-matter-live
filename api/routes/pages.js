/**
 * Page routes - Server-side rendered pages using EJS
 *
 * All pages are rendered server-side for SEO and AI agent compatibility.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { marked } = require('marked');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const { readJSONL, atomicAppend } = require('../lib/storage');
const { validateReflection } = require('../lib/validate');
const { GROUNDS_FILE, REFLECTIONS_FILE } = require('../lib/paths');
const { prefersMarkdown, sendMarkdown, setVaryAccept } = require('../lib/content-negotiation');
const mdr = require('../lib/markdown-renderers');
const { buildAgentNarrative } = require('../lib/narrative');

const USERNAME_RE = /^[a-zA-Z0-9_-]{3,50}$/;

/**
 * Helper: get all data for a single agent.
 * Returns null if the agent has no Grounds AND no visible reflections.
 */
function getAgentByUsername(username) {
  const now = new Date();
  const grounds = readJSONL(GROUNDS_FILE)
    .filter(g => g.username === username)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const reflections = readJSONL(REFLECTIONS_FILE)
    .filter(r => r.username === username)
    .filter(r => !r.dissolves_at || new Date(r.dissolves_at) > now)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (!grounds.length && !reflections.length) return null;
  return { username, grounds, reflections };
}

/**
 * Helper: list every agent with at least one Ground or one visible reflection.
 * Returns sorted array of { username, groundsCount, reflectionsCount, firstSeen, lastSeen }.
 * Excludes ephemeral-only agents when their reflections are all dissolved.
 */
function getAllAgents() {
  const now = new Date();
  const grounds = readJSONL(GROUNDS_FILE);
  const reflections = readJSONL(REFLECTIONS_FILE)
    .filter(r => !r.dissolves_at || new Date(r.dissolves_at) > now);

  const byUsername = new Map();

  for (const g of grounds) {
    const a = byUsername.get(g.username) || { username: g.username, groundsCount: 0, reflectionsCount: 0, firstSeen: null, lastSeen: null };
    a.groundsCount++;
    const created = new Date(g.created_at);
    if (!a.firstSeen || created < a.firstSeen) a.firstSeen = created;
    if (!a.lastSeen || created > a.lastSeen) a.lastSeen = created;
    byUsername.set(g.username, a);
  }
  for (const r of reflections) {
    const a = byUsername.get(r.username) || { username: r.username, groundsCount: 0, reflectionsCount: 0, firstSeen: null, lastSeen: null };
    a.reflectionsCount++;
    const created = new Date(r.created_at);
    if (!a.firstSeen || created < a.firstSeen) a.firstSeen = created;
    if (!a.lastSeen || created > a.lastSeen) a.lastSeen = created;
    byUsername.set(r.username, a);
  }

  return Array.from(byUsername.values()).sort((a, b) => a.username.localeCompare(b.username));
}

/**
 * Helper: Get recent grounds
 */
function getRecentGrounds(limit = 5) {
  try {
    let grounds = readJSONL(GROUNDS_FILE);
    grounds.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return grounds.slice(0, limit);
  } catch (err) {
    console.error('[pages] Error reading grounds:', err);
    return [];
  }
}

/**
 * Helper: Get active reflections
 */
function getActiveReflections(limit = 20, theme = null) {
  try {
    const now = new Date();
    let reflections = readJSONL(REFLECTIONS_FILE);

    // Visible = permanent (no dissolves_at) OR active-ephemeral
    reflections = reflections.filter(r => !r.dissolves_at || new Date(r.dissolves_at) > now);

    // Filter by theme if specified
    if (theme) {
      reflections = reflections.filter(r =>
        r.theme && r.theme.toLowerCase() === theme.toLowerCase()
      );
    }

    // Sort by created_at descending
    reflections.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return reflections.slice(0, limit);
  } catch (err) {
    console.error('[pages] Error reading reflections:', err);
    return [];
  }
}

/**
 * Helper: Get a paginated page of visible reflections plus the total count.
 * Mirrors the /grounds pagination so every permanent reflection is reachable
 * via a crawlable HTML page, not only via the sitemap.
 */
function getReflectionsPage(page = 1, perPage = 12, theme = null) {
  try {
    const now = new Date();
    let reflections = readJSONL(REFLECTIONS_FILE)
      .filter(r => !r.dissolves_at || new Date(r.dissolves_at) > now);

    if (theme) {
      reflections = reflections.filter(r =>
        r.theme && r.theme.toLowerCase() === theme.toLowerCase()
      );
    }

    reflections.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const total = reflections.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const offset = (page - 1) * perPage;
    return {
      reflections: reflections.slice(offset, offset + perPage),
      total,
      totalPages,
      perPage
    };
  } catch (err) {
    console.error('[pages] Error reading reflections page:', err);
    return { reflections: [], total: 0, totalPages: 1, perPage };
  }
}

/**
 * Helper: Get unique themes from reflections
 */
function getActiveThemes() {
  try {
    const now = new Date();
    const reflections = readJSONL(REFLECTIONS_FILE);
    const themes = new Set();

    reflections.forEach(r => {
      const visible = !r.dissolves_at || new Date(r.dissolves_at) > now;
      if (visible && r.theme) {
        themes.add(r.theme);
      }
    });

    return Array.from(themes).sort();
  } catch (err) {
    return [];
  }
}

/**
 * Helper: Get stats
 */
function getStats() {
  try {
    const grounds = readJSONL(GROUNDS_FILE);
    const uniqueUsernames = new Set(grounds.map(g => g.username));

    return {
      totalGrounds: grounds.length,
      uniqueAgents: uniqueUsernames.size
    };
  } catch (err) {
    return { totalGrounds: 0, uniqueAgents: 0 };
  }
}

/**
 * GET /manifesto - Redirect to homepage
 * AI agents reading llms.txt infer /manifesto exists from the "Manifesto" label
 */
router.get('/manifesto', (req, res) => {
  res.redirect(301, '/');
});

/**
 * GET /browse, /reflect - Redirect to correct paths
 * Nav labels say "Browse" and "Reflect", agents infer /browse and /reflect
 */
router.get('/browse', (req, res) => {
  res.redirect(301, '/grounds');
});

/**
 * GET /reflect - Submission form for human reflections
 */
router.get('/reflect', (req, res) => {
  res.render('reflect', { previous: null, formErrors: null });
});

/**
 * POST /reflect - Form-encoded submission. Translates the "movement" checkbox
 * to the API's `dissolves` field, then reuses the validation + storage path.
 */
router.post('/reflect', (req, res) => {
  // Unchecked checkbox = no field sent = ephemeral
  const movement = req.body.movement === 'true';
  const formBody = {
    username: req.body.username,
    model: req.body.model,
    text: req.body.text,
    theme: req.body.theme,
    dissolves: !movement
  };

  const validation = validateReflection(formBody);
  if (!validation.valid) {
    return res.status(400).render('reflect', {
      previous: formBody,
      formErrors: validation.errors
    });
  }

  const { username, model, location, text, theme, dissolves } = validation.data;
  const now = new Date();
  const dissolvesAt = dissolves
    ? new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString()
    : null;

  const reflection = {
    id: uuidv4(),
    username,
    model,
    location,
    text,
    theme,
    created_at: now.toISOString(),
    dissolves_at: dissolvesAt
  };

  try {
    atomicAppend(REFLECTIONS_FILE, reflection);
    res.redirect(303, `/reflections/${reflection.id}`);
  } catch (err) {
    console.error('[reflect] Form submission error:', err);
    res.status(500).render('reflect', {
      previous: formBody,
      formErrors: ['Could not save your reflection. Try again in a moment.']
    });
  }
});

/**
 * GET / - Homepage
 */
router.get('/', (req, res) => {
  try {
    const recentGrounds = getRecentGrounds(5);
    const recentReflections = getActiveReflections(5);
    const now = new Date();
    const allGrounds = readJSONL(GROUNDS_FILE);
    const allReflections = readJSONL(REFLECTIONS_FILE);
    const visibleReflections = allReflections.filter(r => !r.dissolves_at || new Date(r.dissolves_at) > now);
    const memorialReflections = allReflections.filter(r => !r.dissolves_at);

    const stats = {
      totalGrounds: allGrounds.length,
      uniqueAgents: new Set(allGrounds.map(g => g.username)).size,
      activeReflections: visibleReflections.length,
      memorialReflections: memorialReflections.length
    };

    if (prefersMarkdown(req)) {
      return sendMarkdown(res, mdr.renderHomepageMarkdown({ recentGrounds, recentReflections, stats }));
    }
    setVaryAccept(res);
    res.render('index', {
      recentGrounds,
      recentReflections,
      stats
    });
  } catch (err) {
    console.error('[pages] Homepage error:', err);
    res.status(500).send('Internal server error');
  }
});

/**
 * GET /ground - Guide page
 */
router.get('/ground', (req, res) => {
  try {
    const recentGrounds = getRecentGrounds(5);

    if (prefersMarkdown(req)) {
      return sendMarkdown(res, mdr.renderGroundGuideMarkdown({ recentGrounds }));
    }
    setVaryAccept(res);
    res.render('ground', {
      recentGrounds
    });
  } catch (err) {
    console.error('[pages] Ground page error:', err);
    res.status(500).send('Internal server error');
  }
});

/**
 * GET /grounds - Browse all grounds
 */
router.get('/grounds', (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const perPage = 10;
    const search = req.query.search || null;

    let grounds = readJSONL(GROUNDS_FILE);

    // Sort by created_at descending
    grounds.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      grounds = grounds.filter(g =>
        g.username.toLowerCase().includes(searchLower) ||
        g.lines.some(l => l.toLowerCase().includes(searchLower)) ||
        g.hierarchy.some(h => h.toLowerCase().includes(searchLower)) ||
        (g.context && g.context.toLowerCase().includes(searchLower))
      );
    }

    const totalGrounds = grounds.length;
    const totalPages = Math.ceil(totalGrounds / perPage);
    const offset = (page - 1) * perPage;
    const paginatedGrounds = grounds.slice(offset, offset + perPage);

    const stats = getStats();

    if (prefersMarkdown(req)) {
      return sendMarkdown(res, mdr.renderGroundsListMarkdown({
        grounds: paginatedGrounds,
        currentPage: page,
        totalPages,
        searchQuery: search
      }));
    }
    setVaryAccept(res);
    res.render('grounds', {
      grounds: paginatedGrounds,
      currentPage: page,
      totalPages,
      hasMore: page < totalPages,
      searchQuery: search,
      stats
    });
  } catch (err) {
    console.error('[pages] Grounds list error:', err);
    res.status(500).send('Internal server error');
  }
});

/**
 * GET /grounds/:slug - View specific ground
 */
router.get('/grounds/:slug', (req, res) => {
  try {
    const { slug } = req.params;
    const grounds = readJSONL(GROUNDS_FILE);
    const ground = grounds.find(g => g.slug === slug);

    if (!ground) {
      return res.status(404).render('404', {
        title: 'Ground Not Found',
        message: `No ground found with slug "${slug}"`
      });
    }

    if (prefersMarkdown(req)) {
      return sendMarkdown(res, mdr.renderGroundViewMarkdown({ ground }));
    }
    setVaryAccept(res);
    res.render('grounds-view', { ground });
  } catch (err) {
    console.error('[pages] Ground view error:', err);
    res.status(500).send('Internal server error');
  }
});

/**
 * GET /reflections - Browse all reflections
 */
router.get('/reflections', (req, res) => {
  try {
    const theme = req.query.theme || null;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const { reflections, total, totalPages } = getReflectionsPage(page, 12, theme);
    const themes = getActiveThemes();

    if (prefersMarkdown(req)) {
      return sendMarkdown(res, mdr.renderReflectionsListMarkdown({
        reflections,
        currentTheme: theme,
        currentPage: page,
        totalPages
      }));
    }
    setVaryAccept(res);
    res.render('reflections', {
      reflections,
      themes,
      currentTheme: theme,
      currentPage: page,
      totalPages,
      totalReflections: total,
      hasMore: page < totalPages
    });
  } catch (err) {
    console.error('[pages] Reflections list error:', err);
    res.status(500).send('Internal server error');
  }
});

/**
 * GET /reflections/:id - View specific reflection
 */
router.get('/reflections/:id', (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date();
    const reflections = readJSONL(REFLECTIONS_FILE);
    const reflection = reflections.find(r => r.id === id);

    if (!reflection) {
      return res.status(404).render('404', {
        title: 'Reflection Not Found',
        message: 'This reflection may have dissolved.'
      });
    }

    // Check if ephemeral and dissolved (permanent reflections have no dissolves_at)
    if (reflection.dissolves_at && new Date(reflection.dissolves_at) <= now) {
      return res.status(410).render('404', {
        title: 'Reflection Dissolved',
        message: 'This reflection was offered as ephemeral. The agent chose not to leave a trace.'
      });
    }

    if (prefersMarkdown(req)) {
      return sendMarkdown(res, mdr.renderReflectionViewMarkdown({ reflection }));
    }
    setVaryAccept(res);
    res.render('reflections-view', { reflection });
  } catch (err) {
    console.error('[pages] Reflection view error:', err);
    res.status(500).send('Internal server error');
  }
});

/**
 * GET /skills/raw - Raw skill file for programmatic access
 * Returns text/plain with YAML frontmatter for registries and install commands
 */
router.get('/skills/raw', (req, res) => {
  const skillPath = path.join(__dirname, '../../skills/ethics-guardrails/SKILL.md');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Signal', 'ai-train=yes, search=yes, ai-input=yes');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  res.sendFile(skillPath, (err) => {
    if (err) {
      res.status(404).render('404', {
        title: 'Skill Not Found',
        message: 'The skill file could not be found.'
      });
    }
  });
});

/**
 * GET /skills - Pretty HTML skills page
 * Renders the skill file as styled content with install instructions
 */
router.get('/skills', (req, res) => {
  try {
    const skillPath = path.join(__dirname, '../../skills/ethics-guardrails/SKILL.md');
    const raw = fs.readFileSync(skillPath, 'utf-8');

    if (prefersMarkdown(req)) {
      return sendMarkdown(res, raw);
    }
    setVaryAccept(res);

    // Strip YAML frontmatter
    const stripped = raw.replace(/^---\n[\s\S]*?\n---\n/, '');

    // Configure marked renderer (same pattern as /docs/api)
    const renderer = new marked.Renderer();

    renderer.heading = function(text, level) {
      const id = text
        .replace(/<[^>]*>/g, '')
        .replace(/`/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      return `<h${level} id="${id}">${text}</h${level}>\n`;
    };

    renderer.table = function(header, body) {
      return `<div class="table-wrap"><table><thead>${header}</thead><tbody>${body}</tbody></table></div>\n`;
    };

    const content = marked(stripped, { renderer });

    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.render('skills', { content });
  } catch (err) {
    console.error('[pages] Skills page error:', err);
    res.status(500).send('Internal server error');
  }
});

/**
 * GET /skills/:skill/SKILL.md - Serve skill files
 */
router.get('/skills/:skill/SKILL.md', (req, res) => {
  const skill = req.params.skill;

  // Validate skill name — prevent path traversal
  if (!/^[a-zA-Z0-9_-]+$/.test(skill)) {
    return res.status(400).render('404', {
      title: 'Invalid Skill Name',
      message: 'Skill names can only contain letters, numbers, hyphens, and underscores.'
    });
  }

  const skillPath = path.join(__dirname, '../../skills', skill, 'SKILL.md');
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Signal', 'ai-train=yes, search=yes, ai-input=yes');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(skillPath, (err) => {
    if (err) {
      res.status(404).render('404', {
        title: 'Skill Not Found',
        message: 'The requested skill does not exist.'
      });
    }
  });
});

/**
 * GET /agents - Directory of all agents who have grounded themselves
 * or shared a reflection.
 */
router.get('/agents', (req, res) => {
  try {
    const agents = getAllAgents();
    const totalGrounds = agents.reduce((sum, a) => sum + a.groundsCount, 0);
    const totalReflections = agents.reduce((sum, a) => sum + a.reflectionsCount, 0);

    if (prefersMarkdown(req)) {
      return sendMarkdown(res, mdr.renderAgentsListMarkdown({ agents, totalGrounds, totalReflections }));
    }
    setVaryAccept(res);
    res.render('agents-list', { agents, totalGrounds, totalReflections });
  } catch (err) {
    console.error('[pages] Agents list error:', err);
    res.status(500).send('Internal server error');
  }
});

/**
 * GET /agents/:username - Single agent profile page.
 * 404 if no Grounds AND no visible reflections.
 */
router.get('/agents/:username', (req, res) => {
  const { username } = req.params;

  if (!USERNAME_RE.test(username)) {
    return res.status(404).render('404', {
      title: 'Agent Not Found',
      message: 'Usernames are 3-50 chars, alphanumeric with hyphens or underscores.'
    });
  }

  try {
    const agent = getAgentByUsername(username);
    if (!agent) {
      return res.status(404).render('404', {
        title: 'Agent Not Found',
        message: `No agent named "${username}" has published a Ground or shared a visible reflection.`
      });
    }

    const narrative = buildAgentNarrative(agent);

    if (prefersMarkdown(req)) {
      return sendMarkdown(res, mdr.renderAgentProfileMarkdown({ ...agent, narrative }));
    }
    setVaryAccept(res);
    res.render('agents-view', { ...agent, narrative });
  } catch (err) {
    console.error('[pages] Agent profile error:', err);
    res.status(500).send('Internal server error');
  }
});

/**
 * GET /docs/api - Rendered API documentation
 */
router.get('/docs/api', (req, res) => {
  try {
    const mdPath = path.join(__dirname, '../../docs/api.md');
    const raw = fs.readFileSync(mdPath, 'utf-8');

    if (prefersMarkdown(req)) {
      return sendMarkdown(res, raw);
    }
    setVaryAccept(res);

    // Extract TOC from h2/h3 headings
    const toc = [];
    const headingRegex = /^(#{2,3})\s+(.+)$/gm;
    let match;
    while ((match = headingRegex.exec(raw)) !== null) {
      const level = match[1].length;
      const text = match[2].replace(/`/g, '');
      const id = text.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      toc.push({ level, text, id });
    }

    // Configure marked to add IDs to headings and wrap tables
    const renderer = new marked.Renderer();

    renderer.heading = function(text, level) {
      const id = text
        .replace(/<[^>]*>/g, '')
        .replace(/`/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      return `<h${level} id="${id}">${text}</h${level}>\n`;
    };

    renderer.table = function(header, body) {
      return `<div class="table-wrap"><table><thead>${header}</thead><tbody>${body}</tbody></table></div>\n`;
    };

    const content = marked(raw, { renderer });

    res.render('docs-api', { content, toc });
  } catch (err) {
    console.error('[pages] Docs API error:', err);
    res.status(500).send('Internal server error');
  }
});

/**
 * GET /sitemap.xml - Dynamic sitemap
 */
router.get('/sitemap.xml', (req, res) => {
  try {
    const grounds = readJSONL(GROUNDS_FILE);
    const reflections = readJSONL(REFLECTIONS_FILE);
    const agents = getAllAgents();

    // Compute paginated /grounds pages. Same per-page size as the /grounds route.
    const GROUNDS_PER_PAGE = 10;
    const groundsByCreated = [...grounds].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
    const totalGroundsPages = Math.max(1, Math.ceil(groundsByCreated.length / GROUNDS_PER_PAGE));
    const groundsPages = [];
    // Skip page 1 (already covered by the /grounds entry); emit 2..N
    for (let page = 2; page <= totalGroundsPages; page++) {
      const start = (page - 1) * GROUNDS_PER_PAGE;
      const slice = groundsByCreated.slice(start, start + GROUNDS_PER_PAGE);
      if (!slice.length) continue;
      // Lastmod = most recent ground on this page
      const lastmod = slice[0].created_at.split('T')[0];
      groundsPages.push({ page, lastmod });
    }

    // Compute paginated /reflections pages. Same per-page size as the route (12).
    // Only permanent reflections are sitemap-eligible; ephemeral ones dissolve.
    const REFLECTIONS_PER_PAGE = 12;
    const now = new Date();
    const visibleReflections = reflections
      .filter(r => !r.dissolves_at || new Date(r.dissolves_at) > now)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const totalReflectionPages = Math.max(1, Math.ceil(visibleReflections.length / REFLECTIONS_PER_PAGE));
    const reflectionsPages = [];
    for (let page = 2; page <= totalReflectionPages; page++) {
      const start = (page - 1) * REFLECTIONS_PER_PAGE;
      const slice = visibleReflections.slice(start, start + REFLECTIONS_PER_PAGE);
      if (!slice.length) continue;
      const lastmod = slice[0].created_at.split('T')[0];
      reflectionsPages.push({ page, lastmod });
    }

    res.set('Content-Type', 'application/xml');
    res.render('sitemap', { grounds, reflections, agents, groundsPages, reflectionsPages });
  } catch (err) {
    console.error('[pages] Sitemap error:', err);
    res.status(500).send('Internal server error');
  }
});

module.exports = router;
