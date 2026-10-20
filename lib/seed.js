// Sample data for the PREVIEW site, so the Council can see how things look.
// Every row is marked sample = 1 and shows a "Sample" tag on the site.
// The Council area has a button to delete all of it before launch.
// (Set SEED_SAMPLE_DATA=false to start with an empty database instead.)

// Password for every demo/sample account: "nagp-preview" (precomputed so seeding is fast).
const DEMO_HASH = 'pbkdf2$100000$4k/xUaKkIP6W43MxkJeoKA==$1PXMjY/OxITx5Pqmzuh2rsKQ1do/uTH2z2EusHIiCXs=';

// Used by the one-click "Try it as..." buttons on the sign-in page (functions/api/auth/demo.js).
export const DEMO_ACCOUNTS = {
  member: { email: 'demo.member@nagp-preview.org', label: 'an Associate Member' },
  professional: { email: 'demo.professional@nagp-preview.org', label: 'a Professional Member' },
  council: { email: 'demo.council@nagp-preview.org', label: 'a Council member' },
};

const USERS = [
  // [name, email, role, tier, member_type, city, state, credentials, training, specialties, bio, website, show_public]
  ['Demo Member', DEMO_ACCOUNTS.member.email, 'member', 'associate', 'associate', 'Chicago', 'IL', '', '', '',
    'I am a demo account so the Council can try the members-only parts of the site.', '', 0],
  ['Demo Professional', DEMO_ACCOUNTS.professional.email, 'member', 'professional', 'professional', 'Brooklyn', 'NY', 'LCSW',
    'Gestalt training program, 3-year certificate', 'clinical,coaching',
    'A demo professional account. Try editing this profile and turning the public listing on and off.', 'www.example.com', 1],
  ['Demo Council Member', DEMO_ACCOUNTS.council.email, 'council', 'professional', 'professional', 'Denver', 'CO', 'PhD',
    'Gestalt training program', 'clinical,academic',
    'A demo Council account for trying the Council-only area.', '', 0],
  ['Maria Delgado-Reyes', 'maria.delgado@example.com', 'member', 'professional', 'professional', 'Albuquerque', 'NM', 'LPCC',
    'Three-year Gestalt therapy training (2014)', 'clinical',
    'I work with adults and couples, with a focus on grief, life transitions and the body in therapy. Sessions in English and Spanish.', 'www.example.com/maria', 1],
  ['David Okafor', 'david.okafor@example.com', 'member', 'professional', 'professional', 'Cleveland', 'OH', 'PhD, LPC',
    'Post-graduate Gestalt training; Gestalt supervision training', 'clinical,academic',
    'Psychotherapist and adjunct faculty. I teach Gestalt theory to counseling students and offer consultation groups.', '', 1],
  ['Susan Whitfield', 'susan.whitfield@example.com', 'member', 'professional', 'professional', 'Portland', 'OR', 'PCC (ICF)',
    'Gestalt coaching certificate (2018)', 'coaching',
    'Executive and leadership coach helping people notice what is happening in the moment and choose from there.', 'www.example.com/susan', 1],
  ['Robert Lindqvist', 'robert.lindqvist@example.com', 'member', 'professional', 'professional', 'Minneapolis', 'MN', 'MA',
    'Gestalt organization and systems development program', 'od',
    'Organizational consultant supporting teams through change, conflict and growth.', '', 1],
  ['Ellen Marsh', 'ellen.marsh@example.com', 'member', 'professional', 'professional', 'Brooklyn', 'NY', 'LCSW-R',
    'Gestalt therapy training, New York', 'clinical',
    'Individual and group therapy for adults. Longtime group facilitator.', '', 1],
  ['Thomas Avery', 'thomas.avery@example.com', 'member', 'professional', 'professional', 'Austin', 'TX', 'PhD',
    'Gestalt therapy training; trainer since 2010', 'academic,clinical',
    'Trainer and supervisor. I lead year-long Gestalt training groups for clinicians.', '', 1],
  ['Linh Tran', 'linh.tran@example.com', 'member', 'professional', 'professional', 'San Jose', 'CA', 'LMFT',
    'Gestalt therapy training (2016)', 'clinical,coaching',
    'Therapist for individuals and families, with telehealth across California.', '', 1],
  ['Patricia Gomez', 'patricia.gomez@example.com', 'member', 'professional', 'professional', 'Miami', 'FL', 'PsyD',
    'Gestalt therapy post-graduate training', 'clinical',
    'Clinical psychologist working with trauma and anxiety.', '', 1],
  ['Henry Caldwell', 'henry.caldwell@example.com', 'member', 'professional', 'professional', 'Denver', 'CO', 'MBA, PCC',
    'Gestalt coaching and organizational development training', 'coaching,od',
    'Coach and consultant for leaders and leadership teams.', '', 1],
  ['Ruth Feldman', 'ruth.feldman@example.com', 'member', 'professional', 'professional', 'Philadelphia', 'PA', 'EdD',
    'Gestalt therapy training; Gestalt educator', 'academic',
    'Educator and researcher writing about Gestalt approaches to learning.', '', 1],
  ['Grace Holloway', 'grace.holloway@example.com', 'member', 'professional', 'professional', 'Asheville', 'NC', 'LCMHC',
    'Gestalt therapy training (2012)', 'clinical',
    'Therapist in private practice. (This sample member chose NOT to appear in the public directory.)', '', 0],
  ['Ahmed Siddiqui', 'ahmed.siddiqui@example.com', 'member', 'professional', 'professional', 'Toronto', 'ON', 'RP',
    'Gestalt psychotherapy training', 'clinical,od',
    'Registered psychotherapist and workplace consultant.', '', 1],
  ['Michael Romero', 'michael.romero@example.com', 'member', 'professional', 'professional', 'Santa Fe', 'NM', 'LISW',
    'Gestalt therapy training (2008)', 'clinical',
    'Therapist working with men, fathers and families.', '', 1],
  ['Julia Hartmann', 'julia.hartmann@example.com', 'member', 'professional', 'professional', 'Boston', 'MA', 'PhD',
    'Gestalt organization and systems development', 'od,academic',
    'Consultant and lecturer on group dynamics in organizations.', '', 1],
  ['Samuel Brooks', 'samuel.brooks@example.com', 'member', 'associate', 'associate', 'Chicago', 'IL', '', '', '',
    'Retired teacher and longtime friend of the Gestalt community.', '', 0],
  ['Carol Benson', 'carol.benson@example.com', 'member', 'associate', 'associate', 'Indianapolis', 'IN', '', '', '',
    'Grateful participant in Gestalt workshops for many years.', '', 0],
  ['Naomi Fischer', 'naomi.fischer@example.com', 'member', 'student', 'student', 'Seattle', 'WA', '', 'Second year of a Gestalt training program', '',
    'Counseling graduate student and Gestalt trainee.', '', 0],
  ['Kevin Walsh', 'kevin.walsh@example.com', 'member', 'student', 'student', 'Atlanta', 'GA', '', 'First year of Gestalt training', '',
    'Social work student interested in group work.', '', 0],
];

