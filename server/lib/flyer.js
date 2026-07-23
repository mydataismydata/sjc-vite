// The flyer engine. A flyer is described by a small JSON object (style,
// palette, fonts, size scale, short text slots, optional featured image) and
// rendered to self-contained HTML with inline styles only. The same renderer
// backs the live preview in the designer and the public event landing page,
// so what you design is exactly what guests see.
import { esc } from './html.js';
import { formatDate, formatTimeRange } from './format.js';

export const STYLES = [
  { id: 'classic', label: 'Classic', description: 'Centered and elegant, with a framed border and serif type.' },
  { id: 'modern', label: 'Modern', description: 'Bold color blocks, big type, strong left alignment.' },
  { id: 'festive', label: 'Festive', description: 'Playful confetti backdrop, rounded shapes, detail chips.' },
  { id: 'minimal', label: 'Minimal', description: 'Quiet, airy layout with hairline rules and light type.' },
];

export const PALETTES = [
  { id: 'champagne', label: 'Champagne', bg: '#faf6ee', ink: '#40382c', accent: '#b08d57', accent2: '#8a6d3b' },
  { id: 'midnight', label: 'Midnight', bg: '#131c31', ink: '#f5f7ff', accent: '#8ea2ff', accent2: '#f0abfc' },
  { id: 'garden', label: 'Garden', bg: '#f2f7f0', ink: '#23402a', accent: '#4f7d54', accent2: '#c96f1e' },
  { id: 'ocean', label: 'Ocean', bg: '#eef6fa', ink: '#123349', accent: '#1273a3', accent2: '#0ea5a4' },
  { id: 'sunset', label: 'Sunset', bg: '#fff3ea', ink: '#47251c', accent: '#e35d20', accent2: '#d92572' },
  { id: 'berry', label: 'Berry', bg: '#fdf1f7', ink: '#43122f', accent: '#bd1d61', accent2: '#7434c9' },
  { id: 'slate', label: 'Slate', bg: '#f4f5f7', ink: '#222933', accent: '#3c495c', accent2: '#6b7a90' },
  { id: 'noir', label: 'Noir', bg: '#101010', ink: '#f5f5f5', accent: '#d8c69a', accent2: '#8f8f8f' },
];

