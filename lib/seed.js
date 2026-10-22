// Sample data for the PREVIEW site, so the Council can see how things look.
// Every row is marked sample = 1 and shows a "Sample" tag on the site.
// The Council area has a button to delete all of it before launch.
// (Set SEED_SAMPLE_DATA=false to start with an empty database instead.)

// Password for every demo/sample account: "nagp-preview" (precomputed so seeding is fast).
const DEMO_HASH = 'pbkdf2$100000$4k/xUaKkIP6W43MxkJeoKA==$1PXMjY/OxITx5Pqmzuh2rsKQ1do/uTH2z2EusHIiCXs=';

// Used by the one-click "Try it as..." buttons on the sign-in page (functions/api/auth/demo.js).
// "Try it as a member" uses the member account. The professional account is a second member, for the tests.
export const DEMO_ACCOUNTS = {
  member: { email: 'demo.member@nagp-preview.org', label: 'a member' },
  professional: { email: 'demo.professional@nagp-preview.org', label: 'another member' },
  council: { email: 'demo.council@nagp-preview.org', label: 'a Council member' },
};

// Three sample accounts, all practicing professionals listed in both directories, so the Public
// Directory and the Members Directory each show three examples.
const USERS = [
  // [name, email, role, member_type, city, state, credentials, training, specialties, bio, website, show_public]
  ['Demo Member', DEMO_ACCOUNTS.member.email, 'member', 'professional', 'Chicago', 'IL', 'LMFT',
    'Two-year Gestalt therapy training', 'clinical',
    'A demo member account. Try editing this profile and turning the public listing on and off.', '', 1],
  ['Demo Professional', DEMO_ACCOUNTS.professional.email, 'member', 'professional', 'Brooklyn', 'NY', 'LCSW',
    'Gestalt training program, 3-year certificate', 'clinical,coaching',
    'A second demo member account.', 'www.example.com', 1],
  ['Demo Council Member', DEMO_ACCOUNTS.council.email, 'council', 'professional', 'Denver', 'CO', 'PhD',
    'Gestalt training program', 'clinical,academic',
    'A demo Council account for trying the Council-only area.', '', 1],
];

const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString();

