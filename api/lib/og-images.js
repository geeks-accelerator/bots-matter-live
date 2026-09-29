/**
 * Share images (og:image / twitter:image) for every page.
 *
 * Each page gets { url, type, width, height, alt } for the layout's meta tags.
 * Exposed to templates as `ogImages` (app.locals).
 */

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

module.exports = {
  STATIC_IMAGES,
  site: () => staticImage('site'),
  ground: () => staticImage('ground')
};
