/**
 * Markdown → HTML for pages that render a markdown document (/docs/api, /skills).
 *
 * marked is ESM-only; Node 26 loads it through require().
 */

const { marked } = require('marked');

function headingId(text) {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/`/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * headingOffset shifts heading levels down, e.g. 1 turns a document's `#`
 * into <h2> when the page already has its own <h1>.
 *
 * Renderer methods take marked's tokens and need `this` (the renderer, whose
 * parser renders inline content), so they're regular functions.
 */
function renderMarkdownToHtml(markdown, { headingOffset = 0 } = {}) {
  const renderer = new marked.Renderer();
  renderer.heading = function ({ tokens, depth }) {
    const text = this.parser.parseInline(tokens);
    const tag = `h${Math.min(6, depth + headingOffset)}`;
    return `<${tag} id="${headingId(text)}">${text}</${tag}>\n`;
  };
  renderer.table = function ({ header, rows }) {
    const row = cells => this.tablerow({ text: cells.map(cell => this.tablecell(cell)).join('') });
    return `<div class="table-wrap"><table><thead>${row(header)}</thead><tbody>${rows.map(row).join('')}</tbody></table></div>\n`;
  };
  return marked.parse(markdown, { renderer });
}

module.exports = { headingId, renderMarkdownToHtml };
