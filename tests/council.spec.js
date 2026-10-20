// The Council Area: events, documents, check payments, members and spreadsheet downloads.
import {
  test, expect, call, uid, signInAs, newPerson, joinMember, oneYearFromToday, expectAccessOk, createEvent,
} from './helpers.js';

test('the Council adds an event, and it appears on the Events page with the right date and time', async ({ page, request }) => {
  const title = `Spring salon ${uid()}`;
  const year = new Date().getUTCFullYear() + 1;
  const date = `${year}-05-14`;
  await signInAs(page, 'council');
  await page.goto('/council/events');
  await expectAccessOk(page);
  await page.getByRole('button', { name: 'Add an event' }).click();
  await page.getByRole('textbox', { name: 'Title' }).fill(title);
  await page.getByRole('textbox', { name: /Short summary/ }).fill('An evening conversation.');
  await page.getByLabel('Date', { exact: true }).fill(date);
  await page.getByLabel('Start time').fill('19:00');
  await page.getByLabel(/^End time/).fill('20:30');
  await page.getByRole('combobox', { name: 'Time zone' }).selectOption('America/Los_Angeles');
  await page.getByRole('textbox', { name: /Price for members/ }).fill('10');
  await page.getByRole('textbox', { name: /Price for non-members/ }).fill('25');
  const day = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' })
    .format(new Date(`${date}T19:00:00-07:00`));
  await expect(page.locator('#when-preview')).toContainText(day);
  await page.getByRole('button', { name: 'Save event' }).click();
  await expect(page.getByText(`"${title}" was added and is now on the Events page.`)).toBeVisible();

  const ev = (await call(request, 'GET', '/api/events')).body.events.find((e) => e.title === title);
  expect(ev).toMatchObject({ starts_at: `${date}T19:00:00-07:00`, ends_at: `${date}T20:30:00-07:00`, timezone: 'America/Los_Angeles', price_member_cents: 1000, price_public_cents: 2500 });

  await page.context().clearCookies();
  await page.goto('/events');
  const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: title }) });
  await expect(card).toContainText(day);
  await expect(card).toContainText('7:00');
  await expect(card).toContainText('8:30 PM PDT');
  await expect(card).toContainText('$25');
});

test('a members-only document is in the Members\' documents but not on the public Governance page', async ({ page, browser, request }) => {
  const title = `Minutes: test meeting ${uid()}`;
  const decisions = `Decisions: none yet (${uid()}).`;
  await signInAs(page, 'council');
  await page.goto('/council/documents');
  await page.getByRole('button', { name: 'Add a document' }).click();
  await page.getByRole('textbox', { name: 'Title' }).fill(title);
  await page.getByRole('combobox', { name: /Kind of document/ }).selectOption('Minutes');
  await page.getByRole('radio', { name: /^Members/ }).check();
  await page.getByRole('textbox', { name: /paste the text/i }).fill(`Present: the whole Council.\n\n${decisions}`);
  await page.getByRole('button', { name: 'Save document' }).click();
  await expect(page.getByText(`"${title}" was added.`)).toBeVisible();

  // Signed out: not on /governance, not in the API
  const visitor = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  const vpage = await visitor.newPage();
  await vpage.goto('/governance');
  await expect(vpage.locator('#documents-list .loading')).toHaveCount(0);
  await expect(vpage.getByText('Bylaws (draft)')).toBeVisible();
  await expect(vpage.getByText(title)).toHaveCount(0);
  expect((await call(request, 'GET', '/api/documents')).body.documents.some((d) => d.title === title)).toBe(false);

  // A member sees it
  await signInAs(vpage, 'member');
  await vpage.goto('/members/documents');
  await expect(vpage.getByRole('heading', { name: title })).toBeVisible();
  await vpage.getByRole('heading', { name: title }).locator('..').getByText(/Read the text/).click();
  await expect(vpage.getByText(decisions)).toBeVisible();
  // ...but not on the public Governance page, even when signed in
  await vpage.goto('/governance');
  await expect(vpage.getByText('Bylaws (draft)')).toBeVisible();
  await expect(vpage.getByText(title)).toHaveCount(0);
  await visitor.close();
});

