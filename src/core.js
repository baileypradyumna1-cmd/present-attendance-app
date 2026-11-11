'use strict';
/* =====================================================================
   Present: data + calculation engine (pure functions, no DOM)
   ===================================================================== */

/* ---------- constants ---------- */
const RANGE_START = '2026-08-31';
const RANGE_END = '2027-01-01';
// Totals printed on the college calendar, kept for the "calendar check" card.
const COLLEGE = { working: 91, teaching: 77, byDay: [16, 15, 15, 16, 15] };
const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WDL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* kind: class = timetable classes run, off = whole day ignored, event = college programme (full credit if you attended) */
const TYPES = {
  regular:  { label: 'Regular day',                   code: '',    kind: 'class' },
  holiday:  { label: 'Holiday',                       code: 'H',   kind: 'off' },
  declared: { label: 'Declared holiday',              code: 'DH',  kind: 'off' },
  test:     { label: 'Internal test',                 code: 'T',   kind: 'off' },
  labtest:  { label: 'Lab test',                      code: 'LT',  kind: 'off' },
  event:    { label: 'College event / programme',     code: 'EV',  kind: 'event' },
  testatt:  { label: 'Test attendance',               code: 'TA',  kind: 'class' },
  bluebook: { label: 'Blue book verification',        code: 'BV',  kind: 'class' },
  asd:      { label: 'Attendance & sessional display', code: 'ASD', kind: 'class' },
  feedback: { label: 'Faculty feedback',              code: 'FB',  kind: 'class' },
  noclass:  { label: 'No classes',                    code: '',    kind: 'off' }
};
const TYPE_ORDER = ['regular', 'holiday', 'declared', 'test', 'labtest', 'event', 'testatt', 'bluebook', 'asd', 'feedback', 'noclass'];

/* ---------- date helpers (ISO keys: YYYY-MM-DD, local time) ---------- */
function pad(n) { return n < 10 ? '0' + n : '' + n; }
function keyOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function dateOf(k) { const p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
function addDays(k, n) { const d = dateOf(k); d.setDate(d.getDate() + n); return keyOf(d); }
function wd(k) { return (dateOf(k).getDay() + 6) % 7; } // Mon=0 .. Sun=6
function inRange(k) { return k >= RANGE_START && k <= RANGE_END; }
function clampKey(k) { return k < RANGE_START ? RANGE_START : (k > RANGE_END ? RANGE_END : k); }
let _days = null;
function allDays() {
  if (_days) return _days;
  _days = [];
  for (let k = RANGE_START; k <= RANGE_END; k = addDays(k, 1)) _days.push(k);
  return _days;
}
function fmtDate(k, withYear) {
  const d = dateOf(k);
  return WD[wd(k)] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] + (withYear ? ' ' + d.getFullYear() : '');
}

/* ---------- default subjects, periods, timetable ---------- */
const DEFAULT_SUBJECTS = [
  { id: 'maths', short: 'MATHS', code: '25BMAME101', name: 'Differential Calculus & Linear Algebra', faculty: 'Dr. Venkataramana B S', credits: 1, color: 0 },
  { id: 'chem', short: 'CHEM', code: '25BCHME102', name: 'Applied Chemistry for Advanced Metal Protection and Sustainable Energy Systems', faculty: 'Mrs. Shylaja K R', credits: 1, color: 1 },
  { id: 'ai', short: 'AI', code: '25BETCK103', name: 'Introduction to AI and Applications', faculty: 'Mr. Swaroop Gannamani', credits: 1, color: 2 },
  { id: 'iem', short: 'IEM', code: '25BESC104G', name: 'Introduction to Engineering Mechanics', faculty: 'Mr. Saviraj A S', credits: 1, color: 3 },
  { id: 'pp', short: 'PP', code: '25BPLC105A + 25BPLL109A', name: 'Introduction to Python Programming (theory + lab)', faculty: 'Dr. Anil Kumar A', credits: 1, color: 4 },
  { id: 'eng', short: 'ENG', code: '25BCPSK106', name: 'Communicative & Professional Writing Skills in English', faculty: 'Mrs. Anuradha M V', credits: 1, color: 5 },
  { id: 'ic', short: 'IC', code: '25BICOK107', name: 'Indian Constitution & Engineering Ethics', faculty: 'Mrs. Anuradha M V', credits: 1, color: 6 },
  { id: 'idt', short: 'IDT', code: '25BICOK108', name: 'Innovation and Design Thinking Lab (Project-Based Learning)', faculty: 'Mr. Abhishek P', credits: 1, color: 7 }
];
const DEFAULT_PERIODS = [
  { id: 'p1', label: '1', time: '8:30 - 9:25', brk: '' },
  { id: 'p2', label: '2', time: '9:25 - 10:20', brk: 'Break 10:20 - 10:35' },
  { id: 'p3', label: '3', time: '10:35 - 11:30', brk: '' },
  { id: 'p4', label: '4', time: '11:30 - 12:25', brk: 'Lunch 12:25 - 1:15' },
  { id: 'p5', label: '5', time: '1:15 - 2:10', brk: '' },
  { id: 'p6', label: '6', time: '2:10 - 3:05', brk: '' },
  { id: 'p7', label: '7', time: '3:05 - 4:00', brk: '' }
];
function _S(id) { return { k: 's', s: id }; }
function _N(l) { return { k: 'n', l: l }; }
const _LAB_THU = { k: 'b', m: { K1: 'chem', K2: 'pp' } };
const _LAB_FRI = { k: 'b', m: { K1: 'pp', K2: 'chem' } };
/* slot kinds: s = one subject, b = batch-wise lab (batch -> subject), n = not counted (T, LIB, free) */
const DEFAULT_TT = {
  0: { p1: _S('ai'), p2: _S('chem'), p3: _S('pp'), p4: _S('maths'), p5: _S('idt'), p6: _S('idt'), p7: _N('T') },
  1: { p1: _S('pp'), p2: _S('ic'), p3: _S('ai'), p4: _S('chem'), p5: _S('maths'), p6: _S('iem'), p7: _N('LIB') },
  2: { p1: _S('iem'), p2: _S('maths'), p3: _S('pp'), p4: _S('ai'), p5: _S('ai'), p6: _S('chem'), p7: _N('LIB') },
  3: { p1: _S('pp'), p2: _S('maths'), p3: _LAB_THU, p4: _LAB_THU, p5: _S('chem'), p6: _S('iem'), p7: _S('eng') },
  4: { p1: _S('chem'), p2: _S('eng'), p3: _LAB_FRI, p4: _LAB_FRI, p5: _S('maths'), p6: _S('iem'), p7: _N('T') }
};

