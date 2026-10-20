// GET /api/announcements/:id -> { announcement }
// Approved announcements are public (members-only ones need an active member).
// The author and the Council can also open a pending or declined one; it then includes its status.
import { json, isActiveMember, isCouncil, HttpError } from '../../../lib/http.js';
import { first } from '../../../lib/db.js';
import { announcementOut } from '../../../lib/members.js';

export async function onRequestGet(context) {
  const id = Number(context.params.id);
  const notFound = new HttpError(404, 'We could not find that announcement. It may have been removed.');
  if (!Number.isInteger(id) || id < 1) throw notFound;
  const a = await first(context.env, `SELECT * FROM announcements WHERE id = ?`, id);
  if (!a) throw notFound;

  const user = context.data.user;
  const owner = !!user && (a.author_id === user.id || isCouncil(user));
  if (a.status !== 'approved') {
    if (!owner) throw notFound;
    return json({ announcement: announcementOut(a, { withStatus: true }) });
  }
  if (a.visibility === 'members' && !isActiveMember(user)) {
    if (!user) throw new HttpError(401, 'This announcement is for NAGP members. Please sign in to read it.');
    throw new HttpError(403, 'This announcement is for NAGP members with an active membership.');
  }
  return json({ announcement: announcementOut(a, { withStatus: owner }) });
}
