// My Profile and the two directories: the public directory (professionals who opt in)
// and the members-only Members Directory.
import { test, expect, call, uid, joinMember, expectAccessOk, signInAs } from './helpers.js';

const publicCheckbox = (page) => page.getByRole('checkbox', { name: /public directory/ });

async function inPublicDirectory(page, id) {
  await page.goto(`/directory?q=${encodeURIComponent(id)}`);
  await expect(page.locator('#dir-count')).toHaveText(/found/);
  return page.locator('#dir-results').getByRole('heading', { name: new RegExp(id) }).count();
}

test('a professional turns the public listing off and on again', async ({ page }) => {
  const id = uid();
  const { name } = await joinMember(page, { tier: 'professional', name: `Robin Listing ${id}`, showPublic: true });
  expect(await inPublicDirectory(page, id)).toBe(1);

  await page.goto('/members/profile');
  await expectAccessOk(page);
  await expect(publicCheckbox(page)).toBeChecked();
  await publicCheckbox(page).uncheck();
  await expect(page.getByText(/You do not appear in the public directory/)).toBeVisible(); // the live preview
  await page.getByRole('button', { name: 'Save my profile' }).click();
  await expect(page.getByText('Your profile was saved.')).toBeVisible();
  expect(await inPublicDirectory(page, id)).toBe(0);
  await expect(page.getByText('No practitioners match your search.')).toBeVisible();

  await page.goto('/members/profile');
  await publicCheckbox(page).check();
  await page.getByRole('textbox', { name: /few words about you/i }).fill(`I work with groups. ${id}`);
  await page.getByRole('button', { name: 'Save my profile' }).click();
  await expect(page.getByText('Your profile was saved.')).toBeVisible();
  expect(await inPublicDirectory(page, id)).toBe(1);
  await expect(page.getByText(`I work with groups. ${id}`)).toBeVisible();
  await expect(page.getByRole('heading', { name: new RegExp(name) })).toBeVisible();
});

test('a member who is not a practicing professional cannot be listed publicly, but is in the Members Directory', async ({ page }) => {
  const id = uid();
  await joinMember(page, { tier: 'associate', name: `Sam Associate ${id}` });
  await page.goto('/members/profile');
  await expectAccessOk(page);
  await expect(publicCheckbox(page)).toBeDisabled();
  await expect(page.getByText('This is only for practicing professionals.')).toBeVisible();

  const r = await call(page, 'PUT', '/api/me', { show_public: true });
  expect(r.status).toBe(400);
  expect(r.body.fields.show_public).toMatch(/professional/);
  expect(await inPublicDirectory(page, id)).toBe(0);

  await page.goto(`/members/directory?q=${id}`);
  await expect(page.locator('#md-results').getByRole('heading', { name: new RegExp(id) })).toBeVisible();
  await expect(page.locator('#md-results').getByText('Member', { exact: true })).toBeVisible();
});

test('the public directory filters by specialty and state', async ({ page }) => {
  await page.goto('/directory');
  await expect(page.locator('#dir-count')).toHaveText(/found/);
  await page.getByRole('button', { name: 'Coaching' }).click();
  await expect(page).toHaveURL(/specialty=coaching/);
  await expect(page.locator('#dir-count')).toHaveText(/in Coaching/);
  const coaches = await call(page, 'GET', '/api/directory?specialty=coaching');
  expect(coaches.body.practitioners.length).toBeGreaterThan(0);
  expect(coaches.body.practitioners.every((p) => p.specialties.includes('coaching'))).toBe(true);
  await expect(page.locator('#dir-results article')).toHaveCount(coaches.body.practitioners.length);

  await page.getByRole('combobox', { name: /State or province/ }).selectOption('OR');
  await expect(page).toHaveURL(/state=OR/);
  await expect(page.locator('#dir-results').getByRole('heading', { name: /Susan Whitfield/ })).toBeVisible();
  // Only public fields are sent to visitors
  const { practitioners } = (await call(page, 'GET', '/api/directory')).body;
  for (const p of practitioners) {
    expect(Object.keys(p)).not.toEqual(expect.arrayContaining(['email']));
    expect(p).not.toHaveProperty('status');
  }
});

test('a professional with a long training description can still save their profile', async ({ page }) => {
  const training = `Three-year Gestalt therapy training. ${'Then supervision groups and advanced seminars over many years. '.repeat(6)}`.trim();
  expect(training.length).toBeGreaterThan(300);
  await joinMember(page, { tier: 'professional', training });
  await page.goto('/members/profile');
  await expectAccessOk(page);
  await page.getByRole('textbox', { name: /City or town/ }).fill('Toledo');
  await page.getByRole('button', { name: 'Save my profile' }).click();
  await expect(page.getByText('Your profile was saved.')).toBeVisible();
  expect((await call(page, 'GET', '/api/me')).body.user.city).toBe('Toledo');
});

test('changing your password', async ({ page }) => {
  const { email } = await joinMember(page, { tier: 'associate' });
  await page.goto('/members/profile');
  await page.getByLabel('Your current password').fill('wrong password');
  await page.getByLabel('New password', { exact: true }).fill('a brand new password');
  await page.getByLabel('New password again').fill('a brand new password');
  await page.getByRole('button', { name: 'Change my password' }).click();
  await expect(page.getByText(/not your current password/)).toBeVisible();

  await page.getByLabel('Your current password').fill('nagp-preview');
  await page.getByLabel('New password', { exact: true }).fill('a brand new password');
  await page.getByLabel('New password again').fill('a brand new password');
  await page.getByRole('button', { name: 'Change my password' }).click();
  await expect(page.getByText('Your password was changed.', { exact: false })).toBeVisible();

  await page.context().clearCookies();
  const old = await call(page, 'POST', '/api/auth/signin', { email, password: 'nagp-preview' });
  expect(old.status).toBe(401);
  const fresh = await call(page, 'POST', '/api/auth/signin', { email, password: 'a brand new password' });
  expect(fresh.status).toBe(200);
});

test('very long search words do not break the directories or the Council\'s member search', async ({ page, request }) => {
  const long = 'x'.repeat(60);
  const accented = 'Müllerü'.repeat(14);
  for (const q of [long, accented, `${'%_\\'.repeat(20)}`, 'maria.delgado@example.com', 'Delgado']) {
    const r = await call(request, 'GET', `/api/directory?q=${encodeURIComponent(q)}`);
    expect(r.status, q).toBe(200);
  }
  await signInAs(request, 'council');
  for (const q of [long, accented, 'demo.member@nagp-preview.org and some more words after it to be long']) {
    expect((await call(request, 'GET', `/api/members/directory?q=${encodeURIComponent(q)}`)).status, q).toBe(200);
    expect((await call(request, 'GET', `/api/council/members?q=${encodeURIComponent(q)}`)).status, q).toBe(200);
  }
  expect((await call(request, 'GET', `/api/council/members?q=${encodeURIComponent('demo.member@nagp-preview.org')}`)).body.members).toHaveLength(1);

  await page.goto(`/directory?q=${encodeURIComponent(long)}`);
  await expect(page.getByText('No practitioners match your search.')).toBeVisible();
});
