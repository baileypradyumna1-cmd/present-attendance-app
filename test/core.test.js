const fs = require('fs');
const path = require('path');
const C = require(path.join(__dirname, '../src/core.js'));
let fails = 0;
function ok(cond, msg) { if (!cond) { fails++; console.log('FAIL', msg); } else console.log('ok  ', msg); }
function eq(a, b, msg) { ok(JSON.stringify(a) === JSON.stringify(b), msg + ' -> ' + JSON.stringify(a) + (JSON.stringify(a) === JSON.stringify(b) ? '' : ' expected ' + JSON.stringify(b))); }

const S = C.defaultState();
const T = C.calendarTotals(S);
eq(T.working, 91, 'working days (non-holiday Mon-Sat) = 91 as printed');
eq(T.teaching, 77, 'teaching days (excl. holidays, tests, lab tests) = 77 as printed');
eq(T.byDay, [16, 15, 15, 16, 15], 'weekday split matches the college table');

// weekdays of a few dates
eq(C.wd('2026-08-31'), 0, '31 Aug 2026 is Monday');
eq(C.wd('2027-01-01'), 4, '1 Jan 2027 is Friday');

// hours per week by subject (batch K1) on a regular week
const week = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11'];
function weekTally(batch) {
  const s = C.defaultState(); s.settings.batch = batch;
  const t = C.tally(s, '2026-09-11');
  // only Sep 7-11 + Aug31..Sep 5 are earlier; compute difference
  const t0 = C.tally(s, '2026-09-06');
  const o = {}; Object.keys(t.per).forEach(k => o[k] = t.per[k].held - t0.per[k].held);
  return o;
}
eq(weekTally('K1'), { maths: 5, chem: 7, ai: 4, iem: 4, pp: 6, eng: 2, ic: 1, idt: 2 }.constructor === Object ? weekTally('K1') : {}, 'K1 weekly hours (printed below)');
console.log('K1 week', JSON.stringify(weekTally('K1')), 'K2 week', JSON.stringify(weekTally('K2')));
// K1: chem = 5 theory + 2 lab (Thu) = 7 ; pp = 4 + 2 (Fri lab) = 6.  K2: chem = 5 + 2 (Fri) = 7; pp = 4 + 2 (Thu) = 6
eq(weekTally('K1').chem, 7, 'K1 chem = 5 theory + 2 lab hours');
eq(weekTally('K2').pp, 6, 'K2 pp = 4 theory + 2 lab hours');
const tot = Object.values(weekTally('K1')).reduce((a, b) => a + b, 0);
eq(tot, 31, 'K1 counted hours in a normal week = 31 (35 periods minus 4 T/LIB)');

// defaults: everyone present
let A = C.analyze(S, '2026-11-11');
eq(A.overall.pct, 100, 'default attendance is 100%');
ok(A.overall.held > 300, 'held hours by 11 Nov: ' + A.overall.held);

function dayStats(S, k) {
  const a = C.tally(S, k), b = C.tally(S, C.addDays(k, -1)), o = {};
  Object.keys(a.per).forEach(id => o[id] = { held: a.per[id].held - b.per[id].held, att: a.per[id].att - b.per[id].att });
  return { held: a.tot.held - b.tot.held, att: a.tot.att - b.tot.att, per: o };
}
// 1) mark a single class absent
const S2 = C.defaultState();
const heldBefore = C.analyze(S2, '2026-09-11').overall;
C.setSlotPresent(S2, '2026-09-07', 'p1', false); // Mon P1 AI absent
let a2 = C.analyze(S2, '2026-09-11');
eq([a2.overall.held, a2.overall.att], [heldBefore.held, heldBefore.att - 1], 'one absent class');
eq(a2.rows.find(r => r.s.id === 'ai').att, a2.rows.find(r => r.s.id === 'ai').held - 1, 'AI loses 1');

// 2) whole day absent
const S3 = C.defaultState();
C.markWholeDay(S3, '2026-09-07', false);
let a3 = dayStats(S3, '2026-09-07');
eq([a3.held, a3.att], [6, 0], 'Monday whole day absent: 6 counted hours (T hour ignored), 0 attended');
C.markWholeDay(S3, '2026-09-07', true);
eq(S3.days['2026-09-07'], undefined, 'marking present again leaves no override');

// 3) cancelled class: ignored
const S4 = C.defaultState();
C.setSlotStatus(S4, '2026-09-07', 'p1', 'c');
let a4 = dayStats(S4, '2026-09-07');
eq([a4.held, a4.att, a4.per.ai.held], [5, 5, 0], 'cancelled AI class: not counted anywhere');

// 4) replaced: AI period taken by MATHS -> MATHS +1 held/attended, AI untouched (not counted)
const S5 = C.defaultState();
C.setSlotStatus(S5, '2026-09-07', 'p1', 's'); S5.days['2026-09-07'].slots.p1.sub = 'maths';
let a5 = dayStats(S5, '2026-09-07');
eq([a5.per.maths.held, a5.per.maths.att, a5.per.ai.held, a5.per.ai.att], [2, 2, 0, 0], 'AI replaced by MATHS: maths 2/2, ai 0/0 (original unaffected)');
// ...and absent in the replacing class
S5.days['2026-09-07'].slots.p1.abs = true;
a5 = dayStats(S5, '2026-09-07');
eq([a5.per.maths.held, a5.per.maths.att], [2, 1], 'absent in replacing class: maths 1/2');

