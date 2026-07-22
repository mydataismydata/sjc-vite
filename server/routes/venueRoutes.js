import { Router } from 'express';
import { insertId } from '../lib/db.js';
import { wrap, v, ApiError } from '../lib/validate.js';

export const venueRouter = Router();

function venueFields(body, { partial = false } = {}) {
  const out = {};
  if (!partial || body.name !== undefined) out.name = v.str(body.name, { label: 'Venue name', max: 200 });
  if (!partial || body.address !== undefined) out.address = v.optStr(body.address, { label: 'Address', max: 400 });
  if (!partial || body.phone !== undefined) out.phone = v.optStr(body.phone, { label: 'Phone', max: 50 });
  if (!partial || body.map_url !== undefined) out.map_url = v.url(body.map_url, { label: 'Map link' });
  return out;
}

venueRouter.get('/venues', wrap(async (req, res) => {
  res.json({ venues: req.db.prepare('SELECT * FROM venues ORDER BY name COLLATE NOCASE').all() });
}));

venueRouter.post('/venues', wrap(async (req, res) => {
  const f = venueFields(req.body);
  const dup = req.db.prepare('SELECT id FROM venues WHERE name = ? COLLATE NOCASE').get(f.name);
  if (dup) throw new ApiError(409, 'A venue with this name already exists.');
  const info = req.db.prepare(
    'INSERT INTO venues (name, address, phone, map_url) VALUES (?, ?, ?, ?)'
  ).run(f.name, f.address || null, f.phone || null, f.map_url || null);
  res.status(201).json({ venue: req.db.prepare('SELECT * FROM venues WHERE id = ?').get(insertId(info)) });
}));

venueRouter.put('/venues/:id', wrap(async (req, res) => {
  const id = v.int(req.params.id, { label: 'id', min: 1 });
  const existing = req.db.prepare('SELECT * FROM venues WHERE id = ?').get(id);
  if (!existing) throw new ApiError(404, 'Venue not found.');
  const f = venueFields({ ...existing, ...req.body });
  const dup = req.db.prepare('SELECT id FROM venues WHERE name = ? COLLATE NOCASE AND id != ?').get(f.name, id);
  if (dup) throw new ApiError(409, 'Another venue already uses this name.');
  req.db.prepare(
    `UPDATE venues SET name = ?, address = ?, phone = ?, map_url = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(f.name, f.address || null, f.phone || null, f.map_url || null, id);
  res.json({ ok: true });
}));

venueRouter.delete('/venues/:id', wrap(async (req, res) => {
  const id = v.int(req.params.id, { label: 'id', min: 1 });
  const info = req.db.prepare('DELETE FROM venues WHERE id = ?').run(id);
  if (Number(info.changes) === 0) throw new ApiError(404, 'Venue not found.');
  res.json({ ok: true });
}));
