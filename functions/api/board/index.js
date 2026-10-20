// GET  /api/board?limit=  -> { topics: [{ id, title, author_name, created_at, last_activity, reply_count, excerpt, sample, hidden }] }
//      Most recent activity first. Hidden topics show a placeholder (the Council sees the real title).
// POST /api/board  { title, body, agree } -> { ok, id }
import { json, readJson, validate, requireUser, isCouncil, HttpError, nowIso } from '../../../lib/http.js';
import { all, first, run } from '../../../lib/db.js';
import { postOut, excerpt } from '../../../lib/members.js';

const MAX_TOPICS_PER_DAY = 10;

export async function onRequestGet(context) {
  const user = requireUser(context, 'member');
  const url = new URL(context.request.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit'), 10) || 200, 1), 500);
  const rows = await all(context.env,
    `SELECT p.*, (SELECT COUNT(*) FROM board_posts r WHERE r.parent_id = p.id) AS reply_count
     FROM board_posts p WHERE p.parent_id IS NULL
     ORDER BY p.last_activity DESC, p.id DESC LIMIT ?`, limit);
  const council = isCouncil(user);
  const topics = rows.map((p) => {
    const t = postOut(p, user);
    return {
      id: t.id,
      title: t.title,
      author_name: t.author_name,
      created_at: t.created_at,
      last_activity: t.last_activity,
      reply_count: p.reply_count || 0,
      excerpt: excerpt(t.body),
      hidden: t.hidden,
      mine: t.mine,
      sample: t.sample,
      ...(council ? { reports: t.reports } : {}),
    };
  });
  return json({ topics });
}

export async function onRequestPost(context) {
  const user = requireUser(context, 'member');
  const body = await readJson(context.request);
  const check = validate(body);
  const title = check.text('title', { label: 'A title', required: true, max: 150 });
  const text = check.text('body', { label: 'Your message', required: true, max: 5000, multiline: true });
  if (!check.bool('agree')) check.fail('agree', 'Please tick this box to confirm you have read the community guidelines.');
  check.done();

  const since = new Date(Date.now() - 864e5).toISOString();
  const recent = await first(context.env,
    `SELECT COUNT(*) AS n FROM board_posts WHERE author_id = ? AND parent_id IS NULL AND created_at > ?`, user.id, since);
  if (recent && recent.n >= MAX_TOPICS_PER_DAY) {
    throw new HttpError(429, 'You have started a lot of topics today. Please wait until tomorrow to start another one.');
  }

  const now = nowIso();
  const res = await run(context.env,
    `INSERT INTO board_posts (parent_id, title, body, author_id, author_name, created_at, last_activity)
     VALUES (NULL, ?, ?, ?, ?, ?, ?)`, title, text, user.id, user.name, now, now);
  return json({ ok: true, id: res.meta.last_row_id });
}
