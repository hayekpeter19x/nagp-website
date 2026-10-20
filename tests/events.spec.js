// Events: registration for free and paid events, member prices, full, past and members-only events.
import {
  test, expect, call, uid, signInAs, newPerson, createEvent, joinMember, orderFromUrl, payDemo,
} from './helpers.js';

// The sample events (lib/seed.js), found by title so the tests do not depend on ids.
async function sampleEvent(request, title, when = 'upcoming') {
  const { events } = (await call(request, 'GET', `/api/events?when=${when}`)).body;
  const ev = events.find((e) => e.title.startsWith(title));
  expect(ev, `sample event "${title}"`).toBeTruthy();
  return ev;
}

async function registrations(playwright, eventId) {
  const council = await newPerson(playwright);
  await signInAs(council, 'council');
  const r = await call(council, 'GET', `/api/council/events/${eventId}/registrations`);
  await council.dispose();
  return r.body.registrations;
}

test('a visitor registers for a free event @phone', async ({ page, request, playwright }) => {
  const ev = await sampleEvent(request, 'Open Community Meeting');
  const name = `Guest ${uid()}`;
  const email = `guest.${uid()}@example.com`;
  await page.goto('/events');
  await page.getByRole('link', { name: ev.title }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(ev.title);
  await expect(page.getByText('Free').first()).toBeVisible();
  await page.getByRole('textbox', { name: /name/i }).fill(name);
  await page.getByRole('textbox', { name: /email/i }).fill(email);
  await page.getByRole('button', { name: /Register/ }).click();
  await expect(page.getByText("You're registered!")).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();

  const regs = await registrations(playwright, ev.id);
  expect(regs.find((r) => r.email === email)).toMatchObject({ name, status: 'confirmed' });

  // Registering the same email again is refused politely.
  const again = await call(request, 'POST', `/api/events/${ev.id}/register`, { name, email });
  expect(again.status).toBe(409);
  expect(again.body.error).toMatch(/already registered/);
});

test('a visitor registers for a paid event, pays, and the place is confirmed @phone', async ({ page, request, playwright }) => {
  const ev = await sampleEvent(request, 'Presentation: Gestalt in Organizations');
  expect(ev.price_public_cents).toBe(3500);
  const email = `payer.${uid()}@example.com`;
  await page.goto(`/event?id=${ev.id}`);
  await expect(page.getByText('$35').first()).toBeVisible();
  await page.getByRole('textbox', { name: /name/i }).fill('Paying Guest');
  await page.getByRole('textbox', { name: /email/i }).fill(email);
  await page.getByRole('button', { name: /Register and pay \$35/ }).click();

  await expect(page).toHaveURL(/\/checkout\?order=ord_/);
  await expect(page.getByText(ev.title).first()).toBeVisible();
  expect((await registrations(playwright, ev.id)).find((r) => r.email === email).status).toBe('pending');

  await page.getByRole('button', { name: /^Pay \$35/ }).click();
  await expect(page).toHaveURL(/\/payment-complete\?/);
  await expect(page.getByText("You're registered!")).toBeVisible();
  await expect(page.getByText(/Your place at .* is confirmed/)).toBeVisible();
  const regs = await registrations(playwright, ev.id);
  expect(regs.find((r) => r.email === email)).toMatchObject({ status: 'confirmed', amount_cents: 3500 });
});

test('a member sees and pays the member price @phone', async ({ page, request }) => {
  const ev = await sampleEvent(request, 'Presentation: Gestalt in Organizations');
  // Guests see both prices
  await page.goto(`/event?id=${ev.id}`);
  await expect(page.getByText(/Members \$20/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Register and pay \$35/ })).toBeVisible();

  await joinMember(page, { tier: 'associate' });
  await page.goto(`/event?id=${ev.id}`);
  await expect(page.getByText('Your price (member)')).toBeVisible();
  await page.getByRole('button', { name: /Register and pay \$20/ }).click();
  await expect(page).toHaveURL(/\/checkout\?/);
  await expect(page.getByText(/member price/).first()).toBeVisible();
  await page.getByRole('button', { name: /^Pay \$20/ }).click();
  await expect(page.getByText("You're registered!")).toBeVisible();

  // The event page and My Payments now show the registration.
  await page.goto(`/event?id=${ev.id}`);
  await expect(page.getByText('You are registered for this event.')).toBeVisible();
  await page.goto('/members/payments');
  await expect(page.getByRole('link', { name: ev.title, exact: true })).toBeVisible();
});