/* ---------- the college calendar (Aug 31 2026 to Jan 1 2027) ----------
   [date, type, label, {code, tt (timetable weekday 0=Mon), note}]  */
const NOTE_SAT = function (d) { return 'Follows the ' + d + ' timetable (calendar remark).'; };
const CAL = [
  ['2026-08-31', 'regular', 'Commencement of classes'],
  ['2026-09-05', 'holiday', ''],
  ['2026-09-12', 'regular', '', { tt: 2, note: NOTE_SAT('Wednesday') }],
  ['2026-09-14', 'holiday', 'Ganesha Chaturthi'],
  ['2026-09-19', 'declared', ''],
  ['2026-09-24', 'regular', '', { note: 'The calendar remarks list "First Faculty Feed Back" on this date; the grid itself marks it on 27 Oct.' }],
  ['2026-09-26', 'regular', '', { tt: 1, note: NOTE_SAT('Tuesday') }],
  ['2026-10-02', 'holiday', 'Gandhi Jayanthi'],
  ['2026-10-03', 'declared', ''],
  ['2026-10-07', 'testatt', 'Test attendance'],
  ['2026-10-08', 'event', 'AIML Dept Hackathon'],
  ['2026-10-09', 'event', 'AIML Dept Hackathon'],
  ['2026-10-10', 'holiday', 'Mahalaya Amavasya'],
  ['2026-10-14', 'test', 'Internal Test 1', { code: 'T1' }],
  ['2026-10-15', 'test', 'Internal Test 1', { code: 'T1' }],
  ['2026-10-16', 'test', 'Internal Test 1', { code: 'T1' }],
  ['2026-10-17', 'declared', ''],
  ['2026-10-20', 'holiday', 'Maha Navami & Ayudha Pooja'],
  ['2026-10-21', 'holiday', 'Vijayadashami'],
  ['2026-10-24', 'bluebook', 'Blue Book Verification', { tt: 3, note: NOTE_SAT('Thursday') }],
  ['2026-10-27', 'feedback', 'First Faculty Feed Back', { code: 'FFB1' }],
  ['2026-10-31', 'regular', '', { tt: 0, note: 'No timetable is printed for this Saturday. The Monday timetable is assumed because that reproduces the college\'s own weekday totals (16/15/15/16/15). Change it below if your class followed another day.' }],
  ['2026-11-07', 'declared', ''],
  ['2026-11-10', 'holiday', 'Balipadyami'],
  ['2026-11-14', 'testatt', 'Test attendance', { tt: 4, note: NOTE_SAT('Friday') }],
  ['2026-11-18', 'test', 'Internal Test 2', { code: 'T2' }],
  ['2026-11-19', 'test', 'Internal Test 2', { code: 'T2' }],
  ['2026-11-20', 'test', 'Internal Test 2', { code: 'T2' }],
  ['2026-11-21', 'declared', ''],
  ['2026-11-27', 'holiday', 'Kanakadasa Jayanthi'],
  ['2026-11-28', 'bluebook', 'Blue Book Verification', { tt: 2, note: NOTE_SAT('Wednesday') }],
  ['2026-12-01', 'feedback', 'Second Faculty Feed Back', { code: 'FFB2' }],
  ['2026-12-03', 'testatt', 'Test attendance'],
  ['2026-12-05', 'holiday', ''],
  ['2026-12-12', 'regular', '', { tt: 4, note: NOTE_SAT('Friday') }],
  ['2026-12-18', 'testatt', 'Test attendance'],
  ['2026-12-19', 'declared', ''],
  ['2026-12-21', 'test', 'Internal Test 3', { code: 'T3' }],
  ['2026-12-22', 'test', 'Internal Test 3', { code: 'T3' }],
  ['2026-12-23', 'test', 'Internal Test 3', { code: 'T3' }],
  ['2026-12-24', 'labtest', 'Lab test'],
  ['2026-12-25', 'holiday', 'Christmas'],
  ['2026-12-26', 'labtest', 'Lab test'],
  ['2026-12-28', 'labtest', 'Lab test'],
  ['2026-12-29', 'labtest', 'Lab test'],
  ['2026-12-30', 'labtest', 'Lab test'],
  ['2026-12-31', 'asd', 'Attendance & sessional display'],
  ['2027-01-01', 'regular', 'Last working day']
];
const DEF = {};
CAL.forEach(function (r) {
  const k = r[0], x = r[3] || {}, w = wd(k);
  DEF[k] = { type: r[1], label: r[2] || '', code: x.code || '', tt: x.tt !== undefined ? x.tt : (w < 5 ? w : null), note: x.note || '' };
});
function getBase(k) {
  if (DEF[k]) return DEF[k];
  const w = wd(k);
  return w >= 5 ? { type: 'noclass', label: '', code: '', tt: null, note: '' } : { type: 'regular', label: '', code: '', tt: w, note: '' };
}

