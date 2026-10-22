// Shared helpers for the end-to-end tests (not a test file itself: only *.spec.js files are run).
//
//   import { test, expect, signInAs, joinMember, call, uid } from './helpers.js';
//
// `test` is Playwright's test with one addition: every API response a page receives is checked
// for password hashes, so a leak anywhere fails the test that caused it.
import { test as base, expect } from '@playwright/test';

export { expect };

// Password of every demo and sample account (and of the accounts the tests create).
export const PASSWORD = 'nagp-preview';

// Script-injection attempts. They must always show up as plain text.
export const XSS = '<img src=x onerror=alert(1)><script>alert(1)</script>';

let counter = 0;
// A short unique id, so tests never collide with each other or with earlier runs.
export const uid = () => `${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const LEAK = /password_hash|pbkdf2\$/;

export const test = base.extend({
  page: async ({ page }, use) => {
    const leaks = [];
    page.on('response', async (res) => {
      if (!new URL(res.url()).pathname.startsWith('/api/')) return;
      try { if (LEAK.test(await res.text())) leaks.push(res.url()); } catch { /* the page was closed */ }
    });
    await use(page);
    expect(leaks, 'API responses must never contain password hashes').toEqual([]);
  },
});

// The site's own origin. The server blocks POST/PUT/PATCH/DELETE requests from other origins,
// so API calls send it like a browser would.
export const siteOrigin = () => new URL(test.info().project.use.baseURL).origin;

// Calls the API with any request context (page.request, the `request` fixture, or one made with
// playwright.request.newContext). Returns { status, body, text, headers }.
export async function call(target, method, path, data) {
  const req = target.request || target; // a Page or an APIRequestContext
  const headers = method === 'GET' ? {} : { origin: siteOrigin() };
  const res = await req.fetch(path, { method, data, headers });
  const text = await res.text();
  let body = text;
  try { body = JSON.parse(text); } catch { /* not JSON (for example a CSV file) */ }
  expect(text, `${method} ${path} must never contain password hashes`).not.toMatch(LEAK);
  return { status: res.status(), body, text, headers: res.headers() };
}

// One-click demo sign-in: as = 'member' (Associate) | 'professional' | 'council'.
// With page.request the browser page shares the session cookie.
export async function signInAs(target, as) {
  const r = await call(target, 'POST', '/api/auth/demo', { as });
  expect(r.status, `demo sign-in as ${as}`).toBe(200);
  return r.body.user;
}

export async function signOut(target) {
  await call(target, 'POST', '/api/auth/signout');
}

// Options for a second browser window (a different person) in the same test.
export const contextOptions = () => ({ baseURL: test.info().project.use.baseURL, reducedMotion: 'reduce' });

// A separate API "person" with their own cookies. Remember to dispose() it.
export async function newPerson(playwright) {
  return playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
}

// Joins NAGP through the API (and pays with the simulated card unless pay: false).
// The request context must be signed out; afterwards it is signed in as the new member.
// `tier` is what best describes the new member: 'professional' | 'student' | 'associate' (other).
// There is one membership for everyone.
export async function joinMember(target, { tier = 'professional', name, email, showPublic = true, pay = true, ...extra } = {}) {
  const id = uid();
  name = name || `Test ${tier} ${id}`;
  email = email || `test.${id}@example.com`;
  const body = {
    member_type: tier, name, email, password: PASSWORD, password_confirm: PASSWORD, city: 'Springfield', state: 'IL', agree: true, ...extra,
  };
  if (tier === 'professional') {
    Object.assign(body, { credentials: 'LCSW', training: 'Three-year Gestalt therapy training', specialties: ['clinical'], show_public: showPublic, ...extra });
  }
  const r = await call(target, 'POST', '/api/membership/join', body);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  const order = orderFromUrl(r.body.checkout_url);
  if (pay) await payDemo(target, order);
  return { name, email, order };
}

// { id, token } from a /checkout or /payment-complete link.
export function orderFromUrl(url) {
  const u = new URL(url, 'http://localhost');
  return { id: u.searchParams.get('order'), token: u.searchParams.get('token') };
}

export async function payDemo(target, order) {
  const r = await call(target, 'POST', '/api/checkout/demo-complete', { id: order.id, token: order.token });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body.order;
}

// Collects JavaScript errors and console errors on a page.
export function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console: ${msg.text()}`); });
  return errors;
}

// Fails the test if the page tries to open an alert (a sign of injected script).
export function failOnDialog(page) {
  const opened = [];
  page.on('dialog', async (d) => { opened.push(d.message()); await d.dismiss().catch(() => {}); });
  return opened;
}

// On phones the main menu is behind the "Menu" button; open it if it is closed.
export async function openMainMenu(page) {
  const toggle = page.locator('.menu-toggle');
  if (await toggle.isVisible() && (await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
}

// The members' and Council's pages show their content only once app.js has checked access.
export async function expectAccessOk(page) {
  await expect(page.locator('body')).toHaveClass(/access-ok/);
}

// YYYY-MM-DD one year after today (UTC), the end date of a membership paid today.
export function oneYearFromToday() {
  const d = new Date();
  const y = d.getUTCFullYear() + 1;
  const m = d.getUTCMonth() + 1;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const pad = (n) => String(n).padStart(2, '0');
  return `${y}-${pad(m)}-${pad(Math.min(d.getUTCDate(), last))}`;
}

// Creates an event through the Council API (the request context must be signed in as Council).
export async function createEvent(target, fields = {}) {
  const year = new Date().getUTCFullYear() + 1;
  const data = {
    title: `Test event ${uid()}`, category: 'Salon', summary: 'A test event.', description: '', timezone: 'America/New_York',
    start_date: `${year}-06-10`, start_time: '19:00', end_date: '', end_time: '20:30', is_online: '1', location: '',
    presenter: '', ce_info: '', price_member: '0', price_public: '0', capacity: '', members_only: false,
    registration_open: true, published: true, ...fields,
  };
  const r = await call(target, 'POST', '/api/council/events', data);
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body.event;
}
