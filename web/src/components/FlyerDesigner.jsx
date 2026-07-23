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
  const [uploadingSlot, setUploadingSlot] = useState(-1);
  const toast = useToast();
  const timer = useRef(null);
  const fileRef = useRef(null);
  const pendingSlot = useRef(0);

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

  // Featured images live in parallel arrays (imageTokens / imageCaptions) with
  // imageColumns slots. imageToken / imageCaption mirror the first slot so older
  // readers still work. These helpers always write both the arrays and mirror.
  function writeImages(tokens, captions, columns) {
    set({
      imageColumns: columns,
      imageTokens: tokens,
      imageCaptions: captions,
      imageToken: tokens[0] || '',
      imageCaption: captions[0] || '',
    });
  }

  function pickImage(i) {
    pendingSlot.current = i;
    fileRef.current?.click();
  }

  async function uploadImage(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('Images must be 5 MB or smaller', 'bad'); return; }
    const slot = pendingSlot.current;
    setUploadingSlot(slot);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const up = await api.post('/api/uploads', { name: file.name, data: dataUrl });
      const cols = imageCols();
      const tokens = imageSlots(cols).map((t, i) => (i === slot ? up.token : t));
      writeImages(tokens, captionSlots(cols), cols);
      toast('Image added to the flyer');
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      setUploadingSlot(-1);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  // Read the current featured-image state as fixed-length arrays. Older flyers
  // stored a single imageToken/imageCaption — fold those into slot 0.
  function imageCols() {
    return Math.min(3, Math.max(1, Number(flyer.imageColumns) || 1));
  }
  function imageSlots(n) {
    const arr = Array.isArray(flyer.imageTokens) && flyer.imageTokens.length
      ? flyer.imageTokens : (flyer.imageToken ? [flyer.imageToken] : []);
    return Array.from({ length: n }, (_, i) => arr[i] || '');
  }
  function captionSlots(n) {
    const arr = Array.isArray(flyer.imageCaptions) && flyer.imageCaptions.length
      ? flyer.imageCaptions : (flyer.imageCaption ? [flyer.imageCaption] : []);
    return Array.from({ length: n }, (_, i) => arr[i] || '');
  }

  function setColumns(n) {
    writeImages(imageSlots(n), captionSlots(n), n);
  }
  function setImageAt(i, token) {
    const cols = imageCols();
    const tokens = imageSlots(cols).map((t, k) => (k === i ? token : t));
    const captions = captionSlots(cols).map((c, k) => (k === i && !token ? '' : c));
    writeImages(tokens, captions, cols);
  }
  function setCaptionAt(i, caption) {
    const cols = imageCols();
    const captions = captionSlots(cols).map((c, k) => (k === i ? caption : c));
    writeImages(imageSlots(cols), captions, cols);
  }

  if (!presets) return null;
  const isCustom = flyer.paletteId === 'custom';
  const activePalette = presets.palettes.find((p) => p.id === flyer.paletteId) || presets.palettes[0];
  const customColors = flyer.colors || {
    bg: activePalette.bg, ink: activePalette.ink,
    accent: activePalette.accent, accent2: activePalette.accent2,
  };
  const cols = imageCols();
  const tokens = imageSlots(cols);
  const captions = captionSlots(cols);

  return (
    <div className="designer">
      <div>
        <Field label="Style">
          <div className="style-grid">
            {presets.styles.map((s) => (
              <button key={s.id} type="button"
                className={`style-card ${flyer.style === s.id ? 'active' : ''}`}
                onClick={() => set(s.id === 'patriotic'
                  ? { style: s.id, paletteId: 'patriot', colors: null }
                  : { style: s.id })}>
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

        <Field label="Featured images"
          hint="Optional. Show one image, or up to three side by side — e.g. featured speakers. JPEG/PNG/GIF/WebP up to 5 MB.">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp"
            style={{ display: 'none' }} onChange={(e) => uploadImage(e.target.files?.[0])} />
          <div className="col-select" role="group" aria-label="Number of featured images">
            {[1, 2, 3].map((n) => (
              <button key={n} type="button"
                className={`btn btn-sm ${cols === n ? 'btn-primary' : ''}`}
                onClick={() => setColumns(n)}>
                {n === 1 ? '1 image' : `${n} images`}
              </button>
            ))}
          </div>
          <div className="img-slots">
            {tokens.map((tok, i) => (
              <div className="img-slot" key={i}>
                {cols > 1 ? <div className="img-slot-label">Image {i + 1}</div> : null}
                <div className="row">
                  <button type="button" className="btn" disabled={uploadingSlot !== -1}
                    onClick={() => pickImage(i)}>
                    {uploadingSlot === i ? 'Uploading…' : tok ? 'Replace' : 'Add image'}
                  </button>
                  {tok ? (
                    <button type="button" className="btn btn-ghost" onClick={() => setImageAt(i, '')}>
                      Remove
                    </button>
                  ) : null}
                </div>
                {tok ? (
                  <input className="img-cap" value={captions[i] || ''} maxLength={160}
                    placeholder={cols > 1 ? 'Caption / speaker name (optional)' : "Caption (optional) — e.g. Last year's rally"}
                    onChange={(e) => setCaptionAt(i, e.target.value)} />
                ) : null}
              </div>
            ))}
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
