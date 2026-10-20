// POST /api/council/announcements/:id  { action: 'approve'|'decline'|'unpublish'|'delete', reason }
import { json, readJson, validate, requireUser, HttpError, nowIso } from '../../../../lib/http.js';
import { first, run } from '../../../../lib/db.js';
import { idParam } from '../../../../lib/council.js';

export async function onRequestPost(context) {
  const user = requireUser(context, 'council');
  const { env, request } = context;
  const id = idParam(context, 'announcement');
  const body = await readJson(request);
  const check = validate(body);
  const action = check.oneOf('action', ['approve', 'decline', 'unpublish', 'delete'], { label: 'what to do' });
  const reason = check.text('reason', { label: 'Reason', max: 1000, multiline: true });
  check.done();

  const item = await first(env, `SELECT id, title, status, published_at FROM announcements WHERE id = ?`, id);
  if (!item) throw new HttpError(404, 'We could not find that announcement. It may have been deleted already.');
  const now = nowIso();

  if (action === 'approve') {
    await run(env,
      `UPDATE announcements SET status = 'approved', decline_reason = '', reviewed_by = ?, reviewed_at = ?,
              published_at = COALESCE(published_at, ?) WHERE id = ?`, user.id, now, now, id);
    return json({ ok: true, status: 'approved', message: `Approved. "${item.title}" is now on the Announcements page.` });
  }
  if (action === 'decline' || action === 'unpublish') {
    if (action === 'unpublish' && item.status !== 'approved') throw new HttpError(400, 'Only published announcements can be unpublished.');
    await run(env,
      `UPDATE announcements SET status = 'declined', decline_reason = ?, reviewed_by = ?, reviewed_at = ?, published_at = NULL
        WHERE id = ?`, reason, user.id, now, id);
    return json({
      ok: true,
      status: 'declined',
      message: action === 'decline'
        ? `Not approved. "${item.title}" will not be posted.${reason ? ' The member can see your reason on their page.' : ''}`
        : `Unpublished. "${item.title}" is no longer on the Announcements page.`,
    });
  }
  // delete
  await run(env, `DELETE FROM announcements WHERE id = ?`, id);
  return json({ ok: true, status: 'deleted', message: `Deleted. "${item.title}" has been removed for good.` });
}
