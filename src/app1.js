'use strict';
/* =====================================================================
   Present: UI, part 1 (state, helpers, header, dashboard, attendance, calendar)
   ===================================================================== */
const LS_KEY = 'present.v1';
const TABS = [
  ['dashboard', 'Dashboard'], ['attendance', 'Attendance'], ['calendar', 'Calendar'],
  ['marks', 'Marks'], ['targets', 'Targets'], ['timetable', 'Timetable'], ['export', 'Export']
];
let storageOK = true;
function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) { const s = sanitizeState(JSON.parse(raw)); if (s) return s; }
  } catch (e) { storageOK = false; }
  return defaultState();
}
let S = load();
let TODAY = keyOf(new Date());
const UI = { tab: 'dashboard', attGroup: null, openDay: null, scrollTo: null };
let saveTimer = null;
function saveNow() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(S)); storageOK = true; } catch (e) { storageOK = false; }
  syncHeader();
}
function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 250); }

const $ = function (s, r) { return (r || document).querySelector(s); };
const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

/* ---------- icons ---------- */
const ICONS = {
  check: '<path d="M4 8.5l2.8 2.8L12 5.5"/>',
  alert: '<path d="M8 2.2l6 10.6H2z"/><path d="M8 6.5v3"/><path d="M8 11.4v.1"/>',
  minus: '<path d="M4 8h8"/>',
  chev: '<path d="M4.5 6.2L8 9.7l3.5-3.5"/>',
  up: '<path d="M8 12V4.5M4.7 7.6L8 4.3l3.3 3.3"/>',
  down: '<path d="M8 4v7.5M4.7 8.4L8 11.7l3.3-3.3"/>',
  left: '<path d="M12 8H4.5M7.6 4.7L4.3 8l3.3 3.3"/>',
  right: '<path d="M4 8h7.5M8.4 4.7L11.7 8l-3.3 3.3"/>',
  trash: '<path d="M3.5 4.5h9M6.5 4.5V3h3v1.5M5 4.5l.5 8h5l.5-8"/>',
  plus: '<path d="M8 3.5v9M3.5 8h9"/>',
  sun: '<circle cx="8" cy="8" r="2.8"/><path d="M8 1.8v1.4M8 12.8v1.4M1.8 8h1.4M12.8 8h1.4M3.6 3.6l1 1M11.4 11.4l1 1M12.4 3.6l-1 1M4.6 11.4l-1 1"/>',
  moon: '<path d="M12.8 9.6A5.2 5.2 0 016.4 3.2a5.2 5.2 0 106.4 6.4z"/>',
  down2: '<path d="M8 2.5v7.6M4.8 7.2L8 10.4l3.2-3.2M3 13h10"/>',
  copy: '<rect x="5.5" y="5.5" width="7" height="8" rx="1.3"/><path d="M10.5 5.5V4a1.3 1.3 0 00-1.3-1.3H4.8A1.3 1.3 0 003.5 4v6.2a1.3 1.3 0 001.3 1.3h.7"/>',
  undo: '<path d="M5.2 4.2L2.8 6.6l2.4 2.4M3 6.6h6a3.6 3.6 0 010 7.2H6"/>',
  info: '<circle cx="8" cy="8" r="5.8"/><path d="M8 7.2v3.6M8 5.1v.1"/>',
  up2: '<path d="M8 13.5V5.9M4.8 8.8L8 5.6l3.2 3.2M3 3h10"/>',
  cal: '<rect x="2.5" y="3.5" width="11" height="10" rx="1.6"/><path d="M2.5 6.7h11M5.5 2v2.8M10.5 2v2.8"/>',
  swap: '<path d="M3 5.5h9.5M10 3l2.5 2.5L10 8M13 10.5H3.5M6 8l-2.5 2.5L6 13"/>'
};
function ic(n, cls) {
  return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[n] || '') + '</svg>';
}