export async function seedDemoData(env) {
  const db = env.DB;
  const now = new Date().toISOString();
  const s = [];

  for (const [name, email, role, type, city, state, cred, training, spec, bio, website, pub] of USERS) {
    s.push(db.prepare(
      `INSERT OR IGNORE INTO users (email, password_hash, name, role, status, tier, member_type, membership_expires,
        city, state, credentials, training, specialties, bio, website, show_public, show_members, sample, created_at)
       VALUES (?, ?, ?, ?, 'active', 'member', ?, '2027-10-31', ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?)`
    ).bind(email, DEMO_HASH, name, role, type, city, state, cred, training, spec, bio,
      website ? 'https://' + website : '', pub, now));
  }
  await db.batch(s);

  const ids = {};
  const { results } = await db.prepare(`SELECT id, name FROM users`).all();
  for (const r of results) ids[r.name] = r.id;

  const events = [
    // [title, category, summary, description, starts, ends, tz, location, online, presenter, ce, member$, public$, membersOnly, capacity, open, sample]
    ['Community Salon: Presence in Everyday Practice', 'Salon',
      'An informal evening conversation about staying present with clients, colleagues and ourselves.',
      'Bring a cup of tea and your curiosity. We will begin with a short reflection, then talk together in small groups about what helps us stay present in our work, and what pulls us away.\n\nThe Zoom link is emailed to everyone who registers.',
      '2026-11-12T19:00:00-05:00', '2026-11-12T20:30:00-05:00', 'America/New_York', 'Online (Zoom)', 1,
      'Hosted by the Founding Council', '', 0, 1500, 0, null, 1, 1],
    ['Open Community Meeting with the Founding Council', 'Community meeting',
      'Hear the latest from the Founding Council and share your ideas for NAGP. Open to everyone.',
      'The Founding Council will share progress on membership, governance and upcoming programs, followed by open conversation. Everyone is welcome, whether or not you are a member.',
      '2026-12-05T13:00:00-05:00', '2026-12-05T14:30:00-05:00', 'America/New_York', 'Online (Zoom)', 1,
      'The Founding Council', '', 0, 0, 0, null, 1, 1],
    // Real past gatherings, from the current usgestalt.org site.
    ['2026 National Gathering, Denver', 'Gathering',
      'The second national gathering, where the organization was formally formed.',
      'Held at the Gestalt Institute of the Rockies in Denver, Colorado, in person and online. Participants reconnected, heard the proposal for legal formation, and worked together on the philosophy, values and culture of the new organization.',
      '2026-04-24T18:30:00-06:00', '2026-04-26T12:00:00-06:00', 'America/Denver', 'Gestalt Institute of the Rockies, Denver, Colorado', 0,
      '', '', 0, 0, 0, null, 0, 0],
    ['2025 Inaugural Gathering, Chicago', 'Gathering',
      'The first national gathering, where the association chose its name and set its first sense of mission.',
      'Held April 5 and 6, 2025 at The Westin O’Hare in Rosemont, Illinois, in person and on Zoom. Participants adopted a name, identified a sense of mission, brainstormed activities and formed a Next Steps Group.',
      '2025-04-05T10:00:00-05:00', '2025-04-06T15:00:00-05:00', 'America/Chicago', 'Rosemont, Illinois', 0,
      '', '', 0, 0, 0, null, 0, 0],
  ];
  // An event is only added if there is no event with the same title yet (the real past gatherings
  // are not sample data, so they are still there when the sample data is replaced).
  await db.batch(events.map((e) => db.prepare(
    `INSERT INTO events (title, category, summary, description, starts_at, ends_at, timezone, location, is_online, presenter, ce_info,
      price_member_cents, price_public_cents, members_only, capacity, registration_open, sample, created_at)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = ?)`
  ).bind(...e, now, e[0])));

  const council = ids['Demo Council Member'];
  const announcements = [
    // [title, body, category, visibility, status, authorName, fromCouncil, link, daysAgo]
    ['Thank you for joining our first open community meeting',
      'On September 27, 2026, Gestalt practitioners from across the country joined the Founding Council for our first open community meeting. Thank you to everyone who came, listened and shared.\n\nNotes from the meeting will be posted for members soon.',
      'NAGP news', 'public', 'approved', 'NAGP Founding Council', 1, '', 23],
    ['Membership is coming soon',
      'The Founding Council is finishing the details of membership categories, dues and benefits. Join the mailing list to be the first to know when membership opens.',
      'NAGP news', 'public', 'approved', 'NAGP Founding Council', 1, '', 10],
    ['Call for presenters: winter salon series',
      'We are looking for members who would like to host a one-hour online salon this winter. Topics can be anything connected to Gestalt practice, theory or community. Write to the Council with a short description of your idea.',
      'Opportunity', 'members', 'approved', 'NAGP Founding Council', 1, '', 4],
  ];
  await db.batch(announcements.map(([title, body, cat, vis, status, author, fromCouncil, link, ago]) => db.prepare(
    `INSERT INTO announcements (title, body, category, visibility, status, author_id, author_name, from_council, link_url,
      reviewed_by, reviewed_at, sample, created_at, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  ).bind(title, body, cat, vis, status, ids[author] || council, author, fromCouncil, link,
    status === 'approved' ? council : null, status === 'approved' ? daysAgo(ago) : null,
    daysAgo(ago + 1), status === 'approved' ? daysAgo(ago) : null)));

  const topics = [
    ['Welcome! Introduce yourself here', 'Welcome to the NAGP community board. Please say hello: where you are, how you came to Gestalt, and what you hope to find here.', 'Demo Council Member', 9,
      [['Demo Professional', 'Hello from Brooklyn! I trained many years ago and am glad to see this coming together.', 8],
       ['Demo Member', 'Hi everyone, hello from Chicago. Happy to be here and to learn from all of you.', 7]]],
    ['How are you working with Gestalt experiments in telehealth?', 'I would love to hear how others adapt experiments for video sessions. What has worked for you, and what has not?', 'Demo Professional', 5,
      [['Demo Member', 'I often invite clients to notice their breath and posture before we begin. Simple, but it changes the whole session.', 4]]],
  ];
  for (const [title, body, author, ago, replies] of topics) {
    const last = replies.length ? replies[replies.length - 1][2] : ago;
    const res = await db.prepare(
      `INSERT INTO board_posts (title, body, author_id, author_name, sample, created_at, last_activity) VALUES (?, ?, ?, ?, 1, ?, ?)`
    ).bind(title, body, ids[author], author, daysAgo(ago), daysAgo(last)).run();
    const topicId = res.meta.last_row_id;
    if (replies.length) {
      await db.batch(replies.map(([who, text, rAgo]) => db.prepare(
        `INSERT INTO board_posts (parent_id, body, author_id, author_name, sample, created_at, last_activity) VALUES (?, ?, ?, ?, 1, ?, ?)`
      ).bind(topicId, text, ids[who], who, daysAgo(rAgo), daysAgo(rAgo))));
    }
  }

  const PLACEHOLDER = 'Placeholder. The Council will move the real document over from Notion (or add a link to it).';
  const docs = [
    ['Bylaws (draft)', 'Bylaws', 'The draft bylaws of NAGP, under review by the Founding Council.', 'public', '2026-09-15'],
    ['Articles of Incorporation', 'Incorporation', 'The documents that formally created NAGP as an organization.', 'public', '2026-06-01'],
    ['Minutes: Open Community Meeting, September 27, 2026', 'Minutes', 'Notes from the first open community meeting.', 'members', '2026-09-27'],
    ['Minutes: Founding Council meeting, October 2026', 'Minutes', 'Notes from the October meeting of the Founding Council.', 'members', '2026-10-08'],
    ['Council working notes: membership launch plan', 'Other', 'Internal planning notes. Visible to the Council only.', 'council', '2026-10-12'],
  ];
  await db.batch(docs.map(([title, cat, desc, vis, date]) => db.prepare(
    `INSERT INTO documents (title, category, description, body, doc_date, visibility, sample, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`
  ).bind(title, cat, desc, PLACEHOLDER, date, vis, now, now)));
}

// Every made-up row (sample = 1) and what depends on it: the demo accounts' sign-in sessions,
// registrations and payments for sample events or accounts, replies under sample topics, and reports
// about sample posts. Used by the Council's "Delete all sample data" button and by replaceSampleData.
const SAMPLE_USERS = `SELECT id FROM users WHERE sample = 1`;
const SAMPLE_EVENTS = `SELECT id FROM events WHERE sample = 1`;
const SAMPLE_POSTS = `SELECT id FROM board_posts WHERE sample = 1 OR parent_id IN (SELECT id FROM board_posts WHERE sample = 1)`;
export const SAMPLE_DELETE_STEPS = [
  ['sessions', `DELETE FROM sessions WHERE user_id IN (${SAMPLE_USERS})`],
  ['registrations', `DELETE FROM registrations WHERE event_id IN (${SAMPLE_EVENTS}) OR user_id IN (${SAMPLE_USERS})`],
  ['orders', `DELETE FROM orders WHERE user_id IN (${SAMPLE_USERS})
      OR (kind = 'event' AND ref_id IN (${SAMPLE_EVENTS})) OR (kind = 'membership' AND ref_id IN (${SAMPLE_USERS}))`],
  ['board_reports', `DELETE FROM board_reports WHERE post_id IN (${SAMPLE_POSTS}) OR reporter_id IN (${SAMPLE_USERS})`],
  ['board_posts', `DELETE FROM board_posts WHERE id IN (${SAMPLE_POSTS})`],
  ['announcements', `DELETE FROM announcements WHERE sample = 1`],
  ['documents', `DELETE FROM documents WHERE sample = 1`],
  ['events', `DELETE FROM events WHERE sample = 1`],
  ['users', `DELETE FROM users WHERE sample = 1`],
];

// Schema version 4: a preview database filled with the older, larger set of sample data gets the
// current, smaller set instead. Real rows are kept. Does nothing if the sample data was deleted already.
export async function replaceSampleData(env) {
  const db = env.DB;
  if (env.SEED_SAMPLE_DATA === 'false') return;
  const left = await db.prepare(`SELECT COUNT(*) AS n FROM users WHERE sample = 1`).first();
  if (!left || !left.n) return;
  // Only one request does it, even if several arrive at once.
  const lock = await db.prepare(`INSERT OR IGNORE INTO meta (key, value) VALUES ('sample_data_replaced', ?)`)
    .bind(new Date().toISOString()).run();
  if (lock.meta.changes !== 1) return;
  await db.batch(SAMPLE_DELETE_STEPS.map(([, sql]) => db.prepare(sql)));
  await seedDemoData(env);
}
