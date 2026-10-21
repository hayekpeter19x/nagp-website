// Events are for members only: visitors are asked to sign in. Covers free and paid events,
// member prices, full, past, closed and unpublished events.
import {
  test, expect, call, uid, signInAs, newPerson, createEvent, joinMember, orderFromUrl, payDemo,
} from './helpers.js';

// The sample events (lib/seed.js), found by title so the tests do not depend on ids.
// `target` must be signed in as a member.
async function sampleEvent(target, title, when = 'upcoming') {
  const { events } = (await call(target, 'GET', `/api/events?when=${when}`)).body;
  const ev = events.find((e) => e.title.startsWith(title));
  expect(ev, `sample event "${title}"`).toBeTruthy();
  return ev;
}

// A second person (an API session) signed in with a demo account.
async function person(playwright, as) {
  const p = await newPerson(playwright);
  await signInAs(p, as);
  return p;
}

async function registrations(playwright, eventId) {
  const council = await person(playwright, 'council');
  const r = await call(council, 'GET', `/api/council/events/${eventId}/registrations`);
  await council.dispose();
  return r.body.registrations;
}

test('visitors who are not signed in are asked to sign in, and cannot see or register for events @phone', async ({ page, request }) => {
  await page.goto('/events');
  await expect(page.getByRole('heading', { level: 1, name: 'Please sign in' })).toBeVisible();
  expect((await call(request, 'GET', '/api/events')).status).toBe(401);
  expect((await call(request, 'GET', '/api/events/1')).status).toBe(401);
  expect((await call(request, 'POST', '/api/events/1/register', { name: 'Guest', email: 'guest@example.com' })).status).toBe(401);
});

test('people who have not finished paying for membership cannot use events yet', async ({ page }) => {
  await joinMember(page, { tier: 'student', pay: false });
  await page.goto('/events');
  await expect(page.getByRole('heading', { level: 1, name: 'Your membership is not active yet' })).toBeVisible();
  expect((await call(page, 'GET', '/api/events')).status).toBe(403);
});

test('a member registers for a free event @phone', async ({ page, playwright }) => {
  await joinMember(page, { tier: 'associate' });
  const me = (await call(page, 'GET', '/api/me')).body.user;
  const ev = await sampleEvent(page, 'Open Community Meeting');
  await page.goto('/events');
  await page.getByRole('link', { name: ev.title }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(ev.title);
  await expect(page.getByText('Free').first()).toBeVisible();
  await page.getByRole('button', { name: /Register/ }).click();
  await expect(page.getByText("You're registered!")).toBeVisible();

  const regs = await registrations(playwright, ev.id);
  expect(regs.find((r) => r.email === me.email)).toMatchObject({ status: 'confirmed' });

  // Registering again is refused politely.
  const again = await call(page, 'POST', `/api/events/${ev.id}/register`, { name: me.name, email: me.email });
  expect(again.status).toBe(409);
  expect(again.body.error).toMatch(/already registered/);
});

test('a member sees the member price, pays it, and the place is confirmed @phone', async ({ page, playwright }) => {
  await joinMember(page, { tier: 'associate' });
  const me = (await call(page, 'GET', '/api/me')).body.user;
  const ev = await sampleEvent(page, 'Presentation: Gestalt in Organizations');
  expect(ev.price_member_cents).toBe(2000);

  await page.goto(`/event?id=${ev.id}`);
  await expect(page.getByText('Your price (member)')).toBeVisible();
  await page.getByRole('button', { name: /Register and pay \$20/ }).click();
  await expect(page).toHaveURL(/\/checkout\?order=ord_/);
  await expect(page.getByText(ev.title).first()).toBeVisible();
  await expect(page.getByText(/member price/).first()).toBeVisible();
  expect((await registrations(playwright, ev.id)).find((r) => r.email === me.email).status).toBe('pending');

  await page.getByRole('button', { name: /^Pay \$20/ }).click();
  await expect(page).toHaveURL(/\/payment-complete\?/);
  await expect(page.getByText("You're registered!")).toBeVisible();
  await expect(page.getByText(/Your place at .* is confirmed/)).toBeVisible();
  expect((await registrations(playwright, ev.id)).find((r) => r.email === me.email)).toMatchObject({ status: 'confirmed', amount_cents: 2000 });

  // The event page and My Payments now show the registration.
  await page.goto(`/event?id=${ev.id}`);
  await expect(page.getByText('You are registered for this event.')).toBeVisible();
  await page.goto('/members/payments');
  await expect(page.getByRole('link', { name: ev.title, exact: true })).toBeVisible();
});

test('members can register for a members-only salon', async ({ page }) => {
  await joinMember(page, { tier: 'student' });
  const ev = await sampleEvent(page, 'Members-only Salon');
  await page.goto(`/event?id=${ev.id}`);
  await page.getByRole('button', { name: /Register/ }).click();
  await expect(page.getByText("You're registered!")).toBeVisible();
});

test('a full event cannot be registered for, and says so', async ({ page, playwright }) => {
  const council = await person(playwright, 'council');
  const ev = await createEvent(council, { title: `Tiny salon ${uid()}`, capacity: '1' });
  await council.dispose();

  const a = await person(playwright, 'member');
  const b = await person(playwright, 'professional');
  const first = await call(a, 'POST', `/api/events/${ev.id}/register`, { name: 'First Person', email: `first.${uid()}@example.com` });
  expect(first.body.status).toBe('confirmed');
  const second = await call(b, 'POST', `/api/events/${ev.id}/register`, { name: 'Second Person', email: `second.${uid()}@example.com` });
  expect(second.status).toBe(409);
  expect(second.body.error).toMatch(/full/);
  await a.dispose();
  await b.dispose();

  await signInAs(page, 'council');
  await page.goto(`/event?id=${ev.id}`);
  await expect(page.getByText('This event is full').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Register/ })).toHaveCount(0);
});

