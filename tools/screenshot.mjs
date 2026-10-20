// Take a screenshot of a page:  node tools/screenshot.mjs <url> <out.png> [width=1280] [full=1] [demoAs]
// demoAs (optional): member | professional | council  -> signs in with a demo account first.
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const [,, url, out, width = '1280', full = '1', demoAs] = process.argv;
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ executablePath });
const page = await browser.newPage({ viewport: { width: Number(width), height: 900 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('console error:', m.text()); });
page.on('pageerror', (e) => console.log('page error:', e.message));
if (demoAs) {
  const origin = new URL(url).origin;
  await page.goto(origin + '/signin');
  const res = await page.request.post(origin + '/api/auth/demo', { data: { as: demoAs }, headers: { origin } });
  if (!res.ok()) console.log('demo sign-in failed:', res.status(), await res.text());
}
await page.goto(url, { waitUntil: 'networkidle' });
await page.screenshot({ path: out, fullPage: full === '1' });
await browser.close();
console.log('saved', out);
