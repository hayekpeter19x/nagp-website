// Shared settings for the whole site. Used by the server (Cloudflare Functions)
// AND copied into the browser at build time as /assets/js/config.js, so there is
// one place to change names, prices and lists.

export const ORG = {
  name: 'North American Gestalt Professionals',
  short: 'NAGP',
  tagline: 'A professional home for Gestalt practitioners',
  // Taken from the current usgestalt.org site. Council to confirm.
  email: 'usgestalt2025@gmail.com',
  listserv: 'unitedstatesgestalt@googlegroups.com',
  // While true, every page shows the "preview" banner and the feedback button.
  preview: true,
};

// Specialties used by the public directory (from Ken's notes).
export const SPECIALTIES = [
  { key: 'clinical', label: 'Clinical' },
  { key: 'coaching', label: 'Coaching' },
  { key: 'od', label: 'Organizational Development' },
  { key: 'academic', label: 'Academic / Training' },
];

// PLACEHOLDER PRICES. The brief says not to publish dues until the Council
// confirms them. The site labels these as sample prices while ORG.preview is on.
export const MEMBERSHIP_TIERS = [
  {
    key: 'professional',
    name: 'Professional Member',
    price_cents: 15000,
    period: 'year',
    professional: true,
    who: 'For licensed clinicians, coaches, organizational consultants and educators who work from a Gestalt perspective.',
    benefits: [
      'Optional listing in the public "Find a Practitioner" directory',
      'Listing in the members-only directory',
      'Member prices on trainings and events',
      'Post announcements and join the community board',
      'A voice in shaping the future of NAGP',
    ],
  },
  {
    key: 'associate',
    name: 'Associate Member',
    price_cents: 7500,
    period: 'year',
    professional: false,
    who: 'For anyone who values Gestalt and wants to belong, including people who are not practicing professionals.',
    benefits: [
      'Listing in the members-only directory',
      'Member prices on trainings and events',
      'Post announcements and join the community board',
      'A voice in shaping the future of NAGP',
    ],
  },
  {
    key: 'student',
    name: 'Student / Trainee Member',
    price_cents: 4000,
    period: 'year',
    professional: false,
    who: 'For people currently in a Gestalt training program or graduate study.',
    benefits: [
      'Listing in the members-only directory',
      'Member prices on trainings and events',
      'Join the community board and connect with mentors',
    ],
  },
];

export const DONATION_AMOUNTS_CENTS = [2500, 5000, 10000, 25000];

export const EVENT_CATEGORIES = ['Training', 'Salon', 'Community meeting', 'Gathering', 'Presentation'];
export const ANNOUNCEMENT_CATEGORIES = ['NAGP news', 'Member news', 'Event', 'Opportunity', 'Resource'];
export const DOCUMENT_CATEGORIES = ['Bylaws', 'Incorporation', 'Minutes', 'Policies', 'Other'];

// Who can see a document or announcement.
export const VISIBILITY = [
  { key: 'public', label: 'Everyone (public)' },
  { key: 'members', label: 'Members only' },
  { key: 'council', label: 'Council only' },
];

export const REGIONS = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'],
  ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'],
  ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'],
  ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'],
  ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'],
  ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'], ['PR', 'Puerto Rico'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'],
  ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'],
  ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
  ['AB', 'Alberta (Canada)'], ['BC', 'British Columbia (Canada)'], ['MB', 'Manitoba (Canada)'],
  ['NB', 'New Brunswick (Canada)'], ['NL', 'Newfoundland and Labrador (Canada)'],
  ['NS', 'Nova Scotia (Canada)'], ['ON', 'Ontario (Canada)'], ['PE', 'Prince Edward Island (Canada)'],
  ['QC', 'Quebec (Canada)'], ['SK', 'Saskatchewan (Canada)'], ['NT', 'Northwest Territories (Canada)'],
  ['NU', 'Nunavut (Canada)'], ['YT', 'Yukon (Canada)'],
  ['MX', 'Mexico'], ['OT', 'Outside North America'],
].map(([code, name]) => ({ code, name }));

export const regionName = (code) => REGIONS.find((r) => r.code === code)?.name || code || '';
export const tierByKey = (key) => MEMBERSHIP_TIERS.find((t) => t.key === key) || null;

// Everything the browser is allowed to know. Written to /assets/js/config.js by build.mjs.
export const PUBLIC_CONFIG = {
  ORG, SPECIALTIES, MEMBERSHIP_TIERS, DONATION_AMOUNTS_CENTS, EVENT_CATEGORIES,
  ANNOUNCEMENT_CATEGORIES, DOCUMENT_CATEGORIES, VISIBILITY, REGIONS,
};