test('the last paid place is held for the person who is paying', async ({ playwright }) => {
  const council = await person(playwright, 'council');
  const ev = await createEvent(council, { capacity: '1', price_public: '10', price_member: '10' });
  await council.dispose();

  const a = await person(playwright, 'member');
  const b = await person(playwright, 'professional');
  const ra = await call(a, 'POST', `/api/events/${ev.id}/register`, { name: 'Payer A', email: `a.${uid()}@example.com` });
  expect(ra.body.status).toBe('pending');
  // While A is paying, nobody else can take the place.
  const rb = await call(b, 'POST', `/api/events/${ev.id}/register`, { name: 'Payer B', email: `b.${uid()}@example.com` });
  expect(rb.status).toBe(409);
  const paid = await payDemo(a, orderFromUrl(ra.body.checkout_url));
  expect(paid.status).toBe('paid');
  expect(paid.registration_status).toBe('confirmed');
  await a.dispose();
  await b.dispose();
});

test('past events are listed under "Past events" and cannot be registered for @phone', async ({ page }) => {
  await signInAs(page, 'member');
  const ev = await sampleEvent(page, '2026 National Gathering', 'past');
  expect(ev.registration_state).toBe('past');
  await page.goto('/events');
  await expect(page.getByRole('heading', { name: 'Past events' })).toBeVisible();
  await page.locator('#past-list').getByRole('link', { name: ev.title }).click();
  await expect(page.getByText('This event has already taken place')).toBeVisible();
  await expect(page.getByRole('button', { name: /Register/ })).toHaveCount(0);
  const r = await call(page, 'POST', `/api/events/${ev.id}/register`, { name: 'Late Person', email: 'late@example.com' });
  expect(r.status).toBe(400);
});

test('unpublished events are hidden from members but the Council can preview them', async ({ playwright }) => {
  const council = await person(playwright, 'council');
  const ev = await createEvent(council, { published: false });
  expect((await call(council, 'GET', `/api/events/${ev.id}`)).status).toBe(200);
  await council.dispose();

  const member = await person(playwright, 'member');
  expect((await call(member, 'GET', `/api/events/${ev.id}`)).status).toBe(404);
  expect((await call(member, 'POST', `/api/events/${ev.id}/register`, { name: 'x', email: 'x@example.com' })).status).toBe(404);
  const { events } = (await call(member, 'GET', '/api/events')).body;
  expect(events.some((e) => e.id === ev.id)).toBe(false);
  await member.dispose();
});

