import { Router } from 'express';
import { insertId } from '../lib/db.js';
import { wrap, v, ApiError } from '../lib/validate.js';
import { TAG_DEFS } from '../lib/mergeTags.js';

export const templateRouter = Router();

templateRouter.get('/merge-tags', wrap(async (_req, res) => {
  res.json({ tags: TAG_DEFS });
}));

templateRouter.get('/templates', wrap(async (req, res) => {
  res.json({ templates: req.db.prepare('SELECT * FROM templates ORDER BY is_default DESC, name COLLATE NOCASE').all() });
}));

function templateFields(body) {
  return {
    name: v.str(body.name, { label: 'Template name', max: 120 }),
    subject: v.optStr(body.subject, { label: 'Subject', max: 300 }),
    body: v.optStr(body.body, { label: 'Body', max: 20000 }),
  };
}

templateRouter.post('/templates', wrap(async (req, res) => {
  const f = templateFields(req.body);
  const info = req.db.prepare('INSERT INTO templates (name, subject, body) VALUES (?, ?, ?)')
    .run(f.name, f.subject, f.body);
  res.status(201).json({ template: req.db.prepare('SELECT * FROM templates WHERE id = ?').get(insertId(info)) });
}));

templateRouter.put('/templates/:id', wrap(async (req, res) => {
  const id = v.int(req.params.id, { label: 'id', min: 1 });
  const existing = req.db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
  if (!existing) throw new ApiError(404, 'Template not found.');
  const f = templateFields({ ...existing, ...req.body });
  req.db.prepare(
    `UPDATE templates SET name = ?, subject = ?, body = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(f.name, f.subject, f.body, id);
  res.json({ ok: true });
}));

templateRouter.post('/templates/:id/default', wrap(async (req, res) => {
  const id = v.int(req.params.id, { label: 'id', min: 1 });
  const existing = req.db.prepare('SELECT id FROM templates WHERE id = ?').get(id);
  if (!existing) throw new ApiError(404, 'Template not found.');
  req.db.prepare('UPDATE templates SET is_default = 0').run();
  req.db.prepare('UPDATE templates SET is_default = 1 WHERE id = ?').run(id);
  res.json({ ok: true });
}));

templateRouter.delete('/templates/:id', wrap(async (req, res) => {
  const id = v.int(req.params.id, { label: 'id', min: 1 });
  const info = req.db.prepare('DELETE FROM templates WHERE id = ?').run(id);
  if (Number(info.changes) === 0) throw new ApiError(404, 'Template not found.');
  res.json({ ok: true });
}));
