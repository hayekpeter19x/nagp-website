// GET /api/council/summary — the numbers on the Council dashboard.
import { json, requireUser } from '../../../lib/http.js';
import { first } from '../../../lib/db.js';
import { daysAgoIso } from '../../../lib/council.js';

const count = async (env, sql, ...params) => Number((await first(env, sql, ...params))?.n || 0);

export async function onRequestGet(context) {
  requireUser(context, 'council');
  const { env } = context;
  const since30 = daysAgoIso(30);

  const [pendingAnnouncements, openReports, unreadMessages, openFeedback,
    activeMembers, newMembers, waitingForPayment, subscribers, upcomingEvents, payments,
    sampleUsers, sampleOther, realCouncil] = await Promise.all([
    count(env, `SELECT COUNT(*) AS n FROM announcements WHERE status = 'pending'`),
    // Number of board posts with at least one report nobody has looked at yet.
    count(env, `SELECT COUNT(DISTINCT post_id) AS n FROM board_reports WHERE resolved = 0`),
    count(env, `SELECT COUNT(*) AS n FROM messages WHERE handled = 0`),
    count(env, `SELECT COUNT(*) AS n FROM feedback WHERE resolved = 0`),
    count(env, `SELECT COUNT(*) AS n FROM users WHERE status = 'active'`),
    count(env, `SELECT COUNT(*) AS n FROM users WHERE status = 'active' AND created_at >= ?`, since30),
    count(env, `SELECT COUNT(*) AS n FROM users WHERE status = 'pending'`),
    count(env, `SELECT COUNT(*) AS n FROM subscribers`),
    count(env, `SELECT COUNT(*) AS n FROM events WHERE published = 1 AND julianday(COALESCE(ends_at, starts_at)) >= julianday('now')`),
    first(env, `SELECT COUNT(*) AS n, COALESCE(SUM(amount_cents), 0) AS cents FROM orders WHERE status = 'paid' AND paid_at >= ?`, since30),
    count(env, `SELECT COUNT(*) AS n FROM users WHERE sample = 1`),
    count(env, `SELECT (SELECT COUNT(*) FROM announcements WHERE sample = 1) + (SELECT COUNT(*) FROM events WHERE sample = 1)
      + (SELECT COUNT(*) FROM documents WHERE sample = 1) + (SELECT COUNT(*) FROM board_posts WHERE sample = 1) AS n`),
    count(env, `SELECT COUNT(*) AS n FROM users WHERE role IN ('council', 'admin') AND sample = 0 AND status != 'suspended' AND password_hash IS NOT NULL`),
  ]);

  return json({
    attention: {
      pending_announcements: pendingAnnouncements,
      open_reports: openReports,
      unread_messages: unreadMessages,
      open_feedback: openFeedback,
    },
    glance: {
      active_members: activeMembers,
      new_members_30d: newMembers,
      waiting_for_payment: waitingForPayment,
      subscribers,
      upcoming_events: upcomingEvents,
      payments_30d_count: Number(payments?.n || 0),
      payments_30d_cents: Number(payments?.cents || 0),
    },
    sample: {
      accounts: sampleUsers,
      other: sampleOther,
      total: sampleUsers + sampleOther,
      real_council_accounts: realCouncil,
    },
  });
}
