#!/usr/bin/env node
/**
 * Validate every skills/<name>/SKILL.md against the Agent Skills spec
 * (https://agentskills.io/specification) plus ClawHub's size limit, and
 * check that each skill is listed in the discovery manifest. Also checks
 * every rate limit the skills and docs/api.md quote against the code
 * (api/lib/rate-limit.js): the numbers were hand-written and drifted once.
 *
 * Runs automatically before `npm run skills:digest`.
 *
 *   npm run skills:validate
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const { LIMITS } = require('../api/lib/rate-limit.js');
const skillsDir = path.join(repoRoot, 'skills');
const indexPath = path.join(repoRoot, 'public/.well-known/agent-skills/index.json');

// Top-level frontmatter keys the spec allows. Anything else (version, author,
// tags, homepage, emoji...) belongs under `metadata` or in the ClawHub flags.
const ALLOWED_FIELDS = new Set(['name', 'description', 'license', 'allowed-tools', 'metadata', 'compatibility']);
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CLAWHUB_MAX_BYTES = 20000;

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split('\n')) {
    // Top-level keys only: no leading whitespace
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    fields[m[1]] = value;
  }
  return fields;
}

const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
const indexed = new Map(index.skills.map(s => [s.name, s]));

const skillNames = fs.readdirSync(skillsDir, { withFileTypes: true })
  .filter(d => d.isDirectory() && fs.existsSync(path.join(skillsDir, d.name, 'SKILL.md')))
  .map(d => d.name);

let failures = 0;
function fail(skill, msg) {
  console.error(`[skills:validate] ${skill}: ${msg}`);
  failures++;
}

for (const dir of skillNames) {
  const file = path.join(skillsDir, dir, 'SKILL.md');
  const raw = fs.readFileSync(file, 'utf8');
  const bytes = Buffer.byteLength(raw);
  const fm = parseFrontmatter(raw);

  if (!fm) { fail(dir, 'missing YAML frontmatter'); continue; }

  const extra = Object.keys(fm).filter(k => !ALLOWED_FIELDS.has(k));
  if (extra.length) fail(dir, `unexpected frontmatter fields: ${extra.join(', ')} (move under metadata)`);

  const name = fm.name || '';
  if (!name) fail(dir, 'name is required');
  else {
    if (name.length > 64) fail(dir, `name is ${name.length} chars (max 64)`);
    if (!NAME_RE.test(name)) fail(dir, `name "${name}" must be lowercase letters, numbers, single hyphens`);
    if (name !== dir) fail(dir, `name "${name}" must match directory name "${dir}"`);
  }

  const desc = fm.description || '';
  if (!desc) fail(dir, 'description is required');
  else if (desc.length > 1024) fail(dir, `description is ${desc.length} chars (max 1024)`);

  // ClawHub relicenses every published skill as MIT-0 and rejects conflicting per-skill licenses
  if (fm.license && fm.license !== 'MIT-0') fail(dir, `license "${fm.license}" conflicts with ClawHub's MIT-0; use MIT-0 or omit`);

  if (fm.compatibility && fm.compatibility.length > 500) {
    fail(dir, `compatibility is ${fm.compatibility.length} chars (max 500)`);
  }

  if (bytes > CLAWHUB_MAX_BYTES) fail(dir, `${bytes} bytes exceeds ClawHub limit of ${CLAWHUB_MAX_BYTES}`);

  const entry = indexed.get(dir);
  if (!entry) fail(dir, 'not listed in public/.well-known/agent-skills/index.json');
  else if (entry.description !== desc) fail(dir, 'index.json description differs from SKILL.md description');

  console.log(`[skills:validate] ${dir}: ${bytes} bytes, description ${desc.length} chars`);
}

// Rate limits quoted in the skills and the API reference, against LIMITS.
// A table row names one endpoint (`GET /api/stats` | 60) or "All other
// endpoints"; a row naming a group ("GET endpoints") fails, since the limits
// differ within it. Prose: "N reflections per minute".
function checkRateLimits(label, raw) {
  for (const row of raw.match(/^\|.*\|\s*$/gm) || []) {
    const cells = row.split('|').slice(1, -1).map(c => c.trim().replace(/`/g, ''));
    const n = (cells[1] || '').match(/^(\d+)(\/min)?$/);
    if (!n) continue;
    const ep = cells[0].match(/^(GET|POST)\s+(\/\S+)$/);
    const want = /^all other/i.test(cells[0]) ? LIMITS.DEFAULT.max
      : ep ? (LIMITS[`${ep[1]}:${ep[2]}`] || LIMITS.DEFAULT).max : null;
    if (want === null) {
      if (/^(GET|POST)\b/.test(cells[0])) fail(label, `rate limit row "${cells[0]}" names no single endpoint`);
      continue;
    }
    if (Number(n[1]) !== want) fail(label, `says ${cells[0]} allows ${n[1]}; api/lib/rate-limit.js says ${want}`);
  }
  for (const m of raw.matchAll(/(\d+) reflections per minute/g)) {
    const want = LIMITS['POST:/api/reflect'].max;
    if (Number(m[1]) !== want) fail(label, `says ${m[1]} reflections per minute; api/lib/rate-limit.js says ${want}`);
  }
}
for (const dir of skillNames) checkRateLimits(dir, fs.readFileSync(path.join(skillsDir, dir, 'SKILL.md'), 'utf8'));
checkRateLimits('docs/api.md', fs.readFileSync(path.join(repoRoot, 'docs/api.md'), 'utf8'));

for (const name of indexed.keys()) {
  if (!skillNames.includes(name)) fail(name, 'listed in index.json but no skills/<name>/SKILL.md exists');
}

if (failures) {
  console.error(`[skills:validate] ${failures} problem${failures === 1 ? '' : 's'} found.`);
  process.exit(1);
}
console.log(`[skills:validate] ${skillNames.length} skills valid.`);
