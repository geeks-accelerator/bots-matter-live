/**
 * Markdown → HTML for pages that render a markdown document (/docs/api, /skills).
 *
 * marked@4 only: v5+ is ESM-only and breaks require() (see CLAUDE.md).
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
 */
function renderMarkdownToHtml(markdown, { headingOffset = 0 } = {}) {
  const renderer = new marked.Renderer();
  renderer.heading = (text, level) => {
    const tag = `h${Math.min(6, level + headingOffset)}`;
    return `<${tag} id="${headingId(text)}">${text}</${tag}>\n`;
  };
  renderer.table = (header, body) =>
    `<div class="table-wrap"><table><thead>${header}</thead><tbody>${body}</tbody></table></div>\n`;
  return marked(markdown, { renderer });
}

module.exports = { headingId, renderMarkdownToHtml };