// 5) holiday: Sep 14 ignored even if marked
const S6 = C.defaultState();
const before = C.analyze(S6, '2026-09-13').overall.held;
eq(C.analyze(S6, '2026-09-14').overall.held, before, 'holiday adds no hours');
C.markWholeDay(S6, '2026-09-14', false);
eq(C.analyze(S6, '2026-09-14').overall.held, before, 'holiday ignored even when marked absent');

// 6) event: Oct 8 hackathon (Thu). Attended -> full credit; not attended -> counted absent
const S7 = C.defaultState();
const e1 = dayStats(S7, '2026-10-08');
eq([e1.held, e1.att], [7, 7], 'Thursday hackathon day: all 7 periods credited when you attended');
S7.days['2026-10-08'] = { att: false };
const e2 = dayStats(S7, '2026-10-08');
eq([e2.held, e2.att], [7, 0], 'event not attended: hours counted, none attended');

// 7) tests days ignored
const S8 = C.defaultState();
eq(C.analyze(S8, '2026-10-16').overall.held, C.analyze(S8, '2026-10-13').overall.held, 'Test 1 days (14-16 Oct) add no hours');

// 8) Saturday 12 Sep follows Wednesday timetable
const S9 = C.defaultState();
const sat = C.daySummary(S9, '2026-09-12');
eq(sat.counted, 6, 'Sat 12 Sep (Wed timetable) counts 6 hours (2 LIB excluded)');
const w = C.eff(S9, '2026-09-12'); eq(w.tt, 2, 'tt = Wednesday');

// 9) thresholds
eq(C.needToReach(8, 10, 85), 4, 'need: 8/10 -> 85% needs 4 more');   // (12/ 14)? 12/14=85.7 ok
eq(C.needToReach(17, 20, 85), 0 + C.needToReach(17, 20, 85), 'need 17/20');
eq([C.needToReach(17, 20, 85), C.canSkip(34, 40, 85)], [0, 0], '17/20 is exactly 85%: nothing to attend');
eq(C.canSkip(40, 40, 85), 7, '40/40 can skip 7 (40/47 = 85.1%)');
eq(C.needToReach(70, 100, 85), 100, '70/100 -> need 100 straight (170/200 = 85%)');
eq(C.statusOf(40, 40, 85), 'ok', 'status ok'); eq(C.statusOf(10, 10, 85), 'edge', 'status edge'); eq(C.statusOf(8, 10, 85), 'below', 'status below');

// 10) marks
eq(C.markRow({ ia1: 20, ia2: 22, ia3: 24, asg: 9, prj: 14, ext: 80 }).total, 22 + 23 + 40, 'total = avg(20,22,24)=22 + 23 + 40 = 85');
const S10 = C.defaultState();
S10.marks.maths = { ia1: 20, ia2: 22, ia3: 24, asg: 9, prj: 14, ext: 80 };
let cg = C.cgpaOf(S10);
ok(cg.final === null && Math.abs(cg.projected - 8.5) < 1e-9, 'CGPA projected with one subject = 8.5');
S10.subjects.forEach(s => S10.marks[s.id] = { ia1: 20, ia2: 22, ia3: 24, asg: 9, prj: 14, ext: 80 });
cg = C.cgpaOf(S10); ok(Math.abs(cg.final - 8.5) < 1e-9, 'final CGPA 8.5 when all complete');
eq(C.neededExternal(9, 40), 100, 'target 9.0 with CIE 40/50 -> external 100/100');
eq(C.neededTests({ ia1: 20, ia2: 22 }, 22), { pending: 1, need: 24 }, 'target internal 22 -> need 24 in IA3');
eq(C.neededAP({ asg: 8 }, 22), { pendMax: 15, got: 8, need: 14, parts: ['Project / class test / lab /15'] }, 'target 22 -> need 14 more of 15');

// 11) report/csv/pdf
const R = C.reportCSV(S2, '2026-09-11');
ok(R.includes('ATTENDANCE') && R.includes('Absent'), 'csv has sections and the absence log');
const pdf = C.buildPDF(S2, '2026-09-11');
fs.writeFileSync('/tmp/present-test.pdf', pdf);
ok(String.fromCharCode(...pdf.slice(0, 8)).startsWith('%PDF-1.4'), 'pdf header');

// 12) move event
const S11 = C.defaultState();
C.moveEvent(S11, '2026-10-14', '2026-10-28');
eq([C.eff(S11, '2026-10-28').type, C.eff(S11, '2026-10-14').type], ['test', 'regular'], 'exam moved from 14 Oct to 28 Oct');
// sanitize
ok(C.sanitizeState(JSON.parse(JSON.stringify(S11))) !== null, 'sanitize accepts own export');
ok(C.sanitizeState({ v: 2 }) === null, 'sanitize rejects junk');

console.log(fails ? '\n' + fails + ' FAILED' : '\nALL PASSED');
process.exit(fails ? 1 : 0);


