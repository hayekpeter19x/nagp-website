// GET  /api/announcements?limit=&category=  -> { announcements: [...] }
//      Approved only, newest first. Members-only ones are included only for active members.
// POST /api/announcements  { title, body, category, link_url, visibility, official } -> { ok, id, status }
//      Members' posts wait for Council approval (status 'pending').
//      Council posts are approved at once; official: true posts as "NAGP Founding Council".
import { json, readJson, validate, requireUser, isActiveMember, isCouncil, HttpError, nowIso } from '../../../lib/http.js';
import { all, first, run } from '../../../lib/db.js';
import { ANNOUNCEMENT_CATEGORIES } from '../../../lib/config.js';
import { announcementOut } from '../../../lib/members.js';

const OFFICIAL_AUTHOR = 'NAGP Founding Council';
const MAX_PENDING = 5;

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit'), 10) || 50, 1), 100);
  const category = url.searchParams.get('category') || '';
  const member = isActiveMember(context.data.user);

  let sql = `SELECT * FROM announcements WHERE status = 'approved' AND visibility IN (${member ? `'public', 'members'` : `'public'`})`;
  const params = [];
  if (ANNOUNCEMENT_CATEGORIES.includes(category)) {
    sql += ` AND category = ?`;
    params.push(category);
  }
  sql += ` ORDER BY COALESCE(published_at, created_at) DESC, id DESC LIMIT ?`;
  params.push(limit);
  const rows = await all(context.env, sql, ...params);
  return json({ announcements: rows.map((a) => announcementOut(a)) });
}

export async function onRequestPost(context) {
  const user = requireUser(context, 'member');
  const council = isCouncil(user);
  const body = await readJson(context.request);
  const check = validate(body);
  const title = check.text('title', { label: 'A title', required: true, max: 150 });
  const text = check.text('body', { label: 'Your announcement', required: true, max: 5000, multiline: true });
  const category = check.oneOf('category', ANNOUNCEMENT_CATEGORIES, { label: 'a category' });
  const link = check.url('link_url', { label: 'Link' });
  const visibility = check.oneOf('visibility', ['public', 'members'], { label: 'who can see it' });
  const official = council && check.bool('official');
  if (!council && category === 'NAGP news') {
    check.fail('category', '"NAGP news" is for announcements from the Council. Please choose another category.');
  }
  check.done();

  const now = nowIso();
  if (council) {
    const res = await run(context.env,
      `INSERT INTO announcements (title, body, category, visibility, status, author_id, author_name, from_council, link_url,
        reviewed_by, reviewed_at, created_at, published_at)
       VALUES (?, ?, ?, ?, 'approved', ?, ?, ?, ?, ?, ?, ?, ?)`,
      title, text, category, visibility, user.id, official ? OFFICIAL_AUTHOR : user.name, official ? 1 : 0, link,
      user.id, now, now, now);
    return json({ ok: true, id: res.meta.last_row_id, status: 'approved' });
  }

  const waiting = await first(context.env,
    `SELECT COUNT(*) AS n FROM announcements WHERE author_id = ? AND status = 'pending'`, user.id);
  if (waiting && waiting.n >= MAX_PENDING) {
    throw new HttpError(429, `You already have ${MAX_PENDING} announcements waiting for approval. Please wait until the Council has looked at them, then send this one.`);
  }
  const res = await run(context.env,
    `INSERT INTO announcements (title, body, category, visibility, status, author_id, author_name, from_council, link_url, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?, 0, ?, ?)`,
    title, text, category, visibility, user.id, user.name, link, now);
  return json({ ok: true, id: res.meta.last_row_id, status: 'pending' });
}
