(() => {
'use strict';
const C = window.ZWB_CONFIG || {};
const $ = (s, r = document) => r.querySelector(s);
const root = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const go = h => { location.hash = h; };
let sb, session = null, uid = null, profile = null, flow = {}, resetting = false, view = '', period = 'day', liveLoc = null, chan = null;

/* ---------- utilities ---------- */
function toast(m, bad) { const t = document.createElement('div'); t.className = 'toast' + (bad ? ' bad' : ''); t.textContent = m; t.setAttribute('role', bad ? 'alert' : 'status'); $('#toasts').append(t); setTimeout(() => t.remove(), 4800); }
async function busy(b, fn) { if (b.getAttribute('aria-busy') === 'true') return; b.setAttribute('aria-busy', 'true'); b.disabled = true; try { await fn(); } catch (e) { toast(e.message || 'Something went wrong. Please try again.', true); } finally { b.removeAttribute('aria-busy'); b.disabled = false; } }
const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const normPhone = (cc, v) => { let d = String(v).replace(/[^\d+]/g, ''); if (d.startsWith('+')) return d; return cc + d.replace(/^0+/, ''); };
const ident = v => { v = v.trim(); if (isEmail(v)) return { email: v.toLowerCase() }; const p = normPhone(C.DEFAULT_COUNTRY_CODE || '+91', v); if (!/^\+\d{8,15}$/.test(p)) throw new Error('Enter a valid email address or mobile number.'); return { phone: p }; };
const pwCheck = (p, c) => { if (p.length < 8 || !/\d/.test(p) || !/[A-Za-z]/.test(p)) throw new Error('Password needs at least 8 characters with letters and numbers.'); if (p !== c) throw new Error('Passwords do not match.'); };
const friendly = e => { const m = e.message || ''; if (/invalid login/i.test(m)) return new Error('Incorrect email/mobile or password.'); if (/not confirmed/i.test(m)) return new Error('Verify your account first. Use "Forgot password" to get a new code if needed.'); if (/expired|invalid/i.test(m) && /token|otp|code/i.test(m)) return new Error('That code is wrong or has expired. Request a new one.'); if (/already registered|already been registered/i.test(m)) return new Error('An account with these details already exists. Log in instead.'); if (/rate limit|too many|seconds/i.test(m)) return new Error('Too many attempts. Please wait a minute and try again.'); return e; };
const left = ms => { if (ms <= 0) return 'Expired'; const s = Math.floor(ms / 1e3), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h >= 24 ? Math.floor(h / 24) + 'd ' + h % 24 + 'h left' : h ? h + 'h ' + m + 'm left' : m + 'm ' + s % 60 + 's left'; };
const urg = ms => ms <= 0 ? 'gone' : ms < 36e5 ? 'hot' : ms < 108e5 ? 'soon' : 'fresh';
const timer = iso => { const ms = new Date(iso) - Date.now(); return `<span class="timer" data-end="${esc(iso)}" data-u="${urg(ms)}">${left(ms)}</span>`; };
setInterval(() => document.querySelectorAll('[data-end]').forEach(el => { const ms = new Date(el.dataset.end) - Date.now(); el.textContent = left(ms); el.dataset.u = urg(ms); }), 1000);
const km = (a, b, c, d) => { const r = x => x * Math.PI / 180, u = r(c - a), v = r(d - b); return 12742 * Math.asin(Math.sqrt(Math.sin(u / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(v / 2) ** 2)); };
const fmt = n => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 });
const fmtDate = (iso, p) => { const d = new Date(iso); return p === 'year' ? d.getFullYear() : p === 'month' ? d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' }) : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }); };
const ago = iso => { const m = Math.floor((Date.now() - new Date(iso)) / 6e4); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.floor(m / 60) + ' h ago' : new Date(iso).toLocaleDateString('en-IN'); };
const mapLink = d => d.lat != null ? `https://www.google.com/maps/search/?api=1&query=${d.lat},${d.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.address)}`;
const live = () => new Promise((ok, no) => navigator.geolocation ? navigator.geolocation.getCurrentPosition(p => ok(p.coords), e => no(new Error(e.code === 1 ? 'Location permission denied. Type the address instead.' : 'Could not get your location. Type the address instead.')), { enableHighAccuracy: true, timeout: 15000 }) : no(new Error('Location is not supported on this device.')));
const rev = async (a, o) => { try { const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${a}&lon=${o}`); return (await r.json()).display_name || ''; } catch { return ''; } };
const fwd = async q => { try { const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`); const j = await r.json(); return j[0] ? { lat: +j[0].lat, lng: +j[0].lon } : null; } catch { return null; } };
const myLoc = () => liveLoc || (profile && profile.lat != null ? { lat: profile.lat, lng: profile.lng } : null);

const LOGO = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#0F5C46"/><path d="M16 6c-5 0-8 4-8 9 0 4.6 3.3 8.400 8 11 4.700-2.600 8-6.400 8-11 0-5-3-9-8-9Z" fill="#fff"/><path d="M16 11v9M11.500 15.500h9" stroke="#0F5C46" stroke-width="2" stroke-linecap="round"/></svg>';
const THEME = '<button class="theme" data-a="theme" type="button" aria-label="Switch between day and night mode"><svg class="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.500A8.500 8.500 0 1 1 9.500 4a7 7 0 0 0 10.500 10.500Z"/></svg><svg class="i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="4.300"/><path d="M12 2.500v2.300M12 19.200v2.300M4.200 4.200l1.600 1.600M18.200 18.200l1.600 1.600M2.500 12h2.300M19.200 12h2.300M4.200 19.800l1.600-1.600M18.200 5.800l1.600-1.600"/></svg></button>';

/* ---------- legal text ---------- */
const policy = () => `<h2>1. Who we are</h2><p>ZeroWasteBite is a platform that helps food donors (restaurants, hostels, caterers, event venues and households) pass surplus food to nearby NGOs and volunteers. It is operated by Joydip Dey ("we", "us").</p>
<h2>2. What we collect</h2><ul><li><b>Account details:</b> your name, organisation name, role (donor or NGO), email address and/or mobile number, and an encrypted password.</li><li><b>Food listings:</b> food name, quantity, best-before time, pickup address and notes.</li><li><b>Location:</b> the address you type, and your precise coordinates only when you press "Use live location" and allow your browser to share them. We never track you in the background.</li><li><b>Activity:</b> accepted, completed and cancelled pickups, number of people served, and in-app notifications.</li></ul>
<h2>3. Why we use it</h2><ul><li>To create your account, verify you with a one-time code and keep you signed in.</li><li>To show listings to nearby NGOs, notify them and let one NGO accept a pickup.</li><li>To calculate your impact dashboard (meals, people fed, food saved, CO2e avoided).</li><li>To keep the platform safe and prevent misuse.</li></ul>
<h2>4. Who can see what</h2><ul><li>NGOs see the food name, quantity, best-before time, pickup address and donor name of available listings.</li><li>A donor's phone number is shown only to the NGO that accepted that pickup. The NGO's name and phone number are shown to the donor after acceptance.</li><li>Other users never see your email address. The public login page shows only anonymous platform totals.</li><li>We do not sell your data or show advertising.</li></ul>
<h2>5. Services we rely on</h2><p>Your data is stored and processed by Supabase (database, authentication and OTP delivery, including email and SMS providers). Address search and reverse lookup use OpenStreetMap Nominatim, and map links open Google Maps. Those services receive only what is needed to perform the request.</p>
<h2>6. Cookies and local storage</h2><p>We use browser storage only for your sign-in session and your day/night theme. We do not use advertising or tracking cookies.</p>
<h2>7. Retention and your rights</h2><p>We keep your data while your account exists. You can edit your details on the Profile page and permanently delete your account and listings at any time there. You may also email us to ask for a copy of your data or a correction.</p>
<h2>8. Security</h2><p>Data is encrypted in transit, passwords are hashed, and database access rules ensure you can only read the records that concern you. No system is perfectly secure, so please use a strong, unique password.</p>
<h2>9. Children</h2><p>ZeroWasteBite is for people aged 18 and over.</p>
<h2>10. Changes and contact</h2><p>If this policy changes in a meaningful way we will ask for your consent again. Questions: <a href="mailto:${esc(C.SUPPORT_EMAIL)}">${esc(C.SUPPORT_EMAIL)}</a>.</p>`;
const terms = () => `<h2>1. Purpose</h2><p>ZeroWasteBite only connects donors and NGOs. We do not prepare, inspect, store or transport food.</p>
<h2>2. Food safety</h2><p>Donors must list only food that is safe to eat, correctly described and within its best-before time. NGOs must check the food on collection and may refuse anything that looks unsafe.</p>
<h2>3. Your account</h2><p>Give accurate details, keep your password private and do not impersonate another person or organisation. NGO accounts must represent a genuine charitable or volunteer activity.</p>
<h2>4. Acceptable use</h2><p>Do not post false listings, spam, abuse other users, or attempt to break or overload the service. We may suspend accounts that do.</p>
<h2>5. Liability</h2><p>The service is provided "as is". To the extent allowed by law, we are not liable for the quality of donated food or for arrangements between donors and NGOs.</p>
<h2>6. Privacy</h2><p>Our <a href="#/privacy">Privacy Policy</a> explains how we handle your data.</p>`;
const legal = t => `<div class="legal"><a href="#/${session ? '' : 'login'}" class="btn ghost sm">Back</a><h1 style="margin-top:1rem">${t === 'privacy' ? 'Privacy Policy' : 'Terms of Use'}</h1><p class="hint">Last updated: 1 October 2026</p>${t === 'privacy' ? policy() : terms()}</div>`;

/* ---------- auth screens ---------- */
function auth(mode) {
  view = mode;
  const f = {
    login: `<h2>Welcome back</h2><p class="hint">Log in to list, find and track surplus food.</p>
<form data-f="login" novalidate><div class="field"><label for="id">Email or mobile number</label><input id="id" name="id" autocomplete="username" required></div>
<div class="field"><label for="pw">Password</label><input id="pw" name="password" type="password" autocomplete="current-password" required></div>
<p style="text-align:right"><button type="button" class="linkbtn" data-a="to" data-h="#/forgot">Forgot password?</button></p>
<button class="btn block">Log in</button></form><p class="switch">New here? <button class="linkbtn" data-a="to" data-h="#/signup">Create an account</button></p>`,
    signup: `<h2>Create your account</h2><p class="hint">Join as a donor or as an NGO. It takes a minute.</p>
<form data-f="signup" data-m="email" novalidate>
<fieldset class="roles"><legend>I am joining as</legend>
<label class="role"><input type="radio" name="role" value="donor" checked><span><b>Food donor</b><small>Restaurant, hostel, caterer, venue or home</small></span></label>
<label class="role"><input type="radio" name="role" value="ngo"><span><b>NGO or volunteer</b><small>Collect and distribute surplus food</small></span></label></fieldset>
<div class="row"><div class="field"><label for="n">Full name</label><input id="n" name="name" autocomplete="name" required maxlength="100"></div>
<div class="field"><label for="o">Organisation (optional)</label><input id="o" name="org" maxlength="120"></div></div>
<fieldset><legend>Sign up with</legend><div class="seg"><label><input type="radio" name="method" value="email" checked><span>Email</span></label><label><input type="radio" name="method" value="phone"><span>Mobile number</span></label></div></fieldset>
<div class="field only-email"><label for="e">Email address</label><input id="e" name="email" type="email" autocomplete="email"></div>
<div class="field only-email"><label for="po">Mobile number (optional)</label><input id="po" name="phone_opt" type="tel" autocomplete="tel"><p class="hint">Shown only to the donor or NGO you are matched with.</p></div>
<div class="field only-phone"><label for="p">Mobile number</label><div class="phone"><select name="cc" aria-label="Country code"><option value="+91">+91</option><option value="+880">+880</option><option value="+977">+977</option><option value="+94">+94</option><option value="+1">+1</option><option value="+44">+44</option><option value="+971">+971</option></select><input id="p" name="phone" type="tel" autocomplete="tel-national"></div></div>
<div class="row"><div class="field"><label for="pw1">Password</label><input id="pw1" name="password" type="password" autocomplete="new-password" minlength="8" required></div>
<div class="field"><label for="pw2">Confirm password</label><input id="pw2" name="confirm" type="password" autocomplete="new-password" required></div></div>
<label class="check field"><input type="checkbox" name="agree"><span>I agree to the <a href="#/terms" target="_blank">Terms of Use</a> and <a href="#/privacy" target="_blank">Privacy Policy</a>.</span></label>
<button class="btn block">Create account</button></form><p class="switch">Already registered? <button class="linkbtn" data-a="to" data-h="#/login">Log in</button></p>`,
    verify: `<h2>Enter your code</h2><p class="hint">We sent a verification code to <b>${esc(flow.email || flow.phone)}</b>.</p>
<form data-f="verify" novalidate><div class="field"><label for="c">Verification code</label><input id="c" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="10" required></div><button class="btn block">Verify and continue</button></form>
<p class="switch">No code? <button class="linkbtn" data-a="resend">Send again</button></p>`,
    forgot: `<h2>Reset your password</h2><p class="hint">Enter the email or mobile number on your account. We will send a one-time code.</p>
<form data-f="forgot" novalidate><div class="field"><label for="id">Email or mobile number</label><input id="id" name="id" autocomplete="username" required></div><button class="btn block">Send code</button></form>
<p class="switch"><button class="linkbtn" data-a="to" data-h="#/login">Back to log in</button></p>`,
    reset: `<h2>Set a new password</h2><p class="hint">Enter the code sent to <b>${esc(flow.email || flow.phone)}</b> and choose a new password.</p>
<form data-f="reset" novalidate><div class="field"><label for="c">One-time code</label><input id="c" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="10" required></div>
<div class="field"><label for="pw1">New password</label><input id="pw1" name="password" type="password" autocomplete="new-password" required></div>
<div class="field"><label for="pw2">Confirm new password</label><input id="pw2" name="confirm" type="password" autocomplete="new-password" required></div><button class="btn block">Update password</button></form>`
  }[mode];
  root.innerHTML = `<div class="auth"><aside class="brandpanel"><a class="brand" href="#/login">${LOGO}ZeroWasteBite</a>
<div><h1>Good food should feed people, not bins.</h1><p>List surplus food in seconds. The nearest NGO is alerted, accepts the pickup and distributes it before it spoils.</p></div>
<div class="demo" aria-hidden="true"><div class="ring"><svg viewBox="0 0 76 76" width="76" height="76"><circle class="bg" cx="38" cy="38" r="32"/><circle class="fg" cx="38" cy="38" r="32"/></svg><b>Live</b></div><div><h3>Vegetable biryani, 25 plates</h3><small>Best-before countdown starts when a donor lists food</small></div></div>
<div class="totals" id="totals"></div></aside>
<div class="authwrap"><div class="authtop">${THEME}</div><section class="authcard">${f}</section></div></div>`;
  if (mode === 'login' || mode === 'signup') sb.rpc('platform_totals').then(({ data }) => { const t = data && data[0]; if (t && $('#totals')) $('#totals').innerHTML = `<div><b>${fmt(t.meals)}</b>meals shared</div><div><b>${fmt(t.people)}</b>people fed</div><div><b>${fmt(t.kg)} kg</b>food saved</div>`; });
}

/* ---------- consent gate ---------- */
function consent() {
  view = 'consent';
  root.innerHTML = `<div class="consent"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem"><a class="brand" style="color:var(--ink)" href="#/">${LOGO}ZeroWasteBite</a>${THEME}</div>
<h1>Privacy Policy</h1><p class="hint">Please read and accept to use ZeroWasteBite. If you decline, the website will not open.</p><div class="scroll">${policy()}</div>
<div class="btns"><button class="btn" data-a="accept">I accept and continue</button><button class="btn ghost" data-a="decline">Decline</button></div></div>`;
}
function declined() { view = 'declined'; root.innerHTML = `<div class="center"><a class="brand" style="color:var(--ink);justify-content:center" href="#/login">${LOGO}ZeroWasteBite</a><h1 style="margin-top:1.5rem">Access blocked</h1><p>ZeroWasteBite cannot open without accepting the Privacy Policy, because your data is needed to match food donors and NGOs. You have been logged out.</p><a class="btn" href="#/login">Back to log in</a></div>`; }

/* ---------- app shell ---------- */
const NAV = { donor: [['dashboard', 'Impact'], ['list', 'List food'], ['mine', 'My listings'], ['alerts', 'Alerts']], ngo: [['feed', 'Available food'], ['pickups', 'My pickups'], ['dashboard', 'Impact'], ['alerts', 'Alerts']] };
function shell(active, inner) {
  view = active;
  const name = profile.org_name || profile.full_name || 'Me';
  root.innerHTML = `<header class="top"><div class="top-in"><a class="brand" href="#/">${LOGO}<span>ZeroWasteBite</span></a>
<nav class="nav" aria-label="Main">${NAV[profile.role].map(([h, l]) => `<a href="#/${h}" ${h === active ? 'aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
<div class="tools"><a class="iconbtn" href="#/alerts" aria-label="Alerts"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 1 1 12 0c0 6 2.500 7.500 2.500 7.500h-17S6 15 6 9Z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg><span class="dot" id="badge" hidden></span></a>${THEME}
<a class="iconbtn" href="#/profile" aria-label="Profile" title="${esc(name)}">${esc(name[0].toUpperCase())}</a></div></div></header><main>${inner}</main>`;
  badge();
}
async function badge() { const { count } = await sb.from('notifications').select('id', { count: 'exact', head: true }).eq('read', false); const b = $('#badge'); if (b) { b.hidden = !count; b.textContent = count > 9 ? '9+' : count; } }
const empty = (t, p, a) => `<div class="card empty"><h3>${t}</h3><p>${p}</p>${a || ''}</div>`;

/* ---------- donations ---------- */
function card(d, extra) {
  const ms = new Date(d.best_before) - Date.now(); const st = d.status === 'available' && ms <= 0 ? 'expired' : d.status;
  const dist = d._km != null ? ` &middot; ${d._km < 1 ? '<1' : d._km.toFixed(1)} km away` : '';
  return `<article class="card don"><header><span class="chip">${esc(d.category)}</span>${st === 'available' ? timer(d.best_before) : `<span class="st st-${st}">${st}</span>`}</header>
<h3>${esc(d.title)}</h3><p class="meta">${d.servings} servings${d.weight_kg ? ', ' + d.weight_kg + ' kg' : ''}${dist}</p>
<p class="meta">From ${esc(d.donor_name || 'Donor')}</p><p class="meta"><a href="${mapLink(d)}" target="_blank" rel="noopener">${esc(d.address)}</a></p>${d.notes ? `<p class="meta">${esc(d.notes)}</p>` : ''}${extra || ''}</article>`;
}
async function viewList() {
  const chips = [1, 2, 4, 6, 12].map(h => `<button type="button" data-a="hrs" data-h="${h}">${h} hour${h > 1 ? 's' : ''}</button>`).join('');
  const dt = new Date(Date.now() + 4 * 36e5 - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
  shell('list', `<div class="page-h"><div><h1>List surplus food</h1><p>Nearby NGOs are alerted the moment you post.</p></div></div>
<form class="card formcard" data-f="list" novalidate><div class="field"><label for="t">Food name</label><input id="t" name="title" maxlength="120" placeholder="e.g. Vegetable biryani" required></div>
<div class="row"><div class="field"><label for="c">Category</label><select id="c" name="category"><option value="cooked">Cooked meals</option><option value="packaged">Packaged food</option><option value="bakery">Bakery</option><option value="produce">Fruit and vegetables</option><option value="other">Other</option></select></div>
<div class="field"><label for="s">Servings (plates)</label><input id="s" name="servings" type="number" min="1" max="10000" required></div></div>
<div class="field"><label for="w">Weight in kg (optional)</label><input id="w" name="weight" type="number" min="0.1" step="0.1"><p class="hint">Leave blank and we estimate ${C.KG_PER_SERVING} kg per serving.</p></div>
<div class="field"><label for="b">Best before</label><input id="b" name="best" type="datetime-local" value="${dt}" required><div class="chips" role="group" aria-label="Quick best-before">${chips}</div></div>
<div class="field"><label for="a">Pickup address</label><textarea id="a" name="address" maxlength="300" placeholder="Building, street, area, city" required></textarea>
<div class="chips"><button type="button" data-a="here">Use live location</button></div><input type="hidden" name="lat"><input type="hidden" name="lng"><p class="hint" id="locnote">Type the exact address or use your live location.</p></div>
<div class="row"><div class="field"><label for="ph">Contact number</label><input id="ph" name="phone" type="tel" value="${esc(profile.phone || '')}" required><p class="hint">Shared only with the NGO that accepts.</p></div>
<div class="field"><label for="nt">Notes (optional)</label><input id="nt" name="notes" maxlength="500" placeholder="Veg only, bring containers"></div></div>
<button class="btn">Publish listing</button></form>`);
}
async function viewMine() {
  shell('mine', '<div class="page-h"><div><h1>My listings</h1><p>Track each donation from listing to distribution.</p></div><a class="btn" href="#/list">List food</a></div><div id="box"></div>');
  const { data, error } = await sb.from('donations').select('*').eq('donor_id', uid).order('created_at', { ascending: false }).limit(50);
  if (error) return toast(error.message, true);
  const ids = data.filter(d => d.status === 'accepted').map(d => d.id);
  $('#box').innerHTML = data.length ? `<div class="grid">${data.map(d => card(d,
    (d.status === 'accepted' ? `<p class="meta"><b>${esc(d.ngo_name)}</b> will collect${d.ngo_phone ? ': <a href="tel:' + esc(d.ngo_phone) + '">' + esc(d.ngo_phone) + '</a>' : ''}</p>` : '') +
    (d.status === 'completed' ? `<p class="meta">Reached <b>${d.people_served}</b> people, ${fmt(d.waste_kg)} kg saved</p>` : '') +
    (['available', 'accepted'].includes(d.status) ? `<div class="act"><button class="btn ghost sm" data-a="cancel" data-id="${d.id}">Cancel listing</button></div>` : ''))).join('')}</div>`
    : empty('No listings yet', 'Post your first surplus food in under a minute.', '<a class="btn" href="#/list">List food</a>');
}
async function viewFeed() {
  shell('feed', '<div class="page-h"><div><h1>Available food</h1><p id="sub">Nearest first.</p></div><button class="btn ghost" data-a="here-feed">Use live location</button></div><div id="box"></div>');
  const { data, error } = await sb.from('donations').select('*').eq('status', 'available').gt('best_before', new Date().toISOString()).order('best_before').limit(100);
  if (error) return toast(error.message, true);
  const L = myLoc();
  data.forEach(d => { d._km = L && d.lat != null ? km(L.lat, L.lng, d.lat, d.lng) : null; });
  if (L) data.sort((a, b) => (a._km ?? 1e9) - (b._km ?? 1e9)); else $('#sub').textContent = 'Soonest to expire first. Set your location to see the nearest donations.';
  $('#box').innerHTML = data.length ? `<div class="grid">${data.map(d => card(d, `<div class="act"><button class="btn sm" data-a="accept" data-id="${d.id}">Accept pickup</button></div>`)).join('')}</div>`
    : empty('No food available right now', 'You will get an alert the moment a donor posts surplus food near you.');
}
async function viewPickups() {
  shell('pickups', '<div class="page-h"><div><h1>My pickups</h1><p>Collect the food, then record how many people it reached.</p></div></div><div id="box"></div>');
  const { data, error } = await sb.from('donations').select('*').eq('accepted_by', uid).in('status', ['accepted', 'completed']).order('accepted_at', { ascending: false }).limit(50);
  if (error) return toast(error.message, true);
  const { data: cs } = await sb.from('donation_contacts').select('*').in('donation_id', data.map(d => d.id));
  const ph = Object.fromEntries((cs || []).map(c => [c.donation_id, c.phone]));
  $('#box').innerHTML = data.length ? `<div class="grid">${data.map(d => card(d, d.status === 'accepted'
    ? `<p class="meta">Donor contact: ${ph[d.id] ? `<a href="tel:${esc(ph[d.id])}">${esc(ph[d.id])}</a>` : 'not provided'}</p><div class="act"><input type="number" min="0" value="${d.servings}" aria-label="People served"><button class="btn sm" data-a="complete" data-id="${d.id}">Mark distributed</button></div>`
    : `<p class="meta">Reached <b>${d.people_served}</b> people</p>`)).join('')}</div>` : empty('No pickups yet', 'Accept a donation from the Available food page.', '<a class="btn" href="#/feed">See available food</a>');
}
async function viewAlerts() {
  shell('alerts', '<div class="page-h"><div><h1>Alerts</h1><p>Updates about your donations and pickups.</p></div></div><div class="card" id="box"></div>');
  const { data, error } = await sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
  if (error) return toast(error.message, true);
  $('#box').innerHTML = data.length ? data.map(n => `<div class="note ${n.read ? '' : 'un'}"><div><a href="#/${profile.role === 'ngo' ? 'feed' : 'mine'}" style="color:inherit;text-decoration:none">${esc(n.title)}</a><small>${esc(n.body)} &middot; ${ago(n.created_at)}</small></div></div>`).join('') : '<div class="empty"><h3>No alerts yet</h3></div>';
  if (data.some(n => !n.read)) { await sb.from('notifications').update({ read: true }).eq('read', false); badge(); }
}
async function viewDash() {
  shell('dashboard', `<div class="page-h"><div><h1>Your impact</h1><p>${profile.role === 'ngo' ? 'Food you collected and distributed.' : 'Food you saved from going to waste.'}</p></div>
<div class="tabs" role="group" aria-label="Period">${[['day', 'Daily'], ['month', 'Monthly'], ['year', 'Yearly']].map(([k, l]) => `<button data-a="period" data-p="${k}" aria-pressed="${k === period}">${l}</button>`).join('')}</div></div><div id="box"></div>`);
  const { data, error } = await sb.rpc('impact_series', { p_unit: period });
  if (error) return toast(error.message, true);
  const sum = k => data.reduce((a, r) => a + Number(r[k] || 0), 0), kg = sum('kg');
  const max = Math.max(1, ...data.map(r => Number(r.meals))), span = { day: 'last 30 days', month: 'last 12 months', year: 'last 5 years' }[period];
  $('#box').innerHTML = `<div class="stats"><div class="card stat"><b>${fmt(sum('meals'))}</b><span>Meals shared</span></div><div class="card stat"><b>${fmt(sum('people'))}</b><span>People fed free</span></div><div class="card stat"><b>${fmt(kg)} kg</b><span>Food saved from waste</span></div><div class="card stat"><b>${fmt(kg * C.CO2E_PER_KG)} kg</b><span>CO2e avoided (estimate)</span></div><div class="card stat"><b>${fmt(sum('pickups'))}</b><span>Pickups completed</span></div></div>
<div class="card" style="margin-bottom:1.2rem"><h3>Meals per ${period === 'day' ? 'day' : period}, ${span}</h3>${data.length ? `<div class="bars" role="img" aria-label="Bar chart of meals per ${period}">${data.map(r => `<div class="bar" title="${fmtDate(r.bucket, period)}: ${r.meals} meals"><i style="--h:${Math.round(r.meals / max * 100)}%"></i>${fmtDate(r.bucket, period)}</div>`).join('')}</div>` : '<p class="meta" style="margin-top:.6rem">Completed pickups will appear here automatically.</p>'}</div>
${data.length ? `<div class="card tblwrap" style="margin-bottom:1.2rem"><table><thead><tr><th>${period === 'day' ? 'Date' : period === 'month' ? 'Month' : 'Year'}</th><th class="n">Pickups</th><th class="n">Meals</th><th class="n">People</th><th class="n">Food saved (kg)</th><th class="n">CO2e (kg)</th></tr></thead><tbody>${[...data].reverse().map(r => `<tr><td>${fmtDate(r.bucket, period)}</td><td class="n">${r.pickups}</td><td class="n">${r.meals}</td><td class="n">${r.people}</td><td class="n">${fmt(r.kg)}</td><td class="n">${fmt(r.kg * C.CO2E_PER_KG)}</td></tr>`).join('')}</tbody></table></div>` : ''}
<div class="card how"><h3>How these numbers are calculated</h3><ol><li><b>Meals</b> = servings the donor listed.</li><li><b>Food saved</b> = the weight the donor entered, or ${C.KG_PER_SERVING} kg per serving if left blank.</li><li><b>People fed</b> = the number the NGO confirms when marking the food distributed.</li><li><b>CO2e avoided</b> = food saved &times; ${C.CO2E_PER_KG} kg CO2e per kg. This is an estimate, not a measurement.</li><li>Only <b>completed</b> pickups are counted. Dates use UTC.</li></ol></div>`;
}
async function viewProfile() {
  const p = profile;
  shell('profile', `<div class="page-h"><div><h1>Profile</h1><p>${p.role === 'ngo' ? 'NGO or volunteer account' : 'Donor account'}</p></div><button class="btn ghost" data-a="logout">Log out</button></div>
<form class="card formcard" data-f="profile" novalidate><div class="row"><div class="field"><label for="n">Full name</label><input id="n" name="name" value="${esc(p.full_name)}" maxlength="100"></div><div class="field"><label for="o">Organisation</label><input id="o" name="org" value="${esc(p.org_name)}" maxlength="120"></div></div>
<div class="row"><div class="field"><label for="ph">Mobile number</label><input id="ph" name="phone" type="tel" value="${esc(p.phone)}"></div><div class="field"><label>Email</label><input value="${esc(p.email)}" disabled></div></div>
<div class="field"><label for="a">${p.role === 'ngo' ? 'Base address' : 'Usual pickup address'}</label><textarea id="a" name="address" maxlength="300">${esc(p.address)}</textarea><div class="chips"><button type="button" data-a="here">Use live location</button></div>
<input type="hidden" name="lat" value="${p.lat ?? ''}"><input type="hidden" name="lng" value="${p.lng ?? ''}"><p class="hint" id="locnote">${p.lat != null ? 'Location saved.' : p.role === 'ngo' ? 'Set this so you are matched with the nearest donations.' : 'Optional.'}</p></div><button class="btn">Save changes</button></form>
<div class="card formcard" style="margin-top:1.2rem"><h3>Delete account</h3><p class="meta">Permanently removes your account, listings and alerts. Type DELETE to confirm.</p><form data-f="delete" novalidate style="display:flex;gap:.6rem;flex-wrap:wrap"><input name="confirm" style="max-width:180px" aria-label="Type DELETE"><button class="btn danger">Delete my account</button></form></div>`);
}

/* ---------- realtime ---------- */
function startRealtime() {
  if (chan) return;
  chan = sb.channel('zwb-' + uid)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + uid }, p => { toast(p.new.title + '. ' + (p.new.body || '')); badge(); if (['feed', 'pickups', 'mine', 'alerts'].includes(view)) route(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'donations' }, () => { if (['feed', 'pickups', 'mine'].includes(view)) route(); })
    .subscribe();
}
const stopRealtime = () => { if (chan) { sb.removeChannel(chan); chan = null; } };

/* ---------- router ---------- */
async function loadProfile() { const { data } = await sb.from('profiles').select('*').eq('id', uid).maybeSingle(); profile = data; }
async function route() {
  const r = (location.hash.replace(/^#\/?/, '') || '').split('?')[0];
  if (r === 'privacy' || r === 'terms') { view = r; root.innerHTML = legal(r); return; }
  if (!session) { if (r === 'declined') return declined(); if (['login', 'signup', 'forgot'].includes(r)) return auth(r); if (r === 'verify' && flow.kind) return auth('verify'); return go('#/login'); }
  if (!profile || profile.id !== uid) await loadProfile();
  if (!profile) { root.innerHTML = '<div class="center"><h1>Setting up your account</h1><p>Your profile is not ready yet. Refresh in a few seconds.</p><button class="btn" onclick="location.reload()">Refresh</button></div>'; return; }
  if (!profile.privacy_accepted_at) return r === 'declined' ? declined() : consent();
  startRealtime();
  const routes = { dashboard: viewDash, list: viewList, mine: viewMine, feed: viewFeed, pickups: viewPickups, alerts: viewAlerts, profile: viewProfile };
  const home = profile.role === 'ngo' ? 'feed' : 'list';
  if (!routes[r] || (r === 'list' && profile.role !== 'donor') || (['mine'].includes(r) && profile.role !== 'donor') || (['feed', 'pickups'].includes(r) && profile.role !== 'ngo')) return go('#/' + home);
  await routes[r]();
}

/* ---------- handlers ---------- */
const forms = {
  async login(f, b) { await busy(b, async () => { const { error } = await sb.auth.signInWithPassword({ ...ident(f.id.value), password: f.password.value }); if (error) throw friendly(error); }); },
  async signup(f, b) {
    await busy(b, async () => {
      if (!f.name.value.trim()) throw new Error('Enter your name.');
      pwCheck(f.password.value, f.confirm.value);
      if (!f.agree.checked) throw new Error('Please accept the Terms of Use and Privacy Policy.');
      const meta = { role: f.role.value, full_name: f.name.value.trim(), org_name: f.org.value.trim() }; let cred;
      if (f.method.value === 'email') { cred = { email: f.email.value.trim().toLowerCase() }; if (!isEmail(cred.email)) throw new Error('Enter a valid email address.'); if (f.phone_opt.value.trim()) meta.phone = normPhone(f.cc.value, f.phone_opt.value); }
      else { cred = { phone: normPhone(f.cc.value, f.phone.value) }; if (!/^\+\d{8,15}$/.test(cred.phone)) throw new Error('Enter a valid mobile number.'); }
      const { data, error } = await sb.auth.signUp({ ...cred, password: f.password.value, options: { data: meta } });
      if (error) throw friendly(error);
      if (!data.session) { flow = { kind: 'signup', ...cred }; auth('verify'); toast('Code sent. Check your ' + (cred.email ? 'email.' : 'messages.')); }
    });
  },
  async verify(f, b) { await busy(b, async () => { const t = f.code.value.trim(); const { error } = await sb.auth.verifyOtp(flow.email ? { email: flow.email, token: t, type: 'signup' } : { phone: flow.phone, token: t, type: 'sms' }); if (error) throw friendly(error); }); },
  async forgot(f, b) {
    await busy(b, async () => {
      const id = ident(f.id.value);
      const { error } = id.email ? await sb.auth.resetPasswordForEmail(id.email) : await sb.auth.signInWithOtp({ phone: id.phone, options: { shouldCreateUser: false } });
      if (error && !/signups not allowed|not found/i.test(error.message)) throw friendly(error);
      flow = { kind: 'reset', ...id }; auth('reset'); toast('If the account exists, a code is on its way.');
    });
  },
  async reset(f, b) {
    await busy(b, async () => {
      pwCheck(f.password.value, f.confirm.value); resetting = true;
      try {
        const t = f.code.value.trim();
        const { error } = await sb.auth.verifyOtp(flow.email ? { email: flow.email, token: t, type: 'recovery' } : { phone: flow.phone, token: t, type: 'sms' });
        if (error) throw friendly(error);
        const u = await sb.auth.updateUser({ password: f.password.value }); if (u.error) throw u.error;
        await sb.auth.signOut(); flow = {}; toast('Password updated. Log in with your new password.'); go('#/login');
      } finally { resetting = false; }
    });
  },
  async list(f, b) {
    await busy(b, async () => {
      const best = new Date(f.best.value); if (!(best > new Date())) throw new Error('Best-before time must be in the future.');
      const servings = parseInt(f.servings.value, 10); if (!(servings >= 1)) throw new Error('Enter the number of servings.');
      if (f.address.value.trim().length < 5) throw new Error('Enter the pickup address.');
      if (f.phone.value.trim().length < 8) throw new Error('Enter a contact number.');
      let lat = f.lat.value ? +f.lat.value : null, lng = f.lng.value ? +f.lng.value : null;
      if (lat == null) { const g = await fwd(f.address.value.trim()); if (g) { lat = g.lat; lng = g.lng; } }
      const { data, error } = await sb.from('donations').insert({ donor_id: uid, title: f.title.value.trim(), category: f.category.value, servings, weight_kg: f.weight.value ? +f.weight.value : null, notes: f.notes.value.trim() || null, address: f.address.value.trim(), lat, lng, best_before: best.toISOString() }).select('id').single();
      if (error) throw error;
      await sb.from('donation_contacts').insert({ donation_id: data.id, phone: normPhone(C.DEFAULT_COUNTRY_CODE || '+91', f.phone.value).slice(0, 20) });
      toast('Listing published. Nearby NGOs have been alerted.'); go('#/mine');
    });
  },
  async profile(f, b) {
    await busy(b, async () => {
      const upd = { full_name: f.name.value.trim(), org_name: f.org.value.trim(), phone: f.phone.value.trim() || null, address: f.address.value.trim() || null, lat: f.lat.value ? +f.lat.value : null, lng: f.lng.value ? +f.lng.value : null };
      if (!upd.lat && upd.address) { const g = await fwd(upd.address); if (g) { upd.lat = g.lat; upd.lng = g.lng; } }
      const { error } = await sb.from('profiles').update(upd).eq('id', uid); if (error) throw error;
      Object.assign(profile, upd); toast('Profile saved.'); route();
    });
  },
  async delete(f, b) { await busy(b, async () => { if (f.confirm.value !== 'DELETE') throw new Error('Type DELETE to confirm.'); const { error } = await sb.rpc('delete_my_account'); if (error) throw error; await sb.auth.signOut(); toast('Your account was deleted.'); }); }
};
const acts = {
  theme(el) { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; try { localStorage.setItem('zwb-theme', t); } catch { } document.querySelectorAll('.theme').forEach(x => { x.classList.add('spin'); setTimeout(() => x.classList.remove('spin'), 450); }); },
  to(el) { go(el.dataset.h); },
  hrs(el) { const d = new Date(Date.now() + el.dataset.h * 36e5 - new Date().getTimezoneOffset() * 6e4); $('[name=best]').value = d.toISOString().slice(0, 16); },
  here(el) { return busy(el, async () => { const c = await live(); const f = el.closest('form'); f.lat.value = c.latitude; f.lng.value = c.longitude; $('#locnote').textContent = 'Live location added.'; const a = await rev(c.latitude, c.longitude); if (a) f.address.value = a; }); },
  'here-feed'(el) { return busy(el, async () => { const c = await live(); liveLoc = { lat: c.latitude, lng: c.longitude }; route(); }); },
  complete(el) { return busy(el, async () => { const n = parseInt(el.closest('.act').querySelector('input').value, 10); if (!(n >= 0)) throw new Error('Enter how many people were served.'); const { error } = await sb.rpc('complete_donation', { p_id: el.dataset.id, p_people: n }); if (error) throw error; toast('Recorded. Your impact dashboard is updated.'); route(); }); },
  cancel(el) { if (!confirm('Cancel this listing?')) return; return busy(el, async () => { const { error } = await sb.rpc('cancel_donation', { p_id: el.dataset.id }); if (error) throw error; toast('Listing cancelled.'); route(); }); },
  period(el) { period = el.dataset.p; route(); },
  resend(el) { return busy(el, async () => { const { error } = await sb.auth.resend(flow.email ? { type: 'signup', email: flow.email } : { type: 'sms', phone: flow.phone }); if (error) throw friendly(error); toast('New code sent.'); }); },
  logout() { return sb.auth.signOut(); },
  async decline() { await sb.auth.signOut(); go('#/declined'); declined(); }
};
const consentActs = {
  accept(el) { return busy(el, async () => { const { error } = await sb.from('profiles').update({ privacy_accepted_at: new Date().toISOString() }).eq('id', uid); if (error) throw error; profile.privacy_accepted_at = new Date().toISOString(); go('#/'); route(); }); }
};
document.addEventListener('click', e => { const el = e.target.closest('[data-a]'); if (!el) return; const a = el.dataset.a; const fn = a === 'accept' ? (view === 'consent' ? consentActs.accept : acceptPickup) : acts[a]; if (fn) { e.preventDefault(); fn(el); } });
function acceptPickup(el) { return busy(el, async () => { const { error } = await sb.rpc('accept_donation', { p_id: el.dataset.id }); if (error) { route(); throw error; } toast('Pickup accepted. Donor contact is in My pickups.'); go('#/pickups'); }); }
document.addEventListener('submit', e => { const f = e.target.closest('form[data-f]'); if (!f) return; e.preventDefault(); const h = forms[f.dataset.f]; if (h) h(f, f.querySelector('button:not([type=button])')); });
document.addEventListener('change', e => { if (e.target.name === 'method') { const f = e.target.form; f.dataset.m = e.target.value; } });

/* ---------- boot ---------- */
async function boot() {
  $('#yr').textContent = new Date().getFullYear();
  $('#mail').href = 'mailto:' + (C.SUPPORT_EMAIL || '');
  if (!window.supabase || !C.SUPABASE_URL || /YOUR-PROJECT/.test(C.SUPABASE_URL)) { root.innerHTML = '<div class="center"><h1>Setup needed</h1><p>Add your Supabase URL and anon key in <code>js/config.js</code>, then reload. See README.md.</p></div>'; return; }
  sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  const { data } = await sb.auth.getSession(); session = data.session; uid = session ? session.user.id : null;
  sb.auth.onAuthStateChange((ev, s) => { const nu = s ? s.user.id : null; if (nu === uid) { session = s; return; } uid = nu; session = s; if (!nu) { profile = null; stopRealtime(); } if (!resetting) setTimeout(route, 0); });
  window.addEventListener('hashchange', route);
  route();
}
boot();
})();
