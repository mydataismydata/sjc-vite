// Creating an organization with sensible starting content (a default
// invitation template). Used by the create-org and seed scripts.
import { createOrg } from './db.js';
import { createUser, generatePassword } from './auth.js';
import { DEFAULT_INVITE_BODY } from './emailTemplates.js';

export function createOrgWithAdmin({ slug, name, adminEmail, adminName, password }) {
  const { org, db } = createOrg({ slug, name });
  const pw = password || generatePassword();
  const userId = createUser(db, { email: adminEmail, name: adminName, password: pw, role: 'admin' });
  db.prepare(
    'INSERT INTO templates (name, subject, body, is_default) VALUES (?, ?, ?, 1)'
  ).run('Standard invitation', "You're invited: {{event_title}}", DEFAULT_INVITE_BODY);
  return { org, db, userId, password: pw };
}
