// Smoke test: every built page loads, has exactly one main heading, and runs without errors.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test, expect, collectErrors, signInAs } from './helpers.js';

// The built site (npm test builds it before the tests start). The source pages map one to one
// onto it, so they are used if the build folder is not there yet.
const BUILT = process.env.NAGP_TEST_DIST || 'dist-test';
const DIST = existsSync(BUILT) ? BUILT : 'site/pages';

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

// dist-test/about.html -> /about, dist-test/members/index.html -> /members/
const PAGES = walk(DIST).filter((f) => f.endsWith('.html')).sort().map((file) => {
  const rel = '/' + relative(DIST, file).split('\\').join('/');
  const path = rel.endsWith('/index.html') ? rel.slice(0, -'index.html'.length) : rel.replace(/\.html$/, '');
  const html = readFileSync(file, 'utf8');
  const access = (html.match(/<body[^>]*data-access="(\w+)"/) || html.match(/<!--meta[^>]*"access":\s*"(\w+)"/) || [])[1] || 'public';
  return { path, access };
});

// Gated pages may log the 401/403 of an API call they make before access is known
// (and the not-found page logs its own 404).
const resourceError = /Failed to load resource: the server responded with a status of 4\d\d/;

// Waits until the session is known and no "Loading…" placeholder is visible any more.
const settled = (page) => page.waitForFunction(() => window.NAGP && window.NAGP.session
  && [...document.querySelectorAll('.loading')].every((el) => !el.offsetParent));

test('the build has pages to check @phone', () => {
  expect(PAGES.length).toBeGreaterThan(30);
});

for (const { path, access } of PAGES) {
  const notFound = path === '/404';
  test(`${path} loads signed out @phone`, async ({ page }) => {
    const errors = collectErrors(page);
    const url = notFound ? '/this-page-does-not-exist' : path;
    const res = await page.goto(url);
    expect(res.status()).toBe(notFound ? 404 : 200);
    await settled(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    if (access !== 'public') await expect(page.getByRole('heading', { level: 1 })).toHaveText('Please sign in');
    const unexpected = errors.filter((e) => !((access !== 'public' || notFound) && resourceError.test(e)));
    expect(unexpected).toEqual([]);
  });

  if (access !== 'public') {
    test(`${path} loads for the Council`, async ({ page }) => {
      const errors = collectErrors(page);
      await signInAs(page, 'council');
      const res = await page.goto(path);
      expect(res.status()).toBe(200);
      await settled(page);
      await expect(page.locator('body')).toHaveClass(/access-ok/);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Please sign in');
      expect(errors).toEqual([]);
    });
  }
}