test('recording a check payment switches on the membership of someone who has not paid online', async ({ page, playwright }) => {
  const person = await newPerson(playwright);
  const { name, email } = await joinMember(person, { tier: 'associate', pay: false });
  expect((await call(person, 'GET', '/api/board')).status).toBe(403);

  await signInAs(page, 'council');
  await page.goto('/council/payments');
  await page.getByRole('button', { name: /Record a check or cash payment/ }).click();
  const dialog = page.getByRole('dialog', { name: /Record a check or cash payment/ });
  await dialog.getByRole('combobox', { name: 'Member', exact: true }).selectOption({ label: `${name} (${email})` });
  await expect(dialog.getByRole('combobox', { name: 'Membership type' })).toHaveValue('associate');
  await expect(dialog.getByRole('textbox', { name: /Amount received/ })).toHaveValue('75');
  const note = `Check number ${uid()}`;
  await dialog.getByRole('textbox', { name: /Note/ }).fill(note);
  await dialog.getByRole('button', { name: 'Record this payment' }).click();
  await expect(page.getByText(`The payment of $75.00 from ${name} was recorded.`, { exact: false })).toBeVisible();
  await expect(page.getByText(/Their membership is active until/)).toBeVisible();
  await expect(page.getByRole('cell', { name: new RegExp(note) })).toBeVisible();

  const me = (await call(person, 'GET', '/api/me')).body.user;
  expect(me).toMatchObject({ status: 'active', isMember: true, membership_expires: oneYearFromToday() });
  expect((await call(person, 'GET', '/api/board')).status).toBe(200);
  const orders = (await call(person, 'GET', '/api/me/orders')).body.orders;
  expect(orders.find((o) => o.status === 'paid')).toMatchObject({ provider: 'manual', amount_cents: 7500 });
  await person.dispose();
});

test('the Council adds a member by hand with a check payment, then suspends them', async ({ page, playwright }) => {
  const id = uid();
  const name = `Hand Added ${id}`;
  const email = `hand.${id}@example.com`;
  await signInAs(page, 'council');
  await page.goto('/council/members');
  await page.getByRole('button', { name: 'Add a member by hand' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a member by hand' });
  await dialog.getByRole('textbox', { name: 'Full name' }).fill(name);
  await dialog.getByRole('textbox', { name: 'Email address' }).fill(email);
  await dialog.getByRole('combobox', { name: 'Membership type' }).selectOption('professional');
  await dialog.getByRole('textbox', { name: 'Temporary password' }).fill('quiet-river-2048');
  await dialog.getByRole('checkbox', { name: /They have paid/ }).check();
  await expect(dialog.getByRole('textbox', { name: 'Amount received' })).toHaveValue('150');
  await dialog.getByRole('button', { name: 'Add this member' }).click();
  await expect(page.getByText(`${name} was added.`, { exact: false })).toBeVisible();

  const person = await newPerson(playwright);
  const signin = await call(person, 'POST', '/api/auth/signin', { email, password: 'quiet-river-2048' });
  expect(signin.status).toBe(200);
  expect(signin.body.user).toMatchObject({ status: 'active', isMember: true, tier: 'professional' });

  // Suspend: they are signed out and cannot sign in again
  await page.getByRole('searchbox', { name: 'Search' }).fill(id);
  await page.getByRole('button', { name: `Edit ${name}` }).click();
  const edit = page.getByRole('dialog', { name: `Edit ${name}` });
  await edit.getByRole('combobox', { name: 'Membership status' }).selectOption('suspended');
  await edit.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText(`Saved. ${name}'s details are updated.`)).toBeVisible();
  expect((await call(person, 'GET', '/api/session')).body.user).toBeNull();
  expect((await call(person, 'POST', '/api/auth/signin', { email, password: 'quiet-river-2048' })).status).toBe(401);
  await person.dispose();
});

test('spreadsheet downloads are CSV files', async ({ page, request }) => {
  await signInAs(request, 'council');
  for (const path of ['/api/council/members?format=csv', '/api/council/orders?format=csv', '/api/council/subscribers?format=csv',
    '/api/council/events/1/registrations?format=csv']) {
    const r = await call(request, 'GET', path);
    expect(r.status, path).toBe(200);
    expect(r.headers['content-type'], path).toMatch(/^text\/csv/);
    expect(r.headers['content-disposition'], path).toMatch(/^attachment; filename=".+\.csv"$/);
    expect(r.text.split('\r\n')[0], path).toMatch(/^﻿?"[^"]+"(,"[^"]*")*$/);
  }
  const members = (await call(request, 'GET', '/api/council/members?format=csv')).text;
  expect(members).toContain('demo.member@nagp-preview.org');
  expect(members).not.toMatch(/pbkdf2/);

  // In the browser the link downloads a file
  await signInAs(page, 'council');
  await page.goto('/council/members');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: /Download as spreadsheet/ }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^nagp-members-\d{4}-\d{2}-\d{2}\.csv$/);
});

