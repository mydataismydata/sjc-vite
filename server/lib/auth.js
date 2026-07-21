// Passwords, sessions and the authentication middleware.
//
// Passwords: scrypt (Node built-in) with per-user salt, constant-time verify.
// Sessions:  random 32-char token, stored HASHED in the org database. The
//            cookie carries "<org slug>.<token>.<hmac>" — the HMAC (server
//            secret) prevents tampering with the org slug, and the session
//            row lives inside the org's own database, so a session can only
//            ever unlock the organization that issued it.
import crypto from 'node:crypto';
import { config } from './env.js';
import { getOrg, orgDb } from './db.js';
import { randomToken, sha256hex, hmacHex, safeEqual } from './tokens.js';
import { ApiError } from './validate.js';

export const COOKIE_NAME = 'sv_session';
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64, SCRYPT_OPTS);
  return `s1$${SCRYPT_OPTS.N}$${SCRYPT_OPTS.r}$${SCRYPT_OPTS.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  try {
    const [tag, N, r, p, saltB64, hashB64] = String(stored).split('$');
    if (tag !== 's1') return false;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    const actual = crypto.scryptSync(String(password), salt, expected.length, {
      N: Number(N), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
    });
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function generatePassword() {
  return `${randomToken(4)}-${randomToken(4)}-${randomToken(4)}`;
}

// --- cookies ---------------------------------------------------------------

export function cookieParser(req, _res, next) {
  const header = req.headers.cookie || '';
  const cookies = {};
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (name) cookies[name] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  req.cookies = cookies;
  next();
}

function cookieFlags(maxAgeSeconds) {
  const secure = config.isProd && config.baseUrl.startsWith('https') ? '; Secure' : '';
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

function signSession(orgSlug, token) {
  const payload = `${orgSlug}.${token}`;
  return `${payload}.${hmacHex(config.sessionSecret, payload)}`;
}

function parseSessionCookie(value) {
  if (typeof value !== 'string') return null;
  const parts = value.split('.');
  if (parts.length !== 3) return null;
  const [orgSlug, token, sig] = parts;
  if (!safeEqual(sig, hmacHex(config.sessionSecret, `${orgSlug}.${token}`))) return null;
  return { orgSlug, token };
}

// --- session lifecycle -----------------------------------------------------

export function createSession(db, orgSlug, userId, req, res) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + config.sessionDays * 86400_000)
    .toISOString().slice(0, 19).replace('T', ' ');
  db.prepare(
    'INSERT INTO sessions (token_hash, user_id, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?)'
  ).run(sha256hex(token), userId, expiresAt, req.ip || '', String(req.headers['user-agent'] || '').slice(0, 300));
  res.setHeader('Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(signSession(orgSlug, token))}; ${cookieFlags(config.sessionDays * 86400)}`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; ${cookieFlags(0)}`);
}

export function destroySession(req, res) {
  const parsed = parseSessionCookie(req.cookies?.[COOKIE_NAME]);
  if (parsed) {
    const db = orgDb(parsed.orgSlug);
    if (db) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256hex(parsed.token));
  }
  clearSessionCookie(res);
}

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

export function resolveSession(req) {
  const parsed = parseSessionCookie(req.cookies?.[COOKIE_NAME]);
  if (!parsed) return null;
  const org = getOrg(parsed.orgSlug);
  if (!org) return null;
  const db = orgDb(parsed.orgSlug);
  const session = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(sha256hex(parsed.token));
  if (!session) return null;
  if (session.expires_at <= nowSql()) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(session.id);
    return null;
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(session.user_id);
  if (!user) return null;
  // Sliding expiry: renew when at least half the lifetime has elapsed.
  const remaining = new Date(session.expires_at.replace(' ', 'T') + 'Z') - Date.now();
  if (remaining < config.sessionDays * 43200_000) {
    const expiresAt = new Date(Date.now() + config.sessionDays * 86400_000)
      .toISOString().slice(0, 19).replace('T', ' ');
    db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(expiresAt, session.id);
  }
  return { org, db, user };
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// CSRF defense-in-depth: cookies are SameSite=Lax, and additionally every
// mutating API call must carry a custom header that plain cross-site form
// posts cannot set.
export function csrfGuard(req, _res, next) {
  if (MUTATING.has(req.method) && req.headers['x-requested-with'] !== 'sjc-vite') {
    return next(new ApiError(403, 'Missing request header'));
  }
  next();
}

export function requireAuth(req, _res, next) {
  const resolved = resolveSession(req);
  if (!resolved) return next(new ApiError(401, 'Not signed in'));
  req.org = { id: resolved.org.id, slug: resolved.org.slug, name: resolved.org.name };
  req.db = resolved.db;
  req.user = {
    id: resolved.user.id,
    name: resolved.user.name,
    email: resolved.user.email,
    role: resolved.user.role,
  };
  next();
}

export function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') return next(new ApiError(403, 'Administrator access required'));
  next();
}

export function createUser(db, { email, name, password, role = 'member' }) {
  const info = db.prepare(
    'INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run(email.toLowerCase(), name, hashPassword(password), role);
  return Number(info.lastInsertRowid);
}
