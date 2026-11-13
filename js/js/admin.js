/* Hidden admin panel. Press and hold an empty area of any page for 2 seconds to open the login.
   The admin ID, key and password are NOT in this file: they are checked inside Supabase (see supabase/admin_setup.sql). */
(() => {
'use strict';
const API = () => window.ZWB_API;
const $ = (s, r = document) => r.querySelector(s);
const esc = s => API().esc(s);
let tok = null, tab = 'overview', root = null, prefill = null;
const flt = { reports: 'open', users: '', table: 'profiles', q: '' };
const TABLES = ['profiles', 'donations', 'orders', 'reports', 'ratings', 'notifications'];
const COLS = { profiles: ['full_name', 'org_name', 'role', 'email', 'banned'], donations: ['title', 'status', 'kind', 'donor_name'], orders: ['status', 'qty', 'total', 'buyer_name'], reports: ['status', 'reason', 'reporter_name'], ratings: ['stars', 'rater_name', 'supplier_id'], notifications: ['title', 'kind', 'read', 'user_id'] };
const TEMPLATES = [
  ['Greeting', 'greeting', 'Warm greetings from ZeroWasteBite', 'Hello {name}, thank you for being part of ZeroWasteBite. Together we are saving good food and feeding people in need. Have a wonderful day!'],
  ['Thank you', 'thanks', 'Thank you for your support', 'Dear {name}, thank you for helping us rescue food and reduce waste. Every meal you save makes a real difference.'],
  ['Festival', 'greeting', 'Happy festive season!', 'Dear {name}, wishing you and your family joy and good food this festive season. Please share your surplus and spread the happiness.'],
  ['Safety reminder', 'info', 'Food safety reminder', 'Hello {name}, please check the best-before time and keep food safe and clean before pickup. Fresh, safe food keeps everyone happy.']
];

/* ---------- hidden trigger: hold an empty area for 2 seconds ---------- */
let hold = null, px = 0, py = 0, fired = 0;
const BAD = 'a,button,input,select,textarea,label,form,table,svg,img,.card,.modal-bg,#adminroot,.toast,.cookiebar,nav,footer,header,fieldset,h1,h2,h3,p,li,small,b,span,ol,ul,code';
const isEmpty = t => t instanceof Element && !t.closest(BAD) && [...t.childNodes].every(n => n.nodeType !== 3 || !n.textContent.trim());
const stop = () => { if (hold) { clearTimeout(hold); hold = null; } };
document.addEventListener('pointerdown', e => {
  if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0) || tok || $('.modal-bg') || !isEmpty(e.target)) return;
  px = e.clientX; py = e.clientY; stop();
  hold = setTimeout(() => { hold = null; fired = Date.now(); openLogin(); }, 2000);
});
['pointerup', 'pointercancel', 'scroll', 'dragstart'].forEach(ev => document.addEventListener(ev, stop, true));
document.addEventListener('pointermove', e => { if (hold && Math.hypot(e.clientX - px, e.clientY - py) > 12) stop(); });
document.addEventListener('contextmenu', e => { if (hold || Date.now() - fired < 1500) e.preventDefault(); });
document.addEventListener('selectstart', e => { if (hold) e.preventDefault(); });

/* ---------- login ---------- */
function openLogin() {
  API().modal(`<h2>Admin access</h2><form data-adm="login" autocomplete="off" novalidate style="margin-top:1rem"><div class="field"><label for="ai">Admin ID</label><input id="ai" name="aid" autocomplete="off" autocapitalize="off" spellcheck="false"></div>
<div class="field"><label for="ak">Admin key</label><input id="ak" name="akey" type="password" autocomplete="off"></div>
<div class="field"><label for="ap">Password</label><input id="ap" name="apass" type="password" autocomplete="new-password"></div>
<div class="btns"><button class="btn">Log in</button><button type="button" class="btn ghost" data-a="closemodal">Cancel</button></div></form>`);
}
const rpc = async (fn, args) => {
  const { data, error } = await API().sb.rpc(fn, { p_token: tok, ...(args || {}) });
  if (error) { if (/session expired/i.test(error.message)) lock(true); throw error; }
  return data;
};
function lock(expired) {
  if (tok) API().sb.rpc('admin_logout', { p_token: tok }).then(() => { }, () => { });
  tok = null; if (root) root.remove(); root = null; document.body.style.overflow = '';
  if (expired) API().toast('Admin session ended. Please log in again.', true);
}
function mount() {
  root = document.createElement('div'); root.id = 'adminroot'; document.body.append(root); document.body.style.overflow = 'hidden'; show('overview');
}

