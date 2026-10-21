// Database tables (Cloudflare D1 / SQLite). The site creates these automatically
// the first time it runs (see lib/db.js). Every statement uses IF NOT EXISTS so
// running it twice is harmless.
//
// To change the schema later: bump SCHEMA_VERSION and add the new statements to
// MIGRATIONS under the new version number. Dates are ISO text (UTC).

export const SCHEMA_VERSION = 2;

export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)`,

  // Everyone with an account: members, Council members, the site admin.
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',          -- member | council | admin
    status TEXT NOT NULL DEFAULT 'pending',       -- pending (not paid yet) | active | lapsed | suspended
    tier TEXT,                                    -- key from MEMBERSHIP_TIERS
    member_type TEXT NOT NULL DEFAULT 'associate',-- professional | associate | student
    membership_expires TEXT,                      -- YYYY-MM-DD
    city TEXT DEFAULT '',
    state TEXT DEFAULT '',                        -- code from REGIONS
    credentials TEXT DEFAULT '',                  -- e.g. "LCSW, PhD"
    training TEXT DEFAULT '',                     -- Gestalt training background
    specialties TEXT DEFAULT '',                  -- comma list of SPECIALTIES keys
    bio TEXT DEFAULT '',
    website TEXT DEFAULT '',
    public_email TEXT DEFAULT '',
    public_phone TEXT DEFAULT '',
    show_public INTEGER NOT NULL DEFAULT 0,        -- opted in to the public directory (professionals only)
    show_members INTEGER NOT NULL DEFAULT 1,       -- appears in the members-only directory
    sample INTEGER NOT NULL DEFAULT 0,             -- 1 = made-up preview data
    created_at TEXT NOT NULL,
    last_login TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,                          -- SHA-256 of the cookie token
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,

  `CREATE TABLE IF NOT EXISTS login_attempts (
    key TEXT NOT NULL,
    at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_login_attempts ON login_attempts(key, at)`,

  // Announcements by NAGP and members. Members submit -> Council approves.
  `CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Member news',
    visibility TEXT NOT NULL DEFAULT 'public',    -- public | members
    status TEXT NOT NULL DEFAULT 'pending',       -- pending | approved | declined
    author_id INTEGER,
    author_name TEXT NOT NULL,
    from_council INTEGER NOT NULL DEFAULT 0,      -- 1 = official NAGP announcement
    link_url TEXT DEFAULT '',
    decline_reason TEXT DEFAULT '',
    reviewed_by INTEGER,
    reviewed_at TEXT,
    sample INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    published_at TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Training',
    summary TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    starts_at TEXT NOT NULL,                      -- ISO with offset, e.g. 2026-11-14T19:00:00-05:00
    ends_at TEXT,
    timezone TEXT NOT NULL DEFAULT 'America/New_York',
    location TEXT NOT NULL DEFAULT '',
    is_online INTEGER NOT NULL DEFAULT 0,
    presenter TEXT DEFAULT '',
    ce_info TEXT DEFAULT '',                      -- continuing education note
    price_member_cents INTEGER NOT NULL DEFAULT 0,
    price_public_cents INTEGER NOT NULL DEFAULT 0,
    members_only INTEGER NOT NULL DEFAULT 0,
    capacity INTEGER,                             -- NULL = unlimited
    registration_open INTEGER NOT NULL DEFAULT 1,
    published INTEGER NOT NULL DEFAULT 1,
    sample INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    user_id INTEGER,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    order_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',       -- pending (awaiting payment) | confirmed | cancelled
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_registrations_event ON registrations(event_id)`,

  // Every payment: memberships, event registrations, donations.
  `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,                          -- random, e.g. ord_abc123
    token TEXT NOT NULL,                          -- secret used in receipt links
    kind TEXT NOT NULL,                           -- membership | event | donation
    ref_id INTEGER,                               -- user id (membership) or event id (event)
    description TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'usd',
    status TEXT NOT NULL DEFAULT 'pending',       -- pending | paid | cancelled | refunded
    user_id INTEGER,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'demo',        -- demo | stripe
    provider_ref TEXT,
    meta TEXT DEFAULT '{}',
    created_at TEXT NOT NULL,
    paid_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)`,

  `CREATE TABLE IF NOT EXISTS board_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER,                            -- NULL = new topic, otherwise a reply to that topic
    title TEXT DEFAULT '',
    body TEXT NOT NULL,
    author_id INTEGER NOT NULL,
    author_name TEXT NOT NULL,
    hidden INTEGER NOT NULL DEFAULT 0,            -- hidden by the Council
    hidden_reason TEXT DEFAULT '',
    reports INTEGER NOT NULL DEFAULT 0,
    sample INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    last_activity TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_board_parent ON board_posts(parent_id)`,

  `CREATE TABLE IF NOT EXISTS board_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    reporter_id INTEGER NOT NULL,
    reason TEXT DEFAULT '',
    resolved INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_board_reports_once ON board_reports(post_id, reporter_id)`,

  // Bylaws, minutes, incorporation papers... (moved over from Notion)
  `CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Other',
    description TEXT DEFAULT '',
    url TEXT DEFAULT '',                          -- link to Google Drive / Notion / PDF
    body TEXT DEFAULT '',                         -- or the text itself
    doc_date TEXT,                                -- YYYY-MM-DD
    visibility TEXT NOT NULL DEFAULT 'members',   -- public | members | council
    sample INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    topic TEXT DEFAULT '',
    message TEXT NOT NULL,
    handled INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    first_name TEXT DEFAULT '',
    last_name TEXT DEFAULT '',
    source TEXT DEFAULT '',                       -- which form they used
    interest TEXT DEFAULT '',                     -- e.g. "membership"
    created_at TEXT NOT NULL
  )`,

  // Preview-only: comments from Council members reviewing the new site.
  `CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page TEXT NOT NULL,
    name TEXT DEFAULT '',
    comment TEXT NOT NULL,
    resolved INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
];

// Future changes go here, e.g. { 2: [`ALTER TABLE users ADD COLUMN pronouns TEXT DEFAULT ''`] }
export const MIGRATIONS = {
  // 2: a member can ask to cancel; the membership stays active until its end date.
  2: [`ALTER TABLE users ADD COLUMN cancel_requested_at TEXT`],
};
