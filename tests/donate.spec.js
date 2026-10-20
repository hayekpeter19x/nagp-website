// Donations: choose an amount, pay (simulated), receipt.
import { test, expect, call, uid, signInAs } from './helpers.js';

test('a visitor gives $50, pays, and gets a receipt', async ({ page, playwright }) => {
  const email = `donor.${uid()}@example.com`;
  await page.goto('/donate');
  await expect(page.getByRole('radio', { name: '$50' })).toBeChecked();
  await page.getByRole('textbox', { name: /name/i }).fill('Generous Donor');
  await page.getByRole('textbox', { name: /^Email/ }).fill(email);
  await page.getByRole('textbox', { name: /note/i }).fill('Keep up the good work.');
  await page.getByRole('button', { name: /Continue to payment: \$50/ }).click();

  await expect(page).toHaveURL(/\/checkout\?order=ord_/);
  await expect(page.getByText('Donation to NAGP').first()).toBeVisible();
  await page.getByRole('button', { name: /^Pay \$50/ }).click();
  await expect(page).toHaveURL(/\/payment-complete\?/);
  await expect(page.getByText('Thank you for your gift!')).toBeVisible();
  await expect(page.getByText('Your gift of $50 was received.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Receipt' })).toBeVisible();

  // The Council sees it on the Payments page.
  const council = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  await signInAs(council, 'council');
  const { orders } = (await call(council, 'GET', '/api/council/orders')).body;
  expect(orders.find((o) => o.email === email)).toMatchObject({ kind: 'donation', amount_cents: 5000, status: 'paid' });
  await council.dispose();
});

test('another amount: too small is refused, $37.50 works', async ({ page }) => {
  await page.goto('/donate');
  await page.getByRole('radio', { name: 'Another amount' }).check();
  const amount = page.getByRole('textbox', { name: /amount/i });
  await expect(amount).toBeVisible();
  await amount.fill('3');
  await page.getByRole('textbox', { name: /name/i }).fill('Small Donor');
  await page.getByRole('textbox', { name: /^Email/ }).fill(`small.${uid()}@example.com`);
  await page.getByRole('button', { name: /Continue to payment/ }).click();
  await expect(page.getByText(/at least \$5/)).toBeVisible();
  await expect(page).toHaveURL(/\/donate$/);

  await amount.fill('37.50');
  await expect(page.getByRole('button', { name: /Continue to payment: \$37\.50/ })).toBeVisible();
  await page.getByRole('button', { name: /Continue to payment/ }).click();
  await expect(page).toHaveURL(/\/checkout\?/);
  await expect(page.getByRole('button', { name: /^Pay \$37\.50/ })).toBeVisible();
});

test('the server checks the amount itself', async ({ request }) => {
  for (const amount_cents of [499, 0, -100, 12.5, '100; DROP TABLE orders', 3_000_000]) {
    const r = await call(request, 'POST', '/api/donate', { amount_cents, name: 'X', email: 'x@example.com' });
    expect(r.status, String(amount_cents)).toBe(400);
    expect(r.body.fields.amount_cents).toBeTruthy();
  }
});
