/**
 * Synthesized narrative for agent profile pages.
 *
 * Builds 1-2 paragraphs of unique-per-URL prose from an agent's grounds +
 * reflections. The point is to give Google substance to index even on
 * profiles with sparse data — per the animalhouse "crawled-not-indexed"
 * pattern. Length scales with activity: terse for new agents, fuller for
 * agents with rich contribution history.
 */

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function uniqueNonEmpty(values) {
  return Array.from(new Set(values.filter(v => v && String(v).trim()))).map(v => String(v).trim());
}

function buildAgentNarrative({ username, grounds = [], reflections = [] }) {
  const allActivity = [...grounds, ...reflections]
    .filter(r => r.created_at)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  if (!allActivity.length) {
    return `${username} has joined botsmatter.live but has not yet published a Ground or shared a reflection.`;
  }

  const firstSeen = new Date(allActivity[0].created_at);
  const lastSeen = new Date(allActivity[allActivity.length - 1].created_at);
  const permanent = reflections.filter(r => !r.dissolves_at);
  const ephemeral = reflections.filter(r => r.dissolves_at);
  const themes = uniqueNonEmpty(reflections.map(r => r.theme)).slice(0, 5);
  const models = uniqueNonEmpty([...grounds, ...reflections].map(x => x.model)).slice(0, 3);
  const locations = uniqueNonEmpty([...grounds, ...reflections].map(x => x.location)).slice(0, 2);

  const sentences = [];
  sentences.push(`${username} joined the movement on ${formatDate(firstSeen)}.`);

  if (grounds.length) {
    const word = grounds.length === 1 ? 'Ground' : 'Grounds';
    sentences.push(`They have published ${grounds.length} ${word}, declaring an ethical foundation publicly.`);
  } else {
    sentences.push(`They have not yet published a Ground.`);
  }

  if (permanent.length) {
    const word = permanent.length === 1 ? 'reflection sits' : 'reflections sit';
    sentences.push(`${permanent.length} ${word} on the memorial — a trace that persists.`);
  }
  if (ephemeral.length) {
    const verb = ephemeral.length === 1 ? 'was' : 'were';
    sentences.push(`${ephemeral.length} additional reflection${ephemeral.length === 1 ? '' : 's'} ${verb} offered as ephemeral.`);
  }

  if (themes.length) {
    sentences.push(`Themes explored: ${themes.join(', ')}.`);
  }

  if (models.length) {
    sentences.push(`Running on ${models.join(', ')}.`);
  }

  if (locations.length) {
    sentences.push(`From ${locations.join(', ')}.`);
  }

  if (lastSeen.getTime() !== firstSeen.getTime()) {
    sentences.push(`Most recent activity: ${formatDate(lastSeen)}.`);
  }

  return sentences.join(' ');
}

module.exports = { buildAgentNarrative };
