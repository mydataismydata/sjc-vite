// Database schemas. Two kinds of database exist:
//
//   core.db          — the tiny registry of organizations (slug -> db file).
//   orgs/<slug>/org.db — EVERYTHING belonging to one organization: its users,
//                        sessions, contacts, events, invites, email log.
//
// Tenant isolation is physical: there is no organization id column anywhere,
// because data from two organizations never shares a database file. A query
// cannot leak across tenants — it would have to open a different file.
//
// Migrations use PRAGMA user_version. To evolve a schema later, push another
// entry onto the relevant array; every database is brought up to date on open.

export const CORE_MIGRATIONS = [
  `
  CREATE TABLE organizations (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  `,
];

export const ORG_MIGRATIONS = [
  `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_login_at TEXT
  );

  CREATE TABLE sessions (
    id INTEGER PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    ip TEXT,
    user_agent TEXT
  );

  CREATE TABLE contacts (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT COLLATE NOCASE,
    phone TEXT,
    notes TEXT,
    unsubscribed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_contacts_email ON contacts(email);

  CREATE TABLE groups (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE group_members (
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, contact_id)
  );

  CREATE TABLE templates (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE events (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    host_name TEXT,
    venue_name TEXT,
    venue_address TEXT,
    date TEXT,
    start_time TEXT,
    end_time TEXT,
    timezone_note TEXT,
    rsvp_mode TEXT NOT NULL DEFAULT 'rsvp' CHECK (rsvp_mode IN ('rsvp', 'open')),
    rsvp_deadline TEXT,
    capacity INTEGER,
    allow_plus_ones INTEGER NOT NULL DEFAULT 1,
    max_party_size INTEGER NOT NULL DEFAULT 5,
    show_guest_list INTEGER NOT NULL DEFAULT 0,
    share_enabled INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled')),
    flyer TEXT NOT NULL DEFAULT '{}',
    email_subject TEXT,
    email_body TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_events_date ON events(date);

  CREATE TABLE invites (
    id INTEGER PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    guest_name TEXT,
    guest_email TEXT COLLATE NOCASE,
    token TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL DEFAULT 'email' CHECK (source IN ('email', 'link', 'manual')),
    email_status TEXT NOT NULL DEFAULT 'not_sent'
      CHECK (email_status IN ('not_sent', 'queued', 'sent', 'failed')),
    response TEXT CHECK (response IN ('yes', 'no')),
    responded_at TEXT,
    party_size INTEGER NOT NULL DEFAULT 1,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (event_id, contact_id)
  );
  CREATE INDEX idx_invites_event ON invites(event_id);
  CREATE INDEX idx_invites_email ON invites(guest_email);

  CREATE TABLE email_log (
    id INTEGER PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
    invite_id INTEGER REFERENCES invites(id) ON DELETE SET NULL,
    kind TEXT NOT NULL CHECK (kind IN ('invitation', 'follow_up', 'nudge', 'cancellation', 'test')),
    to_name TEXT,
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    html TEXT NOT NULL,
    body_text TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'queued'
      CHECK (status IN ('queued', 'sending', 'sent', 'simulated', 'failed')),
    error TEXT,
    provider_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    sent_at TEXT
  );
  CREATE INDEX idx_email_log_status ON email_log(status);
  CREATE INDEX idx_email_log_event ON email_log(event_id);

  CREATE TABLE uploads (
    id INTEGER PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    original_name TEXT,
    mime TEXT NOT NULL,
    bytes INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
  `,
];
