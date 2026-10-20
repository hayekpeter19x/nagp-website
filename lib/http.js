// Small helpers shared by every API route in functions/api.

export class HttpError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields || null;
  }
}

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status || 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(init.headers || {}),
    },
  });
}

export function errorResponse(err) {
  if (err instanceof HttpError) {
    return json({ error: err.message, fields: err.fields || undefined }, { status: err.status });
  }
  console.error(err);
  return json({ error: 'Something went wrong on our side. Please try again in a minute.' }, { status: 500 });
}

const MAX_BODY = 100_000;

export async function readJson(request) {
  const text = await request.text();
  if (text.length > MAX_BODY) throw new HttpError(413, 'That is too much text to send at once.');
  if (!text) return {};
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('not an object');
    return data;
  } catch {
    throw new HttpError(400, 'We could not read that request.');
  }
}

export const isCouncil = (user) => !!user && (user.role === 'council' || user.role === 'admin');
export const isActiveMember = (user) => !!user && (user.status === 'active' || isCouncil(user));

// Throws a friendly error unless the visitor has the needed access level.
// level: 'signed-in' | 'member' (active membership) | 'council'
export function requireUser(context, level = 'member') {
  const user = context.data.user;
  if (!user) throw new HttpError(401, 'Please sign in to continue.');
  if (level === 'council' && !isCouncil(user)) {
    throw new HttpError(403, 'This area is for Council members only.');
  }
  if (level === 'member' && !isActiveMember(user)) {
    throw new HttpError(403, 'This is for members with an active membership. If you have just joined, please complete your payment first.');
  }
  return user;
}

// Collects friendly field errors, then throws them all at once.
//   const check = validate(body);
//   const title = check.text('title', { label: 'Title', required: true, max: 120 });
//   check.done();
export function validate(body) {
  const fields = {};
  const fail = (name, msg) => { if (!fields[name]) fields[name] = msg; };
  return {
    fields,
    fail,
    text(name, { label = 'This field', required = false, max = 200, min = 0, multiline = false } = {}) {
      let v = body[name];
      if (v === undefined || v === null) v = '';
      if (typeof v !== 'string') v = String(v);
      v = multiline ? v.replace(/\r\n/g, '\n').trim() : v.replace(/\s+/g, ' ').trim();
      if (required && !v) fail(name, `Please enter ${label.toLowerCase()}.`);
      else if (v && v.length < min) fail(name, `${label} must be at least ${min} characters.`);
      else if (v.length > max) fail(name, `${label} can be at most ${max} characters (you have ${v.length}).`);
      return v;
    },
    email(name, { label = 'Email address', required = true } = {}) {
      const v = String(body[name] ?? '').trim().toLowerCase();
      if (!v) { if (required) fail(name, `Please enter your ${label.toLowerCase()}.`); return ''; }
      if (v.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) fail(name, 'Please check the email address. It should look like name@example.com.');
      return v;
    },
    url(name, { label = 'Web address', required = false } = {}) {
      let v = String(body[name] ?? '').trim();
      if (!v) { if (required) fail(name, `Please enter ${label.toLowerCase()}.`); return ''; }
      if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
      try { const u = new URL(v); if (!u.hostname.includes('.')) throw 0; } catch { fail(name, 'Please check the web address, for example www.example.com.'); }
      if (v.length > 300) fail(name, 'That web address is too long.');
      return v;
    },
    bool(name) {
      const v = body[name];
      return v === true || v === 'true' || v === 'on' || v === 1 || v === '1';
    },
    int(name, { label = 'This number', min = -Infinity, max = Infinity, required = false } = {}) {
      const raw = body[name];
      if (raw === undefined || raw === null || raw === '') { if (required) fail(name, `Please enter ${label.toLowerCase()}.`); return null; }
      const n = Number(raw);
      if (!Number.isInteger(n) || n < min || n > max) { fail(name, `${label} must be a whole number${Number.isFinite(min) ? ` from ${min}` : ''}${Number.isFinite(max) ? ` to ${max}` : ''}.`); return null; }
      return n;
    },
    oneOf(name, allowed, { label = 'an option', required = true } = {}) {
      const v = body[name];
      if ((v === undefined || v === null || v === '') && !required) return '';
      if (!allowed.includes(v)) { fail(name, `Please choose ${label.toLowerCase()}.`); return allowed[0]; }
      return v;
    },
    list(name, allowed) {
      let v = body[name];
      if (v === undefined || v === null || v === '') return [];
      if (!Array.isArray(v)) v = [v];
      return [...new Set(v.filter((x) => allowed.includes(x)))];
    },
    done(message = 'Please check the highlighted fields.') {
      if (Object.keys(fields).length) throw new HttpError(400, message, fields);
    },
  };
}

export const nowIso = () => new Date().toISOString();

export function clientIp(request) {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'local';
}
