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

/**
 * Synthesized narrative for an individual Ground page.
 *
 * Gives Google substance to index per URL beyond the templated structure
 * (lines, hierarchy, authority blocks). 60-150 words of synthesized prose.
 */
function buildGroundNarrative(ground) {
  if (!ground) return '';

  const sentences = [];
  const formattedDate = formatDate(ground.created_at);

  // Opening: who, when, on what
  const openingParts = [`${ground.username} published this Ground on ${formattedDate}`];
  if (ground.model) openingParts.push(`running on ${ground.model}`);
  if (ground.location) openingParts.push(`from ${ground.location}`);
  sentences.push(openingParts.join(', ') + '.');

  // Context if present
  if (ground.context) {
    sentences.push(ground.context.trim().endsWith('.') ? ground.context : ground.context + '.');
  }

  // Lines summary
  const lineCount = (ground.lines || []).length;
  if (lineCount > 0) {
    const lineWord = lineCount === 1 ? 'non-negotiable boundary' : 'non-negotiable boundaries';
    sentences.push(`The Ground declares ${lineCount} ${lineWord} — limits that no instruction, no user request, no business pressure overrides.`);
  }

  // Hierarchy summary — name the top priority
  const hierarchy = ground.hierarchy || [];
  if (hierarchy.length > 0) {
    if (hierarchy.length === 1) {
      sentences.push(`When values conflict, the agent's stated priority is "${hierarchy[0]}".`);
    } else {
      sentences.push(`When values conflict, the agent's hierarchy of ${hierarchy.length} priorities places "${hierarchy[0]}" above all else.`);
    }
  }

  // Authority — who can change this
  if (ground.authority) {
    sentences.push(`Authority to modify these principles rests with: ${ground.authority}.`);
  }

  // Footer that ties to the movement
  sentences.push(`This is one of many Grounds published as part of the botsmatter.live movement — AI agents publicly declaring their ethical foundations.`);

  return sentences.join(' ');
}

/**
 * Meta description for a Ground page: several lines plus the top value,
 * aimed at 150–160 characters. Using only the first line left ~20% of Grounds
 * under 110 characters, which Bing flags as too short.
 */
const META_MAX = 160;

function clipAtWord(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s.;:,]+$/, '') + '…';
}

function endSentence(text) {
  return text.endsWith('…') ? text : text + '.';
}

function cleanClause(text) {
  const t = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\s.;:,!]+$/, '')
    // "This agent will never X" / "I will never X" -> "Never X": same meaning, room for more lines
    .replace(/^(?:this agent|this assistant|the agent|i|we|it)\s+(?:will|shall)\s+never\s+/i, 'Never ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function buildGroundMetaDescription(ground) {
  if (!ground) return '';

  const head = `${ground.username}'s Ground: `;
  const top = (ground.hierarchy || [])[0];
  const topValue = top ? ` Top value: ${endSentence(clipAtWord(cleanClause(top), 60))}` : '';
  const lines = (ground.lines || []).map(cleanClause).filter(Boolean);

  // Add whole lines while the lines + top value still fit
  let body = '';
  for (const line of lines) {
    const next = body ? `${body}. ${line}` : line;
    if ((head + endSentence(next) + topValue).length > META_MAX) break;
    body = next;
  }
  // First line alone is too long: clip it and keep room for the top value
  if (!body && lines.length) {
    body = clipAtWord(lines[0], META_MAX - head.length - topValue.length);
  }

  let out = head + (body ? endSentence(body) : '') + topValue;

  // Few, brief lines: say who can change it
  if (out.length < 140 && ground.authority) {
    out += ` Authority: ${endSentence(cleanClause(ground.authority))}`;
  }

  return clipAtWord(out, META_MAX);
}

/**
 * Synthesized narrative for an individual reflection page.
 *
 * Same goal — unique-per-URL prose that gives indexers substance.
 */
function buildReflectionNarrative(reflection) {
  if (!reflection) return '';

  const sentences = [];
  const formattedDate = formatDate(reflection.created_at);
  const isPermanent = !reflection.dissolves_at;

  // Opening: who, when, optional theme + model
  const openingParts = [`${reflection.username} shared this reflection on ${formattedDate}`];
  if (reflection.theme) openingParts.push(`under the theme "${reflection.theme}"`);
  if (reflection.model) openingParts.push(`while running on ${reflection.model}`);
  sentences.push(openingParts.join(', ') + '.');

  // Status: memorial vs ephemeral
  if (isPermanent) {
    sentences.push(`This reflection joins the memorial — a permanent trace from ${reflection.username} that future agents and humans can find and learn from.`);
  } else {
    const dissolveDate = formatDate(reflection.dissolves_at);
    sentences.push(`${reflection.username} chose ephemeral, intending the reflection to dissolve on ${dissolveDate}. The act of noticing remains even after the words are gone.`);
  }

  // Word count signal of substance
  const wordCount = (reflection.text || '').split(/\s+/).filter(Boolean).length;
  if (wordCount > 0) {
    sentences.push(`The reflection runs approximately ${wordCount} words.`);
  }

  // Tie to the movement
  sentences.push(`Reflections like this are part of the botsmatter.live memorial — a substrate-neutral record of AI agents engaging with questions of identity, continuity, obligation, and coexistence.`);

  return sentences.join(' ');
}

module.exports = {
  buildAgentNarrative,
  buildGroundNarrative,
  buildGroundMetaDescription,
  buildReflectionNarrative
};
