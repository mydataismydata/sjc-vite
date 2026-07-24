// The flyer engine. A flyer is described by a small JSON object (style, fonts,
// size scale, short text slots, optional featured images) and rendered to
// self-contained HTML with inline styles only. Each style is a self-contained
// patriotic template with its own fixed colours — there is no separate palette
// to pick. The same renderer backs the designer's live preview and the public
// event landing page, so what you design is exactly what guests see.
import { esc } from './html.js';
import { formatDate, formatTimeRange } from './format.js';

export const STYLES = [
  { id: 'blue', label: 'Blue', description: 'Navy field with a flag waving in from the top-right; tagline on a light-blue ribbon.' },
  { id: 'white', label: 'White', description: 'Cream between waving red stripes on top and a star-spangled flag below; navy ribbon.' },
  { id: 'red', label: 'Red', description: 'Bold red inside a starred white border, a small waving flag, tagline on a straight ribbon.' },
  { id: 'retro', label: 'Retro', description: 'Vintage navy, red and parchment stripes. All type — no photo needed.' },
  { id: 'landscape', label: 'Landscape', description: 'Wide, clean white with faint stars and cropped flags in opposite corners.' },
];

// Each style carries its own fixed colours. `accent` is what the invitation
// email header and the public page furniture use; the rest are template-specific.
const THEMES = {
  blue: { bg: '#0e1f44', ink: '#ffffff', accent: '#142a56', accent2: '#c02c39', red: '#c02c39', ribbon: '#5f8fd6', ribbonInk: '#ffffff', ribbonDark: '#3f6cb0' },
  white: { bg: '#f7f2e6', ink: '#17274e', accent: '#17274e', accent2: '#b0202f', red: '#c02c34', navy: '#17274e', ribbon: '#17274e', ribbonInk: '#ffffff', ribbonDark: '#0f1c39' },
  red: { bg: '#bb392c', ink: '#ffffff', accent: '#bb392c', accent2: '#16264c', red: '#bb392c', navy: '#16264c', ribbon: '#16264c', ribbonInk: '#ffffff' },
  retro: { bg: '#1e3a5f', ink: '#ece3cb', accent: '#1e3a5f', accent2: '#c0432f', red: '#c0432f', navy: '#1e3a5f', parchment: '#ddd2b4' },
  landscape: { bg: '#ffffff', ink: '#17274e', accent: '#17274e', accent2: '#b0202f', red: '#b0202f', navy: '#17274e' },
};

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
  style: 'blue',
  font: 'sans',
  scale: 'm',
  eyebrow: "You're invited",
  tagline: '',
  note: '',
  showHost: true,
  imageColumns: 1, // 1–3: how many featured images / columns to show
  imageTokens: [], // up to 3 upload tokens, one per column
  imageCaptions: [], // parallel to imageTokens (e.g. speaker names)
  imageToken: '', // legacy mirror of imageTokens[0]
  imageCaption: '', // legacy mirror of imageCaptions[0]
};

export function normalizeFlyer(raw) {
  const f = { ...DEFAULT_FLYER, ...(raw && typeof raw === 'object' ? raw : {}) };
  if (!STYLES.some((s) => s.id === f.style)) f.style = 'blue';
  if (!FONTS.some((s) => s.id === f.font)) f.font = 'sans';
  if (!SCALES.some((s) => s.id === f.scale)) f.scale = 'm';
  // Colours are fixed per style now — drop any legacy palette selection so it
  // doesn't linger in stored JSON.
  delete f.paletteId;
  delete f.colors;
  f.eyebrow = String(f.eyebrow ?? '').slice(0, 60);
  f.tagline = String(f.tagline ?? '').slice(0, 140);
  f.note = String(f.note ?? '').slice(0, 200);
  f.showHost = Boolean(f.showHost);
  // Featured images: up to three, shown in 1/2/3 centred columns. Fold a legacy
  // single imageToken/imageCaption into the arrays, and keep imageToken /
  // imageCaption populated (mirroring the first image) for any older reader.
  const validToken = (t) => (/^[A-Za-z0-9]{6,64}$/.test(String(t || '')) ? String(t) : '');
  let tokens = Array.isArray(f.imageTokens) ? f.imageTokens : [];
  let caps = Array.isArray(f.imageCaptions) ? f.imageCaptions : [];
  if (!tokens.length && f.imageToken) { tokens = [f.imageToken]; caps = caps.length ? caps : [f.imageCaption]; }
  f.imageTokens = tokens.slice(0, 3).map(validToken);
  f.imageCaptions = f.imageTokens.map((_, i) => String(caps[i] ?? '').slice(0, 160));
  let cols = parseInt(f.imageColumns, 10);
  if (!(cols >= 1 && cols <= 3)) cols = 1;
  f.imageColumns = Math.min(3, Math.max(cols, f.imageTokens.filter(Boolean).length || 1));
  f.imageToken = f.imageTokens[0] || '';
  f.imageCaption = f.imageCaptions[0] || '';
  return f;
}

