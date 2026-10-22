// Finishing joining later, and renewing a membership early or after it has ended.
import {
  test, expect, call, signInAs, newPerson, joinMember, oneYearFromToday, expectAccessOk, uid,
} from './helpers.js';

const yesterday = () => new Date(Date.now() - 864e5).toISOString().slice(0, 10);

test('someone who did not pay when joining can finish from My Membership', async ({ page, request }) => {
  const id = uid();
  await joinMember(page, { tier: 'professional', name: `Later Payer ${id}`, pay: false, showPublic: true });
  // Not listed anywhere until they have paid
  expect((await call(request, 'GET', `/api/directory?q=${id}`)).body.practitioners).toHaveLength(0);

  await page.goto('/members/payments');
  await expectAccessOk(page);
  await expect(page.getByRole('heading', { name: 'Finish joining' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: /Membership type/ })).toHaveCount(0);
  await page.getByRole('link', { name: 'Pay $100' }).click();
  await expect(page).toHaveURL(/\/checkout\?/);
  await page.getByRole('button', { name: /^Pay \$100/ }).click();
  await expect(page.getByText('Welcome to NAGP!')).toBeVisible();

  const me = (await call(page, 'GET', '/api/me')).body.user;
  expect(me).toMatchObject({ status: 'active', tier: 'member', member_type: 'professional', show_public: true, membership_expires: oneYearFromToday() });
  const { orders } = (await call(page, 'GET', '/api/me/orders')).body;
  expect(orders.map((o) => [o.amount_cents, o.status])).toEqual([[10000, 'paid']]);
  // Now they have paid, the public directory lists them (they ticked the box)
  expect((await call(request, 'GET', `/api/directory?q=${id}`)).body.practitioners).toHaveLength(1);
});

test('a member whose membership has ended is asked to renew, and renewing gives a new year from today', async ({ page, playwright }) => {
  await joinMember(page, { tier: 'associate' });
  const me = (await call(page, 'GET', '/api/me')).body.user;
  const council = await newPerson(playwright);
  await signInAs(council, 'council');
  expect((await call(council, 'PATCH', `/api/council/members/${me.id}`, { membership_expires: yesterday() })).status).toBe(200);
  await council.dispose();

  await page.goto('/members/board');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your membership has ended');
  expect((await call(page, 'GET', '/api/board')).status).toBe(403);
  await page.getByRole('link', { name: 'Renew my membership' }).click();
  await expect(page).toHaveURL(/\/members\/payments$/);
  await expect(page.getByRole('heading', { name: 'Your membership has ended' })).toBeVisible();
  await page.getByRole('button', { name: /Renew now: \$100/ }).click();
  await expect(page).toHaveURL(/\/checkout\?/);
  await expect(page.getByText(/renewal/).first()).toBeVisible();
  await page.getByRole('button', { name: /^Pay \$100/ }).click();
  await expect(page.getByText('Your membership is renewed')).toBeVisible();

  expect((await call(page, 'GET', '/api/me')).body.user).toMatchObject({ status: 'active', membership_expires: oneYearFromToday(), isMember: true });
  await page.goto('/members/board');
  await expectAccessOk(page);
});

test('an active member renews early from My Payments and keeps the time they already had', async ({ page }) => {
  await joinMember(page, { tier: 'associate' });
  const before = (await call(page, 'GET', '/api/me')).body.user.membership_expires;
  await page.goto('/members/payments');
  await expect(page.getByRole('heading', { name: 'Your membership', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Renew for one year: \$100/ }).click();
  await page.getByRole('button', { name: /^Pay \$100/ }).click();
  await expect(page.getByText('Your membership is renewed')).toBeVisible();
  const [y, m, d] = before.split('-').map(Number);
  expect((await call(page, 'GET', '/api/me')).body.user.membership_expires).toBe(`${y + 1}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
});