/* ---------- small UI helpers ---------- */
function badge(st, t) {
  const m = { ok: ['check', 'On track'], edge: ['alert', 'Little room'], below: ['alert', 'Below ' + t + '%'], none: ['minus', 'No classes yet'] }[st];
  return '<span class="badge ' + st + '">' + ic(m[0]) + m[1] + '</span>';
}
function opt(v, label, sel) { return '<option value="' + esc(v) + '"' + (sel ? ' selected' : '') + '>' + esc(label) + '</option>'; }
function subjOptions(selId, blankLabel) {
  let h = blankLabel !== undefined ? opt('', blankLabel, !selId) : '';
  S.subjects.forEach(function (s) { h += opt(s.id, s.short, s.id === selId); });
  return h;
}
function dot(s) { return '<i class="sdot" style="--c:var(--sc' + ((s.color || 0) % 8) + ')"></i>'; }
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 3200);
}
let modalRes = null;
function confirmBox(o) {
  return new Promise(function (res) {
    const m = $('#modal'); modalRes = res;
    m.innerHTML = '<div class="scrim" data-act="modal-cancel"></div><div class="dlg" role="dialog" aria-modal="true" aria-labelledby="dlg-t"><h3 id="dlg-t">' + esc(o.title) + '</h3><p>' + o.body + '</p><div class="dlg-btns"><button class="btn" data-act="modal-cancel" id="dlg-cancel">Cancel</button><button class="btn ' + (o.danger ? 'danger' : 'primary') + '" data-act="modal-ok">' + esc(o.ok || 'Confirm') + '</button></div></div>';
    m.hidden = false; $('#dlg-cancel').focus();
  });
}
function closeModal(v) { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; if (modalRes) { const r = modalRes; modalRes = null; r(v); } }

