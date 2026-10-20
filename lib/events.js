// Events and registrations: shared by /api/events, /api/events/:id, /api/events/:id/register,
// /api/orders/:id and /api/me/orders.
import { all, first } from './db.js';
import { isActiveMember } from './http.js';

// A place is held for someone who is paying for this long. After that, an unpaid
// registration no longer counts toward the event's capacity.
export const PENDING_HOLD_MS = 60 * 60 * 1000;
export const holdCutoff = () => new Date(Date.now() - PENDING_HOLD_MS).toISOString();

// How many places are taken, per event id: confirmed + recently started (pending) registrations.
export async function takenCounts(env, eventIds) {
  const ids = [...new Set(eventIds)].filter((n) => Number.isInteger(n));
  if (!ids.length) return {};
  const marks = ids.map(() => '?').join(',');
  const rows = await all(env,
    `SELECT event_id, COUNT(*) AS n FROM registrations
     WHERE event_id IN (${marks}) AND (status = 'confirmed' OR (status = 'pending' AND created_at > ?))
     GROUP BY event_id`, ...ids, holdCutoff());
  const out = {};
  for (const r of rows) out[r.event_id] = r.n;
  return out;
}

const time = (iso) => { const t = Date.parse(iso || ''); return Number.isNaN(t) ? 0 : t; };
export const eventEnd = (ev) => time(ev.ends_at || ev.starts_at);
export const eventIsPast = (ev, now = Date.now()) => eventEnd(ev) < now;
export const eventHasStarted = (ev, now = Date.now()) => time(ev.starts_at) <= now;

// What a visitor pays: the member price for active members, otherwise the public price.
export const priceFor = (ev, user) => (isActiveMember(user) ? ev.price_member_cents : ev.price_public_cents);

// 'open' | 'closed' | 'full' | 'started' | 'past'
export function registrationState(ev, spotsLeft, now = Date.now()) {
  if (eventIsPast(ev, now)) return 'past';
  if (eventHasStarted(ev, now)) return 'started';
  if (!ev.registration_open) return 'closed';
  if (spotsLeft !== null && spotsLeft <= 0) return 'full';
  return 'open';
}

// The signed-in visitor's own registrations, keyed by event id (the most useful one per event).
export async function myRegistrations(env, user, eventIds) {
  if (!user || !eventIds.length) return {};
  const marks = eventIds.map(() => '?').join(',');
  const rows = await all(env,
    `SELECT r.id, r.event_id, r.status, r.order_id, o.token AS order_token, o.status AS order_status
     FROM registrations r LEFT JOIN orders o ON o.id = r.order_id
     WHERE r.user_id = ? AND r.event_id IN (${marks}) AND r.status != 'cancelled'
     ORDER BY r.id`, user.id, ...eventIds);
  const out = {};
  for (const r of rows) {
    if (out[r.event_id] && out[r.event_id].status === 'confirmed') continue;
    const mine = { status: r.status };
    if (r.status === 'pending' && r.order_id && r.order_status === 'pending') {
      mine.checkout_url = `/checkout?order=${encodeURIComponent(r.order_id)}&token=${encodeURIComponent(r.order_token)}`;
    }
    out[r.event_id] = mine;
  }
  return out;
}

// Database row -> the Event shape in docs/API.md (plus a few helpful extras).
export function toEvent(row, { taken = 0, mine = null, user = null, now = Date.now() } = {}) {
  const spotsLeft = row.capacity === null || row.capacity === undefined ? null : Math.max(0, row.capacity - taken);
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    summary: row.summary,
    description: row.description,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    timezone: row.timezone,
    location: row.location,
    is_online: !!row.is_online,
    presenter: row.presenter || '',
    ce_info: row.ce_info || '',
    price_member_cents: row.price_member_cents,
    price_public_cents: row.price_public_cents,
    members_only: !!row.members_only,
    capacity: row.capacity,
    spots_left: spotsLeft,
    registration_open: !!row.registration_open,
    registration_state: registrationState(row, spotsLeft, now),
    your_price_cents: priceFor(row, user),
    is_past: eventIsPast(row, now),
    published: !!row.published,
    sample: !!row.sample,
    my_registration: mine,
  };
}

export async function getEventRow(env, id) {
  return first(env, `SELECT * FROM events WHERE id = ?`, id);
}

// "Saturday, January 22, 2027" in the event's own time zone (for order descriptions).
export function eventDateText(ev) {
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: ev.timezone || 'America/New_York' })
      .format(new Date(ev.starts_at));
  } catch {
    return String(ev.starts_at || '').slice(0, 10);
  }
}

// Turns a route parameter into a positive integer id, or null.
export const toId = (v) => (/^\d{1,9}$/.test(String(v || '')) ? Number(v) : null);

// For an event order: the event, its registration, and (while unpaid) whether the place can
// still be paid for. problem is a friendly sentence, or null when all is well.
export async function eventOrderInfo(env, order) {
  const ev = order.ref_id ? await getEventRow(env, order.ref_id) : null;
  const reg = await first(env, `SELECT id, status, created_at FROM registrations WHERE order_id = ? ORDER BY id DESC LIMIT 1`, order.id);
  let problem = null;
  if (order.status === 'pending') {
    if (!ev || !ev.published) problem = 'This event is no longer listed, so it cannot be paid for. Please contact us if you have questions.';
    else if (!reg || reg.status === 'cancelled') problem = 'This registration was cancelled. Please register again from the event page.';
    else {
      const taken = (await takenCounts(env, [ev.id]))[ev.id] || 0;
      const held = reg.status === 'pending' && reg.created_at > holdCutoff();
      const spotsLeft = ev.capacity === null ? null : Math.max(0, ev.capacity - taken + (held ? 1 : 0));
      const state = registrationState(ev, spotsLeft);
      if (state === 'past') problem = 'This event has already taken place, so it can no longer be paid for.';
      else if (state === 'started') problem = 'This event has already started, so registration is closed.';
      else if (state === 'closed') problem = 'Registration for this event has closed. Please contact us if you have questions.';
      else if (state === 'full') problem = 'Sorry, this event filled up before your payment was finished. Nothing was charged.';
    }
  }
  return { event: ev, registration: reg, problem };
}

// Public details of an event for receipts and the checkout page.
export const eventBrief = (ev) => (ev ? {
  id: ev.id, title: ev.title, starts_at: ev.starts_at, ends_at: ev.ends_at, timezone: ev.timezone,
  location: ev.location, is_online: !!ev.is_online, presenter: ev.presenter || '',
} : null);
