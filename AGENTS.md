# Notes for AI assistants (Grok, Claude, Copilot, ...) working on this site

This is the website for NAGP (National Association of Gestalt Practitioners). Its users are Gestalt therapists, many of them older and not comfortable with technology. **Simple, calm and obvious beats clever.**

## Read before changing anything
1. `README.md` covers what the site does, how to run it, and how to deploy it.
2. `docs/CONVENTIONS.md` covers the structure, design system, helpers and rules. **Follow it.**
3. `docs/API.md` lists every API endpoint and who may use it.
4. `docs/source/` holds what the Council actually asked for: the briefing, Ken's and James's notes, and the old site.

## Stack
Plain HTML/CSS/vanilla JS with no framework. `build.mjs` turns `site/` into `dist/`. The server code is Cloudflare Pages Functions (`functions/api/`), with shared code in `lib/`. The database is Cloudflare D1 (SQLite), and its tables are in `lib/schema.js`. Everything runs on Cloudflare's free tier.

## Run and test
```
npm install
npm run dev      # http://localhost:8788 with sample data; one-click demo sign-in on /signin
npm test         # end-to-end tests (Playwright). Run before every push; all must pass.
node build.mjs --strict   # fails on broken internal links
```

## Rules
- Build HTML in JS only with the NAGP.html template helper (it escapes user text). No inline `<script>` or `onclick=` (the Content-Security-Policy blocks them).
- Every API route checks access on the server with `requireUser(context, 'member' | 'council')`. Use `?` placeholders in SQL. Never return `password_hash`.
- Money is in cents and is computed on the server, never taken from the browser.
- Don't add frameworks or new dependencies without asking the project owner.
- Text the Council still has to supply is marked with `<span class="placeholder-note">`. Don't invent facts about NAGP or its people.
- Work on a branch and open a pull request. Don't push straight to `main` (Cloudflare deploys `main` automatically).
