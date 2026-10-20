// Small helpers shared by the Council area pages (window.Council).
// Loaded before each Council page script.
(function () {
  'use strict';
  const { html } = NAGP;
  const C = (window.Council = {});

  /* ---------- Words ---------- */
  C.plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
  C.STATUS = {
    active: { label: 'Active', badge: 'badge-success' },
    pending: { label: 'Waiting for payment', badge: 'badge-warning' },
    expired: { label: 'Expired', badge: 'badge-warning' },
    lapsed: { label: 'Lapsed', badge: '' },
    suspended: { label: 'Suspended', badge: 'badge-danger' },
  };
  // Pass a member row to show "Expired" for an active member past their "active until" date.
  C.statusBadge = (status) => {
    if (status && typeof status === 'object') status = status.expired ? 'expired' : status.status;
    const s = C.STATUS[status] || { label: status, badge: '' };
    return html`<span class="badge ${s.badge}">${s.label}</span>`;
  };
  C.ROLE = { member: 'Member', council: 'Council', admin: 'Site admin' };
  C.VISIBILITY = { public: 'Everyone', members: 'Members only', council: 'Council only' };
  C.tierName = (key) => (NAGP.tier(key) ? NAGP.tier(key).name : key || '');
  C.tierShort = (key) => C.tierName(key).replace(/ Member$/, '').replace(' / Trainee', '');
  // "Tuesday, October 20, 2026"
  C.longDate = (iso) => (iso ? NAGP.formatDate(iso) : '');
  // "Tuesday, October 20, 2026 at 3:15 PM"
  C.dateTime = (iso) => (iso ? `${NAGP.formatDate(iso)} at ${NAGP.formatTime(iso, undefined, { zone: false })}` : '');
  C.dollars = (cents) => '$' + (Number(cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* ---------- Dialogs ---------- */
  // Opens a <dialog> with a question. Resolves to { ok: true, value } or { ok: false }.
  //   Council.ask({ title, message, confirm: 'Delete', cancel: 'Keep it', danger: true,
  //                 input: { label, hint, multiline, required, value } })
  // message may be plain text or NAGP.html. The Cancel button gets focus for dangerous actions.
  C.ask = (opts) => new Promise((resolve) => {
    const returnTo = document.activeElement;
    const dlg = document.createElement('dialog');
    dlg.className = 'council-dialog';
    dlg.setAttribute('aria-labelledby', 'ask-title');
    const input = opts.input;
    const msg = opts.message ? (typeof opts.message === 'string' ? html`<p>${opts.message}</p>` : opts.message) : '';
    dlg.innerHTML = html`<form class="dialog-body" novalidate>
      <h2 id="ask-title">${opts.title}</h2>
      ${msg}
      ${input ? html`<div class="field">
        <label for="ask-input">${input.label}${input.required ? '' : html` <span class="optional">(optional)</span>`}</label>
        ${input.hint ? html`<span class="hint" id="ask-hint">${input.hint}</span>` : ''}
        ${input.multiline
          ? html`<textarea id="ask-input" rows="4" aria-describedby="ask-hint">${input.value || ''}</textarea>`
          : html`<input id="ask-input" type="text" value="${input.value || ''}" aria-describedby="ask-hint">`}
      </div>` : ''}
      <div class="form-status" role="status" aria-live="polite"></div>
      <div class="form-actions">
        <button class="btn ${opts.danger ? 'btn-danger-solid' : ''}" type="submit">${opts.confirm || 'Yes'}</button>
        <button class="btn btn-secondary" type="button" data-cancel>${opts.cancel || 'Cancel'}</button>
      </div>
    </form>`;
    document.body.appendChild(dlg);
    const form = dlg.querySelector('form');
    let result = { ok: false };
    const finish = () => { dlg.close(); };
    dlg.addEventListener('close', () => {
      dlg.remove();
      if (returnTo && document.contains(returnTo)) returnTo.focus();
      resolve(result);
    });
    dlg.querySelector('[data-cancel]').addEventListener('click', finish);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const field = dlg.querySelector('#ask-input');
      const value = field ? field.value.trim() : '';
      if (input && input.required && !value) {
        dlg.querySelector('.form-status').innerHTML = NAGP.notice('error', `Please fill in "${input.label}".`);
        field.focus();
        return;
      }
      result = { ok: true, value };
      finish();
    });
    dlg.showModal();
    const focus = input ? dlg.querySelector('#ask-input') : opts.danger ? dlg.querySelector('[data-cancel]') : dlg.querySelector('[type="submit"]');
    focus.focus();
  });

  // Opens an existing <dialog> (a form written in the page), remembering where focus was.
  C.openDialog = (dlg, focusEl) => {
    const returnTo = document.activeElement;
    dlg.addEventListener('close', () => { if (returnTo && document.contains(returnTo)) returnTo.focus(); }, { once: true });
    dlg.showModal();
    (focusEl || dlg.querySelector('input:not([type="hidden"]), select, textarea, button')).focus();
  };
  // Every [data-close] button inside a dialog closes it.
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('dialog [data-close]');
    if (btn) btn.closest('dialog').close();
  });

  /* ---------- Messages ---------- */
  // Shows a message in a status box and brings it into view.
  C.say = (box, type, message, title) => {
    if (!box) return;
    box.innerHTML = NAGP.notice(type, message, title);
    box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  // Runs an action from a button: disables it while working and shows errors in the box.
  C.run = async (btn, box, work, busy = 'Working…') => {
    const original = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.textContent = busy; }
    try {
      return await work();
    } catch (err) {
      C.say(box, 'error', err.message);
      return undefined;
    } finally {
      if (btn && document.contains(btn)) { btn.disabled = false; btn.innerHTML = original; }
    }
  };

  /* ---------- Copy to clipboard ---------- */
  C.copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      ta.remove();
      return ok;
    }
  };

  /* ---------- Filter pills ---------- */
  // <ul class="filter-pills" data-pills> with buttons carrying data-value. Calls onChange(value).
  C.pills = (list, onChange) => {
    list.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-value]');
      if (!btn) return;
      list.querySelectorAll('button[data-value]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      onChange(btn.dataset.value);
    });
  };
  C.setPill = (list, value) => list.querySelectorAll('button[data-value]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === value)));

  // Fills a form's fields from an object (by name). Checkboxes take true/false.
  C.fill = (form, data) => {
    for (const el of form.elements) {
      if (!el.name || !(el.name in data)) continue;
      const v = data[el.name];
      if (el.type === 'checkbox') el.checked = !!v;
      else if (el.type === 'radio') el.checked = String(v) === el.value;
      else el.value = v === null || v === undefined ? '' : v;
    }
  };

  // Cents -> "150" or "37.50" for a dollars input.
  C.centsToInput = (cents) => {
    const n = Number(cents || 0);
    return n % 100 === 0 ? String(n / 100) : (n / 100).toFixed(2);
  };
})();
