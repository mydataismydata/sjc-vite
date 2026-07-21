import { Router } from 'express';
import { config } from '../lib/env.js';
import { getOrg, orgDb } from '../lib/db.js';
import { verifyPassword, createSession, destroySession, resolveSession } from '../lib/auth.js';
import { take } from '../lib/ratelimit.js';
import { wrap, v, ApiError } from '../lib/validate.js';

export const authRouter = Router();

authRouter.post('/auth/login', wrap(async (req, res) => {
  const orgSlug = v.str(req.body.org, { label: 'Organization', max: 40 }).toLowerCase();
  const email = v.email(req.body.email, { label: 'Email' });
  const password = v.str(req.body.password, { label: 'Password', max: 200 });

  if (!take(`login:ip:${req.ip}`, 30, 15 * 60 * 1000)) {
    throw new ApiError(429, 'Too many sign-in attempts. Please wait a few minutes and try again.');
  }
  if (!take(`login:acct:${orgSlug}:${email}`, 8, 15 * 60 * 1000)) {
    throw new ApiError(429, 'Too many sign-in attempts for this account. Please wait a few minutes.');
  }

  const fail = () => { throw new ApiError(401, 'Invalid organization, email, or password.'); };
  const org = getOrg(orgSlug);
  if (!org) fail();
  const db = orgDb(orgSlug);
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email);
  if (!user || !verifyPassword(password, user.password_hash)) fail();

  db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id);
  createSession(db, orgSlug, user.id, req, res);
  res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    org: { slug: org.slug, name: org.name },
  });
}));

authRouter.post('/auth/logout', wrap(async (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
}));

authRouter.get('/auth/me', wrap(async (req, res) => {
  const resolved = resolveSession(req);
  if (!resolved) throw new ApiError(401, 'Not signed in');
  res.json({
    user: {
      id: resolved.user.id,
      name: resolved.user.name,
      email: resolved.user.email,
      role: resolved.user.role,
    },
    org: { slug: resolved.org.slug, name: resolved.org.name },
    app: { name: config.appName, base_url: config.baseUrl },
  });
}));
