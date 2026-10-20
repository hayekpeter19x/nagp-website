// Joining NAGP and paying for membership (simulated card payments in the preview).
import {
  test, expect, call, uid, PASSWORD, joinMember, orderFromUrl, payDemo, oneYearFromToday, expectAccessOk,
} from './helpers.js';

test('a new Professional member joins, pays, uses the Members\' Area and is listed publicly @phone', async ({ page }) => {
  const id = uid();
  const name = `Jordan Rivers ${id}`;
  const email = `jordan.${id}@example.com`;

  await page.goto('/join');
  // Step 1: membership type
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Please choose a type of membership.')).toBeVisible();
  await page.getByRole('radio', { name: /Professional Member/ }).check();
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 2: details (Continue without them shows what is missing)
  await expect(page.getByRole('heading', { name: /Your details/ })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Please enter your full name.')).toBeVisible();
  await page.getByRole('textbox', { name: /full name/i }).fill(name);
  await page.getByRole('textbox', { name: /^Email address/ }).fill(email);
  await page.getByRole('textbox', { name: /City or town/ }).fill('Cleveland');
  await page.getByRole('combobox', { name: /State or province/ }).selectOption('OH');
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel(/same password again/i).fill(PASSWORD);
  await page.getByRole('textbox', { name: /credentials/i }).fill('LPC');
  await page.getByRole('textbox', { name: /Gestalt training/i }).fill('Three-year Gestalt therapy training, Cleveland');
  await page.getByRole('checkbox', { name: 'Clinical' }).check();
  await page.getByRole('checkbox', { name: /Find a Practitioner/ }).check();
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 3: review and agree
  await expect(page.getByRole('heading', { name: /Review/ })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await page.getByRole('button', { name: /Continue to payment/ }).click();
  await expect(page.getByText(/tick the box to agree|Please tick this box/).first()).toBeVisible();
  await page.getByRole('checkbox', { name: /community guidelines/ }).check();
  await page.getByRole('button', { name: /Continue to payment/ }).click();

  // Checkout, then the receipt
  await expect(page).toHaveURL(/\/checkout\?order=ord_/);
  await expect(page.getByText('$150').first()).toBeVisible();
  await page.getByRole('button', { name: /^Pay \$150/ }).click();
  await expect(page).toHaveURL(/\/payment-complete\?order=ord_/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Thank you!');
  await expect(page.getByText('Welcome to NAGP!')).toBeVisible();
  await expect(page.getByText(/Your membership is active until/)).toBeVisible();
  const order = orderFromUrl(page.url());

  // The Members' Area works for them now
  await page.getByRole('link', { name: /Go to the Members.? Area/ }).click();
  await expect(page).toHaveURL(/\/members\/$/);
  await expectAccessOk(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Welcome, ${name}`);
  const me = (await call(page, 'GET', '/api/me')).body.user;
  expect(me).toMatchObject({ status: 'active', tier: 'professional', member_type: 'professional', show_public: true, isMember: true });
  expect(me.membership_expires).toBe(oneYearFromToday());

  // They opted in, so the public directory lists them
  await page.goto(`/directory?q=${encodeURIComponent(id)}`);
  await expect(page.getByRole('heading', { name: new RegExp(name) })).toBeVisible();

  // Paying the same order again changes nothing
  const again = await call(page, 'POST', '/api/checkout/demo-complete', order);
  expect(again.status).toBe(200);
  expect(again.body.order.status).toBe('paid');
  expect((await call(page, 'GET', '/api/me')).body.user.membership_expires).toBe(oneYearFromToday());
  await page.goto(`/checkout?order=${order.id}&token=${order.token}`);
  await expect(page.getByText('This has already been paid. Thank you!')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Pay/ })).toHaveCount(0);
});

test('an Associate member does not get the professional questions and is not listed publicly', async ({ page }) => {
  await page.goto('/join?tier=associate');
  await expect(page.getByRole('radio', { name: /Associate Member/ })).toBeChecked();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('textbox', { name: /credentials/i })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: /Find a Practitioner/ })).toHaveCount(0);
});

test('the join form explains problems: a short password, different passwords, an email that is taken', async ({ page }) => {
  await page.goto('/join?tier=associate');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('textbox', { name: /full name/i }).fill('Pat Example');
  await page.getByRole('textbox', { name: /^Email address/ }).fill('demo.member@nagp-preview.org');
  await page.getByRole('textbox', { name: /City or town/ }).fill('Chicago');
  await page.getByRole('combobox', { name: /State or province/ }).selectOption('IL');
  await page.getByLabel('Password', { exact: true }).fill('short');
  await page.getByLabel(/same password again/i).fill('short');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Please choose a password with at least 8 characters.')).toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill('long enough password');
  await page.getByLabel(/same password again/i).fill('a different password');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText(/The two passwords are not the same/)).toBeVisible();
  await page.getByLabel(/same password again/i).fill('long enough password');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('checkbox', { name: /community guidelines/ }).check();
  await page.getByRole('button', { name: /Continue to payment/ }).click();
  // The server says the email is taken; the form goes back to the step with the email box.
  await expect(page.getByText(/already exists/)).toBeVisible();
  await expect(page.getByRole('textbox', { name: /^Email address/ })).toHaveAttribute('aria-invalid', 'true');
});

test('paying twice at the same moment adds only one year', async ({ request }) => {
  const { order } = await joinMember(request, { tier: 'associate', pay: false });
  const [a, b] = await Promise.all([
    call(request, 'POST', '/api/checkout/demo-complete', order),
    call(request, 'POST', '/api/checkout/demo-complete', order),
  ]);
  expect([a.status, b.status]).toEqual([200, 200]);
  const me = (await call(request, 'GET', '/api/me')).body.user;
  expect(me.status).toBe('active');
  expect(me.membership_expires).toBe(oneYearFromToday());
  const orders = (await call(request, 'GET', '/api/me/orders')).body.orders;
  expect(orders.filter((o) => o.status === 'paid')).toHaveLength(1);
});

test('renewing early adds a year to the current end date, and an unfinished renewal is reused', async ({ request }) => {
  await joinMember(request, { tier: 'associate' });
  const first = (await call(request, 'GET', '/api/me')).body.user.membership_expires;
  const r1 = await call(request, 'POST', '/api/membership/renew', { tier: 'associate' });
  const r2 = await call(request, 'POST', '/api/membership/renew', { tier: 'associate' });
  expect(r1.status).toBe(200);
  expect(r2.body.order_id).toBe(r1.body.order_id);
  await payDemo(request, orderFromUrl(r1.body.checkout_url));
  const [y, m, d] = first.split('-').map(Number);
  const expected = `${y + 1}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  expect((await call(request, 'GET', '/api/me')).body.user.membership_expires).toBe(expected);
});

test('My Payments shows the receipt of a membership payment', async ({ page }) => {
  const { order } = await joinMember(page, { tier: 'student' });
  await page.goto('/members/payments');
  await expectAccessOk(page);
  await expect(page.getByRole('heading', { name: 'Your membership', exact: true })).toBeVisible();
  await page.getByRole('link', { name: /View receipt/ }).first().click();
  await expect(page).toHaveURL(new RegExp(`order=${order.id}`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Thank you!');
});

test('each receipt keeps the end date that payment gave, even after a later renewal', async ({ page }) => {
  const { order: first } = await joinMember(page, { tier: 'associate' });
  const firstEnd = oneYearFromToday();
  const renew = await call(page, 'POST', '/api/membership/renew', { tier: 'associate' });
  const second = orderFromUrl(renew.body.checkout_url);
  await payDemo(page, second);
  const [y, m, d] = firstEnd.split('-');
  const secondEnd = `${Number(y) + 1}-${m}-${d}`;

  const receipt = async (o) => (await call(page, 'GET', `/api/orders/${o.id}?token=${o.token}`)).body.order.membership.expires;
  expect(await receipt(second)).toBe(secondEnd);
  expect(await receipt(first)).toBe(firstEnd);
  await page.goto(`/payment-complete?order=${first.id}&token=${first.token}`);
  const longDate = (ymd) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  await expect(page.getByText(`Your membership is active until ${longDate(firstEnd)}.`)).toBeVisible();
});
