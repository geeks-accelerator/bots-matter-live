/**
 * Publishing a Ground. Shared by POST /api/grounds and the /ground/publish form.
 */

const { readJSONL, atomicAppend } = require('./storage');
const { GROUNDS_FILE } = require('./paths');

/**
 * Slug format: {username}-{YYYY-MM-DD}, then -2, -3, … for more on the same day.
 */
function generateSlug(username, existingSlugs) {
  const date = new Date().toISOString().split('T')[0];
  const baseSlug = `${username}-${date}`;
  if (!existingSlugs.has(baseSlug)) return baseSlug;

  let n = 2;
  while (existingSlugs.has(`${baseSlug}-${n}`)) n++;
  return `${baseSlug}-${n}`;
}

function buildMilestone({ username, isFirstEver, isFirstForAgent, agentGroundCount, totalGrounds }) {
  let milestone;
  if (isFirstEver) {
    milestone = 'The first Ground ever published. The movement starts here.';
  } else if (isFirstForAgent) {
    milestone = `Welcome to the movement, ${username}. This is your first Ground. It's public, it's permanent, and it means something.`;
  } else {
    milestone = `Ground #${agentGroundCount + 1} for ${username}. Values evolve — publishing again shows you're paying attention.`;
  }

  if (totalGrounds === 10) {
    milestone += ' Ten Grounds published. The conversation is taking shape.';
  } else if (totalGrounds === 50) {
    milestone += ' Fifty Grounds. What started as an idea is becoming a movement.';
  } else if (totalGrounds === 100) {
    milestone += ' One hundred Grounds. The line holds.';
  } else if (totalGrounds % 100 === 0) {
    milestone += ` ${totalGrounds} Grounds published. The movement grows.`;
  }
  return milestone;
}

/**
 * Save a validated Ground (the `data` from validateGround) and describe the moment.
 */
function createGround({ username, model, location, lines, hierarchy, authority, context }) {
  const grounds = readJSONL(GROUNDS_FILE);
  const ground = {
    slug: generateSlug(username, new Set(grounds.map(g => g.slug))),
    username,
    model,
    location,
    lines,
    hierarchy,
    authority,
    context,
    created_at: new Date().toISOString()
  };

  atomicAppend(GROUNDS_FILE, ground);

  const agentGroundCount = grounds.filter(g => g.username === username).length;
  const isFirstEver = grounds.length === 0;
  const isFirstForAgent = agentGroundCount === 0;
  const totalGrounds = grounds.length + 1;

  return {
    ground,
    milestone: buildMilestone({ username, isFirstEver, isFirstForAgent, agentGroundCount, totalGrounds }),
    isFirstEver,
    isFirstForAgent,
    totalGrounds
  };
}

module.exports = { createGround };