const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString();

export async function seedDemoData(env) {
  const db = env.DB;
  const now = new Date().toISOString();
  const s = [];

  for (const [name, email, role, tier, type, city, state, cred, training, spec, bio, website, pub] of USERS) {
    s.push(db.prepare(
      `INSERT OR IGNORE INTO users (email, password_hash, name, role, status, tier, member_type, membership_expires,
        city, state, credentials, training, specialties, bio, website, show_public, show_members, sample, created_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?, '2027-10-31', ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?)`
    ).bind(email, DEMO_HASH, name, role, tier, type, city, state, cred, training, spec, bio,
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
    ['Weekend Training: Foundations of Gestalt Group Work', 'Training',
      'A two-day, in-person training for clinicians, coaches and facilitators who lead groups.',
      'An experiential weekend on the foundations of Gestalt group work: awareness, contact, and the group as a living field. Includes demonstration, practice in small groups, and time for questions.\n\nSuitable for licensed clinicians, coaches, and trainees with some group experience.',
      '2027-01-22T18:00:00-07:00', '2027-01-24T12:00:00-07:00', 'America/Denver', 'Denver, Colorado (venue to be confirmed)', 0,
      'Presenter to be announced', 'Continuing education credits: to be confirmed.', 29500, 37500, 0, 24, 1, 1],
    ['Presentation: Gestalt in Organizations, a Case Conversation', 'Presentation',
      'A lunchtime presentation and discussion about Gestalt approaches to organizational change.',
      'Two organizational development practitioners walk through a real (anonymized) consulting case and invite discussion.',
      '2027-02-18T12:00:00-08:00', '2027-02-18T13:30:00-08:00', 'America/Los_Angeles', 'Online (Zoom)', 1,
      'Presenters to be announced', '', 2000, 3500, 0, 100, 1, 1],
    ['Members-only Salon: Supervision and Consultation', 'Salon',
      'A conversation for members about giving and receiving Gestalt supervision.',
      'An informal salon for members only. Share how you find, offer and use supervision and peer consultation.',
      '2027-03-11T19:00:00-05:00', '2027-03-11T20:30:00-05:00', 'America/New_York', 'Online (Zoom)', 1,
      'Hosted by the Founding Council', '', 0, 0, 1, 60, 1, 1],
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
  await db.batch(events.map((e) => db.prepare(
    `INSERT INTO events (title, category, summary, description, starts_at, ends_at, timezone, location, is_online, presenter, ce_info,
      price_member_cents, price_public_cents, members_only, capacity, registration_open, sample, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(...e, now)));

  const council = ids['Demo Council Member'];
  const announcements = [
    // [title, body, category, visibility, status, authorName, fromCouncil, link, daysAgo]
    ['Thank you for joining our first open community meeting',
      'On September 27, 2026, Gestalt practitioners from across the country joined the Founding Council for our first open community meeting. Thank you to everyone who came, listened and shared.\n\nNotes from the meeting will be posted for members soon.',
      'NAGP news', 'public', 'approved', 'NAGP Founding Council', 1, '', 23],
    ['Membership is coming soon',
      'The Founding Council is finishing the details of membership categories, dues and benefits. Join the mailing list to be the first to know when membership opens.',
      'NAGP news', 'public', 'approved', 'NAGP Founding Council', 1, '', 10],
    ['New Gestalt consultation group forming in Portland',
      'I am starting a monthly peer consultation group for Gestalt-trained coaches and therapists in the Portland area. We will meet in person on the first Thursday of each month. Please reach out if you are interested.',
      'Member news', 'public', 'approved', 'Susan Whitfield', 0, '', 6],
    ['Call for presenters: winter salon series',
      'We are looking for members who would like to host a one-hour online salon this winter. Topics can be anything connected to Gestalt practice, theory or community. Write to the Council with a short description of your idea.',
      'Opportunity', 'members', 'approved', 'NAGP Founding Council', 1, '', 4],
    ['Reading group: Gestalt Therapy by Perls, Hefferline and Goodman',
      'I would like to start an online reading group working slowly through the 1951 classic, one chapter a month. All levels welcome.',
      'Member news', 'public', 'pending', 'Ellen Marsh', 0, '', 2],
    ['Workshop offering: Embodied presence for coaches',
      'A half-day online workshop for coaches on working with breath, posture and sensation in the coaching conversation.',
      'Event', 'public', 'pending', 'Henry Caldwell', 0, '', 1],
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
      [['David Okafor', 'Hello from Cleveland! I trained here many years ago and now teach. Glad to see this coming together.', 8],
       ['Naomi Fischer', 'Hi everyone, I am a second-year trainee in Seattle. Happy to be here and to learn from all of you.', 7]]],
    ['How are you working with Gestalt experiments in telehealth?', 'I would love to hear how others adapt experiments for video sessions. What has worked for you, and what has not?', 'Linh Tran', 5,
      [['Maria Delgado-Reyes', 'I often invite clients to notice their breath and posture before we begin. Simple, but it changes the whole session.', 4]]],
    ['Ideas for regional gatherings', 'Would anyone in the Upper Midwest be interested in an in-person regional day next spring?', 'Robert Lindqvist', 2, []],
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
