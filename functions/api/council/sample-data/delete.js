// POST /api/council/sample-data/delete  { confirm: true }
// Before launch: removes every made-up preview row (sample = 1) from every table, together with
// what depends on it: the demo accounts' sign-in sessions, registrations and payments for sample
// events or accounts, replies under sample topics, and reports about sample posts.
// The one-click demo sign-in stops working afterwards, because the demo accounts are gone.
// Everything happens in one transaction, so it is all-or-nothing.
import { json, readJson, requireUser, HttpError } from '../../../../lib/http.js';
import { first } from '../../../../lib/db.js';
import { SAMPLE_DELETE_STEPS } from '../../../../lib/seed.js';

const STEPS = SAMPLE_DELETE_STEPS;

export async function onRequestPost(context) {
  const me = requireUser(context, 'council');
  const { env, request } = context;
  const body = await readJson(request);
  if (body.confirm !== true) throw new HttpError(400, 'Please confirm that you want to delete all the sample data.');

  // Never leave the site without a way into the Council area.
  const real = await first(env,
    `SELECT COUNT(*) AS n FROM users WHERE role IN ('council', 'admin') AND sample = 0 AND status != 'suspended'
       AND password_hash IS NOT NULL AND password_hash != ''`);
  if (!real || !real.n) {
    throw new HttpError(409, 'Before deleting the sample data, please give at least one real Council member an account with a password '
      + '(Members page: "Add a member by hand", then choose "Edit" and set their role to Council). '
      + 'Otherwise nobody could sign in to the Council area afterwards, because the demo accounts are removed too.');
  }

  const results = await env.DB.batch(STEPS.map(([, sql]) => env.DB.prepare(sql)));
  const deleted = {};
  let total = 0;
  STEPS.forEach(([name], i) => {
    deleted[name] = results[i].meta.changes || 0;
    total += deleted[name];
  });
  const signedOut = !!me.sample;
  return json({
    ok: true,
    deleted,
    total,
    signed_out: signedOut,
    message: total
      ? 'All the sample data was deleted. The demo accounts and the one-click demo sign-in are gone too.'
      : 'There was no sample data left to delete.',
  });
}
