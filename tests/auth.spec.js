// Signing in and out with an email and password.
import { test, expect, call, uid, joinMember, newPerson, signInAs, PASSWORD } from './helpers.js';

test('sign in with email and password, then sign out', async ({ page, playwright }) => {
  const person = await newPerson(playwright);
  const { email, name } = await joinMember(person, { tier: 'associate' });
  await person.dispose();

  await page.goto('/signin');
  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('not my password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText(/do not match our records/)).toBeVisible();

  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/members\/profile$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('My Profile');
  await expect(page.locator('#acc-name')).toHaveText(name);

  // Sign out (on phones the button is inside the menu)
  let signOut = page.getByRole('button', { name: 'Sign out' });
  if (!(await signOut.count())) {
    await page.getByRole('button', { name: 'Menu' }).click();
    signOut = page.getByRole('button', { name: 'Sign out' });
  }
  await signOut.first().click();
  await expect(page).toHaveURL((url) => url.pathname === '/');
  expect((await call(page, 'GET', '/api/session')).body.user).toBeNull();
  await page.goto('/members/profile');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Please sign in');
});

test('after 8 wrong passwords, sign-in pauses for that email; a Council password reset lifts it', async ({ request, playwright }) => {
  const person = await newPerson(playwright);
  const { email } = await joinMember(person, { tier: 'associate' });
  await person.dispose();
  for (let i = 0; i < 8; i++) {
    expect((await call(request, 'POST', '/api/auth/signin', { email, password: `wrong ${i}` })).status).toBe(401);
  }
  const locked = await call(request, 'POST', '/api/auth/signin', { email, password: PASSWORD });
  expect(locked.status).toBe(429);
  expect(locked.body.error).toMatch(/wait 15 minutes/);

  const council = await newPerson(playwright);
  await signInAs(council, 'council');
  const { members } = (await call(council, 'GET', `/api/council/members?q=${encodeURIComponent(email)}`)).body;
  expect(members).toHaveLength(1);
  const reset = await call(council, 'POST', `/api/council/members/${members[0].id}/password`, { password: `new-password-${uid()}` });
  expect(reset.status).toBe(200);
  await council.dispose();
  expect((await call(request, 'POST', '/api/auth/signin', { email, password: PASSWORD })).status).toBe(401);
});

test('the Council cannot delete the sample data while no real Council account exists', async ({ request }) => {
  await signInAs(request, 'council');
  const r = await call(request, 'POST', '/api/council/sample-data/delete', { confirm: true });
  expect(r.status).toBe(409);
  expect((await call(request, 'GET', '/api/council/summary')).body.sample.accounts).toBeGreaterThan(0);
});

test('"Forgot your password?" emails a link that sets a new password once, and signs the person in', async ({ page, request, playwright }) => {
  const { email } = await joinMember(request, { tier: 'associate' });
  await page.goto('/signin');
  await page.getByRole('link', { name: 'Choose a new password' }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  // The test server hands back the link instead of emailing it (EMAIL_TEST_MODE in playwright.config.js)
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/auth/forgot')),
    page.getByRole('button', { name: 'Email me a link' }).click(),
  ]);
  const link = new URL((await res.json()).test_link);
  await expect(page.getByText(/we have sent it an email with a link to choose a new password/)).toBeVisible();

  // An email address without an account gets the same answer, and no link
  const unknown = await call(page, 'POST', '/api/auth/forgot', { email: `nobody.${uid()}@example.com` });
  expect(unknown.body.message).toMatch(/If there is an NAGP account for/);
  expect(unknown.body.test_link).toBeUndefined();

  await page.goto(link.pathname + link.search);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Choose a new password');
  await page.getByLabel('New password').fill('short');
  await page.getByLabel('Type the same password again').fill('short');
  await page.getByRole('button', { name: 'Save my new password' }).click();
  await expect(page.getByText('Please choose a password with at least 8 characters.')).toBeVisible();
  await page.getByLabel('New password').fill('a brand new password');
  await page.getByLabel('Type the same password again').fill('a brand new password');
  await page.getByRole('button', { name: 'Save my new password' }).click();
  await expect(page.getByText('Your new password is saved, and you are signed in.')).toBeVisible();
  expect((await call(page, 'GET', '/api/session')).body.user.email).toBe(email);
  // Signed out everywhere else; the old password no longer works, the new one does
  expect((await call(request, 'GET', '/api/session')).body.user).toBeNull();
  const other = await newPerson(playwright);
  expect((await call(other, 'POST', '/api/auth/signin', { email, password: PASSWORD })).status).toBe(401);
  expect((await call(other, 'POST', '/api/auth/signin', { email, password: 'a brand new password' })).status).toBe(200);
  await other.dispose();

  // The link works only once
  await page.goto(link.pathname + link.search);
  await expect(page.getByText(/This link has expired or has already been used/)).toBeVisible();
  const again = await call(page, 'POST', '/api/auth/reset', { token: link.searchParams.get('token'), password: 'another password 2', password_confirm: 'another password 2' });
  expect(again.status).toBe(400);
});
