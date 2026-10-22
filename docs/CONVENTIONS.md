# How this website is built (read this before changing anything)

This is the guide for anyone working on the NAGP website: people, Claude, Grok or any other assistant.

## Who the site is for

Most visitors are **Gestalt therapists, many of them older and not very comfortable with technology**. Every decision should make the site **simple, calm and obvious**:

- Use plain words. Say "Sign in", not "Authenticate". Say "Pay $150", not "Proceed".
- Have one clear main action per screen, shown as a big button. Avoid menus that open on hover, carousels, pop-ups and tiny icons without words.
- Labels sit above the form fields. Mark optional fields with "(optional)". Error messages say exactly what to fix.
- After every action, say clearly what happened and what comes next ("Thank you! Your announcement was sent to the Council for approval. You will see it on the Announcements page once it is approved.").
- Write dates out in full: "Thursday, November 12, 2026, 7:00 to 8:30 PM EST". Never write "11/12".
- The tone is professional but warm, the way Gestalt practitioners value presence and human connection. Avoid sounding corporate or clinical.

## Tech in one paragraph

**Cloudflare Pages** serves the static pages in `dist/`, which are built from `site/` by `build.mjs`. **Pages Functions** in `functions/api/` are the small server, and they use the shared code in `lib/`. **Cloudflare D1** (SQLite) is the database. Its tables are in `lib/schema.js` and are created automatically on the first request. There is no framework and no bundler on the browser side: plain HTML, one CSS file and small vanilla JS files. Everything runs on Cloudflare's free tier.

```
site/pages/        one .html file per page (URL = file path without .html)
site/partials/     reusable snippets, included with {{> name}} or {{> name id=home}}
site/layout.html   the shared header, menu and footer around every page
site/assets/css/styles.css   the design system (colors, buttons, cards, forms...)
site/assets/js/app.js        shared browser helpers (window.NAGP)
site/assets/js/<page>.js     one script per page that needs one
lib/config.js      org name, the membership and its price, member types, specialties, states  (also sent to the browser)
lib/schema.js      database tables
lib/seed.js        sample data for the preview (every row has sample = 1): three demo accounts, two events, two board topics
lib/http.js        json(), HttpError, validate(), requireUser()
lib/auth.js        passwords, sessions, cookies, "forgot your password" links
lib/email.js       sending email through Resend (RESEND_API_KEY, EMAIL_FROM)
lib/db.js          all(), first(), run(), randomId()
functions/api/     the API. The file path is the URL, e.g. functions/api/events/[id].js -> /api/events/123
```

## Running it locally

```
npm install
npm run dev          # builds, then serves on http://localhost:8788 with a local database
npm run db:reset     # wipe the local database (it is re-created with sample data)
```

If several people or agents work at once, each one uses their own build folder, port and database:

```
NAGP_DIST=dist-me node build.mjs && npx wrangler pages dev dist-me --d1 DB=nagp-local --binding DEMO_MODE=true --port 8790 --persist-to .wrangler/state-me --compatibility-date=2025-09-01
```

Re-run `NAGP_DIST=dist-me node build.mjs` after changing anything in `site/`. Changes in `functions/` and `lib/` reload by themselves. The build prints warnings for broken internal links, so fix them.

## Pages

Every page in `site/pages/` starts with a settings comment:

```html
<!--meta { "title": "Members Directory", "description": "One sentence.", "nav": "members",
           "section": "members", "access": "member", "scripts": ["members-directory.js"] } -->
<section class="page-header">
  <div class="container">
    <h1>Members Directory</h1>
    <p class="lede">One or two plain sentences saying what this page is for.</p>
  </div>
</section>
<section class="section">
  <div class="container"> ... </div>
</section>
```

- `nav`: which main-menu item is highlighted. One of the keys of `NAV` in `build.mjs`: `home about directory resources faq contact members`.
- `section`: shows a row of section links under the menu. One of `about`, `members` or `council` (the links are listed in `build.mjs`).
- `access`: `member` or `council` pages are hidden until `app.js` confirms the visitor may see them. Otherwise a friendly "Please sign in" box is shown. **This is only cosmetic. The API must always check access itself with `requireUser()`.**
- No inline `<script>` and no `onclick=` attributes. The Content-Security-Policy blocks them. Put code in `site/assets/js/<name>.js` and list it in `scripts`.
- Use `<span class="placeholder-note missing">Info missing - to be provided by the Council</span>` (a dashed box) for anything the Council still has to supply or confirm, such as bios, photos, prices or wording.

## Design system (site/assets/css/styles.css)

