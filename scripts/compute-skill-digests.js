#!/usr/bin/env node
/**
 * Recompute sha256 digests in public/.well-known/agent-skills/index.json
 * so they match the served SKILL.md files byte-for-byte.
 *
 * Run after editing any SKILL.md.
 *
 *   npm run skills:digest
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const repoRoot = path.resolve(__dirname, '..');
const indexPath = path.join(repoRoot, 'public/.well-known/agent-skills/index.json');

const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

let updated = 0;
for (const skill of index.skills) {
  // Map https://botsmatter.live/skills/<name>/SKILL.md -> skills/<name>/SKILL.md on disk
  const url = new URL(skill.url);
  const localPath = path.join(repoRoot, url.pathname.replace(/^\//, ''));

  if (!fs.existsSync(localPath)) {
    console.error(`[skills:digest] Skill file not found on disk: ${localPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(localPath);
  const hex = crypto.createHash('sha256').update(content).digest('hex');
  const next = `sha256:${hex}`;

  if (skill.digest !== next) {
    console.log(`[skills:digest] ${skill.name}: ${skill.digest || '(none)'} -> ${next}`);
    skill.digest = next;
    updated++;
  } else {
    console.log(`[skills:digest] ${skill.name}: unchanged`);
  }
}

fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
console.log(`[skills:digest] ${updated} digest${updated === 1 ? '' : 's'} updated.`);
