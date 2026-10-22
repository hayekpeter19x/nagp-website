// Shared helpers for the Council area API (functions/api/council/*).
// Only Council endpoints use this file.
import { HttpError, validate } from './http.js';
import { tierByKey, EVENT_CATEGORIES, DOCUMENT_CATEGORIES } from './config.js';
import { first, run } from './db.js';
import { createOrder, markOrderPaid } from './payments.js';
import { eventDateText } from './events.js';

/* ---------- Small parsing helpers ---------- */

// "/api/council/events/12" -> 12, or a friendly 404.
export function idParam(context, what = 'item') {
  const n = Number(context.params.id);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(404, `We could not find that ${what}.`);
  return n;
}

export const bool = (v) => v === 1 || v === true || v === '1';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// A YYYY-MM-DD date from a form, checked to be a real calendar date. '' when empty.
export function dateField(check, body, name, { label = 'Date', required = false } = {}) {
  const v = String(body[name] ?? '').trim();
  if (!v) { if (required) check.fail(name, `Please choose ${label.toLowerCase()}.`); return ''; }
  if (!DATE_RE.test(v) || Number.isNaN(Date.parse(v + 'T00:00:00Z')) || new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) !== v) {
    check.fail(name, `Please choose ${label.toLowerCase()} from the calendar.`);
    return '';
  }
  return v;
}

export function timeField(check, body, name, { label = 'Time', required = false } = {}) {
  const v = String(body[name] ?? '').trim().slice(0, 5);
  if (!v) { if (required) check.fail(name, `Please enter ${label.toLowerCase()}.`); return ''; }
  if (!TIME_RE.test(v)) { check.fail(name, `Please enter ${label.toLowerCase()} like 7:00 PM.`); return ''; }
  return v;
}

// "$1,250.50" / "25" / "" -> cents (integer). Fails the field when it is not a sensible amount.
export function dollarsField(check, body, name, { label = 'Amount', required = false, max = 100000 } = {}) {
  const raw = String(body[name] ?? '').replace(/[$,\s]/g, '');
  if (!raw) { if (required) check.fail(name, `Please enter ${label.toLowerCase()}.`); return 0; }
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) { check.fail(name, `${label} should be a number of dollars, for example 150 or 37.50.`); return 0; }
  const cents = Math.round(Number(raw) * 100);
  if (cents > max * 100) { check.fail(name, `${label} can be at most $${max.toLocaleString('en-US')}.`); return 0; }
  return cents;
}

// check.email() says "your email address"; in the Council area it is someone else's.
export function theirEmail(check, name = 'email') {
  const v = check.email(name, { label: 'email address' });
  if (check.fields[name] && check.fields[name].startsWith('Please enter your')) check.fields[name] = 'Please enter their email address.';
  return v;
}

// '2027-10-20' -> 'October 20, 2027' (for messages shown to the Council)
export const longDate = (ymd) => (ymd ? new Date(ymd + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '');

export const todayIso = () => new Date().toISOString().slice(0, 10);
export const daysAgoIso = (n) => new Date(Date.now() - n * 864e5).toISOString();

/* ---------- Time zones for events ---------- */

export const EVENT_TIMEZONES = [
  { key: 'America/New_York', label: 'Eastern' },
  { key: 'America/Chicago', label: 'Central' },
  { key: 'America/Denver', label: 'Mountain' },
  { key: 'America/Phoenix', label: 'Arizona (no daylight saving)' },
  { key: 'America/Los_Angeles', label: 'Pacific' },
  { key: 'America/Anchorage', label: 'Alaska' },
  { key: 'Pacific/Honolulu', label: 'Hawaii' },
  { key: 'America/Halifax', label: 'Atlantic' },
];

export function isValidTimeZone(tz) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

// Offset of a time zone at a moment, in minutes east of UTC (New York in winter = -300).
export function offsetMinutes(tz, ms) {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
    .formatToParts(new Date(ms)).find((p) => p.type === 'timeZoneName');
  const m = part && part.value.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!m) return 0; // "GMT" alone means UTC
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0));
}

const pad = (n) => String(n).padStart(2, '0');
const formatOffset = (min) => `${min < 0 ? '-' : '+'}${pad(Math.floor(Math.abs(min) / 60))}:${pad(Math.abs(min) % 60)}`;