/* ---------- layout ---------- */
const TABS = [['overview', 'Overview'], ['reports', 'Reports'], ['users', 'Users'], ['data', 'All data'], ['notify', 'Send message']];
async function show(k) {
  tab = k;
  root.innerHTML = `<div class="adm-top"><a class="brand" href="#/" data-x="noop">${API().LOGO}<span>Admin panel</span></a><nav class="adm-tabs" aria-label="Admin sections">${TABS.map(([id, l]) => `<button type="button" data-x="tab" data-k="${id}" aria-pressed="${id === k}">${l}</button>`).join('')}</nav><button type="button" class="adm-out" data-x="out">Log out</button></div><div class="adm-body" id="admb"></div>`;
  try { await VIEWS[k]($('#admb')); } catch (e) { if (tok) API().toast(e.message || 'Something went wrong.', true); }
}
const chip = (t, c) => `<span class="chip ${c || ''}">${esc(t)}</span>`;
const nm = u => u.org_name || u.full_name || u.email || String(u.id).slice(0, 8);
const empty = t => `<div class="card empty"><h3>${t}</h3></div>`;

const VIEWS = {
  async overview(o) {
    const s = await rpc('admin_overview');
    const items = [['Users', s.users], ['Suppliers', s.suppliers], ['NGOs', s.ngos], ['Buyers', s.buyers], ['Banned accounts', s.banned], ['Live listings', s.live], ['All listings', s.listings], ['Orders', s.orders], ['Open reports', s.open_reports], ['Ratings', s.ratings]];
    o.innerHTML = `<div class="page-h"><div><h1>Overview</h1><p>Everything happening on ZeroWasteBite.</p></div></div><div class="stats">${items.map(([l, v]) => `<div class="card stat"><b>${v}</b><span>${l}</span></div>`).join('')}</div>`;
  },
  async reports(o) {
    const rows = await rpc('admin_reports', { p_status: flt.reports });
    o.innerHTML = `<div class="page-h"><div><h1>Food reports</h1><p>Check the photo and reason, then confirm or dismiss each report.</p></div><select data-x="rfilter" aria-label="Filter reports" style="max-width:200px">${['open', 'upheld', 'dismissed', 'all'].map(v => `<option value="${v}" ${v === flt.reports ? 'selected' : ''}>${v[0].toUpperCase() + v.slice(1)}</option>`).join('')}</select></div>
${rows.length ? `<div class="grid">${rows.map(r => `<article class="card don" data-id="${esc(r.id)}"><header>${chip(r.food)}<span class="st st-${{ open: 'available', upheld: 'completed', dismissed: 'cancelled' }[r.status]}">${esc(r.status)}</span></header>
<p class="meta"><b>Reported by</b> ${esc(r.reporter_name)} (${esc(r.reporter_role)}), earlier fake reports: ${r.reporter_fakes}</p>
<p class="meta"><b>Supplier</b> ${esc(r.supplier_name)}, warnings so far: ${r.supplier_warnings}</p>
<p style="margin-top:.5rem">${esc(r.reason)}</p><p class="meta">${esc(API().ago(r.created_at))}</p>
<div class="act"><button type="button" class="btn ghost sm" data-x="photo">View photo</button><button type="button" class="btn ghost sm" data-x="msg" data-u="${esc(r.supplier_id)}">Message supplier</button><button type="button" class="btn ghost sm" data-x="msg" data-u="${esc(r.reporter_id)}">Message reporter</button></div><div class="ph"></div>
${r.status === 'open' ? `<input class="adm-note" placeholder="Note for the user (optional)" maxlength="200" aria-label="Note for the user"><div class="act"><button type="button" class="btn danger sm" data-x="uphold">Food was spoiled</button><button type="button" class="btn sm" data-x="dismiss">Report is fake</button></div>` : (r.admin_note ? `<p class="meta">Admin note: ${esc(r.admin_note)}</p>` : '')}</article>`).join('')}</div>` : empty('No reports here')}`;
  },
  async users(o) {
    const rows = await rpc('admin_users', { p_q: flt.users });
    o.innerHTML = `<div class="page-h"><div><h1>Users</h1><p>Warn, ban, message, edit or delete any account.</p></div></div>
<form data-adm="usearch" class="adm-search"><input name="q" value="${esc(flt.users)}" placeholder="Search name, email, phone or ID" aria-label="Search users"><button class="btn">Search</button></form>
${rows.length ? `<div class="grid">${rows.map(u => `<article class="card don" data-id="${esc(u.id)}"><header>${chip(u.role)}${u.banned ? '<span class="st st-cancelled">banned</span>' : ''}</header><h3>${esc(nm(u))}</h3>
<p class="meta">${esc(u.email || '')} ${esc(u.phone || '')}</p><p class="meta">Warnings: ${u.warnings} &middot; Fake reports: ${u.fake_reports}${u.rating_count ? ` &middot; ★ ${Number(u.rating_avg).toFixed(1)} (${u.rating_count})` : ''}</p>
<div class="act"><button type="button" class="btn ghost sm" data-x="msg" data-u="${esc(u.id)}">Message</button><button type="button" class="btn ghost sm" data-x="warn">Warn</button>${u.banned ? '<button type="button" class="btn ghost sm" data-x="unban">Unban</button>' : '<button type="button" class="btn danger sm" data-x="ban">Ban forever</button>'}<button type="button" class="btn ghost sm" data-x="uedit">Edit</button><button type="button" class="btn ghost sm" data-x="udel">Delete</button></div></article>`).join('')}</div>` : empty('No users found')}`;
  },
  async data(o) {
    const rows = await rpc('admin_list', { p_table: flt.table, p_q: flt.q, p_limit: 100 }), cols = COLS[flt.table];
    o.innerHTML = `<div class="page-h"><div><h1>All data</h1><p>Open any row to change any field, or delete it.</p></div></div>
<form data-adm="dsearch" class="adm-search"><select name="t" aria-label="Table">${TABLES.map(t => `<option ${t === flt.table ? 'selected' : ''}>${t}</option>`).join('')}</select><input name="q" value="${esc(flt.q)}" placeholder="Search this table" aria-label="Search"><button class="btn">Show</button></form>
${rows.length ? `<div class="card tblwrap"><table><thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}<th></th></tr></thead><tbody>${rows.map(r => `<tr>${cols.map(c => `<td>${esc(String(r[c] ?? '').slice(0, 60))}</td>`).join('')}<td><button type="button" class="btn ghost sm" data-x="redit" data-t="${flt.table}" data-id="${esc(r.id)}">Edit</button></td></tr>`).join('')}</tbody></table></div>` : empty('Nothing found')}`;
  },
  async notify(o) {
    const p = prefill; prefill = null;
    o.innerHTML = `<div class="page-h"><div><h1>Send a message</h1><p>It appears in the user's Alerts. Greetings, thank-yous and warnings also pop up on their screen. Use {name} to insert their name.</p></div></div>
<form class="card formcard" data-adm="notify" novalidate><div class="row"><div class="field"><label for="ns">Send to</label><select id="ns" name="scope"><option value="all">Everyone</option><option value="supplier">All suppliers</option><option value="ngo">All NGOs</option><option value="buyer">All buyers</option><option value="user" ${p ? 'selected' : ''}>One person</option></select></div>
<div class="field" id="nu" ${p ? '' : 'hidden'}><label for="nv">User ID, email or phone</label><input id="nv" name="value" value="${p ? esc(p) : ''}" autocomplete="off"></div></div>
<div class="field"><label for="nk">Type</label><select id="nk" name="kind"><option value="info">Notice</option><option value="greeting">Greeting (popup)</option><option value="thanks">Thank you (popup)</option><option value="warning">Warning (popup)</option></select></div>
<div class="chips" aria-label="Templates">${TEMPLATES.map((t, i) => `<button type="button" data-x="tpl" data-i="${i}">${t[0]}</button>`).join('')}</div>
<div class="field" style="margin-top:1rem"><label for="nt">Title</label><input id="nt" name="title" maxlength="120"></div>
<div class="field"><label for="nb">Message</label><textarea id="nb" name="body" maxlength="600"></textarea></div><button class="btn">Send message</button></form>`;
  }
};