/* ---------- state ---------- */
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function defaultState() {
  return {
    v: 1,
    profile: { name: '', usn: '', sem: 'Odd semester, 2026-27', college: '' },
    settings: { threshold: 85, batch: 'K1', batches: ['K1', 'K2'], asOf: 'today', theme: '' },
    subjects: clone(DEFAULT_SUBJECTS),
    periods: clone(DEFAULT_PERIODS),
    tt: clone(DEFAULT_TT),
    days: {},
    marks: {},
    targets: { cgpa: 9, mode: 'ext', exp: 70, pend: 'same', intT: 20, apT: 20 }
  };
}
/* Returns a usable state from untrusted JSON, or null. */
function sanitizeState(raw) {
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return null;
  if (!Array.isArray(raw.subjects) || !Array.isArray(raw.periods) || !raw.tt || typeof raw.tt !== 'object') return null;
  const d = defaultState();
  const S = {
    v: 1,
    profile: Object.assign(d.profile, raw.profile || {}),
    settings: Object.assign(d.settings, raw.settings || {}),
    subjects: raw.subjects.filter(function (s) { return s && typeof s.id === 'string'; }),
    periods: raw.periods.filter(function (p) { return p && typeof p.id === 'string'; }),
    tt: raw.tt,
    days: raw.days && typeof raw.days === 'object' ? raw.days : {},
    marks: raw.marks && typeof raw.marks === 'object' ? raw.marks : {},
    targets: Object.assign(d.targets, raw.targets && typeof raw.targets === 'object' ? raw.targets : {})
  };
  for (let i = 0; i < 5; i++) if (!S.tt[i] || typeof S.tt[i] !== 'object') S.tt[i] = {};
  if (!Array.isArray(S.settings.batches) || !S.settings.batches.length) S.settings.batches = ['K1', 'K2'];
  if (S.settings.batches.indexOf(S.settings.batch) < 0) S.settings.batch = S.settings.batches[0];
  const t = Number(S.settings.threshold);
  S.settings.threshold = isFinite(t) && t > 0 && t <= 100 ? t : 85;
  return S;
}

/* ---------- effective day ---------- */
function eff(S, k) {
  const b = getBase(k), o = S.days[k] || {};
  const type = (o.type !== undefined && TYPES[o.type]) ? o.type : b.type;
  const T = TYPES[type];
  const same = type === b.type;
  return {
    key: k, type: type, kind: T.kind,
    label: o.label !== undefined ? o.label : (same ? b.label : ''),
    code: o.code !== undefined ? o.code : (same && b.code ? b.code : T.code),
    tt: o.tt !== undefined ? o.tt : b.tt,
    att: o.att !== false,
    slots: o.slots || {},
    extras: o.extras || [],
    base: b, ov: o
  };
}
function subjectExists(S, id) { return S.subjects.some(function (s) { return s.id === id; }); }
function subj(S, id) { for (let i = 0; i < S.subjects.length; i++) if (S.subjects[i].id === id) return S.subjects[i]; return null; }
function resolveSlot(S, slot) {
  if (!slot) return null;
  if (slot.k === 's') return subjectExists(S, slot.s) ? slot.s : null;
  if (slot.k === 'b') { const id = slot.m && slot.m[S.settings.batch]; return id && subjectExists(S, id) ? id : null; }
  return null;
}
function dayPeriods(S, e) {
  if (e.tt === null || e.tt === undefined || !S.tt[e.tt]) return [];
  return S.periods.map(function (p) {
    const slot = S.tt[e.tt][p.id];
    return { p: p, slot: slot, subj: resolveSlot(S, slot), st: e.slots[p.id] || null };
  });
}

/* ---------- attendance tally ----------
   Rules (from the brief):
   - holiday / test / lab test / no-class day: whole day ignored
   - cancelled class: ignored
   - class taken by another subject/faculty: credit goes to THAT subject; the scheduled one is untouched
   - college event day: every counted period is credited if you attended college that day  */
function tally(S, upto) {
  const per = {};
  S.subjects.forEach(function (s) { per[s.id] = { held: 0, att: 0, cancelled: 0, replacedIn: 0, replacedOut: 0 }; });
  const tot = { held: 0, att: 0, cancelled: 0 };
  let teachingDays = 0, absentDays = 0;
  function add(id, present, c) {
    if (!per[id]) return;
    per[id].held++; tot.held++; c.held++;
    if (present) { per[id].att++; tot.att++; c.att++; }
  }
  const days = allDays();
  for (let i = 0; i < days.length; i++) {
    const k = days[i];
    if (k > upto) break;
    const e = eff(S, k), c = { held: 0, att: 0 };
    if (e.kind !== 'off') {
      const rows = dayPeriods(S, e);
      for (let j = 0; j < rows.length; j++) {
        const r = rows[j], st = r.st;
        if (e.kind === 'event') { if (r.subj) add(r.subj, e.att, c); continue; }
        if (st && st.x === 'c') { if (r.subj) { per[r.subj].cancelled++; tot.cancelled++; } continue; }
        if (st && st.x === 's') {
          if (r.subj) per[r.subj].replacedOut++;
          if (st.sub && per[st.sub]) { per[st.sub].replacedIn++; add(st.sub, !st.abs, c); }
          continue;
        }
        if (r.subj) add(r.subj, !(st && st.abs), c);
      }
    }
    e.extras.forEach(function (x) { if (x && per[x.sub]) add(x.sub, !x.abs, c); });
    if (c.held > 0) { teachingDays++; if (c.att === 0) absentDays++; }
  }
  return { per: per, tot: tot, teachingDays: teachingDays, absentDays: absentDays };
}

