// Security: text people type is always shown as text, cross-site requests are blocked,
// password hashes never leave the server, and receipts need their secret link.
import {
  test, expect, call, uid, XSS, signInAs, newPerson, joinMember, createEvent, failOnDialog, orderFromUrl,
  contextOptions,
} from './helpers.js';

// The page shows the attack as plain text, and nothing was turned into real HTML.
async function expectShownAsText(page, where) {
  await expect(page.getByText('<img src=x onerror=alert(1)>', { exact: false }).first(), where).toBeVisible();
  const injected = await page.evaluate(() => ({
    images: document.querySelectorAll('img[src="x"], [onerror]').length,
    scripts: [...document.querySelectorAll('script')].filter((s) => s.textContent.includes('alert(1)')).length,
  }));
  expect(injected, where).toEqual({ images: 0, scripts: 0 });
}

test('script in names, bios, announcements, board posts and events is shown as text everywhere', async ({ page, browser, playwright }) => {
  test.setTimeout(90_000);
  const id = uid();
  const dialogs = failOnDialog(page);

  // A professional member with the attack in their name, credentials and bio
  const author = await joinMember(page, { tier: 'professional', name: `Xavier ${XSS} ${id}`, credentials: `PhD ${XSS}`, showPublic: true });
  const put = await call(page, 'PUT', '/api/me', { bio: `About me ${XSS}\n\nSecond paragraph ${XSS} https://example.com/?q=<b>` });
  expect(put.status).toBe(200);
  expect(put.body.user.bio).toContain(XSS); // stored as typed, as plain text

  const ann = await call(page, 'POST', '/api/announcements', { title: `News ${XSS} ${id}`, body: `Body ${XSS}`, category: 'Member news', visibility: 'public', link_url: '' });
  expect(ann.status).toBe(200);
  const topic = await call(page, 'POST', '/api/board', { title: `Topic ${XSS} ${id}`, body: `Post ${XSS}`, agree: true });
  expect(topic.status).toBe(200);
  expect((await call(page, 'POST', `/api/board/${topic.body.id}/replies`, { body: `Reply ${XSS}` })).status).toBe(200);
  // Someone reports it, so it shows up in the Council's list of reports
  const reporter = await newPerson(playwright);
  await signInAs(reporter, 'member');
  expect((await call(reporter, 'POST', `/api/board/${topic.body.id}/report`, { reason: `Reason ${XSS}` })).status).toBe(200);
  await reporter.dispose();

  // What the member sees
  for (const path of [`/directory?q=${id}`, `/members/directory?q=${id}`, '/members/', '/members/board',
    `/members/topic?id=${topic.body.id}`, '/members/announce', `/announcement?id=${ann.body.id}`, '/members/profile']) {
    await page.goto(path);
    await expectShownAsText(page, path);
  }

  // What the Council sees
  const context = await browser.newContext(contextOptions());
  const council = await context.newPage();
  const councilDialogs = failOnDialog(council);
  await signInAs(council, 'council');
  const ev = await createEvent(council, { title: `Event ${XSS} ${id}`, description: `Details ${XSS}`, presenter: XSS });
  for (const path of ['/council/approvals', `/council/members?q=${id}`, '/council/payments', '/council/events']) {
    await council.goto(path);
    await expectShownAsText(council, path);
  }
  await council.goto('/council/members');
  await council.getByRole('searchbox', { name: 'Search' }).fill(id);
  await expect(council.getByRole('cell', { name: new RegExp(`Xavier.*${id}.*PhD`) })).toBeVisible();
  await expectShownAsText(council, 'members list search');

  // Approve the announcement, then check the public pages
  expect((await call(council, 'POST', `/api/council/announcements/${ann.body.id}`, { action: 'approve' })).status).toBe(200);
  await context.close();
  await page.context().clearCookies();
  for (const path of ['/announcements', '/', `/directory?q=${id}`, '/events', `/event?id=${ev.id}`]) {
    await page.goto(path);
    await expectShownAsText(page, path);
  }
  expect(dialogs).toEqual([]);
  expect(councilDialogs).toEqual([]);
  expect(author.name).toContain(XSS);
});

