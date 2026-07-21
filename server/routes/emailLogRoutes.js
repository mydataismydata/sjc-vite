import { Router } from 'express';
import { wrap, v, ApiError } from '../lib/validate.js';

export const emailLogRouter = Router();

emailLogRouter.get('/emails', wrap(async (req, res) => {
  const eventId = req.query.event_id ? v.int(req.query.event_id, { label: 'event_id', min: 1 }) : null;
  const status = v.optStr(req.query.status, { max: 20 });
  const limit = v.int(req.query.limit, { label: 'limit', min: 1, max: 500, required: false, fallback: 200 });

  let sql = `
    SELECT l.id, l.event_id, l.invite_id, l.kind, l.to_name, l.to_email, l.subject,
           l.status, l.error, l.provider_id, l.created_at, l.sent_at, e.title AS event_title
    FROM email_log l LEFT JOIN events e ON e.id = l.event_id WHERE 1=1`;
  const params = [];
  if (eventId) { sql += ' AND l.event_id = ?'; params.push(eventId); }
  if (status) { sql += ' AND l.status = ?'; params.push(status); }
  sql += ' ORDER BY l.id DESC LIMIT ?';
  params.push(limit);
  res.json({ emails: req.db.prepare(sql).all(...params) });
}));

emailLogRouter.get('/emails/:id', wrap(async (req, res) => {
  const id = v.int(req.params.id, { label: 'id', min: 1 });
  const email = req.db.prepare(`
    SELECT l.*, e.title AS event_title FROM email_log l
    LEFT JOIN events e ON e.id = l.event_id WHERE l.id = ?
  `).get(id);
  if (!email) throw new ApiError(404, 'Email not found.');
  res.json({ email });
}));

emailLogRouter.post('/emails/:id/retry', wrap(async (req, res) => {
  const id = v.int(req.params.id, { label: 'id', min: 1 });
  const email = req.db.prepare('SELECT * FROM email_log WHERE id = ?').get(id);
  if (!email) throw new ApiError(404, 'Email not found.');
  if (email.status !== 'failed') throw new ApiError(400, 'Only failed emails can be retried.');
  req.db.prepare("UPDATE email_log SET status = 'queued', error = NULL WHERE id = ?").run(id);
  if (email.invite_id && email.kind === 'invitation') {
    req.db.prepare("UPDATE invites SET email_status = 'queued' WHERE id = ?").run(email.invite_id);
  }
  res.json({ ok: true });
}));