function pct(a, h) { return h > 0 ? a / h * 100 : null; }
/* classes you must attend in a row to reach t% */
function needToReach(a, h, t) {
  const f = t / 100;
  if (h === 0 || a / h >= f - 1e-12) return 0;
  if (f >= 1) return Infinity;
  return Math.max(0, Math.ceil((f * h - a) / (1 - f) - 1e-9));
}
/* classes you can skip in a row and still be at or above t% */
function canSkip(a, h, t) {
  const f = t / 100;
  if (f <= 0) return Infinity;
  return Math.max(0, Math.floor(a / f - h + 1e-9));
}
function statusOf(a, h, t) {
  if (h === 0) return 'none';
  if (a / h < t / 100 - 1e-12) return 'below';
  return canSkip(a, h, t) <= 1 ? 'edge' : 'ok';
}
function resolveAsOf(S, today) {
  const a = S.settings.asOf;
  if (a === 'end') return RANGE_END;
  if (a && a !== 'today') return clampKey(a);
  if (today < RANGE_START) return addDays(RANGE_START, -1);
  return today > RANGE_END ? RANGE_END : today;
}
function analyze(S, today) {
  const asOf = resolveAsOf(S, today), t = S.settings.threshold;
  const cur = tally(S, asOf), end = tally(S, RANGE_END);
  function build(c, e) {
    const remaining = e.held - c.held;
    const best = pct(c.att + remaining, c.held + remaining);
    return {
      held: c.held, att: c.att, missed: c.held - c.att, cancelled: c.cancelled || 0,
      pct: pct(c.att, c.held), remaining: remaining,
      planned: pct(e.att, e.held), best: best,
      need: needToReach(c.att, c.held, t), skip: canSkip(c.att, c.held, t),
      status: statusOf(c.att, c.held, t),
      lost: best !== null && best < t - 1e-9
    };
  }
  const rows = S.subjects.map(function (s) {
    const r = build(cur.per[s.id], end.per[s.id]);
    r.s = s; r.replacedIn = cur.per[s.id].replacedIn; r.replacedOut = cur.per[s.id].replacedOut;
    return r;
  });
  const overall = build(cur.tot, end.tot);
  return { asOf: asOf, rows: rows, overall: overall, teachingDays: cur.teachingDays, absentDays: cur.absentDays, threshold: t };
}

/* ---------- per-day summary (for the checklist headers) ---------- */
function daySummary(S, k) {
  const e = eff(S, k);
  const r = { e: e, counted: 0, present: 0, absent: 0, cancelled: 0, replaced: 0, extras: e.extras.length };
  if (e.kind === 'off') return r;
  dayPeriods(S, e).forEach(function (x) {
    const st = x.st;
    if (e.kind === 'event') { if (x.subj) { r.counted++; if (e.att) r.present++; else r.absent++; } return; }
    if (st && st.x === 'c') { if (x.subj) r.cancelled++; return; }
    if (st && st.x === 's') { if (st.sub) { r.replaced++; r.counted++; if (st.abs) r.absent++; else r.present++; } return; }
    if (x.subj) { r.counted++; if (st && st.abs) r.absent++; else r.present++; }
  });
  return r;
}

/* ---------- calendar check: totals for the current calendar ---------- */
function calendarTotals(S) {
  const byDay = [0, 0, 0, 0, 0];
  let working = 0, teaching = 0;
  allDays().forEach(function (k) {
    const e = eff(S, k);
    if (wd(k) === 6) return;
    if (e.type !== 'holiday' && e.type !== 'declared' && e.type !== 'noclass') working++;
    if (e.kind !== 'off') { teaching++; if (e.tt !== null && e.tt !== undefined && e.tt < 5) byDay[e.tt]++; }
  });
  return { working: working, teaching: teaching, byDay: byDay };
}

/* ---------- editing helpers ---------- */
function dayOv(S, k) { if (!S.days[k]) S.days[k] = {}; return S.days[k]; }
function slotOv(S, k, pid) { const o = dayOv(S, k); if (!o.slots) o.slots = {}; if (!o.slots[pid]) o.slots[pid] = {}; return o.slots[pid]; }
function cleanDay(S, k) {
  const o = S.days[k]; if (!o) return;
  if (o.slots) {
    Object.keys(o.slots).forEach(function (p) {
      const s = o.slots[p];
      if (!s.x && !s.abs) delete o.slots[p];
      else if (s.x !== 's') { delete s.sub; if (s.x === 'c') delete s.abs; }
    });
    if (!Object.keys(o.slots).length) delete o.slots;
  }
  if (o.extras && !o.extras.length) delete o.extras;
  if (o.att === true) delete o.att;
  if (!Object.keys(o).length) delete S.days[k];
}
function setSlotPresent(S, k, pid, present) {
  const s = slotOv(S, k, pid);
  if (present) delete s.abs; else s.abs = true;
  cleanDay(S, k);
}
function setSlotStatus(S, k, pid, x) {
  const s = slotOv(S, k, pid);
  if (!x) { delete s.x; delete s.sub; }
  else { s.x = x; if (x === 'c') delete s.abs; if (x === 's' && s.sub === undefined) s.sub = ''; }
  cleanDay(S, k);
}
function markWholeDay(S, k, present) {
  const e = eff(S, k);
  if (e.kind === 'event') { const o = dayOv(S, k); if (present) delete o.att; else o.att = false; cleanDay(S, k); return; }
  dayPeriods(S, e).forEach(function (r) {
    if (!r.subj && !(r.st && r.st.x === 's')) return;
    if (r.st && r.st.x === 'c') return;
    const s = slotOv(S, k, r.p.id);
    if (present) delete s.abs; else s.abs = true;
  });
  cleanDay(S, k);
}
/* Prepone / postpone: move the day's special type (exam, holiday, event) to another date. */
function moveEvent(S, src, dst) {
  if (src === dst || !inRange(dst)) return false;
  const e = eff(S, src);
  const d = dayOv(S, dst);
  d.type = e.type; d.label = e.label; d.code = e.code;
  delete d.tt;
  const s = dayOv(S, src);
  s.type = wd(src) >= 5 ? 'noclass' : 'regular'; s.label = ''; delete s.code;
  return true;
}

