// Main menu, the phone "Menu" button and the section menus.
import { test, expect, openMainMenu, signInAs } from './helpers.js';

const mainMenu = (page) => page.getByRole('navigation', { name: 'Main menu', includeHidden: true });

test('every main menu link opens its page and is marked as the current page @phone', async ({ page }) => {
  await page.goto('/');
  const hrefs = await mainMenu(page).getByRole('link', { includeHidden: true })
    .evaluateAll((links) => links.map((a) => a.getAttribute('href')));
  expect(hrefs).toEqual(expect.arrayContaining(['/', '/about', '/directory', '/resources', '/faq', '/contact',
    '/members/profile', '/events', '/members/directory', '/members/board', '/members/payments']));

  for (const href of [...hrefs.slice(1), hrefs[0]]) {
    await openMainMenu(page);
    const link = mainMenu(page).locator(`a[href="${href}"]`);
    // The member pages are in the list under the green "Members" button
    if (!(await link.isVisible())) await mainMenu(page).getByRole('button', { name: 'Members' }).click();
    await link.click();
    await expect(page).toHaveURL((url) => url.pathname === href);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(mainMenu(page).locator(`a[href="${href}"]`)).toHaveAttribute('aria-current', 'page');
    await expect(mainMenu(page).locator('a[aria-current="page"]')).toHaveCount(1);
  }
});

test('the green "Members" button opens and closes the list of member pages', async ({ page }) => {
  await page.goto('/about');
  await openMainMenu(page);
  const button = mainMenu(page).getByRole('button', { name: 'Members' });
  const profile = mainMenu(page).getByRole('link', { name: 'My Profile' });
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  await expect(profile).toBeHidden();
  await button.click();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  for (const name of ['My Profile', 'Events', 'Members Directory', 'Community Board', 'My Membership']) {
    await expect(mainMenu(page).getByRole('link', { name, exact: true })).toBeVisible();
  }
  await page.keyboard.press('Escape');
  await expect(profile).toBeHidden();
  await expect(button).toBeFocused();
});

test('the phone "Menu" button opens and closes the menu @phone', async ({ page, isMobile }) => {
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Menu' });
  const about = mainMenu(page).getByRole('link', { name: 'About us', exact: true, includeHidden: true });
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

test('the Members section menu works @phone', async ({ page }) => {
  await signInAs(page, 'member');
  await page.goto('/members/profile');
  const section = page.getByRole('navigation', { name: 'Members pages' });
  if (!(await section.getByRole('link', { name: 'Members Directory' }).count())) {
    // Phones show one button that opens the list of pages
    await section.getByText(/all pages/).click();
  }
  await section.getByRole('link', { name: 'Members Directory' }).click();
  await expect(page).toHaveURL(/\/members\/directory$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Members Directory');
  await expect(section.getByRole('link', { name: 'Members Directory', includeHidden: true }).first()).toHaveAttribute('aria-current', 'page');
});
