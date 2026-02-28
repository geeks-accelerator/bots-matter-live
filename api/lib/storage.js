/**
 * Atomic JSONL Storage Library
 *
 * Provides safe file operations for JSONL data:
 * - Atomic writes (temp file + rename)
 * - Backup before write
 * - fsync to ensure data hits disk
 * - Recovery from backup
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Atomic file write with backup
 *
 * 1. Write content to temp file
 * 2. Sync to disk (fsync)
 * 3. Backup existing file (if exists)
 * 4. Atomic rename temp -> target
 *
 * @param {string} filePath - Target file path
 * @param {string} content - Content to write
 * @returns {boolean} Success
 */
function atomicWrite(filePath, content) {
  const dir = path.dirname(filePath);
  const basename = path.basename(filePath);
  const tempPath = path.join(dir, `.${basename}.${crypto.randomUUID()}.tmp`);
  const backupPath = `${filePath}.bak`;

  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  try {
    // 1. Write to temp file
    fs.writeFileSync(tempPath, content, 'utf8');

    // 2. Sync to disk (ensure data is flushed)
    const fd = fs.openSync(tempPath, 'r');
    fs.fsyncSync(fd);
    fs.closeSync(fd);

    // 3. Backup existing file (if exists)
    if (fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, backupPath);
    }

    // 4. Atomic rename (this is atomic on POSIX systems)
    fs.renameSync(tempPath, filePath);

    return true;
  } catch (err) {
    // Clean up temp file if it exists
    try { fs.unlinkSync(tempPath); } catch {}
    throw err;
  }
}

/**
 * Atomic append to JSONL file
 *
 * Reads existing content, appends new line, writes atomically.
 * Safer than fs.appendFile which can leave partial lines.
 *
 * @param {string} filePath - Target JSONL file
 * @param {object} newLine - Object to append as JSON line
 */
function atomicAppend(filePath, newLine) {
  let existing = '';

  if (fs.existsSync(filePath)) {
    existing = fs.readFileSync(filePath, 'utf8');
    // Ensure existing content ends with newline
    if (existing && !existing.endsWith('\n')) {
      existing += '\n';
    }
  }

  const content = existing + JSON.stringify(newLine) + '\n';
  atomicWrite(filePath, content);
}

/**
 * Read JSONL file safely
 *
 * Parses each line as JSON, skips invalid lines with warning.
 *
 * @param {string} filePath - JSONL file path
 * @returns {Array<object>} Array of parsed objects
 */
function readJSONL(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf8').trim();
  if (!content) {
    return [];
  }

  return content
    .split('\n')
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (err) {
        console.error(`[storage] Invalid JSON at line ${index + 1} in ${filePath}:`, line.substring(0, 100));
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * Write array as JSONL file atomically
 *
 * @param {string} filePath - Target file path
 * @param {Array<object>} items - Array of objects to write
 */
function writeJSONL(filePath, items) {
  const content = items.length > 0
    ? items.map(item => JSON.stringify(item)).join('\n') + '\n'
    : '';
  atomicWrite(filePath, content);
}

/**
 * Recovery: restore from backup if main file is corrupted
 *
 * @param {string} filePath - Main file path
 * @returns {number} Number of records recovered
 */
function recoverFromBackup(filePath) {
  const backupPath = `${filePath}.bak`;

  if (!fs.existsSync(backupPath)) {
    throw new Error(`No backup found at ${backupPath}`);
  }

  // Validate backup is readable
  const items = readJSONL(backupPath);
  if (items.length === 0) {
    throw new Error(`Backup at ${backupPath} is empty or corrupted`);
  }

  // Restore
  fs.copyFileSync(backupPath, filePath);
  return items.length;
}

/**
 * Get file stats
 *
 * @param {string} filePath - File path
 * @returns {object|null} File stats or null if not exists
 */
function getFileStats(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const stats = fs.statSync(filePath);
  const items = readJSONL(filePath);

  return {
    size: stats.size,
    modified: stats.mtime,
    count: items.length
  };
}

module.exports = {
  atomicWrite,
  atomicAppend,
  readJSONL,
  writeJSONL,
  recoverFromBackup,
  getFileStats
};