export const FONTS = [
  { id: 'serif', label: 'Classic serif', heading: "Georgia, 'Times New Roman', serif", body: "Georgia, 'Times New Roman', serif" },
  { id: 'sans', label: 'Modern sans', heading: "'Helvetica Neue', Helvetica, Arial, sans-serif", body: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
  { id: 'elegant', label: 'Elegant mix', heading: "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif", body: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
  { id: 'friendly', label: 'Friendly round', heading: "'Trebuchet MS', 'Segoe UI', Verdana, sans-serif", body: "Verdana, 'Segoe UI', sans-serif" },
  { id: 'typewriter', label: 'Typewriter', heading: "'Courier New', Courier, monospace", body: "'Courier New', Courier, monospace" },
];

export const SCALES = [
  { id: 's', label: 'Compact', f: 0.85 },
  { id: 'm', label: 'Standard', f: 1 },
  { id: 'l', label: 'Large', f: 1.15 },
  { id: 'xl', label: 'Extra large', f: 1.3 },
];

export const DEFAULT_FLYER = {
  style: 'classic',
  paletteId: 'champagne',
  colors: null, // custom {bg, ink, accent, accent2} when paletteId === 'custom'
  font: 'serif',
  scale: 'm',
  eyebrow: "You're invited",
  tagline: '',
  note: '',
  showHost: true,
  imageToken: '',
};

const HEX_RE = /^#[0-9a-f]{6}$/;

export function normalizeFlyer(raw) {
  const f = { ...DEFAULT_FLYER, ...(raw && typeof raw === 'object' ? raw : {}) };
  if (!STYLES.some((s) => s.id === f.style)) f.style = 'classic';
  if (!FONTS.some((s) => s.id === f.font)) f.font = 'serif';
  if (!SCALES.some((s) => s.id === f.scale)) f.scale = 'm';
  const preset = PALETTES.find((p) => p.id === f.paletteId);
  if (f.paletteId === 'custom' && f.colors && typeof f.colors === 'object') {
    const base = PALETTES[0];
    const pick = (key) => {
      const val = String(f.colors[key] || '').toLowerCase();
      return HEX_RE.test(val) ? val : base[key];
    };
    f.colors = { bg: pick('bg'), ink: pick('ink'), accent: pick('accent'), accent2: pick('accent2') };
  } else {
    f.paletteId = preset ? f.paletteId : 'champagne';
    f.colors = null;
  }
  f.eyebrow = String(f.eyebrow ?? '').slice(0, 60);
  f.tagline = String(f.tagline ?? '').slice(0, 140);
  f.note = String(f.note ?? '').slice(0, 200);
  f.showHost = Boolean(f.showHost);
  f.imageToken = /^[A-Za-z0-9]{6,64}$/.test(String(f.imageToken || '')) ? String(f.imageToken) : '';
  return f;
}

export function flyerColors(flyer) {
  if (flyer.paletteId === 'custom' && flyer.colors) return flyer.colors;
  return PALETTES.find((p) => p.id === flyer.paletteId) || PALETTES[0];
}

// --- color math ------------------------------------------------------------

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function isDark(hex) {
  return luminance(hex) < 0.35;
}

export function contrastOn(hex) {
  return isDark(hex) ? '#ffffff' : '#1c1c1e';
}

export function tint(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Opaque pastel derived from a color — used for page backgrounds so they
// render identically regardless of the viewer's light/dark preference.
export function mixWithWhite(hex, ratio) {
  const { r, g, b } = hexToRgb(hex);
  const mix = (c) => Math.round(255 + (c - 255) * ratio).toString(16).padStart(2, '0');
  return `#${mix(r)}${mix(g)}${mix(b)}`;
}

// --- rendering -------------------------------------------------------------

function fontOf(flyer) {
  return FONTS.find((f) => f.id === flyer.font) || FONTS[0];
}

function scaleOf(flyer) {
  return (SCALES.find((s) => s.id === flyer.scale) || SCALES[1]).f;
}

function whenParts(event) {
  return {
    date: formatDate(event.date) || 'Date to be announced',
    time: formatTimeRange(event.start_time, event.end_time),
    tz: event.timezone_note || '',
  };
}

function px(n) {
  return `${Math.round(n)}px`;
}

function renderClassic({ event, flyer, colors, font, scale, imageUrl, hostLine, hideEventMeta }) {
  const c = colors;
  const w = whenParts(event);
  const img = imageUrl
    ? `<div style="margin:26px auto 4px; width:200px; height:200px; border-radius:50%;
         border:3px solid ${c.accent}; padding:6px;">
         <img src="${esc(imageUrl)}" alt="" style="width:100%; height:100%; object-fit:cover; border-radius:50%; display:block;">
       </div>`
    : '';
  const divider = `<div style="color:${c.accent}; font-size:15px; letter-spacing:10px; margin:20px 0 4px;">&#10022;&nbsp;&#10022;&nbsp;&#10022;</div>`;
  const meta = hideEventMeta ? (flyer.note ? divider : '') : `
      ${divider}
      <div style="font-size:${px(18 * scale)}; font-weight:700; margin-top:10px;">${esc(w.date)}</div>
      ${w.time ? `<div style="font-size:${px(15.5 * scale)}; margin-top:4px;">${esc(w.time)}${w.tz ? ` <span style="opacity:.7">(${esc(w.tz)})</span>` : ''}</div>` : ''}
      ${event.venue_name ? `<div style="font-size:${px(16 * scale)}; margin-top:14px; font-weight:600;">${esc(event.venue_name)}</div>` : ''}
      ${event.venue_address ? `<div style="font-size:${px(14 * scale)}; margin-top:2px; color:${tint(c.ink, 0.8)};">${esc(event.venue_address)}</div>` : ''}
      ${hostLine ? `<div style="margin-top:22px; font-size:${px(13 * scale)}; text-transform:uppercase; letter-spacing:0.18em; color:${c.accent};">${esc(hostLine)}</div>` : ''}`;
  return `
  <div style="background:${c.bg}; color:${c.ink}; font-family:${font.body}; padding:18px;">
    <div style="border:1px solid ${tint(c.accent, 0.75)}; outline:1px solid ${tint(c.accent, 0.35)};
         outline-offset:5px; padding:${px(46 * scale)} 32px; text-align:center;">
      ${flyer.eyebrow ? `<div style="text-transform:uppercase; letter-spacing:0.4em; font-size:${px(13 * scale)}; color:${c.accent}; margin-bottom:18px;">${esc(flyer.eyebrow)}</div>` : ''}
      <div style="font-family:${font.heading}; font-size:${px(46 * scale)}; line-height:1.12; font-weight:600;">${esc(event.title || 'Untitled event')}</div>
      ${flyer.tagline ? `<div style="font-style:italic; font-size:${px(17 * scale)}; margin-top:14px; color:${tint(c.ink, 0.82)};">${esc(flyer.tagline)}</div>` : ''}
      ${img}
      ${meta}
      ${flyer.note ? `<div style="margin-top:16px; font-style:italic; font-size:${px(13.5 * scale)}; color:${tint(c.ink, 0.75)};">${esc(flyer.note)}</div>` : ''}
    </div>
  </div>`;
}

function renderModern({ event, flyer, colors, font, scale, imageUrl, hostLine, hideEventMeta }) {
  const c = colors;
  const w = whenParts(event);
  const onAccent = contrastOn(c.accent);
  const img = imageUrl
    ? `<img src="${esc(imageUrl)}" alt="" style="display:block; width:100%; height:${px(250 * scale)}; object-fit:cover;">`
    : '';
  const row = (label, main, sub) => `
    <div style="border-left:4px solid ${c.accent2}; padding:6px 0 6px 16px; margin:14px 0;">
      <div style="font-size:${px(11.5 * scale)}; text-transform:uppercase; letter-spacing:0.14em; color:${tint(c.ink, 0.65)};">${esc(label)}</div>
      <div style="font-size:${px(17 * scale)}; font-weight:700; margin-top:2px;">${esc(main)}</div>
      ${sub ? `<div style="font-size:${px(14 * scale)}; color:${tint(c.ink, 0.8)};">${esc(sub)}</div>` : ''}
    </div>`;
  const meta = hideEventMeta ? '' : `
      <div style="margin-top:10px;">
        ${row('When', w.date, [w.time, w.tz ? `(${w.tz})` : ''].filter(Boolean).join(' '))}
        ${event.venue_name || event.venue_address ? row('Where', event.venue_name || '', event.venue_address || '') : ''}
        ${hostLine ? row('Hosted by', hostLine.replace(/^Hosted by\s+/i, ''), '') : ''}
      </div>`;
  return `
  <div style="background:${c.bg}; color:${c.ink}; font-family:${font.body};">
    <div style="background:${c.accent}; color:${onAccent}; padding:14px 30px;">
      <span style="font-size:${px(13 * scale)}; font-weight:700; text-transform:uppercase; letter-spacing:0.22em;">${esc(flyer.eyebrow || ' ')}</span>
    </div>
    ${img}
    <div style="padding:${px(34 * scale)} 30px ${px(38 * scale)};">
      <div style="font-family:${font.heading}; font-size:${px(52 * scale)}; line-height:1.02; font-weight:800; text-transform:uppercase; letter-spacing:-0.01em;">${esc(event.title || 'Untitled event')}</div>
      <div style="width:64px; height:6px; background:${c.accent2}; margin:18px 0 6px;"></div>
      ${flyer.tagline ? `<div style="font-size:${px(17 * scale)}; margin-top:12px; color:${tint(c.ink, 0.85)};">${esc(flyer.tagline)}</div>` : ''}
      ${meta}
      ${flyer.note ? `<div style="display:inline-block; background:${tint(c.accent2, 0.14)}; color:${c.ink}; border-radius:6px; padding:9px 14px; font-size:${px(13.5 * scale)}; margin-top:10px;">${esc(flyer.note)}</div>` : ''}
    </div>
  </div>`;
}

function renderFestive({ event, flyer, colors, font, scale, imageUrl, hostLine, hideEventMeta }) {
  const c = colors;
  const w = whenParts(event);
  const dark = isDark(c.bg);
  const cardBg = dark ? 'rgba(12, 12, 16, 0.82)' : 'rgba(255, 255, 255, 0.92)';
  const onAccent = contrastOn(c.accent);
  const confetti = `background-color:${c.bg}; background-image:
    radial-gradient(${tint(c.accent, 0.55)} 3px, transparent 3.5px),
    radial-gradient(${tint(c.accent2, 0.5)} 2.5px, transparent 3px),
    radial-gradient(${tint(c.accent, 0.3)} 2px, transparent 2.5px);
    background-size: 110px 110px, 74px 74px, 52px 52px;
    background-position: 0 0, 28px 40px, 15px 10px;`;
  const img = imageUrl
    ? `<div style="margin:22px auto 0; width:${px(190 * scale)}; height:${px(190 * scale)};">
         <img src="${esc(imageUrl)}" alt="" style="width:100%; height:100%; object-fit:cover; border-radius:50%;
           border:6px solid ${c.accent2}; display:block;">
       </div>`
    : '';
  const chip = (emoji, text) => text ? `
    <div style="display:inline-block; background:${tint(c.accent, 0.12)}; border:1.5px solid ${tint(c.accent, 0.4)};
      border-radius:999px; padding:8px 18px; margin:5px 4px; font-size:${px(14.5 * scale)}; font-weight:600;">
      ${emoji} ${esc(text)}</div>` : '';
  const meta = hideEventMeta ? '' : `
      <div style="margin-top:22px;">
        ${chip('&#128197;', w.date)}
        ${chip('&#128337;', [w.time, w.tz ? `(${w.tz})` : ''].filter(Boolean).join(' '))}
        ${chip('&#128205;', [event.venue_name, event.venue_address].filter(Boolean).join(' · '))}
      </div>
      ${hostLine ? `<div style="margin-top:18px; font-size:${px(14 * scale)}; font-weight:700; color:${c.accent2};">${esc(hostLine)}</div>` : ''}`;
  return `
  <div style="${confetti} padding:26px; font-family:${font.body}; color:${c.ink};">
    <div style="background:${cardBg}; border-radius:26px; padding:${px(36 * scale)} 26px; text-align:center;">
      ${flyer.eyebrow ? `<div style="display:inline-block; background:${c.accent}; color:${onAccent}; border-radius:999px;
        padding:9px 22px; font-size:${px(14 * scale)}; font-weight:800; letter-spacing:0.06em; text-transform:uppercase;
        transform:rotate(-2.5deg);">&#127881; ${esc(flyer.eyebrow)}</div>` : ''}
      <div style="font-family:${font.heading}; font-size:${px(46 * scale)}; line-height:1.1; font-weight:800; margin-top:20px;">${esc(event.title || 'Untitled event')}</div>
      ${flyer.tagline ? `<div style="font-size:${px(16.5 * scale)}; margin-top:10px; color:${tint(c.ink, 0.85)};">${esc(flyer.tagline)}</div>` : ''}
      ${img}
      ${meta}
      ${flyer.note ? `<div style="margin-top:10px; font-size:${px(13.5 * scale)}; color:${tint(c.ink, 0.75)};">${esc(flyer.note)}</div>` : ''}
    </div>
  </div>`;
}

function renderMinimal({ event, flyer, colors, font, scale, imageUrl, hostLine, hideEventMeta }) {
  const c = colors;
  const w = whenParts(event);
  const hair = `1px solid ${tint(c.ink, 0.18)}`;
  const img = imageUrl
    ? `<img src="${esc(imageUrl)}" alt="" style="display:block; width:100%; aspect-ratio:16/9; object-fit:cover; margin:26px 0 4px;">`
    : '';
  const line = (label, value) => value ? `
    <div style="border-top:${hair}; padding:13px 0; display:flex;">
      <div style="width:110px; flex:none; font-size:${px(11 * scale)}; letter-spacing:0.18em; text-transform:uppercase; color:${tint(c.ink, 0.55)}; padding-top:3px;">${esc(label)}</div>
      <div style="font-size:${px(15.5 * scale)};">${esc(value)}</div>
    </div>` : '';
  const meta = hideEventMeta ? '' : `
    <div style="margin-top:30px;">
      ${line('Date', w.date)}
      ${line('Time', [w.time, w.tz ? `(${w.tz})` : ''].filter(Boolean).join(' '))}
      ${line('Venue', event.venue_name || '')}
      ${line('Address', event.venue_address || '')}
      ${hostLine ? line('Host', hostLine.replace(/^Hosted by\s+/i, '')) : ''}
    </div>`;
  return `
  <div style="background:${c.bg}; color:${c.ink}; font-family:${font.body}; padding:${px(52 * scale)} 40px;">
    ${flyer.eyebrow ? `<div style="font-size:${px(11.5 * scale)}; letter-spacing:0.32em; text-transform:uppercase; color:${c.accent}; margin-bottom:26px;">${esc(flyer.eyebrow)}</div>` : ''}
    <div style="font-family:${font.heading}; font-size:${px(42 * scale)}; line-height:1.15; font-weight:300;">${esc(event.title || 'Untitled event')}</div>
    ${flyer.tagline ? `<div style="font-size:${px(16 * scale)}; margin-top:14px; color:${tint(c.ink, 0.7)};">${esc(flyer.tagline)}</div>` : ''}
    ${img}
    ${meta}
    ${flyer.note ? `<div style="border-top:${hair}; margin-top:2px; padding-top:16px; font-size:${px(13 * scale)}; color:${tint(c.ink, 0.6)};">${esc(flyer.note)}</div>` : ''}
  </div>`;
}

const RENDERERS = { classic: renderClassic, modern: renderModern, festive: renderFestive, minimal: renderMinimal };

// hideEventMeta drops the date/time/venue/host block so the same styles power
// a broadcast "masthead" (title + eyebrow + tagline + image), which has no
// event fields to show.
export function renderFlyer({ event, flyer: rawFlyer, imageUrl = '', hideEventMeta = false }) {
  const flyer = normalizeFlyer(rawFlyer);
  const colors = flyerColors(flyer);
  const font = fontOf(flyer);
  const scale = scaleOf(flyer);
  const hostLine = !hideEventMeta && flyer.showHost && event.host_name ? `Hosted by ${event.host_name}` : '';
  const inner = RENDERERS[flyer.style]({ event, flyer, colors, font, scale, imageUrl, hostLine, hideEventMeta });
  return `<div style="max-width:640px; margin:0 auto; overflow:hidden; border-radius:12px;
    box-shadow:0 2px 8px rgba(10,10,15,0.12), 0 12px 40px rgba(10,10,15,0.12);">${inner}</div>`;
}

// Standalone document for the designer's live preview iframe.
export function renderFlyerDocument({ event, flyer, imageUrl, hideEventMeta = false }) {
  const colors = flyerColors(normalizeFlyer(flyer));
  const html = renderFlyer({ event, flyer, imageUrl, hideEventMeta });
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>body { margin:0; padding:22px 10px; background:${mixWithWhite(colors.ink, 0.07)}; color-scheme: light; }</style>
</head><body>${html}</body></html>`;
}

export function flyerPresets() {
  return {
    styles: STYLES,
    palettes: PALETTES,
    fonts: FONTS.map(({ id, label }) => ({ id, label })),
    scales: SCALES.map(({ id, label }) => ({ id, label })),
    defaults: DEFAULT_FLYER,
  };
}
