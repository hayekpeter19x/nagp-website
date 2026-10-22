// Announcements: members submit, the Council approves or declines, the public sees approved ones.
// The announcement pages are no longer linked from the menus (and the Council's Approvals page was
// removed), so the Council's decisions are made through the API here.
import { test, expect, call, uid, signInAs, joinMember, newPerson } from './helpers.js';

// The Council approves or declines a waiting announcement, found by its title.
async function decide(playwright, title, action, reason = '') {
  const council = await newPerson(playwright);
  await signInAs(council, 'council');
  const { announcements } = (await call(council, 'GET', '/api/council/announcements')).body;
  const ann = announcements.find((a) => a.title === title);
  expect(ann, `waiting announcement "${title}"`).toBeTruthy();
  const r = await call(council, 'POST', `/api/council/announcements/${ann.id}`, { action, reason });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  await council.dispose();
}

async function submit(page, title, body = 'We meet once a month.\n\nEveryone is welcome.') {
  await page.goto('/members/announce');
  await page.getByRole('textbox', { name: 'Title' }).fill(title);
  await page.getByRole('combobox', { name: 'Category' }).selectOption('Member news');
  await page.getByRole('textbox', { name: /Your announcement/ }).fill(body);
  await page.getByRole('button', { name: /Send to the Council/ }).click();
  await expect(page.getByText(/sent to the Council for approval/)).toBeVisible();
}

test('a member\'s announcement waits for approval, and is public once the Council approves it', async ({ page, playwright, request }) => {
  const title = `Reading group forming ${uid()}`;
  await joinMember(page, { tier: 'associate' });
  await submit(page, title);
  const mine = page.locator('#my-submissions li', { hasText: title });
  await expect(mine.getByText('Waiting for approval')).toBeVisible();

  // Not public yet
  const before = (await call(request, 'GET', '/api/announcements?limit=100')).body.announcements;
  expect(before.some((a) => a.title === title)).toBe(false);
  await page.goto('/announcements');
  await expect(page.getByRole('heading', { name: title })).toHaveCount(0);

  // The Council approves it
  await decide(playwright, title, 'approve');

  // Now everyone can read it
  await page.context().clearCookies();
  await page.goto('/announcements');
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await page.getByRole('link', { name: title }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  await expect(page.getByText('Everyone is welcome.')).toBeVisible();
});

test('a declined announcement is not posted, and the member sees the Council\'s reason', async ({ page, playwright, request }) => {
  const title = `Workshop offer ${uid()}`;
  const reason = `Please add the date and a registration link ${uid()}`;
  await joinMember(page, { tier: 'associate' });
  await submit(page, title);

  await decide(playwright, title, 'decline', reason);

  await page.goto('/members/announce');
  const mine = page.locator('#my-submissions li', { hasText: title });
  await expect(mine.getByText('Not approved')).toBeVisible();
  await expect(mine.getByText(reason)).toBeVisible();
  const anns = (await call(request, 'GET', '/api/announcements?limit=100')).body.announcements;
  expect(anns.some((a) => a.title === title)).toBe(false);
});

test('members cannot post "NAGP news" or skip approval; the Council can post official announcements', async ({ playwright, request }) => {
  const member = await newPerson(playwright);
  await signInAs(member, 'member');
  const official = await call(member, 'POST', '/api/announcements', { title: 'Official?', body: 'x', category: 'NAGP news', visibility: 'public', official: true });
  expect(official.status).toBe(400);
  expect(official.body.fields.category).toBeTruthy();
  await member.dispose();

  const council = await newPerson(playwright);
  await signInAs(council, 'council');
  const title = `Members-only news ${uid()}`;
  const r = await call(council, 'POST', '/api/announcements', { title, body: 'For members.', category: 'NAGP news', visibility: 'members', official: true });
  expect(r.body.status).toBe('approved');
  await council.dispose();

  // Members-only: hidden from visitors, shown to members
  const forVisitors = (await call(request, 'GET', '/api/announcements?limit=100')).body.announcements;
  expect(forVisitors.some((a) => a.title === title)).toBe(false);
  expect((await call(request, 'GET', `/api/announcements/${r.body.id}`)).status).toBe(401);
  await signInAs(request, 'member');
  const forMembers = (await call(request, 'GET', '/api/announcements?limit=100')).body.announcements;
  expect(forMembers.find((a) => a.title === title)).toMatchObject({ author_name: 'NAGP Founding Council', from_council: true });
});
