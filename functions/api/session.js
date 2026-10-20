// GET /api/session — who is signed in, plus site mode flags.
import { json } from '../../lib/http.js';
import { toSessionUser } from '../../lib/auth.js';

export async function onRequestGet({ data, env }) {
  return json({
    user: toSessionUser(data.user),
    demo: data.demo,
    payments: env.STRIPE_SECRET_KEY ? 'stripe' : 'demo',
  });
}
