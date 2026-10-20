// Passwords, sign-in sessions and cookies.
import { first, run } from './db.js';
import { HttpError, isCouncil, isActiveMember, nowIso } from './http.js';

const COOKIE = 'nagp_session';
const SESSION_DAYS = 30; // stay signed in for a month: fewer forgotten passwords
const ITERATIONS = 100_000; // the most Cloudflare Workers allow for PBKDF2

const enc = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(hash)}`;
}

export async function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith('pbkdf2$')) return false;
  const [, iter, salt, hash] = stored.split('$');
  const actual = new Uint8Array(await pbkdf2(password, unb64(salt), Number(iter)));
  const expected = unb64(hash);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

export function checkPasswordStrength(password) {
  if (typeof password !== 'string' || password.length < 8) return 'Please choose a password with at least 8 characters.';
  if (password.length > 200) return 'That password is too long.';
  return null;
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function readCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function cookieHeader(value, maxAge, request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

// Starts a session and returns the Set-Cookie header value.
export async function createSession(env, request, userId) {
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = b64(tokenBytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  await run(env, `INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`,
    await sha256Hex(token), userId, nowIso(), expires);
  await run(env, `UPDATE users SET last_login = ? WHERE id = ?`, nowIso(), userId);
  return cookieHeader(token, SESSION_DAYS * 86400, request);
}

export async function destroySession(env, request) {
  const token = readCookie(request, COOKIE);
  if (token) await run(env, `DELETE FROM sessions WHERE id = ?`, await sha256Hex(token));
  return cookieHeader('', 0, request);
}

// Returns the full users row for the signed-in visitor, or null.
export async function getSessionUser(request, env) {
  const token = readCookie(request, COOKIE);
  if (!token) return null;
  const row = await first(env,
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > ? AND u.status != 'suspended'`,
    await sha256Hex(token), nowIso());
  return row || null;
}

// The safe subset of a user that the browser gets from /api/session.
export function toSessionUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    tier: u.tier,
    member_type: u.member_type,
    membership_expires: u.membership_expires,
    state: u.state,
    isCouncil: isCouncil(u),
    isMember: isActiveMember(u),
    sample: !!u.sample,
  };
}

// Slows down password guessing: at most 8 failed tries per email per 15 minutes.
export async function checkLoginRate(env, key) {
  const since = new Date(Date.now() - 15 * 60e3).toISOString();
  const row = await first(env, `SELECT COUNT(*) AS n FROM login_attempts WHERE key = ? AND at > ?`, key, since);
  if (row && row.n >= 8) {
    throw new HttpError(429, 'Too many attempts. For your security, please wait 15 minutes and try again, or contact the Council for help.');
  }
}
export async function recordFailedLogin(env, key) {
  await run(env, `INSERT INTO login_attempts (key, at) VALUES (?, ?)`, key, nowIso());
  await run(env, `DELETE FROM login_attempts WHERE at < ?`, new Date(Date.now() - 864e5).toISOString());
}