Layout uses `.container` (`.container-narrow`, `.container-mid`), `.section`, `.section-alt` (sand background), `.page-header`, `.grid` (auto columns), `.grid-2`, `.grid-3`, `.split` (2/3 + 1/3), `.prose` (long text) and `.stack`. `.container-narrow` and `.container-mid` are narrower but keep the same left edge as the logo and menu, so every page title starts in the same place. Use the same container in a page's `.page-header` as in its body.

| Component | Classes |
|---|---|
| Buttons | `.btn` (sage green pill), `.btn-accent` (soft clay, for "Join us" / "Pay"), `.btn-secondary` (outline), `.btn-quiet`, `.btn-danger`, `.btn-light`. Sizes: `.btn-small`, `.btn-large`, `.btn-block`. Group them in `.actions`. Use `.link-button` for a link-styled button. |
| Cards | `.card`, `.card-link` (whole card clickable, add `.card-cta` text), `.card-highlight`, `.card-flat`, `.card-icon` |
| Badges | `.badge` plus `-primary -accent -success -warning -danger -sample`. `NAGP.sampleBadge(row)` renders the "Sample" tag. |
| Notices | `.notice` plus `-info -success -warning -error`, with an optional `.notice-title`. `NAGP.notice(type, msg, title)` builds one. |
| Forms | `.form` (max width), `fieldset` and `legend`, `.field` (label + input), `.hint`, `.optional`, `.check` (big checkbox + label), `.check-group`, `.choice-cards` and `.choice-card` (big radio cards, put a `.choice-title` inside), `.form-actions`, `.form-status` (put one in every form, and errors and success messages appear there), `.inline-form`, `.hp-field` (spam trap) |
| Tables | `.table-wrap` > `table.table.table-stack` (stacks on phones: add `data-label="Column"` to each td) |
| Lists | `.list-check` (check-mark bullets), `.list-plain`, `.divided`, `.meta-list`, `.tag-list` |
| People | `.person`, `.avatar` (initials, `NAGP.initials(name)`), `.avatar-lg`, `.person-name`, `.person-role`, `.meta` |
| Events | `.event-item` > `.date-block` (`.month .day .weekday`) + body |
| Other | `.filters`, `.filter-pills` (buttons with aria-pressed), `.results-count`, `.empty`, `.loading`, `.steps` (numbered), `.steps-inline` (progress: li[aria-current="step"], li.done), `.price-card` + `.price`, `.sample-price` (dashed "Sample price, to be confirmed by the Council" note), `.summary-box` / `.summary-row` / `.summary-total`, `.hero`, `.cta-band`, `.eyebrow`, `.lede`, `.muted`, `.center` |

Type: headings use Source Serif 4, everything else Atkinson Hyperlegible. Atkinson draws the digit zero with a slash, so `styles.css` borrows only the "0" from Figtree (an extra `@font-face` with `unicode-range: U+0030`); dates read "2026", not "2Ø26". Never set text smaller than `.9rem` (about 16px).

The header and menus (markup in `site/layout.html` and `build.mjs`, styles in the Header section of `styles.css`):
- The main menu is set in `NAV` in `build.mjs`: Home, About us (opens Founding Council first), Public Directory, Resources, FAQ, Contact, then a green **Members** button that opens My Profile, then a **Donate** pill at the right, under the "Join us" button. On every member page, the member pages show as tabs under the menu (`SECTIONS.members`: My Profile, Events, Members Directory, Community Board, My Membership). Member pages must use `"access": "member"` and `requireUser(context, 'member')` on their API.
- Laptop: logo and account buttons on top, the menu in one row below.
- Narrower screens (1080px and less) get the green **Menu** button, so the menu never wraps onto two lines. If you add a menu item, check that it still fits and move that width if needed.
- Phones (640px and less): logo + Menu on top, then big account buttons side by side. Sign out is repeated inside the menu (`.menu-signout`); `app.js` wires up every `[data-signout]`, so the copy works without extra code. The section links (`.subnav`) fold into one "… : all pages" button (`.subnav-phone`).
- The preview banner is one line on a laptop; `.preview-banner-more` parts are hidden on phones. The preview-only `.feedback-fab` is a small dark pill (never terracotta or green, so it does not compete with page buttons), and the footer has extra bottom padding while it is shown.

**Look and feel:** a community site, not a corporate one. Soft sage, warm clay, oat and cream, rounded pill buttons, light footer, tinted blocks (`--sage-tint`, `--peach-tint`, `--butter-tint`, `--sky-tint`) instead of heavy borders or dark bands. Every text color still passes WCAG AA contrast; check new colors before using them.

