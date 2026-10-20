// Contact form, mailing-list sign-up, and the preview's "Comment on this page" button.
import { test, expect, call, uid, signInAs, contextOptions } from './helpers.js';

test('contact form: errors for empty and invalid fields, then a thank-you', async ({ page, playwright }) => {
  const id = uid();
  await page.goto('/contact');
  const form = page.locator('#contact-form');
  await form.getByRole('button', { name: 'Send message' }).click();
  await expect(form.getByText('Please fill in "Your name".')).toBeVisible();
  await expect(form.getByText(/Please fill in "Your email address"/)).toBeVisible();
  await expect(form.getByText('Please fill in "Your message".')).toBeVisible();
  await expect(form.getByRole('textbox', { name: 'Your name' })).toHaveAttribute('aria-invalid', 'true');
  await expect(form.getByRole('textbox', { name: 'Your name' })).toBeFocused();

  await form.getByRole('textbox', { name: 'Your name' }).fill('Chris Contact');
  await form.getByRole('textbox', { name: /email/i }).fill('chris-at-example');
  await form.getByRole('textbox', { name: 'Your message' }).fill(`Hello Council ${id}`);
  await form.getByRole('button', { name: 'Send message' }).click();
  await expect(form.getByText(/Please check the email address/)).toBeVisible();
  await expect(form.getByRole('textbox', { name: /email/i })).toHaveAttribute('aria-invalid', 'true');

  await form.getByRole('textbox', { name: /email/i }).fill('chris@example.com');
  await form.getByRole('combobox', { name: /about/ }).selectOption('Membership');
  await form.getByRole('button', { name: 'Send message' }).click();
  await expect(form.getByText(/Thank you, Chris Contact! Your message was sent/)).toBeVisible();
  await expect(form.getByText(/Please check the email address/)).toHaveCount(0);
  await expect(form.getByRole('textbox', { name: 'Your message' })).toHaveValue('');

  // The Council reads it
  const council = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  await signInAs(council, 'council');
  const { messages } = (await call(council, 'GET', '/api/council/messages')).body;
  expect(messages.find((m) => m.message === `Hello Council ${id}`)).toMatchObject({ name: 'Chris Contact', email: 'chris@example.com', topic: 'Membership' });
  await council.dispose();
});

test('the contact topic can be chosen from the link', async ({ page }) => {
  await page.goto('/contact?topic=Sign-in%20help');
  await expect(page.getByRole('combobox', { name: /about/ })).toHaveValue('Sign-in help');
  await expect(page.getByText(/Forgot your password\?/).first()).toBeVisible();
  await page.goto('/contact?topic=Events');
  await expect(page.getByRole('combobox', { name: /about/ })).toHaveValue('Events and trainings');
});

test('mailing-list sign-up: errors for a missing or wrong email, then a thank-you', async ({ page, playwright }) => {
  const email = `list.${uid()}@example.com`;
  await page.goto('/newsletter');
  const form = page.locator('form[data-subscribe-form]');
  await form.getByRole('button', { name: /Sign Me Up/i }).click();
  await expect(form.getByText('Please fill in "Email address".')).toBeVisible();

  await form.getByRole('textbox', { name: 'First name' }).fill('Lee');
  await form.getByRole('textbox', { name: 'Last name' }).fill('Listener');
  await form.getByRole('textbox', { name: 'Email address' }).fill('lee@');
  await form.getByRole('button', { name: /Sign Me Up/i }).click();
  await expect(form.getByText(/Please check the email address/)).toBeVisible();

  await form.getByRole('textbox', { name: 'Email address' }).fill(email);
  await form.getByRole('button', { name: /Sign Me Up/i }).click();
  await expect(form.getByText(/You're on the list/)).toBeVisible();

  const council = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  await signInAs(council, 'council');
  const { subscribers } = (await call(council, 'GET', '/api/council/subscribers')).body;
  expect(subscribers.find((s) => s.email === email)).toMatchObject({ first_name: 'Lee', last_name: 'Listener', source: 'newsletter' });
  await council.dispose();
});

test('the home page sign-up form works too', async ({ page }) => {
  await page.goto('/');
  const form = page.locator('form[data-subscribe-form]');
  await form.getByRole('textbox', { name: 'Email address' }).fill(`home.${uid()}@example.com`);
  await form.getByRole('button', { name: /Sign Me Up/i }).click();
  await expect(form.getByText(/You're on the list/)).toBeVisible();
});

test('"Comment on this page" saves a comment that the Council reads in Site Feedback', async ({ page, browser }) => {
  const comment = `Please make the dates bigger ${uid()}`;
  await page.goto('/events');
  await page.getByRole('button', { name: 'Comment on this page' }).locator('visible=true').first().click();
  const dialog = page.getByRole('dialog', { name: 'Comment on this page' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Send comment' }).click();
  await expect(dialog.getByText('Please fill in "Your comment".')).toBeVisible();
  await dialog.getByRole('textbox', { name: /Your name/ }).fill('Reviewer Rae');
  await dialog.getByRole('textbox', { name: 'Your comment' }).fill(comment);
  await dialog.getByRole('button', { name: 'Send comment' }).click();
  await expect(dialog.getByText(/Your comment was saved/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();

  const context = await browser.newContext(contextOptions());
  const council = await context.newPage();
  await signInAs(council, 'council');
  await council.goto('/council/feedback');
  const item = council.getByRole('listitem').filter({ hasText: comment });
  await expect(item).toBeVisible();
  await expect(item).toContainText('Reviewer Rae');
  await expect(council.locator('.page-group', { hasText: comment }).getByRole('heading')).toContainText('Events');
  await item.getByRole('button', { name: 'Mark as done' }).click();
  await expect(council.getByText('Marked as done.')).toBeVisible();
  await context.close();
});

test('a comment can be sent from a page with a very long address', async ({ page }) => {
  await page.goto(`/directory?q=${encodeURIComponent('ü'.repeat(100))}`);
  await expect(page.locator('#dir-count')).toHaveText(/found/);
  expect(new URL(page.url()).search.length).toBeGreaterThan(300);
  await page.getByRole('button', { name: 'Comment on this page' }).locator('visible=true').first().click();
  const dialog = page.getByRole('dialog', { name: 'Comment on this page' });
  await dialog.getByRole('textbox', { name: 'Your comment' }).fill('The search box could be wider.');
  await dialog.getByRole('button', { name: 'Send comment' }).click();
  await expect(dialog.getByText(/Your comment was saved/)).toBeVisible();
});
