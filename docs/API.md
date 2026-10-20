# API contract

Every endpoint returns JSON. Errors look like `{ "error": "Friendly sentence.", "fields": { "email": "..." } }`.
Access levels: **public**, **signed-in** (any account, even unpaid), **member** (active membership, or Council), **council**.
Money is in cents. Dates are ISO strings. Booleans in rows are 0/1 from SQLite. Convert them to true/false where it helps the browser.

## Core (done)
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | /api/session | public | `{ user, demo, payments: 'demo'|'stripe' }` |
| POST | /api/auth/signin | public | `{ email, password }` |
| POST | /api/auth/signout | public | |
| POST | /api/auth/demo | public (preview) | `{ as: 'member'|'professional'|'council' }` |
| POST | /api/contact | public | `{ name, email, topic, message }` → saved in `messages` |
| POST | /api/subscribe | public | `{ first_name, last_name, email, source, interest }` → `subscribers` |
| POST | /api/feedback | public | `{ page, name, comment }` → `feedback` |

## Events, payments, membership (payments agent)
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | /api/events | public | `?when=upcoming|past` (default upcoming), `&limit=`, `&category=` → `{ events: [Event] }` (published only, upcoming sorted soonest first, past sorted newest first) |
| GET | /api/events/:id | public | `{ event: Event }` |
| POST | /api/events/:id/register | public | `{ name, email }`. Free → `{ status: 'confirmed' }`. Paid → `{ status: 'pending', checkout_url }`. Member price if signed in as an active member. Members-only events need a member. |
| POST | /api/membership/join | public | application (tier, name, email, password, city, state, professional fields, agree) → creates the user (status pending) + order, signs them in → `{ checkout_url }` |
| POST | /api/membership/renew | signed-in | `{ tier? }` → `{ checkout_url }` |
| POST | /api/donate | public | `{ amount_cents, name, email, note }` → `{ checkout_url }` |
| GET | /api/orders/:id | public with `?token=` | `{ order }` (safe fields). With Stripe, also confirms a pending order via `session_id`. |
| POST | /api/checkout/demo-complete | public (only when DEMO_MODE is on AND no Stripe key is set) | `{ id, token }` → `{ order, receipt_url }` |
| POST | /api/stripe/webhook | Stripe | verifies signature → marks paid |
| GET | /api/me/orders | signed-in | `{ membership, orders: [...], registrations: [...] }` |
| POST | /api/orders/:id | public with `{ token }` | starts or resumes a Stripe payment for a pending order |

`Event = { registration_state, your_price_cents, id, title, category, summary, description, starts_at, ends_at, timezone, location, is_online, presenter, ce_info, price_member_cents, price_public_cents, members_only, capacity, spots_left (null = unlimited), registration_open, is_past, sample, my_registration: null | { status } }`

### lib/payments.js (payments agent writes it, Council agent imports it)
```js
createOrder(env, { kind, ref_id, description, amount_cents, user_id, name, email, meta })  // -> order row (id like 'ord_7K3M9QX2PD', token)
startCheckout(env, request, order)        // -> { url }   demo: /checkout?order=ID&token=T   stripe: hosted Checkout URL
markOrderPaid(env, orderId, { provider = 'demo', provider_ref = null })   // -> order. Idempotent; runs fulfilment once:
   //  membership: user active, tier/member_type from order meta, membership_expires = max(today, current) + 1 year
   //  event:      registrations with this order_id -> confirmed
   //  donation:   nothing else
orderLinks(order)                         // -> { checkout: '/checkout?…', receipt: '/payment-complete?…' }
```
`provider` is `'demo'`, `'stripe'` or `'manual'` (a check or cash recorded by the Council).

## Members, directory, announcements, board, documents (members agent)
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | /api/me | signed-in | full own profile (no password hash) |
| PUT | /api/me | signed-in | update own profile: name, city, state, credentials, training, specialties[], bio, website, public_email, public_phone, show_public (professionals only), show_members |
| POST | /api/me/password | signed-in | `{ current_password, new_password }` |
| GET | /api/directory | public | `?specialty=&state=&q=` → `{ practitioners: [...] }`. Only active professionals with show_public = 1. |
| GET | /api/members/directory | member | `?state=&q=&type=` → `{ members: [...] }`. Active members with show_members = 1, including non-professionals. |
| GET | /api/announcements | public | `?limit=&category=` → `{ announcements: [...] }`. Approved only, newest first. Members-only ones are included only for members. |
| GET | /api/announcements/:id | public | `{ announcement }` |
| POST | /api/announcements | member | `{ title, body, category, link_url, visibility, official }`. Members' posts are pending. Council posts are approved at once, and `official: true` posts as "NAGP Founding Council". → `{ status }` |
| GET | /api/me/announcements | member | my submissions with status and decline reason |
| GET | /api/board | member | `{ topics: [{ id, title, author_name, created_at, last_activity, reply_count, excerpt, sample }] }` |
| POST | /api/board | member | `{ title, body, agree }` → `{ id }` |
| GET | /api/board/:id | member | `{ topic, replies }`. Hidden posts show as "hidden by the Council" (Council sees the text too). |
| POST | /api/board/:id/replies | member | `{ body }` |
| POST | /api/board/:id/report | member | `{ reason }` (topic or reply id) |
| GET | /api/documents | public | `{ documents }` filtered by the viewer: public for all, members for members, council for the Council |

## Council area (Council agent). Every endpoint needs council access.
| Method | Path | Notes |
|---|---|---|
| GET | /api/council/summary | counts for the dashboard |
| GET | /api/council/announcements | `?status=pending|approved|declined` |
| POST | /api/council/announcements/:id | `{ action: 'approve'|'decline'|'unpublish'|'delete', reason }` |
| GET | /api/council/members | `?q=&status=&role=&format=csv` |
| POST | /api/council/members | add a member by hand (for example someone who paid by check) |
| PATCH | /api/council/members/:id | status, role, tier, membership_expires, show_public… |
| POST | /api/council/members/:id/password | set a new password for someone who forgot theirs |
| GET/POST | /api/council/events | list all (including unpublished) / create |
| PUT/DELETE | /api/council/events/:id | |
| GET | /api/council/events/:id/registrations | `?format=csv` |
| GET/POST | /api/council/documents | |
| PUT/DELETE | /api/council/documents/:id | |
| GET | /api/council/messages | contact form messages |
| POST | /api/council/messages/:id | `{ handled }` |
| GET | /api/council/subscribers | `?format=csv` |
| GET | /api/council/orders | all payments |
| POST | /api/council/orders | record a payment received by check or cash (uses markOrderPaid with provider 'manual') |
| DELETE | /api/council/subscribers/:id | remove someone from the mailing-list sign-ups |
| GET | /api/council/reports | community board reports |
| POST | /api/council/board/:id | `{ action: 'hide'|'unhide'|'delete', reason }` |
| POST | /api/council/reports/:id/resolve | |
| GET | /api/council/feedback | preview comments |
| POST | /api/council/feedback/:id | `{ resolved }` |
| POST | /api/council/sample-data/delete | deletes every sample = 1 row (and the demo accounts) |
