// Unit check for the Stripe webhook signature verification in lib/payments.js.
// Run with:  node tests/stripe-signature.check.mjs
// (Named .check.mjs so Playwright does not try to run it as a browser test.)
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyStripeSignature, nextExpiry, sameText } from '../lib/payments.js';

const secret = 'whsec_test_known_secret_123';
const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: { id: 'cs_test_1', metadata: { order_id: 'ord_abc' } } } });
const t = 1767225600; // 2026-01-01T00:00:00Z
const now = t * 1000;
const sign = (body, ts = t, key = secret) => createHmac('sha256', key).update(`${ts}.${body}`).digest('hex');

// Known answer, computed independently with Node's crypto (not WebCrypto, which the code uses).
const good = sign(payload);
assert.equal(await verifyStripeSignature(payload, `t=${t},v1=${good}`, secret, { now }), true, 'valid signature accepted');
// Stripe may send several v1 signatures (while a secret is being rolled) and a v0 test one.
assert.equal(await verifyStripeSignature(payload, `t=${t},v1=${'0'.repeat(64)},v1=${good},v0=abc`, secret, { now }), true, 'any matching v1 accepted');
// Within the 5-minute tolerance.
assert.equal(await verifyStripeSignature(payload, `t=${t},v1=${good}`, secret, { now: now + 299_000 }), true, 'within tolerance');

// Rejections
assert.equal(await verifyStripeSignature(payload, `t=${t},v1=${good}`, secret, { now: now + 301_000 }), false, 'too old');
assert.equal(await verifyStripeSignature(payload, `t=${t},v1=${good}`, secret, { now: now - 301_000 }), false, 'from the future');
assert.equal(await verifyStripeSignature(payload + ' ', `t=${t},v1=${good}`, secret, { now }), false, 'body changed');
assert.equal(await verifyStripeSignature(payload, `t=${t},v1=${sign(payload, t, 'whsec_other')}`, secret, { now }), false, 'wrong secret');
assert.equal(await verifyStripeSignature(payload, `t=${t + 1},v1=${good}`, secret, { now }), false, 'timestamp changed');
assert.equal(await verifyStripeSignature(payload, `t=${t},v0=${good}`, secret, { now }), false, 'only v1 counts');
assert.equal(await verifyStripeSignature(payload, `v1=${good}`, secret, { now }), false, 'no timestamp');
assert.equal(await verifyStripeSignature(payload, '', secret, { now }), false, 'no header');
assert.equal(await verifyStripeSignature(payload, `t=${t},v1=${good}`, '', { now }), false, 'no secret');
assert.equal(await verifyStripeSignature(payload, 'garbage', secret, { now }), false, 'garbage header');

// Membership end dates: one year from the later of today and the current end date.
assert.equal(nextExpiry(null, '2026-10-20'), '2027-10-20', 'new member');
assert.equal(nextExpiry('2026-03-01', '2026-10-20'), '2027-10-20', 'lapsed member renews from today');
assert.equal(nextExpiry('2027-01-15', '2026-10-20'), '2028-01-15', 'early renewal adds to the current end date');
assert.equal(nextExpiry('2028-02-29', '2026-10-20'), '2029-02-28', 'leap day');
assert.equal(nextExpiry('not a date', '2026-10-20'), '2027-10-20', 'bad stored date');

assert.equal(sameText('abc', 'abc'), true);
assert.equal(sameText('abc', 'abd'), false);
assert.equal(sameText('abc', 'abcd'), false);

console.log('Stripe signature and membership date checks: all passed.');
