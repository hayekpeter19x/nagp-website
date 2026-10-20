// GET /api/council/subscribers            mailing-list sign-ups, newest first
// GET /api/council/subscribers?format=csv a spreadsheet to paste into the Google Group
import { json, requireUser } from '../../../../lib/http.js';
import { all } from '../../../../lib/db.js';
import { csvResponse, wantsCsv } from '../../../../lib/council.js';

export async function onRequestGet(context) {
  requireUser(context, 'council');
  const rows = await all(context.env,
    `SELECT id, email, first_name, last_name, source, interest, created_at FROM subscribers ORDER BY created_at DESC, id DESC`);

  if (wantsCsv(context.request)) {
    return csvResponse('nagp-mailing-list', ['Email', 'First name', 'Last name', 'Signed up', 'Form used', 'Interested in'],
      rows.map((r) => [r.email, r.first_name, r.last_name, r.created_at.slice(0, 10), r.source, r.interest]));
  }
  return json({ subscribers: rows, total: rows.length });
}