// Wall-clock date + time in a time zone -> ISO string with the right offset for that day,
// e.g. ('2027-01-15', '19:00', 'America/New_York') -> '2027-01-15T19:00:00-05:00'
//      ('2027-07-15', '19:00', 'America/New_York') -> '2027-07-15T19:00:00-04:00'
// Daylight saving: a time that happens twice (the autumn change) uses the first one; a time
// that does not exist (the spring change) moves forward by the size of the gap, as clocks do.
export function zonedIso(date, time, tz) {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const before = offsetMinutes(tz, wall - 864e5 / 2);
  const after = offsetMinutes(tz, wall + 864e5 / 2);
  // Try the earlier offset first (ambiguous times resolve to the first occurrence).
  for (const off of before === after ? [before] : [Math.max(before, after), Math.min(before, after)]) {
    const instant = wall - off * 60e3;
    if (offsetMinutes(tz, instant) === off) return `${date}T${time}:00${formatOffset(off)}`;
  }
  // Inside the spring-forward gap: the clock jumps ahead, so does the event.
  const instant = wall - before * 60e3;
  const off = offsetMinutes(tz, instant);
  const local = new Date(instant + off * 60e3);
  const iso = local.toISOString();
  return `${iso.slice(0, 10)}T${iso.slice(11, 16)}:00${formatOffset(off)}`;
}