test('a full event cannot be registered for, and says so', async ({ page, request, playwright }) => {
  const council = await newPerson(playwright);
  await signInAs(council, 'council');
  const ev = await createEvent(council, { title: `Tiny salon ${uid()}`, capacity: '1' });
  await council.dispose();

  const first = await call(request, 'POST', `/api/events/${ev.id}/register`, { name: 'First Person', email: `first.${uid()}@example.com` });
  expect(first.body.status).toBe('confirmed');
  const second = await call(request, 'POST', `/api/events/${ev.id}/register`, { name: 'Second Person', email: `second.${uid()}@example.com` });
  expect(second.status).toBe(409);
  expect(second.body.error).toMatch(/full/);

  await page.goto(`/event?id=${ev.id}`);
  await expect(page.getByText('This event is full').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Register/ })).toHaveCount(0);
});

test('the last paid place is held for the person who is paying', async ({ request, playwright }) => {
  const council = await newPerson(playwright);
  await signInAs(council, 'council');
  const ev = await createEvent(council, { capacity: '1', price_public: '10', price_member: '10' });
  await council.dispose();

  const a = await call(request, 'POST', `/api/events/${ev.id}/register`, { name: 'Payer A', email: `a.${uid()}@example.com` });
  expect(a.body.status).toBe('pending');
  // While A is paying, nobody else can take the place.
  const b = await call(request, 'POST', `/api/events/${ev.id}/register`, { name: 'Payer B', email: `b.${uid()}@example.com` });
  expect(b.status).toBe(409);
  const paid = await payDemo(request, orderFromUrl(a.body.checkout_url));
  expect(paid.status).toBe('paid');
  expect(paid.registration_status).toBe('confirmed');
});

test('past events are listed under "Past events" and cannot be registered for @phone', async ({ page, request }) => {
  const ev = await sampleEvent(request, '2026 National Gathering', 'past');
  expect(ev.registration_state).toBe('past');
  await page.goto('/events');
  await expect(page.getByRole('heading', { name: 'Past events' })).toBeVisible();
  await page.locator('#past-list').getByRole('link', { name: ev.title }).click();
  await expect(page.getByText('This event has already taken place')).toBeVisible();
  await expect(page.getByRole('button', { name: /Register/ })).toHaveCount(0);
  const r = await call(request, 'POST', `/api/events/${ev.id}/register`, { name: 'Late Person', email: 'late@example.com' });
  expect(r.status).toBe(400);
});

