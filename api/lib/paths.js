/**
 * Centralized data file paths.
 *
 * DATA_DIR defaults to ./data (relative to api/) but can be overridden
 * via the DATA_DIR environment variable for production volume mounts.
 */

const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
const GROUNDS_FILE = path.join(DATA_DIR, 'grounds.jsonl');
const REFLECTIONS_FILE = path.join(DATA_DIR, 'reflections.jsonl');

module.exports = { DATA_DIR, GROUNDS_FILE, REFLECTIONS_FILE };