/* ---------- marks ---------- */
function num(v) { if (v === '' || v === null || v === undefined) return null; const x = Number(v); return isFinite(x) ? x : null; }
function markRow(m) {
  m = m || {};
  const ts = [num(m.ia1), num(m.ia2), num(m.ia3)].filter(function (x) { return x !== null; });
  const nT = ts.length;
  const internal = nT ? ts.reduce(function (a, b) { return a + b; }, 0) / nT : null; // average of the tests entered, out of 25
  const a = num(m.asg), p = num(m.prj), e = num(m.ext);
  const ext50 = e !== null ? e / 2 : null;
  let sec = 0, max = 0;
  if (nT) { sec += internal; max += 25; }
  if (a !== null) { sec += a; max += 10; }
  if (p !== null) { sec += p; max += 15; }
  if (ext50 !== null) { sec += ext50; max += 50; }
  const complete = nT === 3 && a !== null && p !== null && e !== null;
  return {
    internal: internal, nT: nT, a: a, p: p, e: e,
    ap: (a !== null || p !== null) ? (a || 0) + (p || 0) : null,
    ext50: ext50, complete: complete,
    total: complete ? sec : null,
    est: max ? sec / max * 100 : null, // out of 100; missing parts assumed at the same % as the entered ones
    entered: max > 0
  };
}
function cgpaOf(S) {
  let sw = 0, sg = 0, nIncl = 0, nComplete = 0;
  S.subjects.forEach(function (s) {
    const w = Number(s.credits), wt = isFinite(w) && w > 0 ? w : 0;
    if (!wt) return;
    nIncl++;
    const r = markRow(S.marks[s.id]);
    if (r.est !== null) { sw += wt; sg += wt * r.est / 10; }
    if (r.complete) nComplete++;
  });
  const proj = sw ? sg / sw : null;
  return { projected: proj, final: (nIncl > 0 && nComplete === nIncl) ? proj : null, nIncl: nIncl, nComplete: nComplete };
}
/* Internals + assignment/project (out of 50). mode 'same': pending parts assumed at the same % as entered parts; 'zero': pending = 0. */
function cieEstimate(m, mode) {
  const r = markRow(m);
  let sec = 0, max = 0;
  if (r.nT) { sec += r.internal; max += 25; }
  if (r.a !== null) { sec += r.a; max += 10; }
  if (r.p !== null) { sec += r.p; max += 15; }
  if (mode === 'zero') return { cie: sec, known: max > 0, complete: max === 50 };
  return { cie: max ? sec / max * 50 : null, known: max > 0, complete: max === 50 };
}
const clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };
/* Target CGPA -> external marks needed (out of 100) for one subject */
function neededExternal(T, cie) { return 2 * (10 * T - cie); }
/* Target internal (out of 25): what the pending tests must average */
function neededTests(m, target) {
  const ts = [num(m && m.ia1), num(m && m.ia2), num(m && m.ia3)].filter(function (x) { return x !== null; });
  const n = ts.length, sum = ts.reduce(function (a, b) { return a + b; }, 0), pend = 3 - n;
  if (pend === 0) return { pending: 0, current: sum / 3, met: sum / 3 >= target - 1e-9 };
  return { pending: pend, need: (3 * target - sum) / pend };
}
/* Target assignment + project (out of 25) */
function neededAP(m, target) {
  const r = markRow(m);
  const got = (r.a || 0) + (r.p || 0);
  const pendMax = (r.a === null ? 10 : 0) + (r.p === null ? 15 : 0);
  const parts = [];
  if (r.a === null) parts.push('Assignment /10');
  if (r.p === null) parts.push('Project / class test / lab /15');
  if (pendMax === 0) return { pendMax: 0, got: got, met: got >= target - 1e-9 };
  return { pendMax: pendMax, got: got, need: target - got, parts: parts };
}

/* ---------- formatting ---------- */
function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function fp(n, d) { return n === null || n === undefined || !isFinite(n) ? '-' : n.toFixed(d === undefined ? 1 : d); }
function fpw(n) { return n === null || n === undefined || !isFinite(n) ? '-' : (Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1)); }
function fm(n) { if (n === null || n === undefined || !isFinite(n)) return '-'; const r = Math.round(n * 100) / 100; return String(r); }
function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }

