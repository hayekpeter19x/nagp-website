// Builds the website into dist/ — no extra tools needed, just Node.
//
//   node build.mjs          build once
//   node build.mjs --watch  rebuild whenever something in site/ or lib/config.js changes
//
// Each page in site/pages/ starts with a settings comment, for example:
//   <!--meta { "title": "About NAGP", "description": "...", "nav": "about", "section": "about" } -->
// Settings:
//   title        page title (browser tab)
//   description  one sentence for search engines and link previews
//   nav          which main-menu item to highlight (see NAV below)
//   section      show a section menu: "about" | "members" | "council"
//   access       "public" (default) | "member" | "council"  (pages that need sign-in)
//   scripts      extra scripts from site/assets/js/, e.g. ["directory.js"]
//   styles       extra stylesheets from site/assets/css/
// Pages can include snippets from site/partials/ with {{> name}} or {{> name id=home interest=membership}}.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, cpSync, rmSync, existsSync, watch } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = join(ROOT, 'site');
// NAGP_DIST lets several people (or agents) build into separate folders at once.
const DIST = join(ROOT, process.env.NAGP_DIST || 'dist');

// The main menu. Public pages first, then one green "Members" button that opens My Profile;
// the member pages (SECTIONS.members) show as tabs under the menu on every member page.
// Membership is the "Join us" button in the header, and Donate sits at the right end of the menu row.
export const NAV = [
  { key: 'home', label: 'Home', href: '/' },
  { key: 'about', label: 'About us', href: '/founding-council' },
  { key: 'directory', label: 'Public Directory', href: '/directory' },
  { key: 'resources', label: 'Resources', href: '/resources' },
  { key: 'faq', label: 'FAQ', href: '/faq' },
  { key: 'contact', label: 'Contact', href: '/contact' },
  { key: 'members', label: 'Members', href: '/members/profile', section: 'members' },
];
// Pages whose own menu item was folded into another one.
const NAV_ALIAS = { council: 'about' };

export const SECTIONS = {
  about: { label: 'About us', links: [
    ['Founding Council', '/founding-council'], ['Our story', '/about'], ['History & Lineage', '/history'],
  ] },
  members: { label: 'Members', links: [
    ['My Profile', '/members/profile'], ['Events', '/events'], ['Members Directory', '/members/directory'],
    ['Community Board', '/members/board'], ['My Membership', '/members/payments'],
  ] },
  council: { label: 'Council Area', links: [
    ['Dashboard', '/council/'], ['Members', '/council/members'], ['Events', '/council/events'],
    ['Messages & Sign-ups', '/council/messages'], ['Payments', '/council/payments'], ['Site Feedback', '/council/feedback'],
  ] },
};

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function hashDir(dirs) {
  const h = createHash('sha1');
  for (const d of dirs) for (const f of walk(d).sort()) h.update(f).update(readFileSync(f));
  return h.digest('hex').slice(0, 10);
}

// "/about.html" -> "/about", "/members/index.html" -> "/members/"
function urlPathFor(file) {
  const rel = '/' + relative(join(SITE, 'pages'), file).split('\\').join('/');
  if (rel.endsWith('/index.html')) return rel.slice(0, -'index.html'.length);
  return rel.replace(/\.html$/, '');
}