/* ---------- theme ---------- */
function effectiveTheme() {
  const a = document.documentElement.getAttribute('data-theme');
  if (a === 'dark' || a === 'light') return a;
  return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/* ---------- header ---------- */
function syncHeader() {
  const bs = $('#batch-sel');
  if (bs) {
    const want = S.settings.batches.map(function (b) { return opt(b, b, b === S.settings.batch); }).join('');
    if (bs.innerHTML !== want) bs.innerHTML = want;
    bs.value = S.settings.batch;
  }
  const th = $('#thr');
  if (th && document.activeElement !== th) th.value = S.settings.threshold;
  const dark = effectiveTheme() === 'dark';
  const tb = $('#theme-btn');
  if (tb) { tb.innerHTML = ic(dark ? 'sun' : 'moon'); tb.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme'); tb.title = dark ? 'Light theme' : 'Dark theme'; }
  const chip = $('#save-chip');
  if (chip) { chip.textContent = storageOK ? 'Saved on this device' : 'Not saved: export a backup'; chip.className = 'save-chip' + (storageOK ? '' : ' warn'); }
  $$('.tabs button').forEach(function (b) { const on = b.dataset.tab === UI.tab; b.setAttribute('aria-current', on ? 'page' : 'false'); b.classList.toggle('on', on); });
}

/* ---------- dashboard ---------- */
function focusDay() { return clampKey(TODAY); }
function asOfControl() {
  const a = S.settings.asOf, mode = (a === 'today' || !a) ? 'today' : (a === 'end' ? 'end' : 'custom');
  let h = '<div class="asof"><label for="asof-sel">Count classes until</label><div class="asof-row"><select id="asof-sel" class="in" data-act="asof" data-fid="asof-sel">' +
    opt('today', 'Today, ' + fmtDate(clampKey(TODAY)), mode === 'today') + opt('end', 'End of semester, ' + fmtDate(RANGE_END), mode === 'end') + opt('custom', 'A date I choose', mode === 'custom') + '</select>';
  if (mode === 'custom') h += '<input type="date" class="in" id="asof-date" data-act="asof-date" data-fid="asof-date" min="' + RANGE_START + '" max="' + RANGE_END + '" value="' + esc(a) + '" aria-label="Count classes until this date">';
  return h + '</div></div>';
}
function ringSVG(pctV, status, t) {
  const R = 56, C = 2 * Math.PI * R, f = Math.min(1, (pctV || 0) / 100);
  const ang = (t / 100) * 2 * Math.PI - Math.PI / 2;
  const x1 = 70 + (R - 11) * Math.cos(ang), y1 = 70 + (R - 11) * Math.sin(ang), x2 = 70 + (R + 11) * Math.cos(ang), y2 = 70 + (R + 11) * Math.sin(ang);
  return '<svg viewBox="0 0 140 140" class="ring-svg st-' + status + '" role="img" aria-label="Overall attendance ' + fp(pctV) + ' percent, minimum ' + t + ' percent">' +
    '<circle cx="70" cy="70" r="' + R + '" class="ring-track"/>' +
    '<circle cx="70" cy="70" r="' + R + '" class="ring-fill" stroke-dasharray="' + (f * C).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 70 70)"/>' +
    '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" class="ring-tick"/></svg>';
}
function meter(p, t, st) {
  const w = Math.max(0, Math.min(100, p || 0));
  return '<div class="meter st-' + st + '" role="img" aria-label="' + fp(p) + ' percent, minimum ' + t + ' percent"><div class="meter-fill" style="width:' + w + '%"></div><div class="meter-tick" style="left:' + t + '%"><span>' + t + '%</span></div></div>';
}
function viewDashboard() {
  const A = analyze(S, TODAY), o = A.overall, t = A.threshold;
  const bad = A.rows.filter(function (r) { return r.status === 'below'; }).sort(function (a, b) { return a.pct - b.pct; });
  const edge = A.rows.filter(function (r) { return r.status === 'edge'; }).sort(function (a, b) { return a.pct - b.pct; });
  let h = '<div class="stack">';
  /* hero */
  h += '<section class="card hero"><div class="hero-ring">' + ringSVG(o.pct, o.status, t) + '<div class="hero-num"><b>' + (o.pct === null ? '--' : fpw(o.pct)) + '<small>%</small></b><span>overall</span></div></div>' +
    '<div class="hero-main"><p class="eyebrow">Hour-wise attendance until ' + esc(fmtDate(A.asOf, true)) + '</p>' +
    '<h2 class="hero-line">' + o.att + ' of ' + o.held + ' class hours attended</h2>' +
    '<div class="hero-badges">' + badge(o.status, t) + '<span class="muted">Minimum ' + t + '%. The tick on the ring marks it.</span></div>' +
    '<p class="hero-adv">' + esc(advice(o, t, 'hour')) + '.</p>' +
    (A.asOf < RANGE_END ? '<p class="muted small">If you attend every remaining class: <b>' + fp(o.best) + '%</b> at semester end. With your planned absences: <b>' + fp(o.planned) + '%</b>.</p>' : '') +
    '</div><div class="hero-side">' + asOfControl() + '<p class="muted small">Batch <b>' + esc(S.settings.batch) + '</b> decides which lab you attend on Thursday and Friday periods 3 and 4.</p></div></section>';
  /* stats */
  h += '<section class="stats" aria-label="Totals"><div class="stat"><span>Hours held</span><b>' + o.held + '</b></div><div class="stat"><span>Attended</span><b>' + o.att + '</b></div><div class="stat"><span>Missed</span><b>' + o.missed + '</b></div>' +
    '<div class="stat"><span>Cancelled, ignored</span><b>' + o.cancelled + '</b></div><div class="stat"><span>Days fully absent</span><b>' + A.absentDays + '</b></div><div class="stat"><span>Teaching days so far</span><b>' + A.teachingDays + '</b></div></section>';
  /* alerts */
  h += '<section class="card pad"><div class="sec-head"><h2>Attendance alerts</h2><span class="muted small">Warns when a subject drops below ' + t + '%</span></div>';
  if (!bad.length && !edge.length) h += '<p class="alert-ok">' + ic('check') + 'Every subject is comfortably above ' + t + '%.</p>';
  else {
    h += '<ul class="alerts">';
    bad.forEach(function (r) { h += '<li class="al below">' + ic('alert') + '<div><b>' + esc(r.s.short) + ' is at ' + fp(r.pct) + '%</b>, below your ' + t + '% minimum. ' + esc(advice(r, t)) + '.</div></li>'; });
    edge.forEach(function (r) { h += '<li class="al edge">' + ic('alert') + '<div><b>' + esc(r.s.short) + ' is at ' + fp(r.pct) + '%</b>, with little room for misses. ' + esc(advice(r, t)) + '.</div></li>'; });
    h += '</ul>';
  }
  h += '</section>';
  /* subjects */
  h += '<section><div class="sec-head"><h2>By subject</h2><span class="muted small">Each class hour counts toward its own subject</span></div><div class="subj-grid">';
  A.rows.forEach(function (r) {
    h += '<article class="card subj st-' + r.status + '"><header>' + dot(r.s) + '<div class="subj-t"><h3>' + esc(r.s.short) + '</h3><p>' + esc(r.s.name) + '</p></div><div class="subj-pct">' + (r.pct === null ? '--' : fp(r.pct)) + '<small>%</small></div></header>' +
      meter(r.pct, t, r.status) +
      '<div class="subj-row"><span class="num">' + r.att + ' / ' + r.held + ' attended</span>' + badge(r.status, t) + '</div>' +
      '<p class="advice">' + esc(advice(r, t)) + '</p>' +
      ((r.replacedIn || r.cancelled || r.replacedOut) ? '<p class="muted small">' + [r.cancelled ? plural(r.cancelled, 'class') + ' cancelled' : '', r.replacedOut ? plural(r.replacedOut, 'class') + ' replaced by other subjects' : '', r.replacedIn ? plural(r.replacedIn, 'class') + ' taken over from others' : ''].filter(Boolean).join(' · ') + '</p>' : '') +
      '</article>';
  });
  h += '</div></section>';
  /* today */
  const fd = focusDay();
  h += '<section class="card pad"><div class="sec-head"><h2>' + (fd === TODAY ? 'Today' : 'Nearest teaching day') + ': ' + esc(fmtDate(fd, true)) + '</h2><span class="muted small">Untick a class you missed. Everything defaults to present.</span></div>' + dayEditor(fd) + '</section>';
  return h + '</div>';
}

/* ---------- attendance (day checklist) ---------- */
function monthGroups() {
  const g = {}, order = [];
  allDays().forEach(function (k) {
    let ym = k.slice(0, 7);
    if (k === RANGE_START) ym = '2026-09';
    if (k === RANGE_END) ym = '2026-12';
    if (!g[ym]) { g[ym] = { id: ym, label: MON[+ym.slice(5) - 1], keys: [] }; order.push(ym); }
    g[ym].keys.push(k);
  });
  return order.map(function (i) { return g[i]; });
}
function groupOf(k) {
  const gs = monthGroups();
  for (let i = 0; i < gs.length; i++) if (gs[i].keys.indexOf(k) >= 0) return gs[i].id;
  return gs[0].id;
}
function daySummaryText(sm) {
  const e = sm.e;
  if (e.kind === 'off') return '<span class="muted">No classes counted</span>';
  if (e.kind === 'event') return '<span class="' + (e.att ? 'pres' : 'abs') + '">' + (e.att ? 'Attended: full credit' : 'Did not attend') + '</span>';
  const parts = [];
  parts.push('<span class="' + (sm.absent ? 'abs' : 'pres') + '">' + sm.present + '/' + sm.counted + ' attended</span>');
  if (sm.cancelled) parts.push('<span class="muted">' + sm.cancelled + ' cancelled</span>');
  if (sm.replaced) parts.push('<span class="muted">' + sm.replaced + ' replaced</span>');
  if (sm.extras) parts.push('<span class="muted">+' + sm.extras + ' extra</span>');
  return parts.join('<i class="sep"></i>');
}
function typeChip(e) {
  const T = TYPES[e.type];
  if (e.type === 'regular' || e.type === 'noclass') return '';
  return '<span class="tchip ' + typeCls(e.type) + '">' + esc(e.code || T.code || T.label) + '</span>';
}
function typeCls(type) {
  return { holiday: 'ty-holiday', declared: 'ty-declared', test: 'ty-test', labtest: 'ty-labtest', event: 'ty-event', testatt: 'ty-info', bluebook: 'ty-info', asd: 'ty-info', feedback: 'ty-info', noclass: 'ty-none' }[type] || '';
}
function viewAttendance() {
  const gs = monthGroups();
  if (!UI.attGroup) UI.attGroup = groupOf(UI.openDay || focusDay());
  if (UI.openDay === null && UI.attGroup === groupOf(focusDay())) UI.openDay = focusDay();
  const g = gs.filter(function (x) { return x.id === UI.attGroup; })[0] || gs[0];
  let h = '<div class="stack"><section class="card pad"><div class="sec-head"><h2>Daily attendance</h2><span class="muted small">Open a day to mark classes. Everything is present unless you change it.</span></div>';
  h += '<div class="seg" role="tablist" aria-label="Month">' + gs.map(function (x) { return '<button role="tab" aria-selected="' + (x.id === g.id) + '" class="' + (x.id === g.id ? 'on' : '') + '" data-act="att-group" data-g="' + x.id + '">' + x.label + (x.id === '2026-09' ? ' <small>from 31 Aug</small>' : '') + (x.id === '2026-12' ? ' <small>to 1 Jan</small>' : '') + '</button>'; }).join('') + '</div>';
  h += '<div class="days">';
  g.keys.forEach(function (k) {
    if (wd(k) === 6 && UI.openDay !== k && !S.days[k]) return;
    const sm = daySummary(S, k), e = sm.e, open = UI.openDay === k;
    h += '<div class="day' + (open ? ' open' : '') + (k === TODAY ? ' is-today' : '') + ' ' + (e.kind === 'off' ? 'off' : '') + '" id="day-' + k + '">' +
      '<button class="day-head" data-act="toggle-day" data-date="' + k + '" aria-expanded="' + open + '" aria-controls="de-' + k + '">' +
      '<span class="dnum"><b>' + dateOf(k).getDate() + '</b><small>' + WD[wd(k)] + '</small></span>' +
      '<span class="dtitle"><span class="dl">' + esc(e.label || TYPES[e.type].label) + '</span>' + typeChip(e) + (k === TODAY ? '<span class="tchip today-chip">Today</span>' : '') +
      (e.tt !== null && e.tt !== undefined && e.tt !== wd(k) && e.kind !== 'off' ? '<span class="tchip ttchip">' + WD[e.tt] + ' timetable</span>' : '') + '</span>' +
      '<span class="dsum">' + daySummaryText(sm) + '</span>' + ic('chev', 'chev') + '</button>' +
      (open ? '<div class="day-body" id="de-' + k + '">' + dayEditor(k) + '</div>' : '') + '</div>';
  });
  return h + '</div></section></div>';
}

/* ---------- the day editor (checklist) ---------- */
const OFF_WHY = {
  holiday: 'Holiday. The whole day is ignored, so your attendance is not affected.',
  declared: 'Declared holiday. The whole day is ignored, so your attendance is not affected.',
  test: 'Internal test day. Regular classes are not counted. Change the day type below if classes were held.',
  labtest: 'Lab test day. Regular classes are not counted. Change the day type below if classes were held.',
  noclass: 'No classes are scheduled on this day. Change the day type below if a class was held.'
};
function dayEditor(k) {
  const e = eff(S, k), b = e.base, ov = S.days[k] || {};
  const fid = function (n) { return n + '-' + k; };
  let h = '<div class="de" data-date="' + k + '">';
  h += '<div class="de-top"><div class="fld"><label for="' + fid('ty') + '">Day type</label><select id="' + fid('ty') + '" class="in" data-act="d-type" data-fid="' + fid('ty') + '">' +
    TYPE_ORDER.map(function (t) { return opt(t, TYPES[t].label, t === e.type); }).join('') + '</select></div>' +
    '<div class="fld grow"><label for="' + fid('lb') + '">Label</label><input id="' + fid('lb') + '" class="in" type="text" maxlength="80" value="' + esc(e.label) + '" placeholder="Event or note, for example: exam moved here" data-act="d-label"></div>' +
    '<div class="fld"><label for="' + fid('tt') + '">Follows timetable of</label><select id="' + fid('tt') + '" class="in" data-act="d-tt" data-fid="' + fid('tt') + '">' +
    opt('', 'Calendar default: ' + (b.tt === null ? 'none' : WDL[b.tt]), ov.tt === undefined) + [0, 1, 2, 3, 4].map(function (i) { return opt(String(i), WDL[i], ov.tt === i); }).join('') + opt('none', 'No timetable', ov.tt === null) + '</select></div></div>';
  if (b.note) h += '<p class="de-note">' + ic('info') + '<span>' + esc(b.note) + '</span></p>';
  if (e.kind === 'off') {
    h += '<p class="de-off">' + ic('minus') + '<span>' + esc(OFF_WHY[e.type] || OFF_WHY.noclass) + '</span></p>';
  } else if (e.kind === 'event') {
    h += '<label class="chk-line big"><input type="checkbox" data-act="d-event-att" data-fid="' + fid('ev') + '"' + (e.att ? ' checked' : '') + '><span>I attended college on this day</span></label>' +
      '<p class="muted small">College programme: every class scheduled today is credited as attended when this is ticked. Untick it if you stayed away.</p>';
    h += classList(k, e, true);
  } else {
    h += '<div class="de-actions"><button class="btn sm" data-act="d-allabs">Mark whole day absent</button><button class="btn sm" data-act="d-allpres">Mark whole day present</button></div>';
    h += classList(k, e, false);
  }
  /* extra classes */
  h += '<div class="de-extra"><h4>Extra classes</h4>';
  e.extras.forEach(function (x, i) {
    const s = subj(S, x.sub);
    h += '<div class="ex-row"><span class="ex-s">' + (s ? dot(s) + esc(s.short) : 'Removed subject') + '</span><label class="chk-line"><input type="checkbox" data-act="d-extra-att" data-i="' + i + '" data-fid="' + fid('xa' + i) + '"' + (x.abs ? '' : ' checked') + '><span>Attended</span></label><button class="btn sm ghost" data-act="d-extra-del" data-i="' + i + '" aria-label="Remove extra class">' + ic('trash') + '</button></div>';
  });
  h += '<div class="ex-add"><select class="in" id="' + fid('xs') + '" aria-label="Subject of the extra class">' + subjOptions('') + '</select><button class="btn sm" data-act="d-extra-add">' + ic('plus') + 'Add extra class</button></div>' +
    '<p class="muted small">For a class held outside the timetable, such as a makeup class on a Saturday. It adds one hour to that subject.</p></div>';
  /* move + reset */
  const special = e.type !== 'regular' && e.type !== 'noclass';
  if (special) {
    h += '<details class="de-move"><summary>' + ic('swap') + 'Prepone or postpone this ' + esc(TYPES[e.type].label.toLowerCase()) + '</summary><div class="mv-row"><label for="' + fid('mv') + '">New date</label><input type="date" class="in" id="' + fid('mv') + '" min="' + RANGE_START + '" max="' + RANGE_END + '"><button class="btn sm primary" data-act="d-move">Move it</button></div>' +
      '<p class="muted small">The new date takes this day type and label. This date becomes a normal ' + (wd(k) >= 5 ? 'no-class' : 'teaching') + ' day.</p></details>';
  }
  if (ov.type !== undefined || ov.label !== undefined || ov.tt !== undefined || ov.code !== undefined) {
    h += '<button class="btn sm ghost" data-act="d-reset">' + ic('undo') + 'Reset day type to the college calendar</button>';
  }
  return h + '</div>';
}
function classList(k, e, readonly) {
  const rows = dayPeriods(S, e);
  if (!rows.length) return '<p class="de-off">' + ic('minus') + '<span>No timetable is set for this day, so there are no classes to mark. Pick a timetable above.</span></p>';
  let h = '<ul class="cls-list">';
  rows.forEach(function (r, i) {
    const p = r.p, st = r.st || {}, s = r.subj ? subj(S, r.subj) : null;
    const when = '<span class="when"><b>' + esc(p.label) + '</b><small>' + esc(p.time) + '</small></span>';
    if (!s && !(st.x === 's')) {
      const nm = r.slot && r.slot.k === 'n' ? (r.slot.l || 'Free') : (r.slot && r.slot.k === 'b' ? 'No lab for batch ' + S.settings.batch : 'Free');
      h += '<li class="cls none">' + '<span class="chk-ph"></span>' + when + '<span class="what"><span class="muted">' + esc(nm) + ' (not counted)</span></span></li>';
    } else {
      const cancelled = st.x === 'c', replaced = st.x === 's';
      const present = !st.abs;
      const cls = readonly ? 'cls' : 'cls ' + (cancelled ? 'cancelled' : replaced ? 'replaced' : st.abs ? 'absent' : 'present');
      h += '<li class="' + cls + '">';
      if (readonly) h += '<span class="chk-ph ok">' + ic('check') + '</span>';
      else h += '<label class="chk"><input type="checkbox" data-act="d-slot-att" data-pid="' + p.id + '" data-fid="a-' + k + '-' + p.id + '"' + (present && !cancelled ? ' checked' : '') + (cancelled ? ' disabled' : '') + ' aria-label="Attended period ' + esc(p.label) + (s ? ', ' + esc(s.short) : '') + '"></label>';
      h += when + '<span class="what">' + (s ? dot(s) + '<b>' + esc(s.short) + '</b><span class="muted nm">' + esc(s.name) + '</span>' : '<b>Extra</b>') + '</span>';
      if (!readonly) {
        h += '<span class="stat-sel"><select class="in sm" data-act="d-slot-x" data-pid="' + p.id + '" data-fid="x-' + k + '-' + p.id + '" aria-label="What happened to period ' + esc(p.label) + '">' +
          opt('', 'Held as scheduled', !st.x) + opt('c', 'Cancelled', cancelled) + opt('s', 'Taken by another subject', replaced) + '</select>';
        if (replaced) h += '<select class="in sm" data-act="d-slot-sub" data-pid="' + p.id + '" data-fid="s-' + k + '-' + p.id + '" aria-label="Subject that replaced this class">' + subjOptions(st.sub, 'Which subject?') + '</select>';
        h += '</span>';
        if (replaced && !st.sub) h += '<span class="hint">Pick the subject that was taught. The hour counts toward it, and ' + esc(s ? s.short : 'this class') + ' is not affected.</span>';
        if (replaced && st.sub) h += '<span class="hint">Tick means you attended the ' + esc(subj(S, st.sub) ? subj(S, st.sub).short : '') + ' class. ' + esc(s ? s.short : '') + ' is not affected.</span>';
        if (cancelled) h += '<span class="hint">Cancelled classes are ignored.</span>';
      }
      h += '</li>';
    }
    if (p.brk) h += '<li class="brk">' + esc(p.brk) + '</li>';
  });
  return h + '</ul>';
}

/* ---------- calendar ---------- */
const LEGEND = [
  ['', 'Regular day', ''], ['ty-holiday', 'H', 'Holiday'], ['ty-declared', 'DH', 'Declared holiday'], ['ty-test', 'T1 T2 T3', 'Internal tests'],
  ['ty-labtest', 'LT', 'Lab test'], ['ty-event', 'EV', 'College event'], ['ty-info', 'TA', 'Test attendance'], ['ty-info', 'BV', 'Blue book verification'],
  ['ty-info', 'ASD', 'Attendance and sessional display'], ['ty-info', 'FFB', 'Faculty feedback']
];
function viewCalendar() {
  let h = '<div class="stack"><section class="card pad"><div class="sec-head"><h2>Academic calendar, 31 Aug 2026 to 1 Jan 2027</h2><span class="muted small">Tap a date to open its class checklist</span></div>';
  h += '<ul class="legend">' + LEGEND.map(function (l) { return '<li><span class="tchip ' + l[0] + '">' + l[1] + '</span>' + (l[2] ? '<span>' + l[2] + '</span>' : '') + '</li>'; }).join('') + '</ul>';
  h += '<div class="cal-scroll"><div class="cal" role="grid" aria-label="Academic calendar by week"><div class="cal-row head" role="row"><span class="cal-wk">Week</span>' + WD.map(function (d) { return '<span role="columnheader">' + d + '</span>'; }).join('') + '<span class="cal-ct" title="Days with classes or a college event">Days</span></div>';
  for (let w = 0; ; w++) {
    const mon = addDays(RANGE_START, 7 * w);
    if (mon > RANGE_END) break;
    let cells = '', count = 0;
    for (let i = 0; i < 7; i++) {
      const k = addDays(mon, i);
      if (!inRange(k)) { cells += '<span class="cal-day empty" role="gridcell"></span>'; continue; }
      const sm = daySummary(S, k), e = sm.e;
      if (e.kind !== 'off') count++;
      const showMo = dateOf(k).getDate() === 1 || k === RANGE_START;
      let tip = fmtDate(k) + ': ' + (e.label || TYPES[e.type].label);
      if (sm.absent) tip += ' (' + sm.absent + ' absent)';
      cells += '<button class="cal-day ' + typeCls(e.type) + (k === TODAY ? ' today' : '') + (i === 6 ? ' sun' : '') + '" role="gridcell" data-act="goto-day" data-date="' + k + '" title="' + esc(tip) + '" aria-label="' + esc(tip) + '">' +
        '<span class="n">' + dateOf(k).getDate() + (showMo ? '<em>' + MON[dateOf(k).getMonth()] + '</em>' : '') + '</span>' +
        ((e.code || (e.type !== 'regular' && e.type !== 'noclass')) ? '<span class="cc">' + esc(e.code || TYPES[e.type].code) + '</span>' : '') +
        (e.kind !== 'off' && e.tt !== null && e.tt !== undefined && e.tt !== wd(k) ? '<span class="ttm">' + WD[e.tt] + ' TT</span>' : '') +
        (sm.absent ? '<i class="mk abs" aria-hidden="true"></i>' : (sm.cancelled || sm.replaced ? '<i class="mk chg" aria-hidden="true"></i>' : '')) + '</button>';
    }
    const m1 = MON[dateOf(mon).getMonth()], m2 = MON[dateOf(addDays(mon, 5)).getMonth()];
    h += '<div class="cal-row" role="row"><span class="cal-wk"><b>' + (5 + w) + '</b><small>' + (m1 === m2 ? m1 : m1 + '/' + m2) + '</small></span>' + cells + '<span class="cal-ct">' + count + '</span></div>';
  }
  h += '</div></div><p class="muted small legend-note"><i class="mk abs"></i> absent in at least one class <i class="mk chg"></i> class cancelled or replaced. "Wed TT" on a Saturday means that day follows the Wednesday timetable.</p></section>';
  /* calendar check */
  const T = calendarTotals(S);
  const same = T.working === COLLEGE.working && T.teaching === COLLEGE.teaching && JSON.stringify(T.byDay) === JSON.stringify(COLLEGE.byDay);
  h += '<section class="card pad"><div class="sec-head"><h2>Calendar check</h2><span class="muted small">' + (same ? 'Matches the totals printed on the college calendar' : 'You have edited the calendar, so it differs from the printed totals') + '</span></div>' +
    '<div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th class="r">Working days</th><th class="r">Teaching days</th>' + WD.slice(0, 5).map(function (d) { return '<th class="r">' + d + '</th>'; }).join('') + '</tr></thead><tbody>' +
    '<tr><th scope="row">College calendar</th><td class="r">' + COLLEGE.working + '</td><td class="r">' + COLLEGE.teaching + '</td>' + COLLEGE.byDay.map(function (n) { return '<td class="r">' + n + '</td>'; }).join('') + '</tr>' +
    '<tr><th scope="row">This app</th><td class="r">' + T.working + '</td><td class="r">' + T.teaching + '</td>' + T.byDay.map(function (n, i) { return '<td class="r' + (n !== COLLEGE.byDay[i] ? ' diff' : '') + '">' + n + '</td>'; }).join('') + '</tr></tbody></table></div>' +
    '<p class="muted small">Working days exclude holidays. Teaching days also exclude internal tests and lab tests. The weekday columns count Saturdays under the timetable they follow.</p></section></div>';
  return h;
}


