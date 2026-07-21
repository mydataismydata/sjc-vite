#!/usr/bin/env node
// Reset a user's password from the server console (for when an organization
// locks itself out).
//
//   node scripts/reset-password.mjs --org sjc --email admin@example.org [--password <new>]
import { parseArgs } from 'node:util';
import '../server/lib/env.js';
import { orgDb } from '../server/lib/db.js';
import { hashPassword, generatePassword } from '../server/lib/auth.js';

const { values } = parseArgs({
  options: {
    org: { type: 'string' },
    email: { type: 'string' },
    password: { type: 'string' },
  },
});

function fail(msg) {
  console.error(`Error: ${msg}`);
  console.error('\nUsage: node scripts/reset-password.mjs --org <slug> --email <email> [--password <new password>]');
  process.exit(1);
}

const slug = (values.org || '').toLowerCase().trim();
const email = (values.email || '').toLowerCase().trim();
if (!slug || !email) fail('--org and --email are required');
if (values.password && values.password.length < 10) fail('--password must be at least 10 characters');

const db = orgDb(slug);
if (!db) fail(`No organization with slug "${slug}"`);
const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
if (!user) fail(`No user with email ${email} in organization ${slug}`);

const password = values.password || generatePassword();
db.prepare('UPDATE users SET password_hash = ?, active = 1 WHERE id = ?').run(hashPassword(password), user.id);
db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
console.log(`Password reset for ${email} (${slug}).`);
if (!values.password) console.log(`New password: ${password}`);
