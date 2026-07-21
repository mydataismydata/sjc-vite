// Everything between "the host clicked send" and "rows sit in the email
// queue": link building, per-recipient rendering, dedupe/skip rules.
import { config } from './env.js';
import { insertId } from './db.js';
import { normalizeFlyer, flyerColors } from './flyer.js';
import { buildTagContext, renderTags } from './mergeTags.js';
import {
  renderInvitationEmail, renderMessageEmail,
  DEFAULT_INVITE_BODY, DEFAULT_NUDGE_BODY, DEFAULT_FOLLOW_UP_BODY, DEFAULT_CANCEL_BODY,
} from './emailTemplates.js';

export const DEFAULT_BODIES = {
  invitation: DEFAULT_INVITE_BODY,
  nudge: DEFAULT_NUDGE_BODY,
  follow_up: DEFAULT_FOLLOW_UP_BODY,
  cancellation: DEFAULT_CANCEL_BODY,
};

export function publicUrl(orgSlug, path) {
  return `${config.baseUrl}/o/${orgSlug}${path}`;
}

export function buildLinks(orgSlug, event, invite = null) {
  const links = { event: publicUrl(orgSlug, `/e/${event.slug}`) };
  if (invite) {
    links.rsvp = publicUrl(orgSlug, `/i/${invite.token}`);
    links.accept = `${links.rsvp}/accept`;
    links.decline = `${links.rsvp}/decline`;
    links.unsub = publicUrl(orgSlug, `/u/${invite.token}`);
  }
  return links;
}

export function parseFlyer(event) {
  let raw = {};
  try { raw = JSON.parse(event.flyer || '{}'); } catch { /* corrupted json -> defaults */ }
  return normalizeFlyer(raw);
}

export function eventAccent(event) {
  return flyerColors(parseFlyer(event)).accent;
}

export function eventImageUrl(orgSlug, event) {
  const flyer = parseFlyer(event);
  return flyer.imageToken ? publicUrl(orgSlug, `/files/${flyer.imageToken}`) : '';
}

export function inviteName(invite) {
  return invite.contact_name || invite.guest_name || '';
}

export function inviteEmail(invite) {
  return (invite.contact_email || invite.guest_email || '').toLowerCase();
}

export function isUnsubscribed(db, email) {
  if (!email) return false;
  const row = db.prepare(
    'SELECT id FROM contacts WHERE email = ? AND unsubscribed_at IS NOT NULL'
  ).get(email);
  return Boolean(row);
}

// Join used everywhere invites are listed: live contact info wins, snapshot
// fields cover contacts that were deleted later.
export const INVITE_SELECT = `
  SELECT i.*, c.name AS contact_name, c.email AS contact_email, c.phone AS contact_phone,
         c.unsubscribed_at AS contact_unsubscribed_at
  FROM invites i LEFT JOIN contacts c ON c.id = i.contact_id
`;

export function getInvitesForEvent(db, eventId) {
  return db.prepare(`${INVITE_SELECT} WHERE i.event_id = ? ORDER BY i.created_at, i.id`).all(eventId);
}

function insertEmailLog(db, { event, invite, kind, toName, toEmail, subject, html, text }) {
  const info = db.prepare(
    `INSERT INTO email_log (event_id, invite_id, kind, to_name, to_email, subject, html, body_text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(event ? event.id : null, invite ? invite.id : null, kind, toName || '', toEmail, subject, html, text);
  return insertId(info);
}

// Links used in test sends and previews: every button lands on the public
// event page instead of mutating a real invite.
export function previewLinks(orgSlug, event) {
  const eventUrl = publicUrl(orgSlug, `/e/${event.slug}`);
  return { event: eventUrl, rsvp: eventUrl, accept: eventUrl, decline: eventUrl, unsub: '' };
}

export function renderEmailFor({ org, event, invite, kind, subjectTemplate, bodyTemplate, linksOverride }) {
  const name = inviteName(invite);
  const email = inviteEmail(invite);
  const links = linksOverride || buildLinks(org.slug, event, invite);
  const ctx = buildTagContext({ org, event, inviteName: name, links });
  const subject = renderTags(subjectTemplate, ctx).trim() || `You're invited: ${event.title}`;
  const bodyText = renderTags(bodyTemplate, ctx);
  const accent = eventAccent(event);
  const common = {
    org, event, accent, toName: name, toEmail: email,
    bodyText, links, unsubUrl: links.unsub,
  };
  const rendered = kind === 'invitation'
    ? renderInvitationEmail({ ...common, imageUrl: eventImageUrl(org.slug, event) })
    : renderMessageEmail({ ...common, kind });
  return { subject, html: rendered.html, text: rendered.text, toName: name, toEmail: email };
}

// Queue one kind of email to a set of invites, applying the skip rules.
// Returns counts the UI reports back to the host.
export function queueEmails(db, { org, event, invites, kind, subjectTemplate, bodyTemplate, markInvitation }) {
  let queued = 0;
  const skipped = { no_email: 0, unsubscribed: 0, already_queued: 0 };
  for (const invite of invites) {
    const email = inviteEmail(invite);
    if (!email) { skipped.no_email++; continue; }
    if (invite.contact_unsubscribed_at || isUnsubscribed(db, email)) { skipped.unsubscribed++; continue; }
    if (markInvitation && invite.email_status === 'queued') { skipped.already_queued++; continue; }
    const msg = renderEmailFor({ org, event, invite, kind, subjectTemplate, bodyTemplate });
    insertEmailLog(db, { event, invite, kind, ...msg, html: msg.html, text: msg.text });
    if (markInvitation) {
      db.prepare('UPDATE invites SET email_status = ? WHERE id = ?').run('queued', invite.id);
    }
    queued++;
  }
  return { queued, skipped };
}

export function logTestEmail(db, { event, toEmail, subject, html, text, status, error }) {
  const info = db.prepare(
    `INSERT INTO email_log (event_id, invite_id, kind, to_name, to_email, subject, html, body_text, status, error, sent_at)
     VALUES (?, NULL, 'test', '', ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).run(event.id, toEmail, subject, html, text, status, error || null);
  return insertId(info);
}
