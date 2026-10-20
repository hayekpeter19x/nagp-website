// Database helpers + automatic set-up on first run.
import { SCHEMA, SCHEMA_VERSION, MIGRATIONS } from './schema.js';
import { seedDemoData } from './seed.js';

let ready = null;

// Called by functions/api/_middleware.js before every API request.
// Creates the tables (and the sample preview data) the first time.
export function ensureDb(env) {
  if (!ready) ready = setUp(env).catch((err) => { ready = null; throw err; });
  return ready;
}

async function setUp(env) {
  const db = env.DB;
  let version = 0;
  try {
    const row = await db.prepare(`SELECT value FROM meta WHERE key = 'schema_version'`).first();
    version = row ? Number(row.value) : 0;
  } catch { version = 0; }
  if (version >= SCHEMA_VERSION) return;

  if (version === 0) {
    await db.batch(SCHEMA.map((sql) => db.prepare(sql)));
    // Only one request gets to seed, even if several arrive at once.
    const lock = await db.prepare(`INSERT OR IGNORE INTO meta (key, value) VALUES ('seeded', ?)`).bind(new Date().toISOString()).run();
    if (lock.meta.changes === 1 && env.SEED_SAMPLE_DATA !== 'false') await seedDemoData(env);
  }
  for (let v = Math.max(version, 1) + 1; v <= SCHEMA_VERSION; v++) {
    const steps = MIGRATIONS[v] || [];
    if (steps.length) await db.batch(steps.map((sql) => db.prepare(sql)));
  }
  await db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)`).bind(String(SCHEMA_VERSION)).run();
}

// Shorthands:  const rows = await all(env, 'SELECT * FROM events WHERE id = ?', id);
export async function all(env, sql, ...params) {
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return results || [];
}
export async function first(env, sql, ...params) {
  return env.DB.prepare(sql).bind(...params).first();
}
export async function run(env, sql, ...params) {
  return env.DB.prepare(sql).bind(...params).run();
}

export function randomId(prefix = '', bytes = 12) {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return prefix + btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
