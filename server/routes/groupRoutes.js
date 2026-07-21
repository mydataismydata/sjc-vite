import { Router } from 'express';
import { insertId, withTx } from '../lib/db.js';
import { wrap, v, ApiError } from '../lib/validate.js';

export const groupRouter = Router();

groupRouter.get('/groups', wrap(async (req, res) => {
  const groups = req.db.prepare(`
    SELECT g.*, (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS member_count
    FROM groups g ORDER BY g.name COLLATE NOCASE
  `).all();
  res.json({ groups });
}));

groupRouter.get('/groups/:id', wrap(async (req, res) => {
  const id = v.int(req.params.id, { label: 'id', min: 1 });
  const group = req.db.prepare('SELECT * FROM groups WHERE id = ?').get(id);
  if (!group) throw new ApiError(404, 'Group not found.');
  const memberIds = req.db.prepare('SELECT contact_id FROM group_members WHERE group_id = ?')
    .all(id).map((r) => Number(r.contact_id));
  res.json({ group: { ...group, member_ids: memberIds } });
}));

groupRouter.post('/groups', wrap(async (req, res) => {
  const name = v.str(req.body.name, { label: 'Group name', max: 120 });
  const description = v.optStr(req.body.description, { label: 'Description', max: 500 });
  const dup = req.db.prepare('SELECT id FROM groups WHERE name = ?').get(name);
  if (dup) throw new ApiError(409, 'A group with this name already exists.');
  const info = req.db.prepare('INSERT INTO groups (name, description) VALUES (?, ?)')
    .run(name, description || null);
  const id = insertId(info);
  const memberIds = v.intArray(req.body.contact_ids, { label: 'contact_ids' });
  if (memberIds.length) {
    const stmt = req.db.prepare('INSERT OR IGNORE INTO group_members (group_id, contact_id) VALUES (?, ?)');
    withTx(req.db, () => { for (const cid of memberIds) stmt.run(id, cid); });
  }
  res.status(201).json({ group: req.db.prepare('SELECT * FROM groups WHERE id = ?').get(id) });
}));

groupRouter.put('/groups/:id', wrap(async (req, res) => {
  const id = v.int(req.params.id, { label: 'id', min: 1 });
  const group = req.db.prepare('SELECT * FROM groups WHERE id = ?').get(id);
  if (!group) throw new ApiError(404, 'Group not found.');
  const name = req.body.name !== undefined ? v.str(req.body.name, { label: 'Group name', max: 120 }) : group.name;
  const description = req.body.description !== undefined
    ? v.optStr(req.body.description, { label: 'Description', max: 500 })
    : group.description;
  const dup = req.db.prepare('SELECT id FROM groups WHERE name = ? AND id != ?').get(name, id);
  if (dup) throw new ApiError(409, 'A group with this name already exists.');
  req.db.prepare('UPDATE groups SET name = ?, description = ? WHERE id = ?').run(name, description || null, id);
  res.json({ ok: true });
}));

// Replace the full membership list of a group.
groupRouter.put('/groups/:id/members', wrap(async (req, res) => {
  const id = v.int(req.params.id, { label: 'id', min: 1 });
  const group = req.db.prepare('SELECT id FROM groups WHERE id = ?').get(id);
  if (!group) throw new ApiError(404, 'Group not found.');
  const memberIds = v.intArray(req.body.contact_ids, { label: 'contact_ids' });
  withTx(req.db, () => {
    req.db.prepare('DELETE FROM group_members WHERE group_id = ?').run(id);
    const stmt = req.db.prepare(
      'INSERT OR IGNORE INTO group_members (group_id, contact_id) SELECT ?, id FROM contacts WHERE id = ?'
    );
    for (const cid of memberIds) stmt.run(id, cid);
  });
  const count = req.db.prepare('SELECT COUNT(*) AS n FROM group_members WHERE group_id = ?').get(id);
  res.json({ ok: true, member_count: Number(count.n) });
}));

groupRouter.delete('/groups/:id', wrap(async (req, res) => {
  const id = v.int(req.params.id, { label: 'id', min: 1 });
  const info = req.db.prepare('DELETE FROM groups WHERE id = ?').run(id);
  if (Number(info.changes) === 0) throw new ApiError(404, 'Group not found.');
  res.json({ ok: true });
}));
