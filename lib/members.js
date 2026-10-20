// Shared server helpers for the members' area: profiles, the two directories,
// announcements, the community board and documents (members agent).
import { SPECIALTIES, REGIONS, MEMBERSHIP_TIERS } from './config.js';
import { isActiveMember, isCouncil } from './http.js';
import { likeContains } from './db.js';

export const SPECIALTY_KEYS = SPECIALTIES.map((s) => s.key);
export const REGION_CODES = REGIONS.map((r) => r.code);
export const MEMBER_TYPES = ['professional', 'associate', 'student'];
export const TIER_KEYS = MEMBERSHIP_TIERS.map((t) => t.key);

// "clinical,coaching" <-> ['clinical', 'coaching'] (unknown keys are dropped)
export const splitSpecialties = (s) => String(s || '').split(',').map((x) => x.trim()).filter((x) => SPECIALTY_KEYS.includes(x));
export const joinSpecialties = (list) => SPECIALTY_KEYS.filter((k) => (list || []).includes(k)).join(',');

export const isProfessional = (user) => !!user && user.member_type === 'professional';

// Fields anyone on the internet may see (public "Find a Practitioner" directory).
export function publicListing(u) {
  return {
    id: u.id,
    name: u.name,
    credentials: u.credentials || '',
    training: u.training || '',
    specialties: splitSpecialties(u.specialties),
    city: u.city || '',
    state: u.state || '',
    bio: u.bio || '',
    website: u.website || '',
    public_email: u.public_email || '',
    public_phone: u.public_phone || '',
    sample: !!u.sample,
  };
}

// Members-only directory: the public fields plus membership type and tier.
// Still only the email/phone the member chose to share.
export function memberListing(u) {
  return { ...publicListing(u), member_type: u.member_type, tier: u.tier || '' };
}

// A member's own profile (GET /api/me). Never includes password_hash.
export function ownProfile(u) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    tier: u.tier || '',
    member_type: u.member_type,
    membership_expires: u.membership_expires || null,
    city: u.city || '',
    state: u.state || '',
    credentials: u.credentials || '',
    training: u.training || '',
    specialties: splitSpecialties(u.specialties),
    bio: u.bio || '',
    website: u.website || '',
    public_email: u.public_email || '',
    public_phone: u.public_phone || '',
    show_public: !!u.show_public,
    show_members: !!u.show_members,
    can_list_public: isProfessional(u),
    isCouncil: isCouncil(u),
    isMember: isActiveMember(u),
    sample: !!u.sample,
    created_at: u.created_at,
    last_login: u.last_login || null,
  };
}

// Who appears in a directory: active, and membership not past its end date.
export const LISTED_SQL = `status = 'active'
  AND (membership_expires IS NULL OR membership_expires = '' OR membership_expires >= ?)`;
export const today = () => new Date().toISOString().slice(0, 10);

// Turns a search box into SQL: every word must appear in at least one of the columns.
// Returns { sql: 'AND (...) AND (...)', params: [...] }.
export function keywordFilter(q, columns) {
  const words = String(q || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 100).split(' ').filter(Boolean).slice(0, 6);
  const parts = [];
  const params = [];
  for (const w of words) {
    const like = likeContains(w);
    parts.push('(' + columns.map((c) => `lower(${c}) LIKE ? ESCAPE '\\'`).join(' OR ') + ')');
    columns.forEach(() => params.push(like));
  }
  return { sql: parts.length ? ' AND ' + parts.join(' AND ') : '', params };
}

// Directory order: by last name, then first name.
const lastName = (name) => String(name || '').replace(/\(.*?\)/g, '').trim().split(/\s+/).pop().toLowerCase();
export const byLastName = (a, b) => lastName(a.name).localeCompare(lastName(b.name)) || a.name.localeCompare(b.name);

/* ---------- Announcements ---------- */

export const canSeeVisibility = (viewer, visibility) =>
  visibility === 'public' || (visibility === 'members' && isActiveMember(viewer)) || (visibility === 'council' && isCouncil(viewer));

export function announcementOut(a, { withStatus = false } = {}) {
  const out = {
    id: a.id,
    title: a.title,
    body: a.body,
    category: a.category,
    visibility: a.visibility,
    author_name: a.author_name,
    from_council: !!a.from_council,
    link_url: a.link_url || '',
    created_at: a.created_at,
    published_at: a.published_at || null,
    sample: !!a.sample,
  };
  if (withStatus) {
    out.status = a.status;
    out.decline_reason = a.status === 'declined' ? a.decline_reason || '' : '';
  }
  return out;
}

/* ---------- Community board ---------- */

export const HIDDEN_TEXT = 'This post was hidden by the Council because it did not follow the community guidelines.';
export const HIDDEN_TITLE = 'Hidden by the Council';

// One board post as a viewer may see it. Hidden posts show a placeholder to everyone
// except the Council, who see the text plus the hidden flag and reason.
export function postOut(p, viewer, { reportedByMe = false } = {}) {
  const council = isCouncil(viewer);
  const hidden = !!p.hidden;
  const conceal = hidden && !council;
  const out = {
    id: p.id,
    parent_id: p.parent_id || null,
    body: conceal ? HIDDEN_TEXT : p.body,
    author_name: conceal ? '' : p.author_name, // no name next to a hidden post, to spare embarrassment
    created_at: p.created_at,
    hidden,
    mine: !!viewer && p.author_id === viewer.id,
    reported_by_me: !!reportedByMe,
    sample: !!p.sample,
  };
  if (!p.parent_id) {
    out.title = conceal ? HIDDEN_TITLE : p.title;
    out.last_activity = p.last_activity;
  }
  if (council) {
    out.hidden_reason = p.hidden_reason || '';
    out.reports = p.reports || 0;
  }
  return out;
}

export function excerpt(text, max = 160) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  return s.slice(0, max).replace(/\s+\S*$/, '') + '…';
}

// Phone numbers: digits and the usual punctuation only.
export const PHONE_RE = /^[0-9+().\-\s]{7,30}(\s*(x|ext\.?)\s*\d{1,6})?$/i;
