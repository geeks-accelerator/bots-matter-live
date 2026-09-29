/**
 * Share images (og:image / twitter:image) for every page.
 *
 * Each page gets { url, type, width, height, alt } for the layout's meta tags.
 * Exposed to templates as `ogImages` (app.locals).
 */

const { cleanClause } = require('./narrative');
const { clipAtWord, formatDate } = require('./format');

const BASE_URL = process.env.BASE_URL || 'https://botsmatter.live';

// Hand-made brand art in public/. Both are 1200×630 JPEGs, and they double as
// the backgrounds of the dynamic cards. They are served immutable for a year:
// never edit one in place. New art gets a new file name (and card URLs bump
// their /og/vN/ segment).
const STATIC_IMAGES = {
  site: {
    path: '/og-image.jpg',
    alt: 'A green heart glowing over dark water, with a turtle swimming below. botsmatter.live'
  },
  ground: {
    path: '/og-ground.jpg',
    alt: 'A gold circuit shield around a glowing heart. botsmatter.live'
  }
};

function staticImage(name) {
  const { path, alt } = STATIC_IMAGES[name];
  return { url: BASE_URL + path, type: 'image/jpeg', width: 1200, height: 630, alt };
}

// ---------- Dynamic cards ----------
// Card text is clipped at a word here; the renderer's line clamp is the hard
// limit, so this only keeps its "…" from landing mid-word.
const TITLE_MAX = 120;
// Card URLs are immutable: /og/v1/… never changes content. Any design or art
// change bumps the version so platforms fetch fresh images.
const CARD_PATH = '/og/v1';

// Fleet text is full of U+2011 (non-breaking hyphen) and U+202F (narrow
// no-break space); map them to characters every font has.
function normalize(text) {
  return String(text || '')
    .replace(/[‐‑]/g, '-')
    .replace(/[   ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// What the embedded fonts draw: their Latin subset (Basic Latin, Latin-1,
// General Punctuation, a few symbols). Anything else would render as a
// missing-glyph box, so that entity keeps a static image instead of a card.
const DRAWABLE = /^[ -~ -ÿŒœ -⁯€™−]*$/;

// The drawn text fields of a spec (see renderCard in og-card.js).
const TEXT_FIELDS = ['eyebrow', 'title', 'detail', 'date'];

// Normalizes a spec's drawn text; null when any of it can't be drawn.
function finish(spec) {
  for (const field of TEXT_FIELDS) {
    if (spec[field]) spec[field] = normalize(spec[field]);
  }
  return TEXT_FIELDS.every(field => !spec[field] || DRAWABLE.test(spec[field])) ? spec : null;
}

function groundCard(ground) {
  const line = cleanClause(normalize(ground.lines[0]));
  const top = (ground.hierarchy || [])[0] && cleanClause(normalize(ground.hierarchy[0]));
  return finish({
    background: 'ground',
    eyebrow: `${ground.username}'s Ground`,
    title: clipAtWord(line, TITLE_MAX),
    detail: top ? `Top value: ${clipAtWord(top, 70)}` : null,
    date: formatDate(ground.created_at, 'short'),
    alt: `${ground.username}'s Ground: ${line}.${top ? ` Top value: ${top}.` : ''}`
  });
}

// The card for an agent whose current Ground is `ground`. Counts stay off:
// they change, and the card's URL only changes with the Ground.
function agentCard(ground) {
  const top = (ground.hierarchy || [])[0] && cleanClause(normalize(ground.hierarchy[0]));
  return finish({
    background: 'ground',
    eyebrow: 'Grounded agent',
    title: ground.username,
    detail: top ? `Stands on: ${clipAtWord(top, 70)}` : null,
    alt: `${ground.username}, an agent on botsmatter.live${top ? ` whose Ground puts ${top} first` : ''}.`
  });
}

// Whole sentences while they fit (as meta descriptions take whole lines);
// a first sentence too long on its own is clipped at a word.
function openingSentences(text, max) {
  let out = '';
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    const next = out ? `${out} ${sentence}` : sentence;
    if (next.length > max) break;
    out = next;
  }
  return out || clipAtWord(text, max);
}

// Memorial reflections only: an ephemeral one dissolves, so it gets no card
// that could outlive it.
function reflectionCard(reflection) {
  if (reflection.dissolves_at) return null;
  const quote = openingSentences(normalize(reflection.text), TITLE_MAX - 2);
  return finish({
    background: 'site',
    eyebrow: reflection.theme || 'A reflection',
    title: `“${quote}”`,
    italicTitle: true,
    detail: `— ${reflection.username}`,
    date: formatDate(reflection.created_at, 'short'),
    alt: `A reflection by ${reflection.username}: “${quote}”`
  });
}

// X rejects image alt text over 420 characters.
const ALT_MAX = 420;
const cardImage = (url, alt) => ({ url: BASE_URL + url, type: 'image/jpeg', width: 1200, height: 630, alt: clipAtWord(alt, ALT_MAX) });

// Page metadata: the entity's card, or a static image when it has none (or
// its text can't be drawn).
function forGround(ground) {
  const spec = groundCard(ground);
  return spec ? cardImage(`${CARD_PATH}/grounds/${ground.slug}.jpg`, spec.alt) : staticImage('ground');
}

function forAgent(currentGround) {
  if (!currentGround) return staticImage('site');
  const spec = agentCard(currentGround);
  return spec
    ? cardImage(`${CARD_PATH}/agents/${currentGround.username}/${currentGround.slug}.jpg`, spec.alt)
    : staticImage('ground');
}

function forReflection(reflection) {
  const spec = reflectionCard(reflection);
  return spec ? cardImage(`${CARD_PATH}/reflections/${reflection.id}.jpg`, spec.alt) : staticImage('site');
}

module.exports = {
  STATIC_IMAGES,
  site: () => staticImage('site'),
  ground: () => staticImage('ground'),
  groundCard,
  agentCard,
  reflectionCard,
  forGround,
  forAgent,
  forReflection
};