// ISO instant -> { date: 'YYYY-MM-DD', time: 'HH:MM' } as shown on a clock in that time zone.
export function zonedParts(iso, tz) {
  if (!iso) return { date: '', time: '' };
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/* ---------- Spreadsheet (CSV) downloads ---------- */

// Every cell is quoted; quotes are doubled. Cells that a spreadsheet would treat as a
// formula (starting with = + - @, tab or carriage return) get a leading apostrophe.
export function csvCell(value) {
  if (value === null || value === undefined) return '""';
  let s = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

export function toCsv(headers, rows) {
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) lines.push(row.map(csvCell).join(','));
  return lines.join('\r\n') + '\r\n';
}

const safeFilename = (s) => String(s).toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'download';

// The byte-order mark helps Excel open accented names (e.g. "Ó") correctly.
export function csvResponse(name, headers, rows) {
  const filename = `${safeFilename(name)}-${todayIso()}.csv`;
  return new Response('﻿' + toCsv(headers, rows), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
}

export const wantsCsv = (request) => new URL(request.url).searchParams.get('format') === 'csv';

export const dollars = (cents) => (Number(cents || 0) / 100).toFixed(2);

/* ---------- Members ---------- */

// Columns for the Council's member list. Never the password hash itself.
export const MEMBER_COLUMNS = `id, name, email, role, status, tier, member_type, membership_expires, city, state, credentials,
  show_public, show_members, (password_hash IS NOT NULL AND password_hash != '') AS has_password, sample, created_at, last_login`;

// Active in the database but past the "active until" date: no longer counts as a member
// (see isActiveMember in lib/http.js), so the Council area shows them as "Expired".
export const isExpired = (u) => u.status === 'active' && !!u.membership_expires && u.membership_expires < todayIso();
export const EXPIRED_SQL = `(status = 'active' AND membership_expires IS NOT NULL AND membership_expires != '' AND membership_expires < date('now'))`;

export function memberRow(u) {
  return {
    expired: isExpired(u),
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    tier: u.tier || '',
    member_type: u.member_type,
    membership_expires: u.membership_expires || '',
    city: u.city || '',
    state: u.state || '',
    credentials: u.credentials || '',
    show_public: !!u.show_public,
    show_members: !!u.show_members,
    has_password: !!u.has_password,
    sample: !!u.sample,
    created_at: u.created_at,
    last_login: u.last_login || '',
  };
}

/* ---------- Plain-language labels (used in CSV files) ---------- */
export const STATUS_LABELS = { pending: 'Waiting for payment', active: 'Active', expired: 'Expired (not renewed)', lapsed: 'Lapsed', suspended: 'Suspended' };
export const ROLE_LABELS = { member: 'Member', council: 'Council', admin: 'Site admin' };
export const PROVIDER_LABELS = { stripe: 'Card (Stripe)', demo: 'Preview (simulated)', manual: 'Check or cash' };

/* ---------- Events ---------- */

export const EVENT_COLUMNS = `id, title, category, summary, description, starts_at, ends_at, timezone, location, is_online, presenter,
  ce_info, price_member_cents, price_public_cents, members_only, capacity, registration_open, published, sample, created_at`;

// An events row (plus registration counts) -> what the Council pages get.
export function eventRow(e) {
  const start = zonedParts(e.starts_at, e.timezone);
  const end = zonedParts(e.ends_at, e.timezone);
  return {
    ...e,
    is_online: !!e.is_online,
    members_only: !!e.members_only,
    registration_open: !!e.registration_open,
    published: !!e.published,
    sample: !!e.sample,
    is_past: Date.parse(e.ends_at || e.starts_at) < Date.now(),
    confirmed: Number(e.confirmed || 0),
    waiting: Number(e.waiting || 0),
    // For the edit form: the wall-clock date and time in the event's own time zone.
    start_date: start.date, start_time: start.time, end_date: end.date, end_time: end.time,
  };
}

// Reads and checks the add/edit event form. Returns the database fields.
export function readEventForm(body, { currentTimezone } = {}) {
  const check = validate(body);
  const title = check.text('title', { label: 'The title', required: true, max: 150 });
  const category = check.oneOf('category', EVENT_CATEGORIES, { label: 'a kind of event' });
  const summary = check.text('summary', { label: 'The short summary', max: 300 });
  const description = check.text('description', { label: 'The full description', max: 10000, multiline: true });
  const zones = EVENT_TIMEZONES.map((z) => z.key);
  if (currentTimezone && !zones.includes(currentTimezone)) zones.push(currentTimezone);
  const timezone = check.oneOf('timezone', zones, { label: 'a time zone' });
  const startDate = dateField(check, body, 'start_date', { label: 'The date', required: true });
  const startTime = timeField(check, body, 'start_time', { label: 'The start time', required: true });
  let endDate = dateField(check, body, 'end_date', { label: 'The end date' });
  const endTime = timeField(check, body, 'end_time', { label: 'The end time' });
  if (endDate && !endTime) check.fail('end_time', 'Please enter the end time too, or leave the end date empty.');
  const isOnline = check.bool('is_online');
  let location = check.text('location', { label: 'The location', max: 200 });
  if (!location && isOnline) location = 'Online (Zoom)';
  if (!location && !isOnline) check.fail('location', 'Please enter where the event takes place, for example the city and venue.');
  const presenter = check.text('presenter', { label: 'Presenter', max: 200 });
  const ceInfo = check.text('ce_info', { label: 'The continuing education note', max: 500, multiline: true });
  const priceMember = dollarsField(check, body, 'price_member', { label: 'The member price', max: 10000 });
  const pricePublic = dollarsField(check, body, 'price_public', { label: 'The non-member price', max: 10000 });
  const capacity = check.int('capacity', { label: 'The number of places', min: 1, max: 100000 });
  const out = {
    title, category, summary, description, timezone, location, presenter,
    is_online: isOnline ? 1 : 0,
    ce_info: ceInfo,
    price_member_cents: priceMember,
    price_public_cents: pricePublic,
    members_only: check.bool('members_only') ? 1 : 0,
    capacity,
    registration_open: check.bool('registration_open') ? 1 : 0,
    published: check.bool('published') ? 1 : 0,
  };
  if (startDate && startTime && !Object.keys(check.fields).includes('timezone')) {
    out.starts_at = zonedIso(startDate, startTime, timezone);
    out.ends_at = null;
    if (endTime) {
      out.ends_at = zonedIso(endDate || startDate, endTime, timezone);
      if (Date.parse(out.ends_at) <= Date.parse(out.starts_at)) {
        check.fail(endDate ? 'end_date' : 'end_time', 'The end must be after the start. For an event over several days, choose the end date too.');
      }
    }
  }
  check.done();
  return out;
}

/* ---------- Documents ---------- */

export const DOCUMENT_COLUMNS = 'id, title, category, description, url, body, doc_date, visibility, sample, created_at, updated_at';

export function readDocumentForm(body) {
  const check = validate(body);
  const out = {
    title: check.text('title', { label: 'The title', required: true, max: 200 }),
    category: check.oneOf('category', DOCUMENT_CATEGORIES, { label: 'a kind of document' }),
    description: check.text('description', { label: 'The short description', max: 500, multiline: true }),
    url: check.url('url', { label: 'The link' }),
    body: check.text('body', { label: 'The text', max: 90000, multiline: true }),
    doc_date: dateField(check, body, 'doc_date', { label: 'The date' }) || null,
    visibility: check.oneOf('visibility', ['public', 'members', 'council'], { label: 'who can see it' }),
  };
  if (!out.url && !out.body && !check.fields.url && !check.fields.body) {
    check.fail('url', 'Please paste a link to the document, or paste its text in the box below.');
  }
  check.done();
  return out;
}

/* ---------- Payments received by check or cash ---------- */

const METHOD_TEXT = { check: 'paid by check', cash: 'paid in cash' };

// Records a payment the Council received by check or cash, as a paid order (provider 'manual').
// membership: activates or extends that member for a year (markOrderPaid does this).
// event:      registers the person (or completes their unfinished registration) and confirms it.
// donation:   just the record.
//   kind, user ({ id, name, email } or null), name, email, tier, eventId, amountCents, method, note
export async function recordManualPayment(env, council, { kind, user = null, name, email, tier: tierKey, eventId, amountCents, method = 'check', note = '' }) {
  const meta = { method, council_note: note, recorded_by: council.name };
  const how = METHOD_TEXT[method] || METHOD_TEXT.check;
  const who = { user_id: user ? user.id : null, name: user ? user.name : name, email: user ? user.email : email };
  let order;

  if (kind === 'membership') {
    const tier = tierByKey(tierKey);
    if (!user) throw new HttpError(400, 'A membership payment needs a member account.');
    if (!tier) throw new HttpError(400, 'Please choose a membership type.', { tier: 'Please choose a membership type.' });
    order = await createOrder(env, {
      kind, ref_id: user.id, description: `NAGP membership, one year (${how})`, amount_cents: amountCents, ...who,
      meta: { ...meta, tier: tier.key, reason: 'manual' },
    });
  } else if (kind === 'event') {
    const ev = await first(env, `SELECT * FROM events WHERE id = ?`, eventId);
    if (!ev) throw new HttpError(404, 'We could not find that event.', { event_id: 'Please choose the event.' });
    order = await createOrder(env, {
      kind, ref_id: ev.id, description: `Event registration: ${ev.title}, ${eventDateText(ev)} (${how})`, amount_cents: amountCents, ...who,
      meta: { ...meta, event_id: ev.id },
    });
    const email = who.email.toLowerCase();
    const confirmed = await first(env,
      `SELECT id FROM registrations WHERE event_id = ? AND status = 'confirmed' AND lower(email) = ? LIMIT 1`, ev.id, email);
    if (!confirmed) {
      // Pick up an unfinished online registration if there is one, otherwise register them now.
      const open = await first(env,
        `SELECT id, order_id FROM registrations WHERE event_id = ? AND status != 'confirmed' AND lower(email) = ? ORDER BY id DESC LIMIT 1`, ev.id, email);
      if (open) {
        await run(env, `UPDATE registrations SET order_id = ?, status = 'pending', name = ?, user_id = COALESCE(user_id, ?) WHERE id = ?`,
          order.id, who.name, who.user_id, open.id);
        if (open.order_id) await run(env, `UPDATE orders SET status = 'cancelled' WHERE id = ? AND status = 'pending'`, open.order_id);
      } else {
        await run(env,
          `INSERT INTO registrations (event_id, user_id, name, email, order_id, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
          ev.id, who.user_id, who.name, email, order.id, new Date().toISOString());
      }
    }
  } else {
    order = await createOrder(env, { kind: 'donation', ref_id: null, description: `Donation to NAGP (${how})`, amount_cents: amountCents, ...who, meta });
  }
  return { order: await markOrderPaid(env, order.id, { provider: 'manual' }) };
}

// The fields of an order the Council area shows (never the secret receipt token).
export function orderRow(o) {
  let meta = {};
  try { meta = JSON.parse(o.meta || '{}') || {}; } catch { /* ignore */ }
  return {
    id: o.id,
    kind: o.kind,
    ref_id: o.ref_id,
    description: o.description,
    amount_cents: o.amount_cents,
    status: o.status,
    user_id: o.user_id,
    name: o.name,
    email: o.email,
    provider: o.provider,
    method: o.provider === 'manual' ? meta.method || 'check' : o.provider,
    council_note: meta.council_note || '',
    recorded_by: meta.recorded_by || '',
    created_at: o.created_at,
    paid_at: o.paid_at,
  };
}
