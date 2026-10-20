/* NAGP website: shared browser code, loaded on every page.
   Page scripts use the helpers on window.NAGP:

     NAGP.ready                    Promise of the session: { user, demo, payments }
     NAGP.api('/api/events')       fetch JSON; throws an Error with a friendly .message (and .fields)
     el.innerHTML = NAGP.html`<p>${name}</p>`   safe HTML (values are escaped; use NAGP.raw() to opt out)
     NAGP.form(formEl, { onSubmit, success })   friendly form handling with field errors
     NAGP.formatDate / formatTime / eventWhen / money / paragraphs / initials / ...
*/
(function () {
  'use strict';
  const CONFIG = window.NAGP_CONFIG || {};
  const NAGP = (window.NAGP = { config: CONFIG });

  /* ---------- Safe HTML ---------- */
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  NAGP.esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
  class Raw { constructor(s) { this.s = String(s); } toString() { return this.s; } }
  NAGP.raw = (s) => new Raw(s);
  const fmt = (v) => (v instanceof Raw ? v.s : Array.isArray(v) ? v.map(fmt).join('')
    : v === null || v === undefined || v === false ? '' : NAGP.esc(v));
  NAGP.html = (strings, ...values) =>
    new Raw(strings.reduce((out, s, i) => out + s + (i < values.length ? fmt(values[i]) : ''), ''));

  // Plain text (as typed by a member) -> safe paragraphs with clickable links.
  NAGP.paragraphs = (text) => {
    const linkify = (s) => NAGP.esc(s).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)'"])/g,
      (u) => `<a href="${u}" rel="noopener nofollow" target="_blank">${u}</a>`);
    return NAGP.raw(String(text || '').trim().split(/\n\s*\n/).filter(Boolean)
      .map((p) => `<p>${p.split('\n').map(linkify).join('<br>')}</p>`).join(''));
  };

  /* ---------- Small helpers ---------- */
  NAGP.qs = (name) => new URLSearchParams(location.search).get(name);
  // A path on this website ("/members/?x=1"), or the fallback. Never another website, even for
  // tricks like "//evil.example", "/\evil.example" or "/<tab>/evil.example" that browsers treat as one.
  NAGP.localUrl = (url, fallback = '/') => {
    const s = String(url || '');
    try {
      const u = new URL(s, location.origin);
      if (s.startsWith('/') && u.origin === location.origin) return u.pathname + u.search + u.hash;
    } catch { /* not a valid address */ }
    return fallback;
  };
  NAGP.$ = (sel, root = document) => root.querySelector(sel);
  NAGP.$$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  NAGP.initials = (name) => String(name || '?').replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(Boolean)
    .map((w) => w[0]).filter((c) => /[A-Za-z]/.test(c)).slice(0, 2).join('').toUpperCase() || '?';
  NAGP.money = (cents, { free = 'Free' } = {}) => {
    const n = Number(cents || 0);
    if (!n) return free;
    return '$' + (n % 100 === 0 ? (n / 100).toLocaleString('en-US') : (n / 100).toLocaleString('en-US', { minimumFractionDigits: 2 }));
  };
  NAGP.specialtyLabel = (key) => (CONFIG.SPECIALTIES || []).find((s) => s.key === key)?.label || key;
  NAGP.regionName = (code) => (CONFIG.REGIONS || []).find((r) => r.code === code)?.name || code || '';
  NAGP.tier = (key) => (CONFIG.MEMBERSHIP_TIERS || []).find((t) => t.key === key) || null;
  NAGP.sampleBadge = (row) => (row && row.sample ? NAGP.html`<span class="badge badge-sample" title="Made-up example for the preview">Sample</span>` : '');
  NAGP.regionOptions = (selected = '', { placeholder = 'Choose a state or province' } = {}) => NAGP.raw(
    `<option value="">${NAGP.esc(placeholder)}</option>` +
    (CONFIG.REGIONS || []).map((r) => `<option value="${r.code}"${r.code === selected ? ' selected' : ''}>${NAGP.esc(r.name)}</option>`).join(''));

  /* ---------- Dates ---------- */
  const isDateOnly = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s));
  const toDate = (s) => new Date(isDateOnly(s) ? s + 'T12:00:00Z' : s);
  const dtf = (opts, tz) => new Intl.DateTimeFormat('en-US', { ...opts, timeZone: tz || undefined });
  NAGP.formatDate = (iso, tz, opts = {}) => (iso ? dtf({ weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', ...opts }, isDateOnly(iso) ? 'UTC' : tz).format(toDate(iso)) : '');
  NAGP.formatShortDate = (iso, tz) => NAGP.formatDate(iso, tz, { weekday: undefined, month: 'long' });
  NAGP.formatTime = (iso, tz, { zone = true } = {}) => (iso ? dtf({ hour: 'numeric', minute: '2-digit', timeZoneName: zone ? 'short' : undefined }, tz).format(toDate(iso)) : '');
  NAGP.dateParts = (iso, tz) => {
    const d = toDate(iso);
    return {
      month: dtf({ month: 'short' }, tz).format(d).toUpperCase(),
      day: dtf({ day: 'numeric' }, tz).format(d),
      weekday: dtf({ weekday: 'short' }, tz).format(d),
      year: dtf({ year: 'numeric' }, tz).format(d),
    };
  };
  // "Thursday, November 12, 2026, 7:00 – 8:30 PM EST" or a multi-day range.
  NAGP.eventWhen = (ev) => {
    const tz = ev.timezone;
    const start = NAGP.formatDate(ev.starts_at, tz);
    if (!ev.ends_at) return `${start}, ${NAGP.formatTime(ev.starts_at, tz)}`;
    const end = NAGP.formatDate(ev.ends_at, tz);
    if (start === end) return `${start}, ${NAGP.formatTime(ev.starts_at, tz, { zone: false })} to ${NAGP.formatTime(ev.ends_at, tz)}`;
    return `${start}, ${NAGP.formatTime(ev.starts_at, tz)} to ${end}, ${NAGP.formatTime(ev.ends_at, tz)}`;
  };
  NAGP.timeAgo = (iso) => {
    const days = Math.floor((Date.now() - toDate(iso)) / 864e5);
    if (days < 1) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 14) return `${days} days ago`;
    return NAGP.formatShortDate(iso);
  };

  /* ---------- Talking to the server ---------- */
  NAGP.api = async function (path, { method = 'GET', body, query } = {}) {
    let url = path;
    if (query) {
      const p = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') p.set(k, v);
      const s = p.toString();
      if (s) url += (url.includes('?') ? '&' : '?') + s;
    }
    let res;
    try {
      res = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: body !== undefined ? { 'content-type': 'application/json' } : {},
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      const err = new Error('We could not reach the website. Please check your internet connection and try again.');
      err.status = 0;
      throw err;
    }
    let data = null;
    try { data = await res.json(); } catch { /* not JSON */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Something went wrong (error ${res.status}). Please try again.`);
      err.status = res.status;
      err.fields = (data && data.fields) || null;
      throw err;
    }
    return data;
  };

  /* ---------- Messages ---------- */
  NAGP.notice = (type, message, title) => NAGP.html`<div class="notice notice-${type}" role="${type === 'error' ? 'alert' : 'status'}">${title ? NAGP.html`<span class="notice-title">${title}</span>` : ''}${message instanceof Raw ? message : NAGP.html`<p>${message}</p>`}</div>`;
  NAGP.loading = (el, text = 'Loading…') => { el.innerHTML = NAGP.html`<p class="loading">${text}</p>`; };
  NAGP.showError = (el, err) => {
    const signIn = err && err.status === 401
      ? NAGP.html`<p><a class="btn" href="/signin?next=${encodeURIComponent(location.pathname + location.search)}">Sign in</a></p>` : '';
    el.innerHTML = NAGP.html`<div class="notice notice-error" role="alert"><p>${(err && err.message) || 'Something went wrong.'}</p>${signIn}</div>`;
  };

  /* ---------- Forms ---------- */
  // Reads a form into a plain object. Checkbox groups (same name) become arrays;
  // a single checkbox becomes true/false.
  NAGP.formData = (form) => {
    const out = {};
    const els = [...form.elements].filter((el) => el.name && !el.disabled && el.type !== 'submit' && el.type !== 'button');
    const counts = {};
    els.forEach((el) => { if (el.type === 'checkbox') counts[el.name] = (counts[el.name] || 0) + 1; });
    for (const el of els) {
      if (el.type === 'checkbox') {
        if (counts[el.name] > 1) { out[el.name] = out[el.name] || []; if (el.checked) out[el.name].push(el.value); }
        else out[el.name] = el.checked;
      } else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; else if (!(el.name in out)) out[el.name] = ''; }
      else if (el.multiple) out[el.name] = [...el.selectedOptions].map((o) => o.value);
      else out[el.name] = el.value;
    }
    return out;
  };

  const labelFor = (el) => {
    const label = el.id && document.querySelector(`label[for="${el.id}"]`);
    const text = (label ? label.textContent : el.closest('fieldset')?.querySelector('legend')?.textContent || el.name) || '';
    return text.replace(/\(optional\)/i, '').trim();
  };

  NAGP.clearErrors = (form) => {
    form.querySelectorAll('.field-error').forEach((n) => n.remove());
    form.querySelectorAll('[aria-invalid]').forEach((n) => {
      n.removeAttribute('aria-invalid');
      const ids = (n.getAttribute('aria-describedby') || '').split(' ').filter((id) => id && !id.startsWith('err-'));
      if (ids.length) n.setAttribute('aria-describedby', ids.join(' ')); else n.removeAttribute('aria-describedby');
    });
    const status = form.querySelector('.form-status');
    if (status) status.innerHTML = '';
  };

  NAGP.showFieldErrors = (form, fields, message = 'Please check the highlighted fields below.') => {
    let firstEl = null;
    for (const [name, msg] of Object.entries(fields || {})) {
      const els = [...form.querySelectorAll(`[name="${CSS.escape(name)}"]`)];
      if (!els.length) continue;
      const id = 'err-' + (form.id || 'f') + '-' + name;
      els.forEach((el) => {
        el.setAttribute('aria-invalid', 'true');
        el.setAttribute('aria-describedby', ((el.getAttribute('aria-describedby') || '') + ' ' + id).trim());
      });
      const span = document.createElement('span');
      span.className = 'field-error';
      span.id = id;
      span.textContent = msg;
      const anchor = els[0].closest('.field, fieldset, .check') || els[els.length - 1];
      if (anchor === els[els.length - 1]) anchor.insertAdjacentElement('afterend', span); else anchor.appendChild(span);
      firstEl = firstEl || els[0];
    }
    const status = form.querySelector('.form-status');
    if (status) status.innerHTML = NAGP.notice('error', message);
    if (firstEl) firstEl.focus();
  };

  // NAGP.form(form, {
  //   onSubmit: async (data, form) => NAGP.api('/api/x', { method: 'POST', body: data }),
  //   success: 'Thank you!'  or  (result) => 'message' | NAGP.html`...`,
  //   reset: true,           clear the form afterwards
  //   busyText: 'Sending…',
  // })
  NAGP.form = (form, { onSubmit, success, reset = true, busyText = 'Sending…' } = {}) => {
    form.setAttribute('novalidate', '');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      NAGP.clearErrors(form);
      const missing = {};
      form.querySelectorAll('[required]').forEach((el) => {
        if (el.disabled) return;
        const empty = el.type === 'checkbox' ? !el.checked : el.type === 'radio'
          ? !form.querySelector(`[name="${CSS.escape(el.name)}"]:checked`) : !String(el.value).trim();
        if (empty && !missing[el.name]) missing[el.name] = el.type === 'checkbox' ? 'Please tick this box to continue.' : `Please fill in "${labelFor(el)}".`;
      });
      if (Object.keys(missing).length) { NAGP.showFieldErrors(form, missing); return; }

      const btn = form.querySelector('[type="submit"]');
      const original = btn ? btn.innerHTML : '';
      if (btn) { btn.disabled = true; btn.textContent = busyText; }
      const status = form.querySelector('.form-status');
      try {
        const result = await onSubmit(NAGP.formData(form), form);
        if (success && status) {
          const msg = typeof success === 'function' ? success(result) : success;
          if (msg) status.innerHTML = msg instanceof Raw && msg.s.includes('class="notice') ? msg : NAGP.notice('success', msg);
          status.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
        if (reset) form.reset();
      } catch (err) {
        if (err.fields) NAGP.showFieldErrors(form, err.fields, err.message);
        else if (status) { status.innerHTML = NAGP.notice('error', err.message); status.scrollIntoView({ block: 'nearest' }); }
        else alert(err.message);
      } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = original; }
      }
    });
  };

  /* ---------- Session + header ---------- */
  NAGP.ready = NAGP.api('/api/session')
    .catch((err) => ({ user: null, demo: false, payments: 'demo', error: err }))
    .then((session) => {
      NAGP.session = session;
      NAGP.user = session.user;
      applySession(session);
      return session;
    });

  function applySession(session) {
    const u = session.user;
    const show = {
      'signed-out': !u,
      'signed-in': !!u,
      council: !!(u && u.isCouncil),
      member: !!(u && u.isMember),
      'not-member': !(u && u.isMember),
    };
    NAGP.$$('[data-auth]').forEach((el) => { el.hidden = !show[el.dataset.auth]; });
    // No "Join NAGP" button in the header while someone is already joining or paying.
    if (/^\/(join|checkout|payment-complete)/.test(location.pathname)) {
      NAGP.$$('.header-actions a[href="/join"], .site-header a[href="/join"][data-auth]').forEach((el) => { el.hidden = true; });
    }
    NAGP.$$('[data-user-name]').forEach((el) => { el.textContent = u ? u.name : ''; });
    gate(session);
  }

  function gate(session) {
    const need = document.body.dataset.access;
    if (!need || need === 'public') return;
    const u = session.user;
    const box = document.getElementById('access-gate');
    const next = encodeURIComponent(location.pathname + location.search);
    let html = null;
    if (session.error && session.error.status !== 401) {
      html = NAGP.html`<div class="card access-gate"><h1>We could not load this page</h1>${NAGP.notice('error', session.error.message)}<p><a class="btn" href="${location.pathname}">Try again</a></p></div>`;
    } else if (!u) {
      const who = need === 'council' ? 'the NAGP Council' : 'NAGP members';
      html = NAGP.html`<div class="card access-gate"><h1>Please sign in</h1>
        <p class="lede">This page is for ${who}. Please sign in with your email address and password to continue.</p>
        <div class="actions"><a class="btn btn-large" href="/signin?next=${next}">Sign in</a>
        ${need === 'member' ? NAGP.html`<a class="btn btn-secondary btn-large" href="/join">Become a member</a>` : ''}</div></div>`;
    } else if (need === 'council' && !u.isCouncil) {
      html = NAGP.html`<div class="card access-gate"><h1>Council members only</h1>
        <p class="lede">This area is only for members of the NAGP Council. You are signed in as ${u.name}.</p>
        <div class="actions"><a class="btn" href="/members/">Go to the Members' Area</a></div></div>`;
    } else if (need === 'member' && !u.isMember && !location.pathname.startsWith('/members/payments')) {
      const ended = u.status === 'lapsed' || (u.status === 'active' && u.membership_expires);
      html = ended
        ? NAGP.html`<div class="card access-gate"><h1>Your membership has ended</h1>
        <p class="lede">Welcome back, ${u.name}. Your membership ended${u.membership_expires ? NAGP.html` on ${NAGP.formatShortDate(u.membership_expires)}` : ''}. Renew it to use the Members' Area again.</p>
        <div class="actions"><a class="btn btn-accent btn-large" href="/members/payments">Renew my membership</a><a class="btn btn-secondary btn-large" href="/contact">Ask for help</a></div></div>`
        : NAGP.html`<div class="card access-gate"><h1>Your membership is not active yet</h1>
        <p class="lede">Welcome, ${u.name}. Once your membership payment is complete you will be able to use this page.</p>
        <div class="actions"><a class="btn btn-accent btn-large" href="/members/payments">Finish joining</a><a class="btn btn-secondary btn-large" href="/contact">Ask for help</a></div></div>`;
    }
    if (html) { box.innerHTML = html; document.title = 'Please sign in | NAGP'; }
    else { box.innerHTML = ''; document.body.classList.add('access-ok'); }
  }

  // Page scripts that need a signed-in member call:  NAGP.whenAllowed().then((session) => { ... })
  NAGP.whenAllowed = () => NAGP.ready.then((s) => new Promise((resolve) => {
    if (document.body.classList.contains('access-ok') || document.body.dataset.access === 'public') resolve(s);
  }));

  NAGP.signOut = async () => {
    try { await NAGP.api('/api/auth/signout', { method: 'POST' }); } catch { /* ignore */ }
    try { sessionStorage.clear(); } catch { /* ignore */ }
    location.href = '/';
  };

  /* ---------- Page chrome ---------- */
  function setTextSize(size) {
    if (size) document.documentElement.dataset.textSize = size; else delete document.documentElement.dataset.textSize;
    try { if (size) localStorage.setItem('nagp-text-size', size); else localStorage.removeItem('nagp-text-size'); } catch { /* ignore */ }
    NAGP.$$('.text-size button').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.textSize || '') === (size || ''))));
  }

  function feedbackDialog() {
    let dlg = document.getElementById('feedback-dialog');
    if (dlg) return dlg;
    let savedName = '';
    try { savedName = localStorage.getItem('nagp-feedback-name') || ''; } catch { /* ignore */ }
    dlg = document.createElement('dialog');
    dlg.id = 'feedback-dialog';
    dlg.setAttribute('aria-labelledby', 'feedback-title');
    dlg.innerHTML = NAGP.html`<div class="dialog-body">
      <h2 id="feedback-title">Comment on this page</h2>
      <p>Tell us what you would like changed on this page: wording, layout, anything at all. Your comment goes to the website team.</p>
      <form id="feedback-form" class="form">
        <div class="field"><label for="fb-name">Your name <span class="optional">(optional)</span></label>
          <input id="fb-name" name="name" type="text" autocomplete="name" value="${savedName}"></div>
        <div class="field"><label for="fb-comment">Your comment</label>
          <textarea id="fb-comment" name="comment" required></textarea></div>
        <input type="hidden" name="page" value="${location.pathname + location.search}">
        <div class="hp-field" aria-hidden="true"><label>Leave this empty <input name="hp" tabindex="-1" autocomplete="off"></label></div>
        <div class="form-actions"><button class="btn" type="submit">Send comment</button>
          <button class="btn btn-secondary" type="button" data-close>Close</button></div>
        <div class="form-status" role="status" aria-live="polite"></div>
      </form></div>`;
    document.body.appendChild(dlg);
    dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
    const form = dlg.querySelector('form');
    NAGP.form(form, {
      onSubmit: (data) => {
        try { localStorage.setItem('nagp-feedback-name', data.name || ''); } catch { /* ignore */ }
        return NAGP.api('/api/feedback', { method: 'POST', body: data });
      },
      success: 'Thank you! Your comment was saved. You can send another one or close this box.',
      reset: false,
    });
    dlg.addEventListener('close', () => { form.comment.value = ''; NAGP.clearErrors(form); });
    return dlg;
  }

  function init() {
    // Text size buttons
    let current = '';
    try { current = localStorage.getItem('nagp-text-size') || ''; } catch { /* ignore */ }
    setTextSize(current);
    NAGP.$$('.text-size button').forEach((b) => b.addEventListener('click', () => setTextSize(b.dataset.textSize)));

    // Mobile menu
    const toggle = NAGP.$('.menu-toggle');
    const nav = NAGP.$('#site-nav');
    const setMenu = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('open', open);
    };
    if (toggle && nav) {
      toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
      // Escape closes the open menu and puts focus back on the Menu button.
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setMenu(false); toggle.focus(); }
      });
    }

    NAGP.$$('[data-signout]').forEach((b) => b.addEventListener('click', NAGP.signOut));

    // "Stay connected" mailing-list forms anywhere on the page
    NAGP.$$('form[data-subscribe-form]').forEach((form) => NAGP.form(form, {
      onSubmit: (data) => NAGP.api('/api/subscribe', { method: 'POST', body: { ...data, interest: form.dataset.interest || '' } }),
      success: "Thank you! You're on the list. We'll be in touch with news from NAGP.",
    }));

    // Preview-only feedback button
    if (CONFIG.ORG && CONFIG.ORG.preview) {
      const fab = document.createElement('button');
      fab.type = 'button';
      fab.className = 'feedback-fab';
      fab.setAttribute('data-feedback-open', '');
      fab.setAttribute('aria-label', 'Comment on this page');
      // A small dark pill, so it never competes with the page's own buttons (styles.css, .feedback-fab).
      fab.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 4h16v11H9l-5 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg><span>Comment<span class="feedback-fab-more"> on this page</span></span>';
      document.body.appendChild(fab);
      NAGP.$$('[data-feedback-open]').forEach((b) => b.addEventListener('click', () => {
        const dlg = feedbackDialog();
        dlg.showModal();
        dlg.querySelector('textarea').focus();
      }));
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