/* ---------- row editor ---------- */
async function editRow(table, id) {
  const rows = await rpc('admin_list', { p_table: table, p_q: id, p_limit: 5 }), r = rows.find(x => x.id === id);
  if (!r) throw new Error('Row not found.');
  const val = v => v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  API().modal(`<h2>Edit ${esc(table.replace(/s$/, ''))}</h2><form data-adm="redit" data-t="${esc(table)}" data-id="${esc(id)}" autocomplete="off" novalidate style="margin-top:1rem">${Object.keys(r).map(k => {
    const ro = ['id', 'created_at'].includes(k), v = val(r[k]);
    return `<div class="field"><label>${esc(k)}</label>${v.length > 90 ? `<textarea name="${esc(k)}" data-o="${esc(v)}" ${ro ? 'readonly' : ''}>${esc(v)}</textarea>` : `<input name="${esc(k)}" value="${esc(v)}" data-o="${esc(v)}" ${ro ? 'readonly' : ''}>`}</div>`;
  }).join('')}<p class="hint">Leave a field empty to clear it. Only the fields you change are saved.</p><div class="btns"><button class="btn">Save changes</button><button type="button" class="btn danger" data-x="rdel" data-t="${esc(table)}" data-id="${esc(id)}">Delete</button><button type="button" class="btn ghost" data-a="closemodal">Cancel</button></div></form>`, 'wide');
}

