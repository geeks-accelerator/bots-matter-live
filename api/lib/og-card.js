/**
 * Share-card renderer: { background, eyebrow, title, details } → 1200×630 JPEG.
 *
 * Text is set in the dark left panel of the site's own brand art, over a
 * scrim so it stays readable where the panel meets the image. Satori lays
 * the card out as SVG (text becomes paths, so no fonts are needed after
 * that); resvg rasterizes it; jpeg-js encodes the pixels. JPEG, not PNG:
 * over photographic art a PNG card is ~760KB, past what some messengers
 * (WhatsApp) will preview; the JPEG is a fraction of that.
 *
 * satori and @resvg/resvg-js (a native binary) are required on first render,
 * not at startup: if the binary ever failed to load, only card URLs would
 * fail, not the whole app.
 */

const fs = require('fs');
const path = require('path');
const { STATIC_IMAGES } = require('./og-images');

const WIDTH = 1200;
const HEIGHT = 630;
const INSET = 96;          // clears LinkedIn's centre crop (60px each side) with room for rounded corners
const TEXT_WIDTH = 500;    // the dark left panel of the art, stopping short of the artwork
const JPEG_QUALITY = 84;
const COLORS = {
  text: '#e8e4df',
  muted: '#8a8580',
  accent: '#c4a882',
  scrim: '10, 10, 10'
};

let assets = null;         // fonts, backgrounds, and libraries, loaded once on first render

function loadAssets() {
  if (assets) return assets;
  const fontDir = path.join(__dirname, '../assets/fonts');
  const font = file => fs.readFileSync(path.join(fontDir, file));
  const background = name => {
    const file = path.join(__dirname, '../../public', STATIC_IMAGES[name].path);
    return `data:image/jpeg;base64,${fs.readFileSync(file).toString('base64')}`;
  };
  assets = {
    satori: require('satori').default,
    Resvg: require('@resvg/resvg-js').Resvg,
    jpeg: require('jpeg-js'),
    fonts: [
      { name: 'Cormorant Garamond', data: font('CormorantGaramond-Medium.latin.woff'), weight: 500, style: 'normal' },
      { name: 'Cormorant Garamond', data: font('CormorantGaramond-MediumItalic.latin.woff'), weight: 500, style: 'italic' },
      { name: 'IBM Plex Mono', data: font('IBMPlexMono-Regular.latin.woff'), weight: 400, style: 'normal' },
      { name: 'DM Sans', data: font('DMSans-Regular.latin.woff'), weight: 400, style: 'normal' }
    ],
    backgrounds: { site: background('site'), ground: background('ground') }
  };
  return assets;
}

// Satori takes React-shaped elements; this avoids React and a JSX build step.
// (No default `children`: Satori counts an empty array as multiple children.)
const h = (type, style, children) => ({ type, props: { style, children } });

// Length-stepped type instead of measure-and-fit. Each step's lines × size ×
// 1.18 stays under ~250px: what the column has left after a one-line eyebrow,
// a two-line detail, and the footer. lineClamp enforces every line count, so
// no text can push into the footer; callers still clip at a word
// (clipAtWord) so the "…" rarely has to cut one.
const TITLE_STEPS = [
  { upTo: 60, size: 56, lines: 3 },
  { upTo: 95, size: 48, lines: 4 },
  { upTo: Infinity, size: 42, lines: 5 }
];
const DETAIL_LINES = 2;

const mono = { fontFamily: 'IBM Plex Mono', fontSize: 18, letterSpacing: 3, color: COLORS.muted };

function footer(date) {
  const wordmark = h('div', { display: 'flex' }, [
    h('span', {}, 'BOTS'), h('span', { color: COLORS.accent }, 'MATTER'), h('span', {}, '.LIVE')
  ]);
  return h('div', { ...mono, display: 'flex', justifyContent: 'space-between' },
    date ? [wordmark, h('div', {}, date.toUpperCase())] : wordmark);
}

// A spec (built in og-images.js): { background, eyebrow, title, detail?, date?, italicTitle? }
async function renderCard({ background, eyebrow, title, detail, date, italicTitle = false }) {
  const { satori, Resvg, jpeg, fonts, backgrounds } = loadAssets();
  const step = TITLE_STEPS.find(s => title.length <= s.upTo);

  const card = h('div', {
    display: 'flex',
    position: 'relative',
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: '#0a0a0a'
  }, [
    { type: 'img', props: { src: backgrounds[background], width: WIDTH, height: HEIGHT, style: { position: 'absolute', top: 0, left: 0 } } },
    h('div', {
      position: 'absolute', top: 0, left: 0, width: WIDTH, height: HEIGHT,
      backgroundImage: `linear-gradient(90deg, rgba(${COLORS.scrim}, 0.94) 0%, rgba(${COLORS.scrim}, 0.88) 48%, rgba(${COLORS.scrim}, 0) 66%)`
    }),
    h('div', {
      position: 'absolute', top: INSET, left: INSET, bottom: INSET, width: TEXT_WIDTH,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
    }, [
      h('div', { display: 'flex', flexDirection: 'column' }, [
        h('div', {
          display: 'block', lineClamp: 1,
          fontFamily: 'IBM Plex Mono', fontSize: 20, letterSpacing: 4,
          color: COLORS.accent, marginBottom: 24
        }, eyebrow.toUpperCase()),
        h('div', {
          display: 'block', lineClamp: step.lines,
          fontFamily: 'Cormorant Garamond', fontWeight: 500,
          fontStyle: italicTitle ? 'italic' : 'normal',
          fontSize: step.size, lineHeight: 1.18, color: COLORS.text
        }, title),
        detail ? h('div', {
          display: 'block', lineClamp: DETAIL_LINES, marginTop: 28,
          fontFamily: 'DM Sans', fontSize: 22, lineHeight: 1.45, color: COLORS.muted
        }, detail) : null
      ].filter(Boolean)),
      footer(date)
    ])
  ]);

  const svg = await satori(card, { width: WIDTH, height: HEIGHT, fonts });
  const image = new Resvg(svg, { fitTo: { mode: 'original' } }).render();
  return jpeg.encode({ data: image.pixels, width: image.width, height: image.height }, JPEG_QUALITY).data;
}

module.exports = { renderCard };