test('links people type can only be web addresses', async ({ request }) => {
  await signInAs(request, 'professional');
  for (const website of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>']) {
    const r = await call(request, 'PUT', '/api/me', { website });
    if (r.status === 200) expect(r.body.user.website).toMatch(/^https?:\/\//);
    else expect(r.status).toBe(400);
  }
  const ann = await call(request, 'POST', '/api/announcements', { title: 'Link test', body: 'x', category: 'Member news', visibility: 'public', link_url: 'javascript:alert(1)' });
  if (ann.status === 200) {
    const mine = (await call(request, 'GET', '/api/me/announcements')).body.announcements.find((a) => a.id === ann.body.id);
    expect(mine.link_url).toMatch(/^https?:\/\//);
  } else {
    expect(ann.status).toBe(400);
  }
});

test('requests from other websites are blocked', async ({ request, playwright }) => {
  const evil = { origin: 'https://evil.example' };
  const contact = await request.post('/api/contact', { headers: evil, data: { name: 'Evil', email: 'e@example.com', message: 'hi' } });
  expect(contact.status()).toBe(403);
  const demo = await request.post('/api/auth/demo', { headers: evil, data: { as: 'council' } });
  expect(demo.status()).toBe(403);
  expect(demo.headers()['set-cookie']).toBeUndefined();
  const nullOrigin = await request.post('/api/subscribe', { headers: { origin: 'null' }, data: { email: 'n@example.com' } });
  expect(nullOrigin.status()).toBe(403);

  // Even with a valid Council session, a request started by another website does nothing.
  const council = await newPerson(playwright);
  await signInAs(council, 'council');
  for (const [method, path, data] of [
    ['POST', '/api/council/announcements/1', { action: 'delete' }],
    ['PATCH', '/api/council/members/1', { role: 'council' }],
    ['PUT', '/api/me', { name: 'Hacked' }],
    ['POST', '/api/auth/signout'],
  ]) {
    const res = await council.fetch(path, { method, data, headers: evil });
    expect(res.status(), `${method} ${path}`).toBe(403);
  }
  expect((await call(council, 'GET', '/api/session')).body.user.name).toBe('Demo Council Member');
  expect((await call(council, 'GET', '/api/announcements/1')).status).toBe(200);
  await council.dispose();
});

test('password hashes never appear in any API response or download', async ({ request, playwright }) => {
  // call() fails the test if a response contains a hash; this visits everything that lists people.
  const council = await newPerson(playwright);
  const login = await council.post('/api/auth/signin', {
    headers: { origin: new URL(test.info().project.use.baseURL).origin },
    data: { email: 'demo.council@nagp-preview.org', password: 'nagp-preview' },
  });
  expect(login.status()).toBe(200);
  expect(await login.text()).not.toMatch(/password_hash|pbkdf2/);
  for (const path of ['/api/session', '/api/me', '/api/me/orders', '/api/council/members', '/api/council/members/1',
    '/api/council/members?format=csv', '/api/council/announcements', '/api/council/reports', '/api/council/orders',
    '/api/council/orders?format=csv', '/api/council/events/1/registrations', '/api/council/summary', '/api/members/directory',
    '/api/directory', '/api/board', '/api/board/1', '/api/announcements', '/api/me/announcements']) {
    const r = await call(council, 'GET', path);
    expect(r.status, path).toBe(200);
  }
  const added = await call(council, 'POST', '/api/council/members', { name: 'Hash Check', email: `hash.${uid()}@example.com`, tier: 'associate', password: 'long-enough-1' });
  expect(added.status).toBe(201);
  const edited = await call(council, 'PATCH', `/api/council/members/${added.body.member.id}`, { city: 'Boston' });
  expect(edited.status).toBe(200);
  await council.dispose();

  const member = await joinMember(request, { tier: 'professional' });
  expect(member.order.id).toMatch(/^ord_/);
  expect((await call(request, 'PUT', '/api/me', { city: 'Dayton' })).status).toBe(200);
});

test('session cookies are HttpOnly and SameSite, and pages send security headers', async ({ request }) => {
  const res = await request.post('/api/auth/demo', { headers: { origin: new URL(test.info().project.use.baseURL).origin }, data: { as: 'member' } });
  const cookie = res.headers()['set-cookie'];
  expect(cookie).toMatch(/HttpOnly/);
  expect(cookie).toMatch(/SameSite=Lax/);
  const page = await request.get('/');
  expect(page.headers()['content-security-policy']).toMatch(/script-src 'self'/);
  expect(page.headers()['x-frame-options']).toBe('DENY');
});

test('receipts and payments need the secret token from the link', async ({ page, request }) => {
  const donation = await call(request, 'POST', '/api/donate', { amount_cents: 2500, name: 'Token Tester', email: `t.${uid()}@example.com` });
  expect(donation.status).toBe(200);
  const order = orderFromUrl(donation.body.checkout_url);
  const other = orderFromUrl((await call(request, 'POST', '/api/donate', { amount_cents: 2500, name: 'Other', email: 'o@example.com' })).body.checkout_url);

  expect((await call(request, 'GET', `/api/orders/${order.id}?token=${order.token}`)).status).toBe(200);
  for (const token of ['', 'wrong', other.token, order.token.slice(0, -1), `${order.token}x`]) {
    const r = await call(request, 'GET', `/api/orders/${order.id}?token=${encodeURIComponent(token)}`);
    expect(r.status, `token "${token}"`).toBe(404);
    expect(r.text).not.toContain('Token Tester');
  }
  expect((await call(request, 'GET', `/api/orders/${order.id}`)).status).toBe(404);
  expect((await call(request, 'POST', '/api/checkout/demo-complete', { id: order.id, token: other.token })).status).toBe(404);
  expect((await call(request, 'POST', `/api/orders/${order.id}`, { token: 'wrong' })).status).toBe(404);
  const still = await call(request, 'GET', `/api/orders/${order.id}?token=${order.token}`);
  expect(still.body.order.status).toBe('pending');
  expect(still.body.order).not.toHaveProperty('token');

  await page.goto(`/payment-complete?order=${order.id}&token=wrong`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('We could not find your payment');
  await expect(page.getByText('Token Tester')).toHaveCount(0);
  await page.goto(`/checkout?order=${order.id}&token=wrong`);
  await expect(page.getByRole('button', { name: /^Pay/ })).toHaveCount(0);
  await page.goto(`/checkout?order=${order.id}&token=${order.token}`);
  await expect(page.getByRole('button', { name: /^Pay \$25/ })).toBeVisible();
});

test('someone who is signed in only sees their own orders', async ({ request, playwright }) => {
  const first = await joinMember(request, { tier: 'associate' });
  const second = await newPerson(playwright);
  await joinMember(second, { tier: 'associate' });
  const theirs = (await call(second, 'GET', '/api/me/orders')).body.orders;
  expect(theirs).toHaveLength(1);
  expect(theirs.some((o) => o.id === first.order.id)).toBe(false);
  await second.dispose();
});