Colors are CSS variables in `:root`, e.g. `var(--primary)`, `var(--accent)`, `var(--sand)`, `var(--ink-soft)`. Don't hard-code new colors. If an area really needs extra CSS, put it in `site/assets/css/<area>.css` and list it in the page's `styles`.

## Browser helpers (window.NAGP, from app.js)

```js
NAGP.ready.then(({ user, demo, payments }) => { ... })   // every page; user is null when signed out
NAGP.whenAllowed().then(...)    // on access: member/council pages, runs only if the visitor may see the page
const data = await NAGP.api('/api/events', { query: { when: 'upcoming' } });
await NAGP.api('/api/contact', { method: 'POST', body: {...} });   // throws Error(.message friendly, .status, .fields)

el.innerHTML = NAGP.html`<h3>${event.title}</h3>${NAGP.paragraphs(event.description)}`;
// ALWAYS build HTML with NAGP.html (it escapes values). Nest NAGP.html results or arrays of them freely.
// NAGP.raw(str) inserts trusted HTML unescaped. Never use it on anything a user typed.

NAGP.form(formEl, { onSubmit: (data) => NAGP.api(...), success: 'Thank you! ...', reset: true });
// Handles "Sending…", required fields, field errors from the server (err.fields) and the .form-status box.

NAGP.formatDate(iso, tz) / formatShortDate / formatTime / dateParts / eventWhen(event) / timeAgo
NAGP.money(cents) -> "$150" or "Free" (or "X$" while ORG.showPrices is false; { exact: true } always shows the amount)
NAGP.regionName('NY');  NAGP.regionOptions(selected)
NAGP.specialtyLabel('od'); NAGP.tier('member'); NAGP.initials(name); NAGP.qs('id')
NAGP.loading(el); NAGP.showError(el, err); NAGP.notice(type, msg, title)
NAGP.config  // lib/config.js PUBLIC_CONFIG: ORG, SPECIALTIES, MEMBERSHIP_TIERS, MEMBER_TYPES, REGIONS, ...
```

Pages with an id in the address use a query string, for example `/event?id=3` and `/members/topic?id=7`.

## API conventions (functions/api)

```js
import { json, readJson, validate, requireUser, HttpError, nowIso } from '../../lib/http.js';
import { all, first, run } from '../../lib/db.js';

export async function onRequestGet(context) {           // context = { request, env, params, data }
  const user = requireUser(context, 'member');            // 'signed-in' | 'member' | 'council'
  const rows = await all(context.env, 'SELECT ... WHERE x = ?', value);
  return json({ items: rows });
}
export async function onRequestPost(context) {
  const body = await readJson(context.request);
  const check = validate(body);
  const title = check.text('title', { label: 'Title', required: true, max: 120 });
  check.done();                                           // 400 with friendly per-field messages
  ...
  return json({ ok: true, id });
}
```

- `context.data.user` is the full users row (or null), and `context.data.demo` is true in preview mode. The middleware has already set up the database, checked the session and blocked cross-site POSTs.
- Throw `new HttpError(status, 'Friendly sentence.')` for errors. The middleware turns it into `{ error }` JSON.
- Always use `?` placeholders in SQL. Never build SQL from user input.
- Never send `password_hash` or private fields to the browser. Each endpoint picks the fields it returns.
- User text is stored as plain text and shown with `NAGP.paragraphs()`. It is never stored as HTML.
- Money is always in **cents** (integer). Prices come from `lib/config.js` or the events table, **never from the browser**.
- There is **one membership for everyone** (`MEMBERSHIP_TIERS` has a single entry, key `member`). What a member does is `users.member_type`: `professional`, `student` or `associate` (shown as "Other"), listed in `MEMBER_TYPES`. Only `professional` members get the professional fields and can be in the Public Directory.
- While the Council has not set the dues, `ORG.showPrices` is `false` and the pages show amounts as **X$** (donation amounts excepted). The test build sets `NAGP_SHOW_PRICES=1` so the tests can check real amounts.
- Dates are ISO strings. Events store `starts_at` with an offset plus an IANA `timezone`.

## Preview mode

While `ORG.preview` is true (lib/config.js), every page shows the "Preview site" banner and a "Comment on this page" button. Comments are saved to the `feedback` table and listed in the Council area. While `DEMO_MODE` is not `"false"` (a Cloudflare environment variable), the sign-in page offers one-click demo accounts and payments are simulated. Before launch: set `ORG.preview = false`, set `DEMO_MODE=false`, add the Stripe keys, and delete the sample data from the Council area.
