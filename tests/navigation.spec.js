// Main menu, the phone "Menu" button and the text-size buttons.
import { test, expect, openMainMenu, signInAs } from './helpers.js';

const mainMenu = (page) => page.getByRole('navigation', { name: 'Main menu', includeHidden: true });

test('every main menu link opens its page and is marked as the current page @phone', async ({ page }) => {
  await page.goto('/');
  const hrefs = await mainMenu(page).getByRole('link', { includeHidden: true })
    .evaluateAll((links) => links.map((a) => a.getAttribute('href')));
  expect(hrefs.length).toBeGreaterThanOrEqual(6);
  expect(hrefs).toEqual(expect.arrayContaining(['/', '/about', '/membership', '/events', '/announcements', '/directory', '/contact']));

  for (const href of [...hrefs.slice(1), hrefs[0]]) {
    await openMainMenu(page);
    await mainMenu(page).locator(`a[href="${href}"]`).click();
    await expect(page).toHaveURL((url) => url.pathname === href);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(mainMenu(page).locator(`a[href="${href}"]`)).toHaveAttribute('aria-current', 'page');
    await expect(mainMenu(page).locator('a[aria-current="page"]')).toHaveCount(1);
  }
});

test('the phone "Menu" button opens and closes the menu @phone', async ({ page, isMobile }) => {
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Menu' });
  const about = mainMenu(page).getByRole('link', { name: 'About', exact: true, includeHidden: true });
  if (!isMobile) {
    // Wide screens show the menu all the time.
    await expect(toggle).toBeHidden();
    await expect(about).toBeVisible();
    return;
  }
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(about).toBeHidden();

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(about).toBeVisible();

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(about).toBeHidden();

  // And it still works after opening it again to go somewhere.
  await toggle.click();
  await about.click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false');
});

// The text-size buttons sit in the header, or inside the menu on small screens.
async function textSizeButtons(page) {
  const groups = page.getByRole('group', { name: /text size/i });
  if (!(await groups.count())) await openMainMenu(page);
  await expect(groups.first()).toBeVisible();
  return groups.first().getByRole('button');
}

test('the text-size buttons change the size, and the choice is kept on other pages @phone', async ({ page }) => {
  await page.goto('/');
  const fontSize = () => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  const normal = await fontSize();
  let sizes = await textSizeButtons(page);
  await expect(sizes).toHaveCount(3);
  await expect(sizes.first()).toHaveAttribute('aria-pressed', 'true');

  await sizes.nth(1).click();
  await expect(sizes.nth(1)).toHaveAttribute('aria-pressed', 'true');
  const large = await fontSize();
  expect(large).toBeGreaterThan(normal);

  sizes = await textSizeButtons(page);
  await sizes.last().click();
  await expect(sizes.last()).toHaveAttribute('aria-pressed', 'true');
  await expect(sizes.first()).toHaveAttribute('aria-pressed', 'false');
  const largest = await fontSize();
  expect(largest).toBeGreaterThan(large);

  // The choice is remembered on the next pages.
  await page.goto('/about');
  expect(await fontSize()).toBe(largest);
  sizes = await textSizeButtons(page);
  await expect(sizes.last()).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/events');
  expect(await fontSize()).toBe(largest);

  sizes = await textSizeButtons(page);
  await sizes.first().click();
  await expect(sizes.first()).toHaveAttribute('aria-pressed', 'true');
  expect(await fontSize()).toBe(normal);
  await page.reload();
  expect(await fontSize()).toBe(normal);
  await expect((await textSizeButtons(page)).first()).toHaveAttribute('aria-pressed', 'true');
});

test('the section menu of the Members\' Area works @phone', async ({ page }) => {
  await signInAs(page, 'member');
  await page.goto('/members/');
  const section = page.getByRole('navigation', { name: /Members.? Area pages/ });
  if (!(await section.getByRole('link', { name: 'My Profile' }).count())) {
    // Phones show one button that opens the list of pages
    await section.getByText(/all pages/).click();
  }
  await section.getByRole('link', { name: 'My Profile' }).click();
  await expect(page).toHaveURL(/\/members\/profile$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('My Profile');
  await expect(section.getByRole('link', { name: 'My Profile', includeHidden: true }).first()).toHaveAttribute('aria-current', 'page');
});
