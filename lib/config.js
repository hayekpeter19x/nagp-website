// Shared settings for the whole site. Used by the server (Cloudflare Functions)
// AND copied into the browser at build time as /assets/js/config.js, so there is
// one place to change names, prices and lists.

export const ORG = {
  name: 'National Association of Gestalt Practitioners',
  short: 'NAGP',
  tagline: 'A professional home for Gestalt practitioners',
  // Taken from the current usgestalt.org site. Council to confirm.
  email: 'usgestalt2025@gmail.com',
  listserv: 'unitedstatesgestalt@googlegroups.com',
  // While true, every page shows the "preview" banner and the feedback button.
  preview: true,
  // While false, prices and payment amounts show as "X$" (dues are not confirmed yet).
  showPrices: false,
};

// Specialties used by the public directory (from Ken's notes).
export const SPECIALTIES = [
  { key: 'clinical', label: 'Clinical' },
  { key: 'coaching', label: 'Coaching' },
  { key: 'od', label: 'Organizational Development' },
  { key: 'academic', label: 'Academic / Training' },
];

// One membership for everyone. PLACEHOLDER PRICE: the Council has not set dues yet, and the
// brief says not to publish them, so the site shows every amount as "X$" while ORG.showPrices is false.
export const MEMBERSHIP_TIERS = [
  {
    key: 'member',
    name: 'Member',
    price_cents: 10000,
    period: 'year',
    who: 'For everyone who practices or values Gestalt: practicing professionals, students and trainees, and friends of Gestalt.',
    benefits: [
      'Events, salons, presentations and trainings for members',
      'Listing in the members-only directory',
      'Practicing professionals can also appear in the Public Directory',
      'The members\' community board',
      'A voice in shaping the future of NAGP',
    ],
  },
];

// What best describes a member. Chosen when joining (and changeable in My Profile).
// Only practicing professionals can appear in the Public Directory (Ken's notes).
export const MEMBER_TYPES = [
  { key: 'professional', label: 'Practicing professional', hint: 'Clinician, coach, organizational consultant or educator' },
  { key: 'student', label: 'Student or trainee', hint: 'In a Gestalt training program or graduate study' },
  { key: 'associate', label: 'Other', hint: 'Someone who values Gestalt but does not practice it professionally' },
];
export const memberTypeLabel = (key) => MEMBER_TYPES.find((t) => t.key === key)?.label || 'Member';

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
// Older records may still name the former types (professional, associate, student): they are all "Member" now.
export const tierByKey = (key) => MEMBERSHIP_TIERS.find((t) => t.key === key) || (key ? MEMBERSHIP_TIERS[0] : null);

// Everything the browser is allowed to know. Written to /assets/js/config.js by build.mjs.
export const PUBLIC_CONFIG = {
  ORG, SPECIALTIES, MEMBERSHIP_TIERS, MEMBER_TYPES, DONATION_AMOUNTS_CENTS, EVENT_CATEGORIES,
  ANNOUNCEMENT_CATEGORIES, DOCUMENT_CATEGORIES, VISIBILITY, REGIONS,
};
