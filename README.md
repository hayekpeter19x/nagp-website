# NAGP website (preview)

The new website for **NAGP, the National Association of Gestalt Practitioners**. It is built to replace the temporary WordPress site at usgestalt.org once the Council is happy with it.

It runs entirely on **Cloudflare's free tier**:
- **Cloudflare Pages** hosts the pages.
- **Pages Functions** are the small server (`functions/api/`).
- **D1** is the database. It is created and filled with sample data automatically on the first visit.

| Who | What they can do |
|---|---|
| Everyone | Read about NAGP and the Founding Council, search the Public Directory (practicing professionals who chose to be listed), read Resources and the FAQ, join and pay online, donate, contact the Council, sign up for the mailing list |
| Members | Edit their profile (practicing professionals can choose to appear in the Public Directory), see and register for events, browse the Members Directory, use the Community Board, and see their membership (renew or cancel), registrations and receipts |
| Council | Manage members (including people who pay by check, and password resets), events, messages, mailing-list sign-ups and payments, hide Community Board posts that break the guidelines, and read website feedback |

There is **one membership for everyone**. When joining, people say what best describes them: a practicing professional, a student or trainee, or other. Only practicing professionals get the professional questions (credentials, training, areas of practice) and can be listed in the Public Directory. Until the Council sets the dues, prices show as **X$** (see `ORG.showPrices` in `lib/config.js`).

The site is designed for readers of every age. It has large text (Atkinson Hyperlegible, a typeface made for low-vision readers), high contrast, big buttons and plain language. There are no hover menus or pop-ups.

## Preview mode

While the Council reviews the site:
- A banner on every page says it is a preview.
- A **Comment on this page** button saves feedback. Read it in Council Area → Site Feedback.
- The sign-in page has one-click buttons: **Try it as a member** and **Try it as a Council member**.
- Payments are **simulated**. No real money moves.
- Made-up examples (members, events, posts) show a **Sample** tag. Demo and sample accounts use the password `nagp-preview`.

## Run it on your computer

Needs Node.js 20 or newer.

```
npm install
npm run dev        # http://localhost:8788  (rebuild with `npm run build` after editing site/)
npm run db:reset   # start over with fresh sample data
npm test           # end-to-end tests (Playwright)
```

Read **docs/CONVENTIONS.md** before changing anything. It explains the structure, the design system and the helpers. **docs/API.md** lists every API endpoint. The Council's original requests are in **docs/source/**.

## Put the preview online (Cloudflare Pages, free)

**The preview is live at https://nagp-website.pages.dev.** It is a Cloudflare Pages project called `nagp-website`, connected to this GitHub repository, and it redeploys automatically on every push to `main`.

### Option A: connect the GitHub repository (recommended, auto-deploys on every change)
1. In the Cloudflare dashboard go to **Workers & Pages → Create application**, click **Continue to Pages** at the bottom (not "Connect GitHub", which makes a Worker), then **Connect to Git**, and pick this repository.
2. Use these build settings: Framework preset **None**, Build command `npm run build`, Build output directory `dist`. Under environment variables, add `SKIP_DEPENDENCY_INSTALL` = `1` (the build needs only Node, so this makes deploys faster). Click **Save and Deploy**.
3. Go to **Storage & Databases → D1 → Create database** and name it `nagp-website-db`.
4. Open the Pages project and go to **Settings → Bindings → Add → D1 database**. Set Variable name `DB` and select `nagp-website-db`. Do this for Production and for Preview.
5. Go to **Deployments → ⋯ → Retry deployment**. Bindings apply from the next deployment.
6. Open `https://<project-name>.pages.dev`. The database sets itself up with sample data on the first visit.

### Option B: from the command line (wrangler)
```
npx wrangler login
npx wrangler d1 create nagp-website-db          # copy the database_id it prints
cp wrangler.toml.example wrangler.toml           # paste the database_id into it
npx wrangler pages project create nagp-website --production-branch main
npm run deploy
```

## Going live (replacing usgestalt.org)

1. The Council confirms the name, wording, membership prices, bios and photos, and the Covenant of Community text. Search the site for the dashed **"For the Council:"** boxes.
2. In `lib/config.js` set `ORG.preview = false`. This removes the banner and the feedback button and lets search engines index the site.
3. In Cloudflare → Pages project → **Settings → Variables and Secrets**:
   - `DEMO_MODE` = `false` turns off the one-click demo sign-in and the simulated payments.
   - `STRIPE_SECRET_KEY` = your Stripe secret key (from dashboard.stripe.com → Developers → API keys).
   - `STRIPE_WEBHOOK_SECRET` = the signing secret of a Stripe webhook pointing to `https://<your-domain>/api/stripe/webhook` with the event `checkout.session.completed`.
4. Create real accounts for the Council: sign in as the demo Council member, go to **Council Area → Members → Add a member by hand** (below the list), and give each person the **council** role. Then delete the sample data, which also removes the demo accounts. The dashboard no longer has a button for this, so a developer does it: sign in with a real Council account, open the browser's developer console on the site and run
   `fetch('/api/council/sample-data/delete', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: true }) }).then((r) => r.json()).then(console.log)`
5. Set up email for "Forgot your password?" (see below).
6. Under **Custom domains**, add `usgestalt.org`. Its DNS needs to point at Cloudflare. Old WordPress addresses (`/index.php/about/` and so on) already redirect to the new pages (see `site/static/_redirects`).

## Email ("Forgot your password?")

The sign-in page has a **Forgot your password?** link. People type their email address and get an email with a link to choose a new password (it works once, for one hour). Emails are sent with **Resend** (resend.com, free for up to 3,000 emails a month):

1. Create a Resend account, add the domain the emails should come from (for example `usgestalt.org`) and add the DNS records Resend shows you at the domain's DNS host.
2. In Resend, create an API key.
3. In Cloudflare → Pages project → **Settings → Variables and Secrets** (Production), add `RESEND_API_KEY` (as a secret) and `EMAIL_FROM`, for example `NAGP <no-reply@usgestalt.org>`. Optionally add `SITE_URL`, for example `https://usgestalt.org`, for the links in emails. Then redeploy.

Until this is set up, or if an email cannot be sent, the person sees "the Council has been told", and the Council gets a "Sign-in help" message under **Messages & Sign-ups**. A Council member then sets a new password for them on the Members page (**Edit**).

## Not built yet (suggested next steps)
- **More emails** (receipts, renewal reminders). Only the "Forgot your password?" email is built so far. Receipts are shown on screen and are printable.
- Automatic yearly renewal (Stripe subscriptions). For now, membership is a one-year payment with a renew button.
- Photo uploads for profiles and the Founding Council (Cloudflare R2), and newsletter sending.
