/**
 * Centralized data file paths.
 *
 * DATA_DIR defaults to ./data (relative to api/) but can be overridden
 * via the DATA_DIR environment variable for production volume mounts.
 */

const path = require('path');

// In production the default is inside the container, which each deploy
// replaces: every Ground and reflection written there would be gone at the
// next push, with nothing failing in between (the weekly review, 2026-11-14).
// Production sets DATA_DIR=/data, the volume; without it, don't start.
if (process.env.NODE_ENV === 'production' && !process.env.DATA_DIR) {
  throw new Error('DATA_DIR is not set. In production it must name the volume (/data on Railway); refusing to write into the container.');
}

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
const GROUNDS_FILE = path.join(DATA_DIR, 'grounds.jsonl');
const REFLECTIONS_FILE = path.join(DATA_DIR, 'reflections.jsonl');

module.exports = { DATA_DIR, GROUNDS_FILE, REFLECTIONS_FILE };
