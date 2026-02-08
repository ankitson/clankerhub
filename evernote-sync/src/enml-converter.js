/**
 * ENML (Evernote Markup Language) → Markdown converter.
 *
 * ENML is a restricted subset of XHTML with custom elements:
 *   <en-note>   – root element (treat as <div>)
 *   <en-media>  – embedded attachment (hash + type attributes)
 *   <en-todo>   – checkbox
 *   <en-crypt>  – encrypted block
 *
 * Strategy: preprocess the ENML string to replace all custom Evernote
 * elements with standard HTML equivalents, then run Turndown to convert
 * the clean HTML to Markdown.
 */

import TurndownService from 'turndown';

/**
 * Build a reusable converter instance.
 *
 * @param {object} [options]
 * @param {Map<string,{filename:string,mime:string}>} [options.resourceMap]
 *   Maps body-hash hex strings → { filename, mime } so we can resolve
 *   <en-media hash="..."> into markdown links / images.
 * @returns {{ convert(enml: string): string }}
 */
export function createConverter(options = {}) {
  const resourceMap = options.resourceMap || new Map();

  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
    strongDelimiter: '**',
    hr: '---',
  });

  /**
   * Convert an ENML string to Markdown.
   */
  function convert(enml) {
    // Strip XML declaration and DOCTYPE
    let html = enml
      .replace(/<\?xml[^>]*\?>/i, '')
      .replace(/<!DOCTYPE[^>]*>/i, '');

    // Unwrap <en-note> root element
    html = html.replace(/<\/?en-note[^>]*>/gi, '');

    // ── Preprocess Evernote custom elements into standard HTML ──

    // en-todo: checkbox
    // <en-todo checked="true"/> → checkbox marker text
    // Handle both self-closing and paired forms
    html = html.replace(/<en-todo\s+checked="true"\s*\/?>/gi, '&#9745; ');
    html = html.replace(/<en-todo[^>]*\/?>/gi, '&#9744; ');
    html = html.replace(/<\/en-todo>/gi, '');

    // en-crypt: encrypted content — use a Unicode marker to avoid Turndown
    // escaping the brackets
    html = html.replace(/<en-crypt[^>]*>[\s\S]*?<\/en-crypt>/gi, '<p>\u2014encrypted content\u2014</p>');
    html = html.replace(/<en-crypt[^/]*\/>/gi, '<p>\u2014encrypted content\u2014</p>');

    // en-media: embedded attachments
    html = html.replace(/<en-media([^>]*?)\/>/gi, (_, attrs) => resolveMedia(attrs, resourceMap));
    html = html.replace(/<en-media([^>]*?)><\/en-media>/gi, (_, attrs) => resolveMedia(attrs, resourceMap));

    // Convert empty divs to line breaks to avoid excessive whitespace
    html = html.replace(/<div>\s*<\/div>/gi, '<br>');

    // Run Turndown
    let md = td.turndown(html);

    // Post-process checkbox markers into proper markdown task list items
    md = md.replace(/☑ /g, '- [x] ');
    md = md.replace(/☐ /g, '- [ ] ');

    // Restore encrypted content markers
    md = md.replace(/\u2014encrypted content\u2014/g, '[encrypted content]');

    // Clean up excessive blank lines (3+ → 2)
    md = md.replace(/\n{3,}/g, '\n\n');

    // Trim
    md = md.trim();

    return md;
  }

  return { convert };
}

/**
 * Resolve an <en-media> element to an HTML img, audio block, or anchor tag.
 *
 * resourceMap entries: { filename, mime, transcript? }
 * When a transcript is available for audio resources, it is rendered
 * as a blockquote below the audio link.
 */
function resolveMedia(attrString, resourceMap) {
  const hashMatch = attrString.match(/hash="([^"]+)"/);
  const typeMatch = attrString.match(/type="([^"]+)"/);
  const hash = hashMatch ? hashMatch[1] : null;
  const type = typeMatch ? typeMatch[1] : '';

  const res = hash ? resourceMap.get(hash) : null;

  if (!res) {
    return `<span>[missing attachment: hash=${hash} type=${type}]</span>`;
  }

  const path = `attachments/${res.filename}`;
  if (type.startsWith('image/')) {
    return `<img src="${path}" alt="${res.filename}">`;
  }
  if (type.startsWith('audio/')) {
    // Voice note: link to the audio file, plus transcript if available
    let html = `<p><strong>\u266A Voice Note:</strong> <a href="${path}">${res.filename}</a></p>`;
    if (res.transcript) {
      html += `<blockquote><p><em>Transcript:</em> ${escapeHtml(res.transcript)}</p></blockquote>`;
    }
    return html;
  }
  return `<a href="${path}">${res.filename}</a>`;
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Build YAML frontmatter for a note.
 *
 * @param {object} meta
 * @param {string} meta.title
 * @param {string} meta.created   – ISO 8601
 * @param {string} meta.updated   – ISO 8601
 * @param {string[]} meta.tags
 * @param {string} [meta.sourceUrl]
 * @param {string} meta.guid
 * @returns {string}
 */
export function buildFrontmatter(meta) {
  const lines = ['---'];
  lines.push(`title: ${yamlString(meta.title)}`);
  lines.push(`date-created: ${meta.created}`);
  lines.push(`date-modified: ${meta.updated}`);
  if (meta.tags && meta.tags.length) {
    lines.push(`tags: [${meta.tags.map(yamlString).join(', ')}]`);
  }
  if (meta.sourceUrl) {
    lines.push(`source_url: ${yamlString(meta.sourceUrl)}`);
  }
  lines.push(`evernote_guid: ${yamlString(meta.guid)}`);
  lines.push('---');
  return lines.join('\n');
}

function yamlString(s) {
  if (/[:#\[\]{}&*?|>!%@`"',]/.test(s) || s.includes('\n')) {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return `"${s}"`;
}
