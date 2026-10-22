// My Membership: one membership for everyone, renew, and cancel (or change your mind).
import { test, expect, call, signInAs, newPerson, joinMember } from './helpers.js';

test('My Membership shows one membership and a single Renew button', async ({ page }) => {
  await joinMember(page, { tier: 'associate' });
  await page.goto('/members/payments');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('My Membership');
  await expect(page.getByText('Membership: NAGP membership')).toBeVisible();
  await expect(page.getByRole('button', { name: /Renew for one year: \$100/ })).toBeVisible();
  await expect(page.getByRole('combobox', { name: /Membership type/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Switch to/ })).toHaveCount(0);
});

test('a member cancels, the Council is told, and the member can change their mind', async ({ page, playwright }) => {
  const { name } = await joinMember(page, { tier: 'associate' });
  await page.goto('/members/payments');
  await page.getByRole('button', { name: 'Cancel my membership' }).click();
  await page.getByRole('button', { name: 'Yes, cancel my membership' }).click();
  await expect(page.getByText(/You asked to cancel on/)).toBeVisible();
  await expect(page.getByText(/Your cancellation was sent to the Council/)).toBeVisible();
  // Still a member until the end date
  expect((await call(page, 'GET', '/api/session')).body.user.isMember).toBe(true);

  const council = await newPerson(playwright);
  await signInAs(council, 'council');
  const { messages } = (await call(council, 'GET', '/api/council/messages')).body;
  expect(messages.some((m) => m.name === name && /asked to cancel/.test(m.message))).toBe(true);
  await council.dispose();

  await page.getByRole('button', { name: 'Keep my membership' }).click();
  await expect(page.getByText('Thank you. Your membership will continue as before.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel my membership' })).toBeVisible();
});

test('cancelling needs a sign-in', async ({ request }) => {
  expect((await call(request, 'POST', '/api/membership/cancel', {})).status).toBe(401);
});
