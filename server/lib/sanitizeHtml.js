// A deliberately tiny, allowlist-only HTML sanitizer for the rich-text event
// description. The description is authored by a signed-in member but rendered
// on public pages, so it must be safe by construction.
//
// The rule is simple: only a fixed set of formatting tags survive, the only
// attribute kept is `class` (and only class tokens from a fixed allowlist —
// the font/size classes the editor applies), and every other tag/attribute is
// dropped. Text between tags is HTML-escaped. There is no path for scripts,
// event handlers, styles, urls, or unknown tags to pass through.

const ALLOWED_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'br', 'p', 'div', 'span']);
const VOID_TAGS = new Set(['br']);
const ALLOWED_CLASSES = new Set([
  'rt-ff-serif', 'rt-ff-sans', 'rt-ff-mono',
  'rt-fs-sm', 'rt-fs-lg', 'rt-fs-xl',
]);

// Matches a start/end tag, tolerating quoted attribute values that contain '>'.
const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;

function escapeText(text) {
  return String(text)
    .replace(/&(?!(#\d+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function safeClass(attrs) {
  const m = /class\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs);
  if (!m) return '';
  const raw = m[2] ?? m[3] ?? '';
  const kept = raw.split(/\s+/).filter((c) => ALLOWED_CLASSES.has(c));
  return kept.join(' ');
}

export function sanitizeRichText(input, { maxLength = 20000 } = {}) {
  let html = String(input ?? '');
  if (html.length > maxLength) html = html.slice(0, maxLength);

  let out = '';
  let last = 0;
  const open = [];
  let m;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(html)) !== null) {
    out += escapeText(html.slice(last, m.index));
    last = TAG_RE.lastIndex;

    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) continue; // drop unknown tag, keep surrounding text

    if (closing) {
      const idx = open.lastIndexOf(tag);
      if (idx !== -1) {
        for (let k = open.length - 1; k >= idx; k--) out += `</${open[k]}>`;
        open.splice(idx);
      }
    } else if (VOID_TAGS.has(tag)) {
      out += '<br>';
    } else {
      const cls = safeClass(m[3] || '');
      out += `<${tag}${cls ? ` class="${cls}"` : ''}>`;
      open.push(tag);
    }
  }
  out += escapeText(html.slice(last));
  for (let k = open.length - 1; k >= 0; k--) out += `</${open[k]}>`;
  return out;
}

// Flatten rich text to readable plain text — used for the {{event_description}}
// merge tag, which drops into plain-text email bodies.
export function stripHtml(input) {
  return String(input ?? '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div)\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Whether a stored description is HTML (new rich text) vs. legacy plain text,
// so old descriptions still render with their line breaks.
export function looksLikeHtml(text) {
  return /<(?:b|strong|i|em|u|br|p|div|span)\b[^>]*>/i.test(String(text ?? ''));
}
