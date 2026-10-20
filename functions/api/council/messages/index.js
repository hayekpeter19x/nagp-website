// GET /api/council/messages — messages sent with the contact form, newest first.
import { json, requireUser } from '../../../../lib/http.js';
import { all } from '../../../../lib/db.js';

export async function onRequestGet(context) {
  requireUser(context, 'council');
  const rows = await all(context.env,
    `SELECT id, name, email, topic, message, handled, created_at FROM messages ORDER BY created_at DESC, id DESC LIMIT 500`);
  const messages = rows.map((r) => ({ ...r, handled: !!r.handled }));
  return json({ messages, unread: messages.filter((m) => !m.handled).length });
}