async function build() {
  const started = Date.now();
  // Fresh import each time so --watch picks up config changes.
  const { PUBLIC_CONFIG, ORG } = await import('./lib/config.js?t=' + started);
  // The automated tests check real amounts, so their build can show prices.
  if (process.env.NAGP_SHOW_PRICES === '1') ORG.showPrices = true;

  const partials = {};
  for (const f of walk(join(SITE, 'partials'))) {
    if (f.endsWith('.html')) partials[relative(join(SITE, 'partials'), f).replace(/\.html$/, '')] = readFileSync(f, 'utf8').trim();
  }
  const applyPartials = (html, depth = 0) => html.replace(/\{\{>\s*([\w-/]+)((?:\s+\w+=[\w-]+)*)\s*\}\}/g, (_, name, args) => {
    if (!(name in partials)) { console.warn(`  ! missing partial "${name}"`); return ''; }
    let body = partials[name];
    for (const [, k, v] of args.matchAll(/(\w+)=([\w-]+)/g)) body = body.split(`{{${k}}}`).join(v);
    body = body.replace(/\{\{\w+\}\}/g, ''); // settings that were not given are left empty
    return depth < 4 ? applyPartials(body, depth + 1) : body;
  });
  const applyOrg = (html) => html.replace(/\{\{org\.(\w+)\}\}/g, (_, k) => esc(ORG[k] ?? ''));

  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });
  cpSync(join(SITE, 'assets'), join(DIST, 'assets'), { recursive: true });
  if (existsSync(join(SITE, 'static'))) cpSync(join(SITE, 'static'), DIST, { recursive: true });
  writeFileSync(join(DIST, 'assets/js/config.js'),
    '// Generated by build.mjs from lib/config.js. Do not edit.\nwindow.NAGP_CONFIG = ' + JSON.stringify(PUBLIC_CONFIG, null, 1) + ';\n');

  const version = hashDir([join(SITE, 'assets')]);
  const layout = readFileSync(join(SITE, 'layout.html'), 'utf8');
  // One line on a laptop, two short lines on a phone (the long part is hidden there, and the
  // floating "Comment" button takes the place of the banner's comment link).
  const previewBanner = ORG.preview ? `<section class="preview-banner" aria-label="About this preview"><div class="container">
  <p><strong>Preview site:</strong> a draft for the Council to review, not the live site.<span class="preview-banner-more"> Examples marked &ldquo;Sample&rdquo; are made up.</span></p>
  <p class="preview-banner-links preview-banner-more"><button type="button" class="link-button" data-feedback-open>Comment on this page</button></p>
</div></section>` : '';

  const pages = walk(join(SITE, 'pages')).filter((f) => f.endsWith('.html'));
  const built = new Set();
  const problems = [];
  for (const file of pages) {
    let src = readFileSync(file, 'utf8');
    let meta = {};
    const m = src.match(/^\s*<!--\s*meta\s*(\{[\s\S]*?\})\s*-->/);
    if (m) {
      try { meta = JSON.parse(m[1]); } catch (e) { problems.push(`${relative(ROOT, file)}: bad meta JSON (${e.message})`); }
      src = src.slice(m[0].length);
    } else problems.push(`${relative(ROOT, file)}: no <!--meta {...} --> settings comment`);

    const path = urlPathFor(file);
    const title = meta.title || 'NAGP';
    const fullTitle = path === '/' ? `${ORG.name} (${ORG.short})` : `${title} | ${ORG.short}`;
    const navKey = NAV_ALIAS[meta.nav] || meta.nav;
    const nav = NAV.map((n) => {
      // A menu item is "current" for its own page, or for every page in its section (Members).
      const current = navKey === n.key || path === n.href || (n.section && meta.section === n.section);
      const cls = n.section === 'members' ? ' class="nav-members"' : '';
      return `<li${cls}><a href="${n.href}"${current ? ' aria-current="page"' : ''}>${esc(n.label)}</a></li>`;
    }).join('');
    let subnav = '';
    const section = SECTIONS[meta.section];
    if (section) {
      // Laptops and tablets see a row of buttons; phones see one "<Section>: all pages" button that opens the same list.
      const links = section.links.map(([label, href]) => `<li><a href="${href}"${href === path ? ' aria-current="page"' : ''}>${esc(label)}</a></li>`).join('');
      subnav = `<nav class="subnav" aria-label="${esc(section.label)} pages"><div class="container">`
        + `<span class="subnav-label">${esc(section.label)}:</span><ul class="subnav-list">${links}</ul>`
        + `<details class="subnav-phone"><summary>${esc(section.label)}: all pages</summary><ul>${links}</ul></details>`
        + `</div></nav>`;
    }
    const scripts = (meta.scripts || []).map((s) => `<script src="/assets/js/${s}?v=${version}"></script>`).join('\n');
    const styles = (meta.styles || []).map((s) => `<link rel="stylesheet" href="/assets/css/${s}?v=${version}">`).join('\n');

    const values = {
      fullTitle: esc(fullTitle), title: esc(title), description: esc(meta.description || ORG.tagline),
      access: esc(meta.access || 'public'), path: esc(path), nav, subnav, scripts, styles,
      previewBanner, v: version, year: String(new Date().getFullYear()),
      robots: ORG.preview || meta.noindex ? '<meta name="robots" content="noindex, nofollow">' : '',
      content: src.trim(),
    };
    let html = applyPartials(layout).replace(/\{\{(\w+)\}\}/g, (all, k) => (k in values ? values[k] : all));
    html = applyOrg(applyPartials(html));

    const out = join(DIST, relative(join(SITE, 'pages'), file));
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, html);
    built.add(path);
  }

  // Security headers for every page (Cloudflare Pages reads dist/_headers).
  const inline = layout.match(/<script>([\s\S]*?)<\/script>/);
  const inlineHash = inline ? `'sha256-${createHash('sha256').update(inline[1]).digest('base64')}'` : '';
  const csp = [
    "default-src 'self'", `script-src 'self' ${inlineHash}`, "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:", "font-src 'self'", "connect-src 'self'",
    "frame-src https://www.google.com https://docs.google.com https://www.youtube-nocookie.com",
    "form-action 'self'", "base-uri 'self'", "frame-ancestors 'none'", "object-src 'none'",
  ].join('; ');
  writeFileSync(join(DIST, '_headers'), [
    '/*',
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '  X-Frame-Options: DENY',
    '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(self)',
    `  Content-Security-Policy: ${csp}`,
    ...(ORG.preview ? ['  X-Robots-Tag: noindex, nofollow'] : []),
    '/assets/*',
    '  Cache-Control: public, max-age=3600',
    '',
  ].join('\n'));
  if (ORG.preview) writeFileSync(join(DIST, 'robots.txt'), 'User-agent: *\nDisallow: /\n');

  // Link check: every internal link must point at a page we built.
  const missing = {};
  for (const file of walk(DIST).filter((f) => f.endsWith('.html'))) {
    const html = readFileSync(file, 'utf8');
    for (const [, href] of html.matchAll(/href="(\/[^"#?]*)/g)) {
      if (href.startsWith('/assets/') || href.startsWith('/api/') || /\.\w+$/.test(href)) continue;
      const clean = href === '/' ? '/' : href.replace(/\/+$/, '') ;
      if (!built.has(href) && !built.has(clean) && !built.has(clean + '/')) {
        (missing[href] = missing[href] || new Set()).add(relative(DIST, file));
      }
    }
  }
  for (const [href, from] of Object.entries(missing)) {
    problems.push(`broken link to ${href} (on ${from.size > 3 ? from.size + ' pages' : [...from].join(', ')})`);
  }
  const unique = [...new Set(problems)];
  console.log(`Built ${pages.length} pages into dist/ in ${Date.now() - started} ms${unique.length ? ` with ${unique.length} warning(s):` : '.'}`);
  for (const p of unique) console.log('  ! ' + p);
  return unique;
}

const warnings = await build();
if (process.argv.includes('--strict') && warnings.length) process.exit(1);
if (process.argv.includes('--watch')) {
  let timer = null;
  const again = () => { clearTimeout(timer); timer = setTimeout(() => build().catch((e) => console.error(e)), 150); };
  watch(SITE, { recursive: true }, again);
  watch(join(ROOT, 'lib'), { recursive: true }, again);
  console.log('Watching site/ for changes...');
}
