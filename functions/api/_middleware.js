// Runs before every /api/* request: database set-up, who is signed in,
// basic cross-site request protection, and friendly error messages.
import { ensureDb } from '../../lib/db.js';
import { getSessionUser } from '../../lib/auth.js';
import { HttpError, errorResponse } from '../../lib/http.js';

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function onRequest(context) {
  const { request, env } = context;
  try {
    if (!env.DB) throw new HttpError(500, 'The database is not connected yet. In Cloudflare, add a D1 database binding named DB to this Pages project.');
    await ensureDb(env);

    const url = new URL(request.url);
    // Block forms posted from other websites. (Stripe's webhook is checked by signature instead.)
    if (UNSAFE.has(request.method) && !url.pathname.startsWith('/api/stripe/')) {
      const origin = request.headers.get('origin');
      if (origin && origin !== url.origin) throw new HttpError(403, 'This request was blocked for your security.');
    }

    context.data.user = await getSessionUser(request, env);
    // Preview mode: one-click demo sign-in and simulated payments. Set DEMO_MODE=false when going live.
    context.data.demo = env.DEMO_MODE !== 'false';
    return await context.next();
  } catch (err) {
    return errorResponse(err);
  }
}
