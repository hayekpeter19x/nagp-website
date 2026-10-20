// POST /api/board/:id/replies  { body } -> { ok, id }
// Adds a reply to a topic and moves the topic to the top of the list (last_activity).
import { json, readJson, validate, requireUser, isCouncil, HttpError, nowIso } from '../../../../lib/http.js';
import { first } from '../../../../lib/db.js';

const MAX_REPLIES_PER_DAY = 40;

export async function onRequestPost(context) {
  const user = requireUser(context, 'member');
  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(404, 'We could not find that topic. It may have been removed.');
  const topic = await first(context.env, `SELECT id, hidden FROM board_posts WHERE id = ? AND parent_id IS NULL`, id);
  if (!topic) throw new HttpError(404, 'We could not find that topic. It may have been removed.');
  if (topic.hidden && !isCouncil(user)) {
    throw new HttpError(403, 'This topic was hidden by the Council, so it is closed to new replies.');
  }

  const body = await readJson(context.request);
  const check = validate(body);
  const text = check.text('body', { label: 'Your reply', required: true, max: 5000, multiline: true });
  check.done();

  const since = new Date(Date.now() - 864e5).toISOString();
  const recent = await first(context.env,
    `SELECT COUNT(*) AS n FROM board_posts WHERE author_id = ? AND parent_id IS NOT NULL AND created_at > ?`, user.id, since);
  if (recent && recent.n >= MAX_REPLIES_PER_DAY) {
    throw new HttpError(429, 'You have posted a lot of replies today. Please wait until tomorrow to post more.');
  }

  const now = nowIso();
  const db = context.env.DB;
  const [inserted] = await db.batch([
    db.prepare(`INSERT INTO board_posts (parent_id, title, body, author_id, author_name, created_at, last_activity)
                VALUES (?, '', ?, ?, ?, ?, ?)`).bind(id, text, user.id, user.name, now, now),
    db.prepare(`UPDATE board_posts SET last_activity = ? WHERE id = ?`).bind(now, id),
  ]);
  return json({ ok: true, id: inserted.meta.last_row_id });
}