test('an unfinished registration can be finished later, from the event page or My Payments', async ({ page, playwright }) => {
  const council = await person(playwright, 'council');
  const ev = await createEvent(council, { price_member: '12', price_public: '30' });
  await council.dispose();

  await joinMember(page, { tier: 'associate' });
  const me = (await call(page, 'GET', '/api/me')).body.user;
  const first = await call(page, 'POST', `/api/events/${ev.id}/register`, { name: me.name, email: me.email });
  expect(first.body.status).toBe('pending');
  // Registering again picks up the same unpaid order instead of taking a second place
  const again = await call(page, 'POST', `/api/events/${ev.id}/register`, { name: me.name, email: me.email });
  expect(again.body.order_id).toBe(first.body.order_id);

  await page.goto(`/event?id=${ev.id}`);
  await expect(page.getByText('Almost done')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Finish payment: $12' })).toBeVisible();
  await page.goto('/members/payments');
  await page.getByRole('link', { name: /Finish payment: \$12/ }).click();
  await expect(page).toHaveURL(new RegExp(`order=${first.body.order_id}`));
  await page.getByRole('button', { name: /^Pay \$12/ }).click();
  await expect(page.getByText("You're registered!")).toBeVisible();
  const regs = (await call(page, 'GET', '/api/me/orders')).body.registrations;
  expect(regs.find((r) => r.event.id === ev.id)).toMatchObject({ status: 'confirmed', amount_cents: 1200 });
});

test('closed and already-started events cannot be registered for', async ({ page, playwright }) => {
  const council = await person(playwright, 'council');
  const closed = await createEvent(council, { registration_open: false });
  const day = (offset) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);
  const started = await createEvent(council, { start_date: day(-1), start_time: '09:00', end_date: day(2), end_time: '17:00' });
  await council.dispose();

  await signInAs(page, 'member');
  await page.goto(`/event?id=${closed.id}`);
  await expect(page.getByText('Registration is closed').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Register/ })).toHaveCount(0);
  expect((await call(page, 'POST', `/api/events/${closed.id}/register`, { name: 'x', email: 'x@example.com' })).status).toBe(400);

  await page.goto(`/event?id=${started.id}`);
  await expect(page.getByText('This event has already started').first()).toBeVisible();
  expect((await call(page, 'POST', `/api/events/${started.id}/register`, { name: 'x', email: 'x@example.com' })).status).toBe(400);
  // Still listed as upcoming until it ends
  expect((await call(page, 'GET', '/api/events')).body.events.some((e) => e.id === started.id)).toBe(true);
});

test('an event that is unpublished after someone started paying cannot be paid for', async ({ page, playwright }) => {
  const council = await person(playwright, 'council');
  const ev = await createEvent(council, { price_public: '25', price_member: '25' });
  const payer = await person(playwright, 'professional');
  const reg = await call(payer, 'POST', `/api/events/${ev.id}/register`, { name: 'Late Payer', email: `late.${uid()}@example.com` });
  await payer.dispose();
  const order = orderFromUrl(reg.body.checkout_url);
  const edited = await call(council, 'GET', `/api/council/events/${ev.id}`);
  const e = edited.body.event;
  expect((await call(council, 'PUT', `/api/council/events/${ev.id}`, {
    ...e, start_date: e.start_date, start_time: e.start_time, end_date: '', end_time: e.end_time,
    price_member: '25', price_public: '25', capacity: '', is_online: '1', published: false,
  })).status).toBe(200);
  await council.dispose();

  await page.goto(`/checkout?order=${order.id}&token=${order.token}`);
  await expect(page.getByText(/no longer listed/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Pay/ })).toHaveCount(0);
  expect((await call(page, 'POST', '/api/checkout/demo-complete', order)).status).toBe(409);
});
