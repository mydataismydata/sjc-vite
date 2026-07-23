import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { Field, useToast } from '../ui.jsx';

let cachedPresets = null;

// The flyer designer: pick a style, adjust palette / fonts / sizes, add short
// text and an optional featured image. The preview iframe is rendered by the
// server with the exact same code that renders the public landing page.
export default function FlyerDesigner({ eventBasics, flyer, onChange, mode = 'event' }) {
  const [presets, setPresets] = useState(cachedPresets);
  const [srcdoc, setSrcdoc] = useState('');
  const [uploading, setUploading] = useState(false);
  const toast = useToast();
  const timer = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (cachedPresets) return;
    api.get('/api/flyer/presets').then((d) => { cachedPresets = d; setPresets(d); }).catch(() => {});
  }, []);

  // Debounced live preview.
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/flyer/preview', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-requested-with': 'sjc-vite' },
          credentials: 'same-origin',
          body: JSON.stringify({ event: eventBasics, flyer, mode }),
        });
        if (res.ok) setSrcdoc(await res.text());
      } catch { /* preview is best-effort */ }
    }, 350);
    return () => clearTimeout(timer.current);
  }, [JSON.stringify(eventBasics), JSON.stringify(flyer), mode]);

  function set(patch) {
    onChange({ ...flyer, ...patch });
  }

  async function uploadImage(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('Images must be 5 MB or smaller', 'bad'); return; }
    setUploading(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const up = await api.post('/api/uploads', { name: file.name, data: dataUrl });
      set({ imageToken: up.token });
      toast('Image added to the flyer');
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  if (!presets) return null;
  const isCustom = flyer.paletteId === 'custom';
  const activePalette = presets.palettes.find((p) => p.id === flyer.paletteId) || presets.palettes[0];
  const customColors = flyer.colors || {
    bg: activePalette.bg, ink: activePalette.ink,
    accent: activePalette.accent, accent2: activePalette.accent2,
  };

  return (
    <div className="designer">
      <div>
        <Field label="Style">
          <div className="style-grid">
            {presets.styles.map((s) => (
              <button key={s.id} type="button"
                className={`style-card ${flyer.style === s.id ? 'active' : ''}`}
                onClick={() => set({ style: s.id })}>
                <div className="s-name">{s.label}</div>
                <div className="s-desc">{s.description}</div>
              </button>
            ))}
          </div>
        </Field>

        <Field label="Color palette">
          <div className="swatch-row">
            {presets.palettes.map((p) => (
              <button key={p.id} type="button" title={p.label}
                className={`swatch ${flyer.paletteId === p.id ? 'active' : ''}`}
                style={{ background: `linear-gradient(135deg, ${p.bg} 0 45%, ${p.accent} 45% 75%, ${p.accent2} 75%)` }}
                onClick={() => set({ paletteId: p.id, colors: null })} />
            ))}
            <button type="button" title="Custom colors"
              className={`swatch ${isCustom ? 'active' : ''}`}
              style={{ background: 'conic-gradient(#f43f5e, #f59e0b, #22c55e, #3b82f6, #a855f7, #f43f5e)' }}
              onClick={() => set({ paletteId: 'custom', colors: customColors })} />
          </div>
          {isCustom ? (
            <div className="color-inputs" style={{ marginTop: 10 }}>
              {[['bg', 'Background'], ['ink', 'Text'], ['accent', 'Accent'], ['accent2', 'Accent 2']].map(([key, label]) => (
                <label key={key}>
                  <input type="color" value={customColors[key]}
                    onChange={(e) => set({ colors: { ...customColors, [key]: e.target.value } })} />
                  {label}
                </label>
              ))}
            </div>
          ) : null}
        </Field>

        <div className="field-row">
          <Field label="Fonts">
            <select value={flyer.font} onChange={(e) => set({ font: e.target.value })}>
              {presets.fonts.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </Field>
          <Field label="Title size">
            <select value={flyer.scale} onChange={(e) => set({ scale: e.target.value })}>
              {presets.scales.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Eyebrow line" hint="The short line above the title.">
          <input value={flyer.eyebrow} maxLength={60} placeholder="You're invited"
            onChange={(e) => set({ eyebrow: e.target.value })} />
        </Field>
        <Field label="Tagline" hint="One sentence under the title (optional).">
          <input value={flyer.tagline} maxLength={140} placeholder="Dinner, dancing, and good company"
            onChange={(e) => set({ tagline: e.target.value })} />
        </Field>
        <Field label="Footnote" hint="Small print at the bottom (optional).">
          <input value={flyer.note} maxLength={200} placeholder="Rain or shine · Free parking on 5th"
            onChange={(e) => set({ note: e.target.value })} />
        </Field>

        {mode === 'event' ? (
          <label className="checkbox">
            <input type="checkbox" checked={flyer.showHost}
              onChange={(e) => set({ showHost: e.target.checked })} />
            <span><span className="cb-label">Show host line</span>
              <div className="cb-sub">Displays “Hosted by {eventBasics.host_name || '…'}” on the flyer.</div></span>
          </label>
        ) : null}

        <Field label="Featured image" hint="Optional. JPEG/PNG/GIF/WebP up to 5 MB — each style frames it differently.">
          <div className="row">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp"
              style={{ display: 'none' }} onChange={(e) => uploadImage(e.target.files?.[0])} />
            <button type="button" className="btn" disabled={uploading}
              onClick={() => fileRef.current?.click()}>
              {uploading ? 'Uploading…' : flyer.imageToken ? 'Replace image' : 'Add image'}
            </button>
            {flyer.imageToken ? (
              <button type="button" className="btn btn-ghost" onClick={() => set({ imageToken: '' })}>
                Remove
              </button>
            ) : null}
          </div>
        </Field>
      </div>

      <div>
        <iframe className="preview-frame" title="Flyer preview" srcDoc={srcdoc} />
        <p className="small muted" style={{ textAlign: 'center', marginTop: 6 }}>
          {mode === 'broadcast'
            ? 'Live preview — the masthead at the top of the email and web version.'
            : 'Live preview — exactly what guests see on the event page.'}
        </p>
      </div>
    </div>
  );
}