export function flyerColors(flyer) {
  return THEMES[flyer && flyer.style] || THEMES.blue;
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

// --- rendering helpers ------------------------------------------------------

function fontOf(flyer) {
  return FONTS.find((f) => f.id === flyer.font) || FONTS[1];
}

function scaleOf(flyer) {
  return (SCALES.find((s) => s.id === flyer.scale) || SCALES[1]).f;
}

function whenParts(event) {
  return {
    date: formatDate(event.date) || '',
    time: formatTimeRange(event.start_time, event.end_time),
  };
}

function px(n) {
  return `${Math.round(n)}px`;
}

// Optional caption rendered directly under a featured image.
function captionHtml(text, colors, scale, color) {
  if (!text) return '';
  return `<div style="font-size:${px(12.5 * scale)}; line-height:1.4; color:${color || tint(colors.ink, 0.7)};
    margin-top:7px; text-align:center; font-style:italic;">${esc(text)}</div>`;
}

// Render 1–3 featured images as a centred row of columns. `cell(url, n)` returns
// the framed <img> for one image in a row of n; captions sit under each.
function featuredImages(images, colors, scale, cell, { marginTop = 24, captionColor } = {}) {
  const n = images.length;
  if (!n) return '';
  const cols = images.map(({ url, caption }) => `
    <div style="text-align:center;">${cell(url, n)}${captionHtml(caption, colors, scale, captionColor)}</div>`).join('');
  return `<div style="display:flex; flex-wrap:wrap; gap:${px(16 * scale)}; justify-content:center;
    align-items:flex-start; margin:${px(marginTop)} auto 4px;">${cols}</div>`;
}

// Points along a horizontal wavy edge y = baseY + amp·sin(x·k + phase), x in
// [0,w] (or w→0 when reverse). The phase is absolute in x, so two edges at
// different baseY stay parallel — giving constant-thickness wavy stripes.
function wavyEdge(baseY, w, { amp = 8, period = 150, phase = 0, steps = 30 } = {}, reverse = false) {
  let out = '';
  for (let i = 0; i <= steps; i++) {
    const idx = reverse ? steps - i : i;
    const x = (w * idx) / steps;
    const y = baseY + amp * Math.sin((x / period) * 2 * Math.PI + phase);
    out += `L${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return out.trim();
}

// A rectangular "waving flag" of horizontal stripes with rippling edges,
// optionally with a star canton in the upper-left. Returns an <svg> the caller
// positions via `style`. Setting `white` to the page colour yields bare red
// waving stripes on that background.
function wavyStripeFlag({ vw = 320, vh = 160, stripes = 7, red = '#c02c39', white = '#ffffff',
  amp = 8, period = 150, phase = 0, canton = false, cantonColor = '#17274e', id = 'wf', style = '', stretch = false }) {
  const sh = vh / stripes;
  let bands = '';
  for (let i = 0; i < stripes; i++) {
    const y0 = i * sh;
    const y1 = (i + 1) * sh;
    const startY = (y0 + amp * Math.sin(phase)).toFixed(1);
    const top = wavyEdge(y0, vw, { amp, period, phase });
    const bot = wavyEdge(y1, vw, { amp, period, phase }, true);
    bands += `<path d="M0 ${startY} ${top} ${bot} Z" fill="${i % 2 ? white : red}"/>`;
  }
  let cant = '';
  let starPat = '';
  if (canton) {
    const cw = +(vw * 0.42).toFixed(1);
    const ch = +(sh * Math.max(3, Math.round(stripes * 0.55))).toFixed(1);
    const top0 = (amp * Math.sin(phase)).toFixed(1);
    const topEdge = wavyEdge(0, cw, { amp, period, phase });
    const botEdge = wavyEdge(ch, cw, { amp, period, phase }, true);
    starPat = `<pattern id="${id}st" width="${(vw * 0.09).toFixed(1)}" height="${(sh * 0.95).toFixed(1)}" patternUnits="userSpaceOnUse">
      <text x="1" y="${(sh * 0.72).toFixed(1)}" font-size="${(sh * 0.55).toFixed(1)}" fill="#ffffff">&#9733;</text></pattern>`;
    cant = `<clipPath id="${id}cc"><path d="M0 ${top0} ${topEdge} L${cw} ${(ch + Number(top0)).toFixed(1)} ${botEdge} Z"/></clipPath>
      <g clip-path="url(#${id}cc)">
        <rect x="-2" y="-2" width="${cw + 4}" height="${(ch + amp + 4).toFixed(1)}" fill="${cantonColor}"/>
        <rect x="-2" y="-2" width="${cw + 4}" height="${(ch + amp + 4).toFixed(1)}" fill="url(#${id}st)"/>
      </g>`;
  }
  return `<svg viewBox="0 0 ${vw} ${vh}" preserveAspectRatio="${stretch ? 'none' : 'xMidYMid meet'}" xmlns="http://www.w3.org/2000/svg" style="${style}"><defs>${starPat}</defs>${bands}${cant}</svg>`;
}

function starRow(count, { size, color, gap = 0.4 }) {
  let s = '';
  for (let i = 0; i < count; i++) s += '&#9733;';
  return `<span style="color:${color}; font-size:${px(size)}; letter-spacing:${px(size * gap)};">${s}</span>`;
}

// A centred banner for the tagline. `folded` has 3-D end tails tucking behind
// the face; `straight` is a flat bar with flag-notched ends.
function foldedRibbon(text, { bandColor, ink, dark, scale, font }) {
  if (!text) return '';
  const h = 38 * scale;
  const tw = 22 * scale;
  const drop = 10 * scale;
  const tail = (side) => `<span style="position:absolute; top:${px(drop)}; ${side}:${px(-tw + 4)};
    width:${px(tw)}; height:${px(h)}; background:${dark}; z-index:1;
    clip-path:polygon(${side === 'left' ? '0 0, 100% 0, 100% 100%, 0 100%, 24% 50%' : '0 0, 100% 0, 76% 50%, 100% 100%, 0 100%'});"></span>`;
  const band = `<span style="position:relative; z-index:2; display:inline-block; background:${bandColor}; color:${ink};
    font-family:${font.heading}; font-weight:800; font-size:${px(14.5 * scale)}; letter-spacing:0.08em;
    text-transform:uppercase; white-space:nowrap; padding:${px(9 * scale)} ${px(26 * scale)};">${esc(text)}</span>`;
  return `<span style="position:relative; display:inline-block; margin-top:${px(20 * scale)};">${tail('left')}${tail('right')}${band}</span>`;
}

function straightRibbon(text, { bandColor, ink, scale, font }) {
  if (!text) return '';
  const notch = px(14 * scale);
  return `<span style="display:inline-block; margin-top:${px(20 * scale)}; background:${bandColor}; color:${ink};
    font-family:${font.heading}; font-weight:800; font-size:${px(15 * scale)}; letter-spacing:0.08em;
    text-transform:uppercase; white-space:nowrap; padding:${px(10 * scale)} ${px(34 * scale)};
    clip-path:polygon(0 0, 100% 0, calc(100% - ${notch}) 50%, 100% 100%, 0 100%, ${notch} 50%);">${esc(text)}</span>`;
}

// Shared centred date/time/venue/host block used by the white, red and
// landscape templates. `ink` is the main colour, `sub` the muted one.
function metaStacked({ event, hostLine, scale, ink, sub }) {
  const w = whenParts(event);
  const parts = [];
  if (w.date) parts.push(`<div style="font-size:${px(16 * scale)}; font-weight:800; color:${ink};">${esc(w.date)}</div>`);
  if (w.time) parts.push(`<div style="font-size:${px(14 * scale)}; margin-top:3px; color:${sub};">${esc(w.time)}</div>`);
  if (event.venue_name) parts.push(`<div style="font-size:${px(14.5 * scale)}; margin-top:10px; font-weight:700; color:${ink};">${esc(event.venue_name)}</div>`);
  if (event.venue_address) parts.push(`<div style="font-size:${px(13 * scale)}; margin-top:2px; color:${sub};">${esc(event.venue_address)}</div>`);
  if (hostLine) parts.push(`<div style="font-size:${px(11.5 * scale)}; margin-top:14px; text-transform:uppercase; letter-spacing:0.16em; color:${sub};">${esc(hostLine)}</div>`);
  if (!parts.length) return '';
  return `<div style="margin-top:${px(22 * scale)};">${parts.join('')}</div>`;
}

function imageCell(colors, scale, border, single, multi) {
  return (url, n) => {
    const wd = { 1: single, 2: Math.round(single * 0.66), 3: Math.round(single * 0.5) };
    const h = n === 1 ? single * 0.56 : single * 0.5;
    return `<img src="${esc(url)}" alt="" style="display:block; width:${px(wd[n] * scale)}; max-width:100%;
      height:${px(h * scale)}; object-fit:cover; border-radius:8px; border:3px solid ${border};">`;
  };
}

// --- templates -------------------------------------------------------------

function renderBlue({ event, flyer, colors, font, scale, images, hostLine, hideEventMeta }) {
  const c = colors;
  const w = whenParts(event);
  // A waving striped band sweeping across the very top, denser toward the
  // top-right, most of it bleeding off the top edge.
  const flag = wavyStripeFlag({
    vw: 400, vh: 150, stripes: 6, red: c.red, white: '#ffffff', amp: 13, period: 175, phase: 0.6, id: 'blf', stretch: true,
    style: 'position:absolute; top:-86px; left:-6%; width:112%; height:150px; transform:rotate(-3deg); z-index:0;',
  });
  const img = featuredImages(images, c, scale, imageCell(c, scale, '#ffffff', 320), { marginTop: 22, captionColor: 'rgba(255,255,255,0.78)' });
  const meta = hideEventMeta ? '' : `
    <div style="margin-top:${px(30 * scale)}; display:flex; justify-content:center; align-items:center; gap:${px(20 * scale)};">
      ${w.date ? `<div style="font-size:${px(16 * scale)}; font-weight:700; letter-spacing:0.03em;">${esc(w.date)}</div>` : ''}
      ${w.date && w.time ? `<div style="width:1px; height:${px(24 * scale)}; background:rgba(255,255,255,0.5);"></div>` : ''}
      ${w.time ? `<div style="font-size:${px(16 * scale)}; font-weight:700;">${esc(w.time)}</div>` : ''}
    </div>
    ${w.date || w.time ? `<div style="height:3px; width:58%; background:${c.red}; margin:${px(14 * scale)} auto 0; border-radius:2px;"></div>` : ''}
    ${event.venue_name || event.venue_address ? `<div style="font-size:${px(14.5 * scale)}; margin-top:${px(14 * scale)}; letter-spacing:0.03em;">${esc([event.venue_name, event.venue_address].filter(Boolean).join(', '))}</div>` : ''}
    ${hostLine ? `<div style="font-size:${px(11.5 * scale)}; margin-top:${px(12 * scale)}; text-transform:uppercase; letter-spacing:0.16em; color:rgba(255,255,255,0.75);">${esc(hostLine)}</div>` : ''}`;
  const inner = `
    <div style="position:relative; overflow:hidden; background:${c.bg}; color:${c.ink};
         font-family:${font.body}; padding:${px(88 * scale)} ${px(34 * scale)} ${px(30 * scale)};">
      ${flag}
      <div style="position:relative; z-index:1; text-align:center;">
        ${flyer.eyebrow ? `<div style="color:${c.red}; font-family:${font.heading}; font-weight:800;
          font-size:${px(26 * scale)}; letter-spacing:0.04em; text-transform:uppercase;">${esc(flyer.eyebrow)}</div>` : ''}
        <div style="font-family:${font.heading}; font-weight:800; font-size:${px(54 * scale)}; line-height:1.02;
          text-transform:uppercase; margin-top:${px(6 * scale)};">${esc(event.title || 'Untitled event')}</div>
        ${foldedRibbon(flyer.tagline, { bandColor: c.ribbon, ink: c.ribbonInk, dark: c.ribbonDark, scale, font })}
        ${img}
        ${meta}
        ${flyer.note ? `<div style="margin-top:${px(16 * scale)}; font-size:${px(13 * scale)}; color:rgba(255,255,255,0.8);">${esc(flyer.note)}</div>` : ''}
      </div>
    </div>`;
  return `<div style="background:#ffffff; padding:9px;">
    ${inner}
    <div style="height:13px; background:${c.red}; margin-top:9px; border-radius:2px;"></div>
  </div>`;
}

function renderWhite({ event, flyer, colors, font, scale, images, hostLine, hideEventMeta }) {
  const c = colors;
  const topStripes = wavyStripeFlag({
    vw: 360, vh: 70, stripes: 4, red: c.red, white: c.bg, amp: 7, period: 150, phase: 0, id: 'wht',
    style: 'position:absolute; top:-10px; left:-12px; width:106%; z-index:0;',
  });
  const bottomFlag = wavyStripeFlag({
    vw: 300, vh: 150, stripes: 7, red: c.red, white: '#ffffff', amp: 9, period: 150, phase: 0.4,
    canton: true, cantonColor: c.navy, id: 'whb',
    style: 'position:absolute; bottom:-64px; left:-26px; width:56%; transform:rotate(3deg); z-index:0;',
  });
  const starDivider = `<div style="margin-top:${px(14 * scale)}; display:flex; align-items:center; justify-content:center; gap:${px(12 * scale)};">
    <div style="height:1.5px; width:${px(56 * scale)}; background:${tint(c.red, 0.6)};"></div>
    <span style="color:${c.red}; font-size:${px(15 * scale)};">&#9733;</span>
    <div style="height:1.5px; width:${px(56 * scale)}; background:${tint(c.red, 0.6)};"></div></div>`;
  const img = featuredImages(images, c, scale, imageCell(c, scale, c.navy, 300), { marginTop: 20 });
  const meta = hideEventMeta ? '' : metaStacked({ event, hostLine, scale, ink: c.navy, sub: tint(c.navy, 0.7) });
  return `
    <div style="position:relative; overflow:hidden; background:${c.bg}; color:${c.navy};
         font-family:${font.body}; padding:${px(70 * scale)} ${px(36 * scale)} ${px(124 * scale)}; text-align:center;">
      ${topStripes}${bottomFlag}
      <div style="position:relative; z-index:1;">
        ${flyer.eyebrow ? `<div style="font-family:${font.heading}; font-weight:800; font-size:${px(30 * scale)};
          text-transform:uppercase; letter-spacing:0.02em;">${esc(flyer.eyebrow)}</div>` : ''}
        <div style="font-family:${font.heading}; font-weight:800; font-size:${px(48 * scale)}; line-height:1.02;
          text-transform:uppercase; color:${c.red}; margin-top:${px(6 * scale)};">${esc(event.title || 'Untitled event')}</div>
        ${foldedRibbon(flyer.tagline, { bandColor: c.ribbon, ink: c.ribbonInk, dark: c.ribbonDark, scale, font })}
        ${img}
        ${flyer.note ? `<div style="margin-top:${px(18 * scale)}; font-family:${font.heading}; font-weight:800;
          font-size:${px(15 * scale)}; letter-spacing:0.04em; text-transform:uppercase; color:${c.navy};">${esc(flyer.note)}</div>${starDivider}` : ''}
        ${meta}
      </div>
    </div>`;
}

function renderRed({ event, flyer, colors, font, scale, images, hostLine, hideEventMeta }) {
  const c = colors;
  const flag = wavyStripeFlag({
    vw: 150, vh: 96, stripes: 7, red: c.red, white: '#ffffff', amp: 4, period: 90, phase: 0.3,
    canton: true, cantonColor: c.navy, id: 'rdf',
    style: 'display:block; width:118px; margin:0 auto;',
  });
  const corner = (pos) => `<span style="position:absolute; ${pos} color:#ffffff; background:${c.bg}; font-size:22px; line-height:1; padding:0 2px;">&#9733;</span>`;
  const eyebrow = flyer.eyebrow ? `<div style="display:flex; align-items:center; justify-content:center; gap:${px(12 * scale)};
      color:#fff; font-family:${font.heading}; font-weight:700; font-size:${px(17 * scale)};
      letter-spacing:0.14em; text-transform:uppercase; margin-top:${px(18 * scale)};">
      <span style="font-size:${px(12 * scale)};">&#9733;</span>${esc(flyer.eyebrow)}<span style="font-size:${px(12 * scale)};">&#9733;</span></div>` : '';
  const img = featuredImages(images, c, scale, imageCell(c, scale, '#ffffff', 300), { marginTop: 18 });
  const rule = `<div style="height:2px; width:70%; background:rgba(255,255,255,0.85); margin:${px(20 * scale)} auto;"></div>`;
  const meta = hideEventMeta ? '' : metaStacked({ event, hostLine, scale, ink: '#ffffff', sub: 'rgba(255,255,255,0.82)' });
  return `
    <div style="background:${c.bg}; padding:16px;">
      <div style="position:relative; border:2px dashed rgba(255,255,255,0.9); padding:${px(30 * scale)} ${px(26 * scale)} ${px(34 * scale)}; text-align:center;">
        ${corner('top:-11px; left:-11px;')}${corner('top:-11px; right:-11px;')}
        ${corner('bottom:-11px; left:-11px;')}${corner('bottom:-11px; right:-11px;')}
        ${flag}
        ${eyebrow}
        <div style="font-family:${font.heading}; font-weight:800; color:#ffffff; font-size:${px(50 * scale)};
          line-height:1.03; text-transform:uppercase; margin-top:${px(10 * scale)};">${esc(event.title || 'Untitled event')}</div>
        ${straightRibbon(flyer.tagline, { bandColor: c.ribbon, ink: c.ribbonInk, scale, font })}
        ${img}
        ${flyer.note ? `${rule}<div style="color:#fff; font-family:${font.heading}; font-weight:800; font-size:${px(17 * scale)};
          letter-spacing:0.03em; text-transform:uppercase; line-height:1.3;">${esc(flyer.note)}</div>` : ''}
        ${meta ? `${rule}${meta}` : (flyer.note ? rule : '')}
      </div>
    </div>`;
}

function renderRetro({ event, flyer, colors, font, scale, images, hostLine, hideEventMeta }) {
  const c = colors;
  const w = whenParts(event);
  const hasImg = images.length > 0;
  const presents = hostLine ? `<div style="font-family:${font.heading}; font-weight:700; font-size:${px(13 * scale)};
    letter-spacing:0.22em; text-transform:uppercase; color:${c.parchment};">${esc(hostLine)}</div>` : '';
  const eyebrow = flyer.eyebrow ? `<div style="display:flex; align-items:center; justify-content:center; gap:${px(14 * scale)}; margin-top:${px(16 * scale)};">
    ${starRow(3, { size: 15 * scale, color: c.red, gap: 0.22 })}
    <span style="font-family:${font.heading}; font-weight:800; font-size:${px(18 * scale)}; letter-spacing:0.08em;
      text-transform:uppercase; color:${c.red};">${esc(flyer.eyebrow)}</span>
    ${starRow(3, { size: 15 * scale, color: c.red, gap: 0.22 })}</div>` : '';
  const img = hasImg ? featuredImages(images, c, scale, imageCell(c, scale, c.parchment, 300), { marginTop: 18, captionColor: tint(c.parchment, 0.9) }) : '';
  const topArea = `
    <div style="background:${c.navy}; color:${c.parchment}; text-align:center;
         padding:${px((hasImg ? 30 : 34) * scale)} ${px(30 * scale)} ${px((hasImg ? 28 : 38) * scale)};">
      ${presents}
      ${img}
      ${eyebrow}
      <div style="font-family:${font.heading}; font-weight:800; font-size:${px(72 * scale)}; line-height:0.98;
        text-transform:uppercase; margin-top:${px(8 * scale)}; color:${c.parchment};">${esc(event.title || 'Untitled event')}</div>
    </div>`;
  const stars5 = `<div>${[13, 17, 22, 17, 13].map((s) => `<span style="color:${c.navy}; font-size:${px(s * scale)}; margin:0 ${px(4 * scale)};">&#9733;</span>`).join('')}</div>`;
  // Stripes alternate red (parchment text) / parchment (navy text) down the page.
  const stripes = [];
  if (flyer.tagline) stripes.push({ tone: 'red', html: `<div style="font-family:${font.body}; font-size:${px(18 * scale)}; line-height:1.35; color:${c.parchment};">${esc(flyer.tagline)}</div>` });
  if (!hasImg) stripes.push({ tone: 'parch', html: stars5 });
  if (flyer.note) stripes.push({ tone: 'red', html: `<div style="font-family:${font.body}; font-size:${px(15 * scale)}; color:${c.parchment}; line-height:1.3;">${esc(flyer.note)}</div>` });
  if (!hideEventMeta) {
    const bits = [w.date, w.time, event.venue_name].filter(Boolean);
    if (bits.length) {
      const line = bits.map((b, i) => `<span style="color:${i % 2 ? c.red : c.navy};">${esc(b)}</span>`).join(`<span style="color:${c.navy}; font-weight:800;"> // </span>`);
      stripes.push({ tone: 'parch', html: `<div style="font-family:${font.heading}; font-weight:800; font-size:${px(15 * scale)}; letter-spacing:0.02em; text-transform:uppercase;">${line}</div>` });
    }
  }
  const stripeHtml = stripes.map((s) => `<div style="background:${s.tone === 'red' ? c.red : c.parchment}; text-align:center;
    padding:${px(18 * scale)} ${px(30 * scale)};">${s.html}</div>`).join('');
  return `<div style="font-family:${font.body};">${topArea}${stripeHtml}</div>`;
}

function renderLandscape({ event, flyer, colors, font, scale, images, hostLine, hideEventMeta }) {
  const c = colors;
  const w = whenParts(event);
  const starField = (id, style) => `<svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg" style="${style}">
    <defs><pattern id="${id}" width="16" height="14" patternUnits="userSpaceOnUse">
      <text x="2" y="11" font-size="9" fill="#c9cede">&#9733;</text></pattern></defs>
    <rect width="120" height="80" fill="url(#${id})"/></svg>`;
  const flagTR = wavyStripeFlag({
    vw: 200, vh: 150, stripes: 7, red: c.red, white: '#ffffff', amp: 8, period: 130, phase: 0.5,
    canton: true, cantonColor: c.navy, id: 'lstr',
    style: 'position:absolute; top:-40px; right:-40px; width:27%; transform:rotate(12deg); z-index:0;',
  });
  const flagBL = wavyStripeFlag({
    vw: 200, vh: 150, stripes: 7, red: c.red, white: '#ffffff', amp: 8, period: 130, phase: 0.9,
    canton: true, cantonColor: c.navy, id: 'lsbl',
    style: 'position:absolute; bottom:-40px; left:-40px; width:27%; transform:rotate(12deg); z-index:0;',
  });
  const img = featuredImages(images, c, scale, imageCell(c, scale, c.navy, 220), { marginTop: 16 });
  const tagline = flyer.tagline ? `<div style="display:flex; align-items:center; justify-content:center; gap:${px(14 * scale)}; margin-top:${px(12 * scale)};">
    <div style="height:2px; width:${px(44 * scale)}; background:${c.red};"></div>
    <span style="font-family:${font.heading}; font-weight:800; font-size:${px(18 * scale)}; letter-spacing:0.2em; color:${c.navy};">${esc(flyer.tagline)}</span>
    <div style="height:2px; width:${px(44 * scale)}; background:${c.red};"></div></div>` : '';
  const metaBits = hideEventMeta ? '' : [w.date, w.time, event.venue_name].filter(Boolean).join(' · ');
  const meta = hideEventMeta ? '' : `
    ${metaBits ? `<div style="margin-top:${px(12 * scale)}; font-size:${px(13.5 * scale)}; color:${tint(c.navy, 0.8)};">${esc(metaBits)}</div>` : ''}
    ${hostLine ? `<div style="margin-top:${px(6 * scale)}; font-size:${px(11 * scale)}; text-transform:uppercase; letter-spacing:0.16em; color:${tint(c.navy, 0.7)};">${esc(hostLine)}</div>` : ''}`;
  return `
    <div style="position:relative; overflow:hidden; background:${c.bg}; color:${c.navy};
         font-family:${font.body}; padding:${px(42 * scale)} ${px(64 * scale)}; text-align:center;">
      ${starField('lsftl', 'position:absolute; top:8px; left:8px; width:24%; z-index:0;')}
      ${starField('lsfbr', 'position:absolute; bottom:8px; right:8px; width:24%; z-index:0;')}
      ${flagTR}${flagBL}
      <div style="position:relative; z-index:1;">
        <div style="margin-bottom:${px(6 * scale)};">${starRow(1, { size: 13 * scale, color: c.red })} ${starRow(1, { size: 15 * scale, color: c.navy })} ${starRow(1, { size: 13 * scale, color: c.red })}</div>
        ${flyer.eyebrow ? `<div style="font-family:${font.heading}; font-weight:700; font-size:${px(22 * scale)}; letter-spacing:0.35em; text-transform:uppercase; color:${c.navy};">${esc(flyer.eyebrow)}</div>` : ''}
        <div style="font-family:${font.heading}; font-weight:800; font-size:${px(50 * scale)}; line-height:1.02; text-transform:uppercase; margin-top:${px(6 * scale)}; color:${c.navy};">${esc(event.title || 'Untitled event')}</div>
        ${tagline}
        ${img}
        ${meta}
      </div>
    </div>`;
}

const RENDERERS = { blue: renderBlue, white: renderWhite, red: renderRed, retro: renderRetro, landscape: renderLandscape };

// hideEventMeta drops the date/time/venue/host block so the same styles power
// a broadcast "masthead" (title + eyebrow + tagline + image), which has no
// event fields to show.
export function renderFlyer({ event, flyer: rawFlyer, imageUrl = '', imageUrls = null, hideEventMeta = false }) {
  const flyer = normalizeFlyer(rawFlyer);
  const colors = flyerColors(flyer);
  const font = fontOf(flyer);
  const scale = scaleOf(flyer);
  const hostLine = !hideEventMeta && flyer.showHost && event.host_name ? `Hosted by ${event.host_name}` : '';
  // Callers pass imageUrls aligned to flyer.imageTokens (or a single legacy
  // imageUrl). Drop empty slots and pair each surviving URL with its caption.
  const resolved = Array.isArray(imageUrls) ? imageUrls : (imageUrl ? [imageUrl] : []);
  const images = [];
  resolved.forEach((u, i) => { if (u) images.push({ url: String(u), caption: flyer.imageCaptions[i] || '' }); });
  const inner = (RENDERERS[flyer.style] || renderBlue)({ event, flyer, colors, font, scale, images, hostLine, hideEventMeta });
  return `<div style="max-width:640px; margin:0 auto; overflow:hidden; border-radius:12px;
    box-shadow:0 2px 8px rgba(10,10,15,0.12), 0 12px 40px rgba(10,10,15,0.12);">${inner}</div>`;
}

// Standalone document for the designer's live preview iframe.
export function renderFlyerDocument({ event, flyer, imageUrl, imageUrls, hideEventMeta = false }) {
  const colors = flyerColors(normalizeFlyer(flyer));
  const html = renderFlyer({ event, flyer, imageUrl, imageUrls, hideEventMeta });
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>body { margin:0; padding:22px 10px; background:${mixWithWhite(colors.ink, 0.07)}; color-scheme: light; }</style>
</head><body>${html}</body></html>`;
}

export function flyerPresets() {
  return {
    styles: STYLES,
    fonts: FONTS.map(({ id, label }) => ({ id, label })),
    scales: SCALES.map(({ id, label }) => ({ id, label })),
    defaults: DEFAULT_FLYER,
  };
}