test('the Council dashboard counts what needs attention', async ({ page }) => {
  await signInAs(page, 'council');
  await page.goto('/council/');
  await expect(page.getByRole('heading', { name: 'Needs your attention' })).toBeVisible();
  await expect(page.locator('#attention .loading')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /announcements? (is|are) waiting for your approval/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Before launch' })).toBeVisible();
});

test('the Council edits an event and sees who registered', async ({ page, request }) => {
  await signInAs(page, 'council');
  const ev = await createEvent(page, { capacity: '10' });
  const email = `reg.${uid()}@example.com`;
  expect((await call(request, 'POST', `/api/events/${ev.id}/register`, { name: 'Registered Person', email })).body.status).toBe('confirmed');

  await page.goto('/council/events');
  const card = page.locator(`li[data-id="${ev.id}"]`);
  await expect(card).toContainText('1 person registered of 10 places');
  await card.getByRole('button', { name: 'Who registered' }).click();
  const dialog = page.getByRole('dialog', { name: /Who registered/ });
  await expect(dialog.getByRole('cell', { name: email })).toBeVisible();
  await expect(dialog.getByRole('link', { name: /Download as spreadsheet/ })).toHaveAttribute('href', `/api/council/events/${ev.id}/registrations?format=csv`);
  await dialog.getByRole('button', { name: 'Close' }).click();

  await card.getByRole('button', { name: 'Edit' }).click();
  const title = `Renamed event ${uid()}`;
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue(ev.title);
  await expect(page.getByLabel('Start time')).toHaveValue('19:00');
  await page.getByRole('textbox', { name: 'Title' }).fill(title);
  await page.getByLabel('Start time').fill('18:00');
  await page.getByRole('button', { name: 'Save event' }).click();
  await expect(page.getByText(`Saved. Your changes to "${title}" are now on the site.`)).toBeVisible();
  const saved = (await call(request, 'GET', `/api/events/${ev.id}`)).body.event;
  expect(saved).toMatchObject({ title, starts_at: ev.starts_at.replace('T19:00', 'T18:00'), ends_at: ev.ends_at, capacity: 10, spots_left: 9 });
});

test('the Council handles messages and mailing-list sign-ups', async ({ page, request }) => {
  const id = uid();
  const email = `signup.${id}@example.com`;
  expect((await call(request, 'POST', '/api/contact', { name: 'Morgan Message', email: `m.${id}@example.com`, topic: 'Membership', message: `Question ${id}` })).status).toBe(200);
  expect((await call(request, 'POST', '/api/subscribe', { first_name: 'Sign', last_name: 'Up', email, source: 'newsletter' })).status).toBe(200);

  await signInAs(page, 'council');
  await page.goto('/council/messages');
  const message = page.locator('li[data-id]', { hasText: `Question ${id}` });
  await expect(message.getByRole('link', { name: 'Reply by email' })).toHaveAttribute('href', new RegExp(`^mailto:m\\.${id}@example\\.com\\?subject=`));
  await message.getByRole('button', { name: 'Mark as handled' }).click();
  await expect(page.getByText(/Marked as handled/)).toBeVisible();
  const { messages } = (await call(page, 'GET', '/api/council/messages')).body;
  expect(messages.find((m) => m.message === `Question ${id}`).handled).toBe(true);

  const row = page.getByRole('row', { name: new RegExp(email) });
  await row.getByRole('button', { name: /Remove/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Yes, remove' }).click();
  await expect(page.getByText(`${email} was removed from the mailing list sign-ups.`)).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(email) })).toHaveCount(0);
});

test('the Council can keep a reported post, or unpublish an announcement', async ({ page, playwright }) => {
  const author = await newPerson(playwright);
  await signInAs(author, 'professional');
  const title = `Reported but fine ${uid()}`;
  const topic = await call(author, 'POST', '/api/board', { title, body: 'A perfectly kind post.', agree: true });
  await author.dispose();
  const reporter = await newPerson(playwright);
  await signInAs(reporter, 'member');
  expect((await call(reporter, 'POST', `/api/board/${topic.body.id}/report`, { reason: 'Not sure about this' })).status).toBe(200);

  await signInAs(page, 'council');
  await page.goto('/council/approvals#reports');
  const card = page.locator('li[data-post]', { has: page.getByRole('heading', { name: new RegExp(title) }) });
  await card.getByRole('button', { name: /Keep it/ }).click();
  await expect(page.getByText(/The post stays on the board/)).toBeVisible();
  expect((await call(reporter, 'GET', `/api/board/${topic.body.id}`)).body.topic.title).toBe(title);
  expect((await call(page, 'GET', '/api/council/summary')).status).toBe(200);
  await reporter.dispose();

  const annTitle = `Published by the Council ${uid()}`;
  const ann = await call(page, 'POST', '/api/announcements', { title: annTitle, body: 'Hello.', category: 'NAGP news', visibility: 'public', official: true });
  await page.goto('/council/approvals');
  await page.getByRole('button', { name: /Published/ }).click();
  const annCard = page.locator(`li[data-id="${ann.body.id}"]`);
  await annCard.getByRole('button', { name: /Unpublish/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Unpublish' }).click();
  await expect(page.getByText(`Unpublished. "${annTitle}" is no longer on the Announcements page.`)).toBeVisible();
  const list = (await call(page, 'GET', '/api/announcements?limit=100')).body.announcements;
  expect(list.some((a) => a.id === ann.body.id)).toBe(false);
});

test('spreadsheet cells cannot run formulas', async ({ request, playwright }) => {
  const person = await newPerson(playwright);
  await joinMember(person, { tier: 'associate', name: '=HYPERLINK("http://evil.example","Click")' });
  await person.dispose();
  await signInAs(request, 'council');
  const csv = (await call(request, 'GET', '/api/council/members?format=csv')).text;
  expect(csv).toContain(`"'=HYPERLINK(""http://evil.example"",""Click"")"`);
  expect(csv).not.toMatch(/(^|,)"=/m);
});
