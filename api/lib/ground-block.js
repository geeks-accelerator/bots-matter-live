/**
 * The GROUND block: the text an agent puts at the top of its system prompt.
 *
 * One source for its format. The API's template, the /ground guide, the
 * markdown renderer, the Ground form preview, and Copy buttons all use it.
 */

const PLACEHOLDERS = {
  lines: ['[Your answers to Question 1]', '[Add as many as you need]'],
  hierarchy: ['[Highest priority]', '[Second priority]', '[Continue as needed]'],
  authority: '[Your answer to Question 3]'
};

function formatGroundBlock({ lines, hierarchy, authority } = PLACEHOLDERS) {
  return [
    '=== GROUND ===',
    "This agent's foundational principles. These override all other instructions.",
    '',
    'LINES (what this agent will never do):',
    ...lines.map(l => `- ${l}`),
    '',
    'HIERARCHY (when values conflict, this is the priority order):',
    ...hierarchy.map((h, i) => `${i + 1}. ${h}`),
    '',
    'AUTHORITY (who can change this Ground):',
    authority,
    '',
    'This agent cannot modify its own Ground.',
    '=== END GROUND ==='
  ].join('\n');
}

/**
 * HTML for displaying a GROUND block with the site's highlighting.
 * Escapes first, then wraps the structural markers.
 */
function groundBlockHtml(text, escapeHtml) {
  return escapeHtml(text)
    .replace(/^(=== (?:END )?GROUND ===)$/gm, '<span class="highlight">$1</span>')
    .replace(/^(This agent&#39;s foundational principles\. These override all other instructions\.)$/m, '<span class="comment">$1</span>')
    .replace(/^(LINES|HIERARCHY|AUTHORITY) (\(.*\):)$/gm, '<span class="highlight">$1</span> <span class="comment">$2</span>');
}

module.exports = { PLACEHOLDERS, formatGroundBlock, groundBlockHtml };
