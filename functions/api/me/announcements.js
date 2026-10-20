// GET /api/me/announcements -> { announcements: [...] }
// The signed-in member's own submissions, newest first, with status and any decline reason.
import { json, requireUser } from '../../../lib/http.js';
import { all } from '../../../lib/db.js';
import { announcementOut } from '../../../lib/members.js';

export async function onRequestGet(context) {
  const user = requireUser(context, 'member');
  const rows = await all(context.env,
    `SELECT * FROM announcements WHERE author_id = ? ORDER BY created_at DESC, id DESC LIMIT 100`, user.id);
  return json({ announcements: rows.map((a) => announcementOut(a, { withStatus: true })) });
}