/* ---------- report (used by CSV, PDF, preview, copy) ---------- */
function advice(r, t, unit) {
  unit = unit || 'class';
  const u = unit === 'class' ? ['class', 'classes'] : [unit, unit + 's'];
  if (r.status === 'none') return 'No classes counted yet';
  if (r.status === 'below') {
    if (!isFinite(r.need)) return 'Cannot recover to ' + t + '%';
    return 'Attend the next ' + plural(r.need, u[0], u[1]) + ' to reach ' + t + '%' + (r.lost ? ' (not reachable this semester)' : '');
  }
  if (r.skip >= 1) return 'Can skip the next ' + plural(r.skip, u[0], u[1]) + ' and stay at ' + t + '%+';
  return 'No spare classes: skipping one drops you below ' + t + '%';
}
function adviceShort(r) {
  if (r.status === 'none') return '-';
  if (r.status === 'below') return isFinite(r.need) ? 'Attend next ' + r.need : 'Cannot recover';
  return r.skip >= 1 ? 'Can skip ' + r.skip : 'None spare';
}
function buildReport(S, today) {
  const A = analyze(S, today), t = S.settings.threshold;
  const att = A.rows.map(function (r) { return { s: r.s, held: r.held, att: r.att, pct: r.pct, status: r.status, advice: advice(r, t), short: adviceShort(r) }; });
  const marks = S.subjects.map(function (s) { return { s: s, r: markRow(S.marks[s.id]), m: S.marks[s.id] || {} }; });
  const cg = cgpaOf(S);
  const log = [];
  allDays().forEach(function (k) {
    if (k > A.asOf) return;
    const e = eff(S, k), o = S.days[k];
    if (!o) return;
    if (o.type !== undefined && o.type !== e.base.type) log.push({ k: k, per: '-', sub: '-', note: 'Day changed from ' + TYPES[e.base.type].label + ' to ' + TYPES[e.type].label + (e.label ? ' (' + e.label + ')' : '') });
    if (e.kind === 'event' && !e.att) log.push({ k: k, per: 'All', sub: '-', note: 'Event day: did not attend college (' + (e.label || 'event') + ')' });
    if (e.kind === 'class') {
      dayPeriods(S, e).forEach(function (x) {
        const st = x.st; if (!st) return;
        const nm = x.subj ? subj(S, x.subj).short : '-';
        if (st.x === 'c') log.push({ k: k, per: x.p.label, sub: nm, note: 'Class cancelled (not counted)' });
        else if (st.x === 's') {
          const sb = st.sub ? subj(S, st.sub) : null;
          log.push({ k: k, per: x.p.label, sub: nm, note: 'Replaced by ' + (sb ? sb.short : 'an untracked class') + (sb ? (st.abs ? ' (absent)' : ' (attended)') : ' (not counted)') });
        } else if (st.abs && x.subj) log.push({ k: k, per: x.p.label, sub: nm, note: 'Absent' });
      });
    }
    e.extras.forEach(function (x) { const sb = subj(S, x.sub); if (sb) log.push({ k: k, per: 'Extra', sub: sb.short, note: 'Extra class (' + (x.abs ? 'absent' : 'attended') + ')' }); });
  });
  return { A: A, att: att, marks: marks, cg: cg, log: log, t: t, today: today };
}
function csvCell(v) { const s = String(v === null || v === undefined ? '' : v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function csvRow(a) { return a.map(csvCell).join(','); }
function reportCSV(S, today) {
  const R = buildReport(S, today), P = S.profile, rows = [];
  rows.push(csvRow(['Present - attendance and marks summary']));
  rows.push(csvRow(['Student', P.name])); rows.push(csvRow(['USN / roll no.', P.usn]));
  rows.push(csvRow(['Semester', P.sem])); rows.push(csvRow(['College', P.college]));
  rows.push(csvRow(['Batch', S.settings.batch])); rows.push(csvRow(['Counted until', fmtDate(R.A.asOf, true)]));
  rows.push(csvRow(['Minimum attendance', R.t + '%'])); rows.push('');
  rows.push(csvRow(['ATTENDANCE (hour-wise)']));
  rows.push(csvRow(['Subject', 'Course code', 'Faculty', 'Hours held', 'Hours attended', 'Attendance %', 'Status', 'Note']));
  R.att.forEach(function (r) { rows.push(csvRow([r.s.name, r.s.code, r.s.faculty, r.held, r.att, fp(r.pct, 2), statusLabel(r.status, R.t), r.advice])); });
  const o = R.A.overall;
  rows.push(csvRow(['Overall', '', '', o.held, o.att, fp(o.pct, 2), statusLabel(o.status, R.t), advice(o, R.t, 'hour')])); rows.push('');
  rows.push(csvRow(['MARKS']));
  rows.push(csvRow(['Subject', 'IA 1 /25', 'IA 2 /25', 'IA 3 /25', 'Internal /25', 'Assignment /10', 'Project-Test-Lab /15', 'Assign+Project /25', 'External /100', 'External /50', 'Total /100', 'Grade point', 'Weight']));
  R.marks.forEach(function (x) {
    const r = x.r, m = x.m;
    rows.push(csvRow([x.s.name, m.ia1 === undefined ? '' : m.ia1, m.ia2 === undefined ? '' : m.ia2, m.ia3 === undefined ? '' : m.ia3, r.internal === null ? '' : fm(r.internal),
      r.a === null ? '' : r.a, r.p === null ? '' : r.p, r.ap === null ? '' : fm(r.ap), r.e === null ? '' : r.e, r.ext50 === null ? '' : fm(r.ext50),
      r.total === null ? '' : fm(r.total), r.total === null ? '' : fp(r.total / 10, 2), x.s.credits]));
  });
  rows.push(csvRow([R.cg.final !== null ? 'CGPA (final)' : 'CGPA (projected, incomplete marks)', R.cg.projected === null ? '' : fp(R.cg.projected, 2)])); rows.push('');
  rows.push(csvRow(['ABSENCES AND CHANGES']));
  rows.push(csvRow(['Date', 'Period', 'Subject', 'Detail']));
  R.log.forEach(function (l) { rows.push(csvRow([l.k, l.per, l.sub, l.note])); });
  return '﻿' + rows.join('\r\n') + '\r\n';
}
function statusLabel(st, t) { return st === 'ok' ? 'On track' : st === 'edge' ? 'Little room' : st === 'below' ? 'Below ' + t + '%' : 'No classes yet'; }
function reportText(S, today) {
  const R = buildReport(S, today), P = S.profile, L = [];
  L.push('ATTENDANCE AND MARKS SUMMARY');
  if (P.name || P.usn) L.push([P.name, P.usn].filter(Boolean).join(' | '));
  L.push([P.sem, P.college, 'Batch ' + S.settings.batch].filter(Boolean).join(' | '));
  L.push('Counted until ' + fmtDate(R.A.asOf, true) + ' | minimum ' + R.t + '%'); L.push('');
  L.push('Attendance');
  R.att.forEach(function (r) { L.push('  ' + r.s.short + ': ' + r.att + '/' + r.held + ' = ' + fp(r.pct) + '% (' + statusLabel(r.status, R.t) + ')'); });
  const o = R.A.overall; L.push('  Overall: ' + o.att + '/' + o.held + ' = ' + fp(o.pct) + '%'); L.push('');
  L.push('Marks');
  R.marks.forEach(function (x) { const r = x.r; L.push('  ' + x.s.short + ': internal ' + fm(r.internal) + '/25, assign+project ' + fm(r.ap) + '/25, external ' + fm(r.ext50) + '/50, total ' + fm(r.total) + '/100'); });
  L.push('  ' + (R.cg.final !== null ? 'CGPA' : 'CGPA (projected)') + ': ' + fp(R.cg.projected, 2));
  return L.join('\n');
}

/* ---------- minimal PDF writer (A4, Helvetica) ---------- */
const HELV = { ' ': 278, '!': 278, '"': 355, '#': 556, '$': 556, '%': 889, '&': 667, "'": 191, '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278, ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556, '@': 1015, '[': 278, '\\': 278, ']': 278, '^': 469, '_': 556, '`': 333, '{': 334, '|': 260, '}': 334, '~': 584 };
'0123456789'.split('').forEach(function (c) { HELV[c] = 556; });
const UP = { A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500, K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611 };
const LO = { a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500 };
Object.assign(HELV, UP, LO);
function pdfText(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/[–—−]/g, '-').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/•/g, '-').replace(/ /g, ' ')
    .replace(/[^\x20-\x7e]/g, '?');
}
function textWidth(s, size, bold) {
  let w = 0;
  for (let i = 0; i < s.length; i++) w += (HELV[s[i]] || 556);
  return w / 1000 * size * (bold ? 1.06 : 1);
}
function fitText(s, width, size, bold) {
  s = pdfText(s);
  if (textWidth(s, size, bold) <= width) return s;
  while (s.length > 1 && textWidth(s + '...', size, bold) > width) s = s.slice(0, -1);
  return s.replace(/\s+$/, '') + '...';
}
function buildPDF(S, today) {
  const R = buildReport(S, today), P = S.profile, t = R.t;
  const W = 595.28, H = 841.89, M = 40, CW = W - 2 * M;
  const pages = []; let cur, y;
  const INK = '0.07 0.10 0.17', MUTE = '0.35 0.40 0.47', ACC = '0.14 0.26 0.77', GOOD = '0.00 0.39 0.00', BAD = '0.71 0.14 0.14', WARN = '0.48 0.32 0.00';
  function esc2(s) { return pdfText(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }
  function newPage() { cur = []; pages.push(cur); y = H - 48; }
  function text(x, yy, s, size, bold, color, align, width) {
    s = pdfText(s);
    if (align === 'r') x = x + width - textWidth(s, size, bold);
    else if (align === 'c') x = x + (width - textWidth(s, size, bold)) / 2;
    cur.push(color + ' rg BT /' + (bold ? 'F2' : 'F1') + ' ' + size + ' Tf ' + x.toFixed(2) + ' ' + yy.toFixed(2) + ' Td (' + esc2(s) + ') Tj ET');
  }
  function rect(x, yy, w, h, color) { cur.push(color + ' rg ' + x.toFixed(2) + ' ' + yy.toFixed(2) + ' ' + w.toFixed(2) + ' ' + h.toFixed(2) + ' re f'); }
  function need(h) { if (y - h < 56) newPage(); }
  function heading(s) { need(40); y -= 10; text(M, y, s, 11, true, ACC); y -= 6; rect(M, y, CW, 0.8, '0.14 0.26 0.77'); y -= 14; }
  function table(cols, rows, opt) {
    opt = opt || {};
    const RH = 17;
    function head() {
      need(RH * 2);
      rect(M, y - 4.5, CW, RH, '0.91 0.93 0.96');
      let x = M;
      cols.forEach(function (c) { text(x + 5, y, c.h, 8, true, MUTE, c.a, c.w - 10); x += c.w; });
      y -= RH;
    }
    head();
    rows.forEach(function (r, i) {
      if (y - RH < 56) { newPage(); head(); }
      if (i % 2 === 1) rect(M, y - 4.5, CW, RH, '0.97 0.975 0.985');
      let x = M;
      cols.forEach(function (c, j) {
        const cell = r.cells[j], bold = !!(r.bold || c.bold);
        const color = (c.color && c.color(r, cell)) || INK;
        text(x + 5, y, fitText(cell, c.w - 10, 8.5, bold), 8.5, bold, color, c.a, c.w - 10);
        x += c.w;
      });
      y -= RH;
    });
  }
  newPage();
  text(M, y, 'Attendance & Marks Summary', 18, true, INK); y -= 18;
  text(M, y, [P.name, P.usn].filter(Boolean).join('  |  ') || 'Student name not set', 10.5, true, INK); y -= 14;
  text(M, y, [P.sem, P.college, 'Batch ' + S.settings.batch].filter(Boolean).join('  |  '), 9, false, MUTE); y -= 12;
  text(M, y, 'Counted until ' + fmtDate(R.A.asOf, true) + '  |  Minimum attendance ' + t + '%  |  Generated ' + fmtDate(today, true), 9, false, MUTE); y -= 6;

  heading('Attendance by subject (hour-wise)');
  const sc = function (r) { return r.st === 'below' ? BAD : (r.st === 'edge' ? WARN : (r.st === 'ok' ? GOOD : MUTE)); };
  const o = R.A.overall;
  const arows = R.att.map(function (r) { return { st: r.status, cells: [r.s.short + '  ' + r.s.name, String(r.held), String(r.att), r.pct === null ? '-' : fp(r.pct) + '%', statusLabel(r.status, t), r.short] }; });
  arows.push({ st: o.status, bold: true, cells: ['Overall (all hours)', String(o.held), String(o.att), o.pct === null ? '-' : fp(o.pct) + '%', statusLabel(o.status, t), adviceShort(o)] });
  table([
    { h: 'Subject', w: 212 }, { h: 'Held', w: 34, a: 'r' }, { h: 'Attended', w: 52, a: 'r' }, { h: '%', w: 46, a: 'r', bold: true },
    { h: 'Status', w: 68, color: sc }, { h: 'Next step', w: 103 }
  ], arows);

  heading('Marks and CGPA');
  const mrows = R.marks.map(function (x) {
    const r = x.r;
    return { cells: [x.s.short + '  ' + x.s.name, fm(r.internal), fm(r.ap), fm(r.ext50), r.total === null ? (r.est === null ? '-' : '~' + fm(r.est)) : fm(r.total), r.total === null ? (r.est === null ? '-' : '~' + fp(r.est / 10, 2)) : fp(r.total / 10, 2)] };
  });
  table([
    { h: 'Subject', w: 215 }, { h: 'Internal /25', w: 60, a: 'r' }, { h: 'Assign+Proj /25', w: 75, a: 'r' },
    { h: 'External /50', w: 60, a: 'r' }, { h: 'Total /100', w: 55, a: 'r', bold: true }, { h: 'Grade pt', w: 50, a: 'r' }
  ], mrows);
  need(30); y -= 4;
  text(M, y, (R.cg.final !== null ? 'CGPA' : 'CGPA (projected; marks incomplete)') + ':  ' + fp(R.cg.projected, 2) + ' / 10', 11, true, INK); y -= 11;
  text(M, y, 'Internal = average of the internal tests entered. Total = internal + assignment/project + external/2. CGPA = total/10 averaged across subjects by weight.', 7.5, false, MUTE); y -= 6;
  if (R.cg.final === null) { text(M, y - 4, '~ = estimate: missing parts are assumed to score the same percentage as the parts entered.', 7.5, false, MUTE); y -= 10; }

  heading('Absences and changes');
  if (!R.log.length) { text(M, y, 'Nothing to list: every counted class is marked present.', 9, false, MUTE); y -= 14; }
  else table([{ h: 'Date', w: 78 }, { h: 'Period', w: 46 }, { h: 'Subject', w: 62 }, { h: 'Detail', w: 329 }],
    R.log.map(function (l) { return { cells: [fmtDate(l.k), l.per, l.sub, l.note] }; }));

  const total = pages.length;
  pages.forEach(function (pg, i) {
    cur = pg;
    text(M, 28, 'Generated by Present - attendance & marks', 7.5, false, MUTE);
    text(M, 28, 'Page ' + (i + 1) + ' of ' + total, 7.5, false, MUTE, 'r', CW);
  });
  /* assemble */
  const objs = [null];
  const kids = [];
  for (let i = 0; i < total; i++) kids.push((5 + 2 * i) + ' 0 R');
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[2] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + total + ' >>';
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  pages.forEach(function (pg, i) {
    const data = pg.join('\n');
    objs[5 + 2 * i] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + (6 + 2 * i) + ' 0 R >>';
    objs[6 + 2 * i] = '<< /Length ' + data.length + ' >>\nstream\n' + data + '\nendstream';
  });
  let out = '%PDF-1.4\n'; const off = [];
  for (let i = 1; i < objs.length; i++) { off[i] = out.length; out += i + ' 0 obj\n' + objs[i] + '\nendobj\n'; }
  const xr = out.length;
  out += 'xref\n0 ' + objs.length + '\n0000000000 65535 f \n';
  for (let i = 1; i < objs.length; i++) out += ('0000000000' + off[i]).slice(-10) + ' 00000 n \n';
  out += 'trailer\n<< /Size ' + objs.length + ' /Root 1 0 R >>\nstartxref\n' + xr + '\n%%EOF';
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
  return bytes;
}

if (typeof module !== 'undefined') module.exports = { RANGE_START, RANGE_END, COLLEGE, TYPES, CAL, DEF, defaultState, sanitizeState, eff, tally, analyze, daySummary, calendarTotals, markWholeDay, setSlotPresent, setSlotStatus, moveEvent, markRow, cgpaOf, cieEstimate, neededExternal, neededTests, neededAP, needToReach, canSkip, statusOf, buildReport, reportCSV, reportText, buildPDF, allDays, wd, keyOf, dayPeriods, getBase, addDays, dayOv, cleanDay, resolveAsOf };


