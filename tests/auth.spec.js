// Signing in and out with an email and password.
import { test, expect, call, uid, joinMember, newPerson, signInAs, PASSWORD } from './helpers.js';

test('sign in with email and password, then sign out @phone', async ({ page, playwright }) => {
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
  await expect(page).toHaveURL(/\/members\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Welcome, ${name}`);

  // Sign out (on phones the button is inside the menu)
  let signOut = page.getByRole('button', { name: 'Sign out' });
  if (!(await signOut.count())) {
    await page.getByRole('button', { name: 'Menu' }).click();
    signOut = page.getByRole('button', { name: 'Sign out' });
  }
  await signOut.first().click();
  await expect(page).toHaveURL((url) => url.pathname === '/');
  expect((await call(page, 'GET', '/api/session')).body.user).toBeNull();
  await page.goto('/members/');
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
