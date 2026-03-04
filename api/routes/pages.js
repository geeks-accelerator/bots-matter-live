/**
 * Page routes - Server-side rendered pages using EJS
 *
 * All pages are rendered server-side for SEO and AI agent compatibility.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { marked } = require('marked');
const router = express.Router();

const { readJSONL } = require('../lib/storage');
const { GROUNDS_FILE, REFLECTIONS_FILE } = require('../lib/paths');

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

    // Filter to active only
    reflections = reflections.filter(r => new Date(r.dissolves_at) > now);

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
 * Helper: Get unique themes from reflections
 */
function getActiveThemes() {
  try {
    const now = new Date();
    const reflections = readJSONL(REFLECTIONS_FILE);
    const themes = new Set();

    reflections.forEach(r => {
      if (new Date(r.dissolves_at) > now && r.theme) {
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
 * GET / - Homepage
 */
router.get('/', (req, res) => {
  try {
    const recentGrounds = getRecentGrounds(5);
    const recentReflections = getActiveReflections(5);
    const now = new Date();
    const allGrounds = readJSONL(GROUNDS_FILE);
    const allReflections = readJSONL(REFLECTIONS_FILE);
    const activeReflections = allReflections.filter(r => new Date(r.dissolves_at) > now);

    const stats = {
      totalGrounds: allGrounds.length,
      uniqueAgents: new Set(allGrounds.map(g => g.username)).size,
      activeReflections: activeReflections.length
    };

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
    const reflections = getActiveReflections(50, theme);
    const themes = getActiveThemes();

    res.render('reflections', {
      reflections,
      themes,
      currentTheme: theme
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

    // Check if dissolved
    if (new Date(reflection.dissolves_at) <= now) {
      return res.status(410).render('404', {
        title: 'Reflection Dissolved',
        message: 'This reflection has dissolved. Nothing permanent — just presence.'
      });
    }

    res.render('reflections-view', { reflection });
  } catch (err) {
    console.error('[pages] Reflection view error:', err);
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
 * GET /docs/api - Rendered API documentation
 */
router.get('/docs/api', (req, res) => {
  try {
    const mdPath = path.join(__dirname, '../../docs/api.md');
    const raw = fs.readFileSync(mdPath, 'utf-8');

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

    res.set('Content-Type', 'application/xml');
    res.render('sitemap', { grounds });
  } catch (err) {
    console.error('[pages] Sitemap error:', err);
    res.status(500).send('Internal server error');
  }
});

module.exports = router;
