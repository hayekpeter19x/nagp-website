// Community board: topics, replies, reports and Council moderation.
import { test, expect, call, uid, signInAs, joinMember, contextOptions } from './helpers.js';

async function newPage(browser, as) {
  const context = await browser.newContext(contextOptions());
  const page = await context.newPage();
  if (as) await signInAs(page, as);
  return page;
}

test('start a topic (guidelines box required), reply, report it, and the Council hides it', async ({ page, browser }) => {
  const title = `Finding a supervisor ${uid()}`;
  const body = `Does anyone know a Gestalt supervisor in Ohio? ${uid()}`;
  const author = await joinMember(page, { tier: 'associate' });

  // Start a topic: the guidelines box must be ticked
  await page.goto('/members/board');
  await page.getByRole('textbox', { name: 'Title' }).fill(title);
  await page.getByRole('textbox', { name: /Your message/ }).fill(body);
  await page.getByRole('button', { name: /Post my topic/ }).click();
  await expect(page.getByText('Please tick this box to continue.')).toBeVisible();
  await page.getByRole('checkbox', { name: /community guidelines/ }).check();
  await page.getByRole('button', { name: /Post my topic/ }).click();
  await expect(page.getByText('Your topic was posted.')).toBeVisible();
  await expect(page.locator('#topics').getByRole('link', { name: title })).toBeVisible();

  // Reply to it
  await page.getByRole('link', { name: /Go to your topic/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  await expect(page.getByText(body)).toBeVisible();
  const reply = `Try asking at the next salon. ${uid()}`;
  await page.getByRole('textbox', { name: /Your reply/ }).fill(reply);
  await page.getByRole('button', { name: /Post my reply/ }).click();
  await expect(page.getByText('Your reply was posted.', { exact: false })).toBeVisible();
  await expect(page.locator('#thread').getByText(reply)).toBeVisible();
  // You cannot report your own posts
  await expect(page.getByRole('button', { name: 'Report this post' })).toHaveCount(0);
  const topicUrl = page.url();

  // Another member reports the topic
  const other = await newPage(browser, 'member');
  await other.goto(topicUrl);
  await other.getByRole('article', { name: /^Topic by/ }).getByRole('button', { name: 'Report this post' }).click();
  const dialog = other.getByRole('dialog', { name: /Report this post/ });
  await dialog.getByRole('textbox').fill('This is not respectful.');
  await dialog.getByRole('button', { name: 'Send report' }).click();
  await expect(dialog.getByText(/Your report was sent to the Council/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(other.getByText('You reported this post. Thank you.')).toBeVisible();

  // The Council hides it
  const council = await newPage(browser, 'council');
  await council.goto('/council/approvals#reports');
  const card = council.locator('li[data-post]', { has: council.getByRole('heading', { name: new RegExp(title) }) });
  await expect(card.getByText('This is not respectful.')).toBeVisible();
  await card.getByRole('button', { name: /Hide it/ }).click();
  const ask = council.getByRole('dialog');
  await ask.getByRole('textbox', { name: /Reason/ }).fill('Not kind');
  await ask.getByRole('button', { name: 'Hide the post' }).click();
  await expect(council.getByText(/^Hidden\. Members now see only/)).toBeVisible();
  await council.context().close();

  // Members now see the placeholder, without the text or the author's name
  await other.reload();
  await expect(other.getByRole('heading', { level: 1 })).toHaveText('Hidden by the Council');
  await expect(other.getByText(/This post was hidden by the Council/)).toBeVisible();
  await expect(other.getByText(body)).toHaveCount(0);
  const topicPost = other.getByRole('article').first();
  await expect(topicPost).toContainText(/hidden by the Council/);
  await expect(topicPost).not.toContainText(author.name);
  await expect(other.getByRole('heading', { level: 1 })).not.toContainText(title);
  await expect(other.getByRole('textbox', { name: /Your reply/ })).toHaveCount(0);
  await other.goto('/members/board');
  await expect(other.getByRole('link', { name: title })).toHaveCount(0);
  await expect(other.locator('#topics').getByText(/This post was hidden by the Council/).first()).toBeVisible();
  await other.context().close();

  // Replying to a hidden topic is refused by the server too
  const id = new URL(topicUrl).searchParams.get('id');
  const r = await call(page, 'POST', `/api/board/${id}/replies`, { body: 'Still here?' });
  expect(r.status).toBe(403);
});

test('the server also requires the guidelines box, and members can report a post only once', async ({ request, playwright }) => {
  await signInAs(request, 'professional');
  const noAgree = await call(request, 'POST', '/api/board', { title: 'No box', body: 'Text' });
  expect(noAgree.status).toBe(400);
  expect(noAgree.body.fields.agree).toBeTruthy();
  const ok = await call(request, 'POST', '/api/board', { title: `Topic ${uid()}`, body: 'Text', agree: true });
  expect(ok.status).toBe(200);

  const reporter = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  await signInAs(reporter, 'member');
  expect((await call(reporter, 'POST', `/api/board/${ok.body.id}/report`, { reason: 'x' })).status).toBe(200);
  expect((await call(reporter, 'POST', `/api/board/${ok.body.id}/report`, { reason: 'x' })).status).toBe(409);
  await reporter.dispose();
  // Not your own post
  expect((await call(request, 'POST', `/api/board/${ok.body.id}/report`, { reason: 'x' })).status).toBe(400);
});