test('members-only events ask visitors to sign in, and members can register', async ({ page, request }) => {
  const ev = await sampleEvent(request, 'Members-only Salon');
  await page.goto(`/event?id=${ev.id}`);
  await expect(page.getByText('This event is for NAGP members. Please sign in to register.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Register/ })).toHaveCount(0);
  const guest = await call(request, 'POST', `/api/events/${ev.id}/register`, { name: 'Guest', email: `g.${uid()}@example.com` });
  expect(guest.status).toBe(403);

  await joinMember(page, { tier: 'student' });
  await page.goto(`/event?id=${ev.id}`);
  await page.getByRole('button', { name: /Register/ }).click();
  await expect(page.getByText("You're registered!")).toBeVisible();
});

test('unpublished events are hidden from visitors but the Council can preview them', async ({ request, playwright }) => {
  const council = await newPerson(playwright);
  await signInAs(council, 'council');
  const ev = await createEvent(council, { published: false });
  expect((await call(council, 'GET', `/api/events/${ev.id}`)).status).toBe(200);
  await council.dispose();
  expect((await call(request, 'GET', `/api/events/${ev.id}`)).status).toBe(404);
  expect((await call(request, 'POST', `/api/events/${ev.id}/register`, { name: 'x', email: 'x@example.com' })).status).toBe(404);
  const { events } = (await call(request, 'GET', '/api/events')).body;
  expect(events.some((e) => e.id === ev.id)).toBe(false);
});

test('an unfinished registration can be finished later, from the event page or My Payments', async ({ page, playwright }) => {
  const council = await newPerson(playwright);
  await signInAs(council, 'council');
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

test('someone who started registering as a visitor and then joined pays the member price', async ({ page, playwright }) => {
  const council = await newPerson(playwright);
  await signInAs(council, 'council');
  const ev = await createEvent(council, { price_member: '10', price_public: '40', capacity: '5' });
  await council.dispose();
  const email = `switch.${uid()}@example.com`;
  const asVisitor = await call(page, 'POST', `/api/events/${ev.id}/register`, { name: 'Switcher', email });
  expect(asVisitor.body.status).toBe('pending');

  await joinMember(page, { tier: 'associate', email });
  const asMember = await call(page, 'POST', `/api/events/${ev.id}/register`, { name: 'Switcher', email });
  expect(asMember.body.order_id).not.toBe(asVisitor.body.order_id);
  const order = orderFromUrl(asMember.body.checkout_url);
  expect((await call(page, 'GET', `/api/orders/${order.id}?token=${order.token}`)).body.order.amount_cents).toBe(1000);
  // The visitor's order was cancelled, so it can no longer be paid, and the place is not counted twice
  const old = orderFromUrl(asVisitor.body.checkout_url);
  expect((await call(page, 'POST', '/api/checkout/demo-complete', old)).status).toBe(409);
  await page.goto(`/checkout?order=${old.id}&token=${old.token}`);
  await expect(page.getByText('This payment was cancelled').first()).toBeVisible();
  expect((await call(page, 'GET', `/api/events/${ev.id}`)).body.event.spots_left).toBe(4);
});

test('closed and already-started events cannot be registered for', async ({ page, request, playwright }) => {
  const council = await newPerson(playwright);
  await signInAs(council, 'council');
  const closed = await createEvent(council, { registration_open: false });
  const day = (offset) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);
  const started = await createEvent(council, { start_date: day(-1), start_time: '09:00', end_date: day(2), end_time: '17:00' });
  await council.dispose();

  await page.goto(`/event?id=${closed.id}`);
  await expect(page.getByText('Registration is closed').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Register/ })).toHaveCount(0);
  expect((await call(request, 'POST', `/api/events/${closed.id}/register`, { name: 'x', email: 'x@example.com' })).status).toBe(400);

  await page.goto(`/event?id=${started.id}`);
  await expect(page.getByText('This event has already started').first()).toBeVisible();
  expect((await call(request, 'POST', `/api/events/${started.id}/register`, { name: 'x', email: 'x@example.com' })).status).toBe(400);
  // Still listed as upcoming until it ends
  expect((await call(request, 'GET', '/api/events')).body.events.some((e) => e.id === started.id)).toBe(true);
});

test('an event that is unpublished after someone started paying cannot be paid for', async ({ page, request, playwright }) => {
  const council = await newPerson(playwright);
  await signInAs(council, 'council');
  const ev = await createEvent(council, { price_public: '25', price_member: '25' });
  const reg = await call(request, 'POST', `/api/events/${ev.id}/register`, { name: 'Late Payer', email: `late.${uid()}@example.com` });
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
  expect((await call(request, 'POST', '/api/checkout/demo-complete', order)).status).toBe(409);
});