/* ---------- events ---------- */
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-adm]'); if (!f) return; e.preventDefault();
  const b = f.querySelector('button:not([type=button])'), t = f.dataset.adm;
  if (t === 'login') return API().busy(b, async () => {
    const { data, error } = await API().sb.rpc('admin_login', { p_id: f.aid.value, p_key: f.akey.value, p_password: f.apass.value });
    if (error) throw new Error('Admin login is not available right now.');
    if (data === 'locked') throw new Error('Too many failed attempts. Try again in 15 minutes.');
    if (!data) throw new Error('Invalid admin credentials.');
    tok = data; f.akey.value = f.apass.value = ''; API().closeModal(); mount();
  });
  if (t === 'usearch') { flt.users = f.q.value.trim(); return show('users'); }
  if (t === 'dsearch') { flt.table = f.t.value; flt.q = f.q.value.trim(); return show('data'); }
  if (t === 'notify') return API().busy(b, async () => {
    const sc = f.scope.value, who = sc === 'all' ? ['all', ''] : sc === 'user' ? ['user', f.value.value.trim()] : ['role', sc];
    if (sc === 'user' && !who[1]) throw new Error('Enter the user ID, email or phone.');
    if (!f.title.value.trim()) throw new Error('Write a title.');
    if (sc !== 'user' && !confirm('Send this message to ' + (sc === 'all' ? 'every user' : 'all ' + sc + 's') + '?')) return;
    const n = await rpc('admin_notify', { p_scope: who[0], p_value: who[1], p_kind: f.kind.value, p_title: f.title.value, p_body: f.body.value });
    API().toast('Sent to ' + n + ' user' + (n === 1 ? '' : 's') + '.'); f.title.value = f.body.value = '';
  });
  if (t === 'redit') return API().busy(b, async () => {
    const ch = {}; [...f.elements].forEach(el => { if (el.name && !el.readOnly && el.value !== el.dataset.o) ch[el.name] = el.value === '' ? null : el.value; });
    if (!Object.keys(ch).length) { API().closeModal(); return; }
    await rpc('admin_update', { p_table: f.dataset.t, p_id: f.dataset.id, p_changes: ch });
    API().closeModal(); API().toast('Saved.'); show(tab);
  });
});
document.addEventListener('change', e => {
  if (!root) { return; }
  if (e.target.matches('[data-x=rfilter]')) { flt.reports = e.target.value; show('reports'); }
  if (e.target.name === 'scope') { const u = $('#nu'); if (u) u.hidden = e.target.value !== 'user'; }
});
document.addEventListener('click', e => {
  const el = e.target.closest('[data-x]'); if (!el || !tok) return;
  const x = el.dataset.x, card = el.closest('[data-id]'), id = card && card.dataset.id;
  if (x === 'noop') { e.preventDefault(); return; }
  if (x === 'tab') return show(el.dataset.k);
  if (x === 'out') return lock();
  const run = fn => API().busy(el, fn);
  if (x === 'msg') { prefill = el.dataset.u; return show('notify'); }
  if (x === 'tpl') { const t = TEMPLATES[+el.dataset.i], f = el.closest('form'); f.kind.value = t[1]; f.title.value = t[2]; f.body.value = t[3]; return; }
  if (x === 'photo') return run(async () => { const p = await rpc('admin_report_photo', { p_id: id }); card.querySelector('.ph').innerHTML = p ? `<img class="adm-photo" src="${esc(p)}" alt="Photo of the reported food">` : '<p class="meta">No photo.</p>'; });
  if (x === 'uphold' || x === 'dismiss') {
    const spoiled = x === 'uphold';
    if (!confirm(spoiled ? 'Confirm the food was spoiled? The supplier gets a warning (or is removed if this is their second).' : 'Mark this report as fake? The reporter gets a warning (or is removed if this is their second).')) return;
    return run(async () => { await rpc('admin_resolve_report', { p_id: id, p_verdict: spoiled ? 'upheld' : 'dismissed', p_note: card.querySelector('.adm-note').value }); API().toast('Report closed and everyone was notified.'); show('reports'); });
  }
  if (x === 'warn' || x === 'ban' || x === 'unban' || x === 'udel') {
    const q = { warn: 'Send a warning to this user?', ban: 'Ban this account forever? It will never be able to log in again.', unban: 'Unban this account and reset its warnings?', udel: 'Permanently delete this account and all its data?' }[x];
    if (!confirm(q)) return;
    return run(async () => { await rpc('admin_user_action', { p_id: id, p_action: x === 'udel' ? 'delete' : x }); API().toast('Done.'); show('users'); });
  }
  if (x === 'uedit') return run(() => editRow('profiles', id));
  if (x === 'redit') return run(() => editRow(el.dataset.t, el.dataset.id));
  if (x === 'rdel') {
    if (!confirm('Delete this row permanently?')) return;
    return run(async () => { await rpc('admin_delete', { p_table: el.dataset.t, p_id: el.dataset.id }); API().closeModal(); API().toast('Deleted.'); show(tab); });
  }
});
})();
