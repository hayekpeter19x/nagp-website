// Who can see what: the members' and Council pages, and the same rules in the API.
import { test, expect, call, signInAs, joinMember, expectAccessOk } from './helpers.js';

test.describe('pages', () => {
  test('signed out, the Members\' Area and the Council Area ask you to sign in', async ({ page }) => {
    for (const path of ['/members/profile', '/members/board', '/council/', '/council/members']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Please sign in');
      const signIn = page.getByRole('main').getByRole('link', { name: 'Sign in' });
      await expect(signIn).toHaveAttribute('href', `/signin?next=${encodeURIComponent(path)}`);
    }
  });

  test('a member can use the Members\' Area but not the Council Area', async ({ page }) => {
    await signInAs(page, 'member');
    await page.goto('/members/profile');
    await expectAccessOk(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('My Profile');

    await page.goto('/council/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Council members only');
    await expect(page.locator('#page-content')).toBeHidden();
    await expect(page.getByRole('link', { name: 'Council Area' })).toBeHidden();
  });

  test('a Council member can see everything', async ({ page }) => {
    const user = await signInAs(page, 'council');
    for (const path of ['/members/profile', '/members/directory', '/council/', '/council/members', '/council/feedback']) {
      await page.goto(path);
      await expectAccessOk(page);
      await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(/Please sign in|Council members only/);
    }
    await page.goto('/council/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Welcome, ${user.name}`);
  });

  test('someone who joined but has not paid sees "Finish joining" instead of the members\' pages', async ({ page }) => {
    await joinMember(page, { tier: 'associate', pay: false });
    await page.goto('/members/board');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your membership is not active yet');
    await page.getByRole('link', { name: 'Finish joining' }).click();
    await expect(page).toHaveURL(/\/members\/payments$/);
    await expectAccessOk(page);
    await expect(page.getByRole('heading', { name: 'Finish joining' })).toBeVisible();
  });

  test('after signing in, you go back to the page you asked for, but never to another website', async ({ page }) => {
    await page.goto('/signin?next=/members/directory');
    await page.getByRole('button', { name: 'Try it as a member' }).click();
    await expect(page).toHaveURL(/\/members\/directory$/);
    await page.waitForLoadState('networkidle');

    await page.context().clearCookies();
    for (const next of ['//example.com/', '/\\example.com/', '/\t/example.com/', 'https://example.com/']) {
      await page.goto(`/signin?next=${encodeURIComponent(next)}`);
      await page.getByRole('button', { name: 'Try it as a member' }).click();
      await page.waitForURL((url) => url.pathname === '/members/profile' || url.hostname !== 'localhost');
      expect(new URL(page.url()).hostname, `next=${next}`).toBe('localhost');
      await page.context().clearCookies();
    }
  });
});

// Every Council endpoint, with a request that would be valid for the Council.
const COUNCIL_GETS = [
  '/api/council/summary', '/api/council/announcements', '/api/council/announcements?status=declined',
  '/api/council/members', '/api/council/members?format=csv', '/api/council/members/1',
  '/api/council/events', '/api/council/events/1', '/api/council/events/1/registrations', '/api/council/events/1/registrations?format=csv',
  '/api/council/documents', '/api/council/documents/1', '/api/council/messages', '/api/council/subscribers',
  '/api/council/subscribers?format=csv', '/api/council/orders', '/api/council/orders?format=csv',
  '/api/council/reports', '/api/council/feedback',
];
// Changes use ids that do not exist (or harmless bodies), in case a check is ever missing.
const COUNCIL_CHANGES = [
  ['POST', '/api/council/announcements/999999', { action: 'approve' }],
  ['POST', '/api/council/members', { name: 'Should Not Exist', email: 'nobody@example.com', member_type: 'associate', password: 'long-enough-1' }],
  ['PATCH', '/api/council/members/999999', { status: 'active' }],
  ['POST', '/api/council/members/999999/password', { password: 'long-enough-1' }],
  ['POST', '/api/council/events', { title: 'Should not exist' }],
  ['PUT', '/api/council/events/999999', { title: 'x' }],
  ['DELETE', '/api/council/events/999999'],
  ['POST', '/api/council/documents', { title: 'Should not exist', url: 'https://example.com' }],
  ['PUT', '/api/council/documents/999999', { title: 'x' }],
  ['DELETE', '/api/council/documents/999999'],
  ['POST', '/api/council/messages/999999', { handled: true }],
  ['DELETE', '/api/council/subscribers/999999'],
  ['POST', '/api/council/orders', { person: 'member', user_id: 999999, kind: 'donation', amount: '10', method: 'check' }],
  ['POST', '/api/council/board/999999', { action: 'hide' }],
  ['POST', '/api/council/reports/999999/resolve'],
  ['POST', '/api/council/feedback/999999', { resolved: true }],
  ['POST', '/api/council/sample-data/delete', { confirm: true }],
];
// Endpoints for members (or anyone signed in).
const MEMBER_ONLY = [
  ['GET', '/api/members/directory'], ['GET', '/api/board'], ['GET', '/api/board/1'], ['GET', '/api/me/announcements'],
  ['POST', '/api/board', { title: 'x', body: 'y', agree: true }], ['POST', '/api/board/1/replies', { body: 'y' }],
  ['POST', '/api/board/1/report', { reason: 'x' }], ['POST', '/api/announcements', { title: 'x', body: 'y', category: 'Member news', visibility: 'public' }],
];
const SIGNED_IN = [
  ['GET', '/api/me'], ['PUT', '/api/me', { city: 'x' }], ['POST', '/api/me/password', { current_password: 'x', new_password: 'long-enough-1' }],
  ['GET', '/api/me/orders'], ['POST', '/api/membership/renew', {}],
];

test.describe('API access', () => {
  test('signed out: every Council and member endpoint answers 401', async ({ request }) => {
    for (const path of COUNCIL_GETS) expect((await call(request, 'GET', path)).status, path).toBe(401);
    for (const [method, path, data] of [...COUNCIL_CHANGES, ...MEMBER_ONLY, ...SIGNED_IN]) {
      expect((await call(request, method, path, data)).status, `${method} ${path}`).toBe(401);
    }
  });

  test('a member gets 403 from every Council endpoint', async ({ request }) => {
    await signInAs(request, 'member');
    for (const path of COUNCIL_GETS) expect((await call(request, 'GET', path)).status, path).toBe(403);
    for (const [method, path, data] of COUNCIL_CHANGES) {
      expect((await call(request, method, path, data)).status, `${method} ${path}`).toBe(403);
    }
  });

  test('someone who has not paid yet gets 403 from member endpoints, but can see their own account', async ({ request }) => {
    await joinMember(request, { tier: 'associate', pay: false });
    for (const [method, path, data] of MEMBER_ONLY) {
      expect((await call(request, method, path, data)).status, `${method} ${path}`).toBe(403);
    }
    for (const path of COUNCIL_GETS.slice(0, 3)) expect((await call(request, 'GET', path)).status, path).toBe(403);
    expect((await call(request, 'GET', '/api/me')).status).toBe(200);
    expect((await call(request, 'GET', '/api/me/orders')).status).toBe(200);
  });

  test('the Council can use every Council endpoint', async ({ request }) => {
    await signInAs(request, 'council');
    for (const path of COUNCIL_GETS) expect((await call(request, 'GET', path)).status, path).toBe(200);
  });

  test('members-only documents and announcements are left out for visitors', async ({ request }) => {
    const docs = (await call(request, 'GET', '/api/documents')).body.documents;
    expect(docs.length).toBeGreaterThan(0);
    expect(docs.every((d) => d.visibility === 'public')).toBe(true);
    const anns = (await call(request, 'GET', '/api/announcements')).body.announcements;
    expect(anns.every((a) => a.visibility === 'public')).toBe(true);

    await signInAs(request, 'member');
    const memberDocs = (await call(request, 'GET', '/api/documents')).body.documents;
    expect(memberDocs.some((d) => d.visibility === 'members')).toBe(true);
    expect(memberDocs.some((d) => d.visibility === 'council')).toBe(false);
  });
});
