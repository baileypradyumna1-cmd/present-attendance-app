'use strict';
/* =====================================================================
   Present: UI, part 2 (marks, targets, timetable editor, export, events, boot)
   ===================================================================== */

/* ---------- marks ---------- */
const MARK_COLS = [['ia1', 'IA 1', 25], ['ia2', 'IA 2', 25], ['ia3', 'IA 3', 25], ['asg', 'Assignment', 10], ['prj', 'Project / test / lab', 15], ['ext', 'External', 100]];
function viewMarks() {
  let h = '<div class="stack"><section class="stats marks-stats" aria-label="CGPA summary"><div class="stat big"><span data-out="cgpa-label">CGPA</span><b data-out="cgpa">-</b></div>' +
    '<div class="stat"><span>Subjects with all marks in</span><b data-out="complete">-</b></div><div class="stat"><span>Average internal (of 25)</span><b data-out="avgint">-</b></div></section>';
  h += '<section class="card pad"><div class="sec-head"><h2>Marks</h2><span class="muted small">Leave a box empty until you have the mark</span></div>';
  h += '<div class="tbl-wrap"><table class="tbl marks"><thead><tr><th rowspan="2" class="l">Subject</th><th colspan="3" class="grp">Internal tests</th><th colspan="2" class="grp">Assignments and projects</th><th class="grp">External</th><th colspan="5" class="grp res">Result</th></tr><tr>';
  MARK_COLS.forEach(function (c) { h += '<th class="r">' + c[1] + '<small>/' + c[2] + '</small></th>'; });
  h += '<th class="r res">Internal<small>/25</small></th><th class="r res">Asg + proj<small>/25</small></th><th class="r res">External<small>/50</small></th><th class="r res">Total<small>/100</small></th><th class="r res">Grade pt<small>/10</small></th></tr></thead><tbody>';
  S.subjects.forEach(function (s) {
    const m = S.marks[s.id] || {};
    h += '<tr><th scope="row" class="l"><span class="subj-cell">' + dot(s) + '<span><b>' + esc(s.short) + '</b><small>' + esc(s.name) + '</small></span></span></th>';
    MARK_COLS.forEach(function (c) {
      h += '<td class="r"><input class="mk-in" type="number" inputmode="decimal" min="0" max="' + c[2] + '" step="any" data-act="m-in" data-sid="' + esc(s.id) + '" data-f="' + c[0] + '" value="' + (m[c[0]] === undefined ? '' : esc(m[c[0]])) + '" aria-label="' + esc(s.short + ' ' + c[1] + ' out of ' + c[2]) + '"></td>';
    });
    ['internal', 'ap', 'ext50', 'total', 'gp'].forEach(function (k) { h += '<td class="r res out" data-out="' + esc(s.id) + ':' + k + '">-</td>'; });
    h += '</tr>';
  });
  h += '</tbody></table></div>';
  h += '<div class="formula"><p><b>How it is calculated.</b> Internal = average of the three internal tests (each out of 25). Assignment is out of 10 and the project, class test or lab is out of 15. The external exam is out of 100 and is halved to 50. Total = internal + assignment and project + external/2, out of 100. Grade point = total / 10, and CGPA is the average of the grade points across your subjects.</p>' +
    '<p class="muted small">Subjects count equally by default. Change a subject\'s CGPA weight in the Timetable tab (a weight of 0 leaves it out). While marks are missing, the grade point is an estimate that assumes the missing parts score the same percentage as the parts you have entered, and it is shown with a ~.</p></div></section></div>';
  return h;
}
function setOut(key, html) { const el = document.querySelector('[data-out="' + key + '"]'); if (el) el.innerHTML = html; }
function refreshMarks() {
  let sumInt = 0, nInt = 0;
  S.subjects.forEach(function (s) {
    const r = markRow(S.marks[s.id]);
    setOut(s.id + ':internal', r.internal === null ? '-' : fm(r.internal) + (r.nT < 3 ? '<sup title="Average of the tests entered so far">' + r.nT + '/3</sup>' : ''));
    if (r.internal !== null) { sumInt += r.internal; nInt++; }
    setOut(s.id + ':ap', r.ap === null ? '-' : fm(r.ap));
    setOut(s.id + ':ext50', r.ext50 === null ? '-' : fm(r.ext50));
    setOut(s.id + ':total', r.total !== null ? '<b>' + fm(r.total) + '</b>' : (r.est === null ? '-' : '<span title="Estimate: missing parts assumed at the same percentage as the parts entered">~' + fm(r.est) + '</span>'));
    setOut(s.id + ':gp', r.total !== null ? '<b>' + fp(r.total / 10, 2) + '</b>' : (r.est === null ? '-' : '<span title="Estimate">~' + fp(r.est / 10, 2) + '</span>'));
  });
  const cg = cgpaOf(S);
  setOut('cgpa', cg.projected === null ? '-' : fp(cg.projected, 2) + '<small> / 10</small>');
  setOut('cgpa-label', cg.final !== null ? 'Final CGPA' : (cg.projected === null ? 'CGPA' : 'Projected CGPA (some marks missing)'));
  setOut('complete', cg.nComplete + ' of ' + cg.nIncl);
  setOut('avgint', nInt ? fm(sumInt / nInt) : '-');
}

/* ---------- targets ---------- */
function pill(kind, text) { return '<span class="badge ' + kind + '">' + ic(kind === 'ok' ? 'check' : (kind === 'none' ? 'minus' : 'alert')) + esc(text) + '</span>'; }
function viewTargets() {
  const T = S.targets;
  let h = '<div class="stack">';
  h += '<section class="card pad"><div class="sec-head"><h2>Target CGPA</h2><span class="muted small">Works out what you still need, using the marks you have entered</span></div>' +
    '<div class="tg-controls"><div class="fld"><label for="tg-cgpa">Target CGPA</label><input id="tg-cgpa" class="in" type="number" min="0" max="10" step="0.1" value="' + esc(T.cgpa) + '" data-act="t-in" data-f="cgpa"></div>' +
    '<div class="fld"><label for="tg-mode">Work out</label><select id="tg-mode" class="in" data-act="t-sel" data-f="mode" data-fid="tg-mode">' + opt('ext', 'External marks I need', T.mode === 'ext') + opt('cie', 'Internal and assignment marks I need', T.mode === 'cie') + '</select></div>' +
    (T.mode === 'cie' ? '<div class="fld"><label for="tg-exp">Expected external (out of 100)</label><input id="tg-exp" class="in" type="number" min="0" max="100" step="1" value="' + esc(T.exp) + '" data-act="t-in" data-f="exp"></div>' : '') +
    '<div class="fld"><label for="tg-pend">Marks not yet entered count as</label><select id="tg-pend" class="in" data-act="t-sel" data-f="pend" data-fid="tg-pend">' + opt('same', 'Same percentage as the marks I have', T.pend === 'same') + opt('zero', 'Zero (worst case)', T.pend === 'zero') + '</select></div></div>' +
    '<div id="tg-a" aria-live="polite"></div></section>';
  h += '<section class="card pad"><div class="sec-head"><h2>Target internal marks</h2><span class="muted small">Internal is the average of three tests, out of 25</span></div>' +
    '<div class="tg-controls"><div class="fld"><label for="tg-int">Target internal (out of 25)</label><input id="tg-int" class="in" type="number" min="0" max="25" step="0.5" value="' + esc(T.intT) + '" data-act="t-in" data-f="intT"></div></div><div id="tg-b" aria-live="polite"></div></section>';
  h += '<section class="card pad"><div class="sec-head"><h2>Target assignment and project marks</h2><span class="muted small">Assignment /10 plus project, class test or lab /15</span></div>' +
    '<div class="tg-controls"><div class="fld"><label for="tg-ap">Target (out of 25)</label><input id="tg-ap" class="in" type="number" min="0" max="25" step="0.5" value="' + esc(T.apT) + '" data-act="t-in" data-f="apT"></div></div><div id="tg-c" aria-live="polite"></div></section>';
  return h + '</div>';
}
function renderTargets() {
  const T = S.targets;
  /* A: target CGPA */
  const tg = clamp(parseFloat(T.cgpa) || 0, 0, 10);
  let rows = '', sw = 0, sc = 0, anyKnown = false;
  S.subjects.forEach(function (s) {
    const w = Number(s.credits); if (!(w > 0)) return;
    const c = cieEstimate(S.marks[s.id], T.pend);
    if (!c.known) { rows += '<tr><th scope="row" class="l">' + dot(s) + esc(s.short) + '</th><td class="r">-</td><td class="r">-</td><td>' + pill('none', 'Enter some marks first') + '</td></tr>'; return; }
    anyKnown = true; sw += w; sc += w * c.cie;
    let verdict, val;
    if (T.mode === 'ext') {
      const need = neededExternal(tg, c.cie); val = need <= 0 ? '0' : fm(need) + ' / 100';
      verdict = need <= 0 ? pill('ok', 'Already secured') : (need <= 100 ? pill(need > 85 ? 'edge' : 'ok', 'Score ' + fm(need) + ' of 100 in the external') : pill('below', 'Out of reach: best grade point is ' + fp((c.cie + 50) / 10, 2)));
    } else {
      const need = 10 * tg - (parseFloat(T.exp) || 0) / 2; val = need <= 0 ? '0' : fm(need) + ' / 50';
      verdict = need <= 0 ? pill('ok', 'Any internal score works') : (need <= 50 ? pill(need > c.cie ? 'edge' : 'ok', (need > c.cie ? 'Need ' + fm(need - c.cie) + ' more than now' : 'Already on track')) : pill('below', 'Not possible with that external score'));
    }
    rows += '<tr><th scope="row" class="l">' + dot(s) + esc(s.short) + '</th><td class="r">' + fm(c.cie) + ' / 50' + (c.complete ? '' : '<sup title="Some internal parts are not entered yet">est</sup>') + '</td><td class="r">' + val + '</td><td>' + verdict + '</td></tr>';
  });
  let a = '';
  if (!anyKnown) a = '<p class="muted">Enter your internal test and assignment marks in the Marks tab and this table fills in.</p>';
  else {
    const avg = sc / sw;
    const best = (avg + 50) / 10;
    let sum;
    if (T.mode === 'ext') {
      const need = neededExternal(tg, avg);
      sum = need <= 0 ? 'Your internals alone already give a CGPA of ' + fp(avg / 10 * 2, 2) + ' or better, so the target is covered.' :
        (need <= 100 ? 'Across all subjects you need an average of <b>' + fm(need) + ' out of 100</b> in the externals to finish on ' + fp(tg, 1) + '.' : 'A CGPA of ' + fp(tg, 1) + ' is out of reach with your current internals. The best you can reach is <b>' + fp(best, 2) + '</b>.');
    } else {
      const need = 10 * tg - (parseFloat(T.exp) || 0) / 2;
      sum = need <= 0 ? 'With that external score you reach the target whatever your internals are.' : (need <= 50 ? 'To finish on ' + fp(tg, 1) + ' with ' + fm(parseFloat(T.exp) || 0) + '/100 in the externals you need <b>' + fm(need) + ' out of 50</b> in internals plus assignments and projects in every subject.' : 'That external score cannot reach ' + fp(tg, 1) + ' even with full internals.');
    }
    a = '<p class="tg-sum">' + sum + '</p><div class="tbl-wrap"><table class="tbl"><thead><tr><th class="l">Subject</th><th class="r">Internal + assignment so far</th><th class="r">' + (T.mode === 'ext' ? 'External needed' : 'Internal + assignment needed') + '</th><th>Verdict</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="muted small">To land on ' + fp(tg, 1) + ' in a subject, its total must reach ' + fm(tg * 10) + ' out of 100. Total = internal + assignment + external / 2.</p>';
  }
  $('#tg-a').innerHTML = a;
  /* B: target internal */
  const ti = clamp(parseFloat(T.intT) || 0, 0, 25);
  let b = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th class="l">Subject</th><th class="r">IA 1</th><th class="r">IA 2</th><th class="r">IA 3</th><th>What you need</th></tr></thead><tbody>';
  S.subjects.forEach(function (s) {
    const m = S.marks[s.id] || {}, r = neededTests(m, ti); let v;
    if (r.pending === 0) v = pill(r.met ? 'ok' : 'below', 'Final internal ' + fm(r.current) + ' / 25: ' + (r.met ? 'target met' : 'below target'));
    else if (r.need <= 0) v = pill('ok', 'Already secured, any score works');
    else if (r.need > 25) v = pill('below', 'Out of reach: would need ' + fm(r.need) + ' in each pending test, the maximum is 25');
    else v = pill(r.need > 21 ? 'edge' : 'ok', 'Score ' + fm(r.need) + ' / 25' + (r.pending > 1 ? ' on average in the ' + r.pending + ' tests still to come' : ' in the remaining test'));
    b += '<tr><th scope="row" class="l">' + dot(s) + esc(s.short) + '</th>' + ['ia1', 'ia2', 'ia3'].map(function (f) { return '<td class="r">' + (num(m[f]) === null ? '-' : fm(m[f])) + '</td>'; }).join('') + '<td>' + v + '</td></tr>';
  });
  $('#tg-b').innerHTML = b + '</tbody></table></div>';
  /* C: target assignment + project */
  const ta = clamp(parseFloat(T.apT) || 0, 0, 25);
  let c = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th class="l">Subject</th><th class="r">Assignment</th><th class="r">Project / test / lab</th><th>What you need</th></tr></thead><tbody>';
  S.subjects.forEach(function (s) {
    const m = S.marks[s.id] || {}, r = neededAP(m, ta); let v;
    if (r.pendMax === 0) v = pill(r.met ? 'ok' : 'below', 'Final ' + fm(r.got) + ' / 25: ' + (r.met ? 'target met' : 'below target'));
    else if (r.need <= 0) v = pill('ok', 'Already secured');
    else if (r.need > r.pendMax) v = pill('below', 'Out of reach: ' + fm(r.need) + ' needed, only ' + r.pendMax + ' left to earn');
    else v = pill(r.need > r.pendMax * 0.85 ? 'edge' : 'ok', 'Earn ' + fm(r.need) + ' of the ' + r.pendMax + ' still open (' + r.parts.join(' + ') + ')');
    c += '<tr><th scope="row" class="l">' + dot(s) + esc(s.short) + '</th><td class="r">' + (num(m.asg) === null ? '-' : fm(m.asg)) + '</td><td class="r">' + (num(m.prj) === null ? '-' : fm(m.prj)) + '</td><td>' + v + '</td></tr>';
  });
  $('#tg-c').innerHTML = c + '</tbody></table></div>';
}

/* ---------- timetable editor ---------- */
function viewTimetable() {
  let h = '<div class="stack">';
  h += '<section class="card pad"><div class="sec-head"><h2>Subjects</h2><span class="muted small">Rename, reorder, add or remove. Changes apply to the whole semester.</span></div><div id="subj-ed">' + subjEditor() + '</div>' +
    '<div class="row-end"><button class="btn" data-act="s-add">' + ic('plus') + 'Add subject</button></div></section>';
  h += '<section class="card pad"><div class="sec-head"><h2>Weekly timetable</h2><span class="muted small">Each box is one class hour that repeats every week</span></div><div id="tt-ed">' + ttEditor() + '</div>' +
    '<div class="row-end"><button class="btn" data-act="p-add">' + ic('plus') + 'Add period</button></div>' +
    '<p class="muted small">Choose "Batch lab" for a slot where each batch attends a different subject. Choose "Not counted" for tutorial, library or free hours. Saturdays follow whichever weekday the calendar names; set that on the day itself.</p></section>';
  h += '<section class="card pad"><div class="sec-head"><h2>Batches</h2><span class="muted small">Your batch decides which lab you attend</span></div><div class="tg-controls"><div class="fld"><label for="batches">Batch names, separated by commas</label><input id="batches" class="in" type="text" value="' + esc(S.settings.batches.join(', ')) + '" data-act="batches"></div>' +
    '<div class="fld"><label for="batch-sel2">Your batch</label><select id="batch-sel2" class="in" data-act="batch" data-fid="batch-sel2">' + S.settings.batches.map(function (b) { return opt(b, b, b === S.settings.batch); }).join('') + '</select></div></div>' +
    '<div class="row-end"><button class="btn danger-o" data-act="tt-reset">' + ic('undo') + 'Restore the college timetable and subjects</button></div></section></div>';
  return h;
}
function subjEditor() {
  let h = '';
  S.subjects.forEach(function (s, i) {
    h += '<div class="sub-row" data-sid="' + esc(s.id) + '"><div class="sub-ord"><button class="btn sm ghost" data-act="s-up" aria-label="Move ' + esc(s.short) + ' up"' + (i === 0 ? ' disabled' : '') + '>' + ic('up') + '</button><button class="btn sm ghost" data-act="s-down" aria-label="Move ' + esc(s.short) + ' down"' + (i === S.subjects.length - 1 ? ' disabled' : '') + '>' + ic('down') + '</button></div>' +
      '<div class="sub-fields"><label class="fld sh">Short name<input class="in" type="text" maxlength="12" value="' + esc(s.short) + '" data-act="s-f" data-f="short"></label>' +
      '<label class="fld nm">Subject name<input class="in" type="text" maxlength="120" value="' + esc(s.name) + '" data-act="s-f" data-f="name"></label>' +
      '<label class="fld cd">Course code<input class="in" type="text" maxlength="40" value="' + esc(s.code) + '" data-act="s-f" data-f="code"></label>' +
      '<label class="fld fc">Faculty<input class="in" type="text" maxlength="60" value="' + esc(s.faculty) + '" data-act="s-f" data-f="faculty"></label>' +
      '<label class="fld wt">CGPA weight<input class="in" type="number" min="0" max="20" step="0.5" value="' + esc(s.credits) + '" data-act="s-f" data-f="credits"></label></div>' +
      '<button class="btn sm ghost del" data-act="s-del" aria-label="Remove ' + esc(s.short) + '">' + ic('trash') + '</button></div>';
  });
  return h;
}
function ttCell(day, p) {
  const slot = S.tt[day][p.id], kind = slot ? slot.k : 'n';
  const v = kind === 's' ? 's:' + slot.s : (kind === 'b' ? 'b' : 'n');
  let h = '<td><select class="in sm" data-act="tt-kind" data-day="' + day + '" data-pid="' + p.id + '" aria-label="' + WDL[day] + ' period ' + esc(p.label) + '">' + opt('n', 'Not counted', v === 'n') +
    S.subjects.map(function (s) { return opt('s:' + s.id, s.short, v === 's:' + s.id); }).join('') + opt('b', 'Batch lab', v === 'b') + '</select>';
  if (kind === 'b') h += S.settings.batches.map(function (b) { return '<label class="bt"><span>' + esc(b) + '</span><select class="in sm" data-act="tt-batch" data-day="' + day + '" data-pid="' + p.id + '" data-b="' + esc(b) + '" aria-label="' + esc(b) + ' lab subject">' + subjOptions(slot.m && slot.m[b], 'None') + '</select></label>'; }).join('');
  else if (kind === 'n') h += '<input class="in sm" type="text" maxlength="12" placeholder="T, LIB..." value="' + esc(slot && slot.l || '') + '" data-act="tt-label" data-day="' + day + '" data-pid="' + p.id + '" aria-label="Label for the free hour">';
  return h + '</td>';
}
function ttEditor() {
  let h = '<div class="tt-scroll"><table class="tt"><thead><tr><th class="l">Day</th>';
  S.periods.forEach(function (p, i) {
    h += '<th><div class="p-head"><div class="p-btns"><button class="btn xs ghost" data-act="p-left" data-i="' + i + '" aria-label="Move period earlier"' + (i === 0 ? ' disabled' : '') + '>' + ic('left') + '</button><button class="btn xs ghost" data-act="p-right" data-i="' + i + '" aria-label="Move period later"' + (i === S.periods.length - 1 ? ' disabled' : '') + '>' + ic('right') + '</button><button class="btn xs ghost" data-act="p-del" data-i="' + i + '" aria-label="Remove period">' + ic('trash') + '</button></div>' +
      '<input class="in xs" type="text" maxlength="4" value="' + esc(p.label) + '" data-act="p-f" data-i="' + i + '" data-f="label" aria-label="Period name">' +
      '<input class="in xs" type="text" maxlength="20" value="' + esc(p.time) + '" data-act="p-f" data-i="' + i + '" data-f="time" aria-label="Period time">' +
      '<input class="in xs" type="text" maxlength="30" placeholder="Break after" value="' + esc(p.brk || '') + '" data-act="p-f" data-i="' + i + '" data-f="brk" aria-label="Break after this period"></div></th>';
  });
  h += '</tr></thead><tbody>';
  [0, 1, 2, 3, 4].forEach(function (d) {
    h += '<tr><th scope="row" class="l">' + WDL[d] + '</th>';
    S.periods.forEach(function (p) { h += ttCell(d, p); });
    h += '</tr>';
  });
  return h + '</tbody></table></div>';
}
function refreshTT() { const el = $('#tt-ed'); if (el) el.innerHTML = ttEditor(); }

/* ---------- export ---------- */
function reportHTML(R) {
  const P = S.profile, o = R.A.overall, t = R.t;
  let h = '<article class="paper"><header><h3>Attendance &amp; marks summary</h3><p class="who"><b>' + esc(P.name || 'Student name not set') + '</b>' + (P.usn ? ' · ' + esc(P.usn) : '') + '</p><p class="meta">' + [P.sem, P.college, 'Batch ' + S.settings.batch].filter(Boolean).map(esc).join(' · ') + '<br>Counted until ' + esc(fmtDate(R.A.asOf, true)) + ' · Minimum attendance ' + t + '%</p></header>';
  h += '<h4>Attendance by subject (hour-wise)</h4><table><thead><tr><th>Subject</th><th class="r">Held</th><th class="r">Attended</th><th class="r">%</th><th>Status</th><th>Next step</th></tr></thead><tbody>';
  R.att.forEach(function (r) { h += '<tr><td><b>' + esc(r.s.short) + '</b> ' + esc(r.s.name) + '</td><td class="r">' + r.held + '</td><td class="r">' + r.att + '</td><td class="r"><b>' + (r.pct === null ? '-' : fp(r.pct)) + '</b></td><td class="st-' + r.status + '">' + esc(statusLabel(r.status, t)) + '</td><td>' + esc(r.advice) + '</td></tr>'; });
  h += '<tr class="tot"><td>Overall</td><td class="r">' + o.held + '</td><td class="r">' + o.att + '</td><td class="r">' + (o.pct === null ? '-' : fp(o.pct)) + '</td><td class="st-' + o.status + '">' + esc(statusLabel(o.status, t)) + '</td><td>' + esc(advice(o, t, 'hour')) + '</td></tr></tbody></table>';
  h += '<h4>Marks</h4><table><thead><tr><th>Subject</th><th class="r">Internal /25</th><th class="r">Assign + project /25</th><th class="r">External /50</th><th class="r">Total /100</th><th class="r">Grade point</th></tr></thead><tbody>';
  R.marks.forEach(function (x) { const r = x.r; h += '<tr><td><b>' + esc(x.s.short) + '</b> ' + esc(x.s.name) + '</td><td class="r">' + fm(r.internal) + '</td><td class="r">' + fm(r.ap) + '</td><td class="r">' + fm(r.ext50) + '</td><td class="r"><b>' + (r.total === null ? (r.est === null ? '-' : '~' + fm(r.est)) : fm(r.total)) + '</b></td><td class="r">' + (r.total === null ? (r.est === null ? '-' : '~' + fp(r.est / 10, 2)) : fp(r.total / 10, 2)) + '</td></tr>'; });
  h += '</tbody></table><p class="cg"><b>' + (R.cg.final !== null ? 'CGPA' : 'CGPA (projected)') + ': ' + fp(R.cg.projected, 2) + ' / 10</b></p>';
  h += '<h4>Absences and changes</h4>';
  if (!R.log.length) h += '<p class="muted">Nothing to list: every counted class is marked present.</p>';
  else {
    h += '<table><thead><tr><th>Date</th><th>Period</th><th>Subject</th><th>Detail</th></tr></thead><tbody>';
    R.log.slice(0, 25).forEach(function (l) { h += '<tr><td>' + esc(fmtDate(l.k)) + '</td><td>' + esc(l.per) + '</td><td>' + esc(l.sub) + '</td><td>' + esc(l.note) + '</td></tr>'; });
    h += '</tbody></table>' + (R.log.length > 25 ? '<p class="muted">' + (R.log.length - 25) + ' more rows are in the downloaded files.</p>' : '');
  }
  return h + '</article>';
}
function viewExport() {
  const P = S.profile, fld = function (id, f, label, ph) { return '<div class="fld"><label for="' + id + '">' + label + '</label><input id="' + id + '" class="in" type="text" maxlength="80" value="' + esc(P[f]) + '" placeholder="' + esc(ph) + '" data-act="prof" data-f="' + f + '"></div>'; };
  let h = '<div class="stack"><section class="card pad"><div class="sec-head"><h2>Semester export</h2><span class="muted small">A clean summary for review or submission</span></div>' +
    '<div class="tg-controls">' + fld('pf-name', 'name', 'Student name', 'Your name') + fld('pf-usn', 'usn', 'USN or roll number', 'Optional') + fld('pf-sem', 'sem', 'Semester', 'Odd semester, 2026-27') + fld('pf-col', 'college', 'College', 'Optional') + '</div>' +
    '<p class="muted small">The summary counts classes ' + (S.settings.asOf === 'end' ? 'to the end of the semester' : 'until ' + esc(fmtDate(resolveAsOf(S, TODAY), true))) + ' (change this on the Dashboard) with a ' + S.settings.threshold + '% minimum.</p>' +
    '<div class="exp-btns"><button class="btn primary" data-act="exp-pdf">' + ic('down2') + 'Download PDF</button><button class="btn" data-act="exp-csv">' + ic('down2') + 'Download CSV (Excel)</button><button class="btn" data-act="exp-copy">' + ic('copy') + 'Copy summary</button></div></section>';
  h += '<section class="card pad"><div class="sec-head"><h2>Preview</h2><span class="muted small">What the PDF contains</span></div><div id="preview" class="paper-wrap">' + reportHTML(buildReport(S, TODAY)) + '</div></section>';
  h += '<section class="card pad"><div class="sec-head"><h2>Backup and reset</h2><span class="muted small">Your data lives in this browser only</span></div><p class="muted small">Download a backup to move your attendance, marks and timetable to another device or browser, then restore it there.</p>' +
    '<div class="exp-btns"><button class="btn" data-act="exp-json">' + ic('down2') + 'Download backup</button><label class="btn file-btn" for="imp-file">' + ic('up2') + 'Restore backup<input id="imp-file" type="file" accept=".json,application/json" data-act="imp"></label><button class="btn danger-o" data-act="reset-all">' + ic('trash') + 'Reset everything</button></div></section></div>';
  return h;
}
function refreshPreview() { const el = $('#preview'); if (el) el.innerHTML = reportHTML(buildReport(S, TODAY)); }
async function saveFile(name, data, mime) {
  let dl = null;
  try { if (window.claude && typeof window.claude.use === 'function') dl = await window.claude.use('downloads'); } catch (e) { dl = null; }
  if (dl) {
    try { await dl.save({ filename: name, data: data }); toast('Saved ' + name); }
    catch (e) { if (e && e.code === 'declined') return; toast('This view could not save the file. Try Copy summary instead.'); }
    return;
  }
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: mime })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    toast('Downloading ' + name);
  } catch (e) { toast('Downloads are blocked here. Use Copy summary instead.'); }
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('Summary copied'); return; } catch (e) { /* fall through */ }
  try {
    const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-999px;top:0;opacity:0';
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove();
    toast(ok ? 'Summary copied' : 'Copying is blocked in this view');
  } catch (e2) { toast('Copying is blocked in this view'); }
}
function fileStamp() { return TODAY; }

/* ---------- views, render ---------- */
const VIEWS = { dashboard: viewDashboard, attendance: viewAttendance, calendar: viewCalendar, marks: viewMarks, targets: viewTargets, timetable: viewTimetable, export: viewExport };
const AFTER = { marks: refreshMarks, targets: renderTargets };
function renderView() {
  const v = $('#view'), ae = document.activeElement, fid = ae && ae.dataset ? ae.dataset.fid : null;
  v.innerHTML = VIEWS[UI.tab]();
  if (AFTER[UI.tab]) AFTER[UI.tab]();
  if (UI.scrollTo) { const el = document.getElementById(UI.scrollTo); UI.scrollTo = null; if (el) el.scrollIntoView({ block: 'start' }); }
  else if (fid) { const el = v.querySelector('[data-fid="' + (window.CSS && CSS.escape ? CSS.escape(fid) : fid) + '"]'); if (el) el.focus(); }
  syncHeader();
}
function commit() { saveSoon(); renderView(); }
function setTab(t, fromHash) {
  if (!VIEWS[t]) t = 'dashboard';
  UI.tab = t;
  if (t === 'attendance' && !UI.attGroup) UI.attGroup = groupOf(focusDay());
  renderView();
  if (!fromHash) { try { if (location.hash !== '#' + t) history.replaceState(null, '', '#' + t); } catch (e) { /* ignore */ } window.scrollTo(0, 0); }
}
function dayKey(el) { const d = el.closest('.de'); return d ? d.dataset.date : null; }

/* ---------- event handlers ---------- */
const H = {};
H.tab = { click: function (el) { setTab(el.dataset.tab); } };
H.theme = { click: function () { const t = effectiveTheme() === 'dark' ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', t); S.settings.theme = t; saveSoon(); syncHeader(); } };
H.batch = { change: function (el) { S.settings.batch = el.value; commit(); } };
H.thr = { input: function (el) { const v = parseFloat(el.value); if (isFinite(v) && v >= 1 && v <= 100) { S.settings.threshold = v; saveSoon(); renderView(); } } };
H['modal-ok'] = { click: function () { closeModal(true); } };
H['modal-cancel'] = { click: function () { closeModal(false); } };
/* dashboard */
H.asof = { change: function (el) { const a = S.settings.asOf; S.settings.asOf = el.value === 'custom' ? ((a && a !== 'today' && a !== 'end') ? a : clampKey(TODAY)) : el.value; commit(); } };
H['asof-date'] = { change: function (el) { if (el.value) { S.settings.asOf = clampKey(el.value); commit(); } } };
/* attendance + calendar */
H['att-group'] = { click: function (el) { UI.attGroup = el.dataset.g; UI.openDay = ''; renderView(); } };
H['toggle-day'] = { click: function (el) { const k = el.dataset.date; UI.openDay = UI.openDay === k ? '' : k; renderView(); } };
H['goto-day'] = { click: function (el) { const k = el.dataset.date; UI.openDay = k; UI.attGroup = groupOf(k); UI.scrollTo = 'day-' + k; setTab('attendance'); } };
/* day editor */
H['d-type'] = { change: function (el) { const k = dayKey(el), o = dayOv(S, k); if (el.value === getBase(k).type) delete o.type; else o.type = el.value; delete o.code; cleanDay(S, k); commit(); } };
H['d-label'] = { input: function (el) { const k = dayKey(el); dayOv(S, k).label = el.value; saveSoon(); const dl = document.querySelector('#day-' + k + ' .dl'); if (dl) dl.textContent = el.value || TYPES[eff(S, k).type].label; } };
H['d-tt'] = { change: function (el) { const k = dayKey(el), o = dayOv(S, k); if (el.value === '') delete o.tt; else if (el.value === 'none') o.tt = null; else o.tt = +el.value; cleanDay(S, k); commit(); } };
H['d-reset'] = { click: function (el) { const k = dayKey(el), o = dayOv(S, k); delete o.type; delete o.label; delete o.tt; delete o.code; cleanDay(S, k); commit(); } };
H['d-allabs'] = { click: function (el) { markWholeDay(S, dayKey(el), false); commit(); } };
H['d-allpres'] = { click: function (el) { markWholeDay(S, dayKey(el), true); commit(); } };
H['d-slot-att'] = { change: function (el) { setSlotPresent(S, dayKey(el), el.dataset.pid, el.checked); commit(); } };
H['d-slot-x'] = { change: function (el) { setSlotStatus(S, dayKey(el), el.dataset.pid, el.value); commit(); } };
H['d-slot-sub'] = { change: function (el) { const k = dayKey(el); slotOv(S, k, el.dataset.pid).sub = el.value; commit(); } };
H['d-event-att'] = { change: function (el) { markWholeDay(S, dayKey(el), el.checked); commit(); } };
H['d-extra-add'] = { click: function (el) { const k = dayKey(el), sel = document.getElementById('xs-' + k); if (!sel || !sel.value) { toast('Choose the subject of the extra class first'); return; } const o = dayOv(S, k); (o.extras = o.extras || []).push({ sub: sel.value, abs: false }); commit(); } };
H['d-extra-att'] = { change: function (el) { const k = dayKey(el), x = eff(S, k).extras[+el.dataset.i]; if (x) x.abs = !el.checked; commit(); } };
H['d-extra-del'] = { click: function (el) { const k = dayKey(el), o = dayOv(S, k); if (o.extras) o.extras.splice(+el.dataset.i, 1); cleanDay(S, k); commit(); } };
H['d-move'] = { click: function (el) {
  const k = dayKey(el), inp = document.getElementById('mv-' + k), dst = inp && inp.value;
  if (!dst || !inRange(dst)) { toast('Pick a date between ' + fmtDate(RANGE_START, true) + ' and ' + fmtDate(RANGE_END, true)); return; }
  if (dst === k) { toast('Pick a different date'); return; }
  moveEvent(S, k, dst); UI.openDay = dst; UI.attGroup = groupOf(dst); toast('Moved to ' + fmtDate(dst, true)); commit();
} };
/* marks + targets */
H['m-in'] = {
  input: function (el) {
    const m = S.marks[el.dataset.sid] = S.marks[el.dataset.sid] || {}, f = el.dataset.f, max = +el.max;
    if (el.value === '') { delete m[f]; el.classList.remove('bad'); }
    else { const x = parseFloat(el.value); if (!isFinite(x)) return; el.classList.toggle('bad', x > max || x < 0); m[f] = clamp(x, 0, max); }
    saveSoon(); refreshMarks();
  },
  change: function (el) { const x = parseFloat(el.value), max = +el.max; if (isFinite(x)) { if (x > max) el.value = max; if (x < 0) el.value = 0; } el.classList.remove('bad'); }
};
H['t-in'] = { input: function (el) { S.targets[el.dataset.f] = el.value; saveSoon(); renderTargets(); } };
H['t-sel'] = { change: function (el) { S.targets[el.dataset.f] = el.value; commit(); } };
/* timetable editor */
H['s-f'] = { input: function (el) {
  const id = el.closest('.sub-row').dataset.sid, s = subj(S, id), f = el.dataset.f; if (!s) return;
  if (f === 'credits') { const v = parseFloat(el.value); s.credits = isFinite(v) && v >= 0 ? v : 1; } else s[f] = el.value;
  saveSoon(); refreshTT();
} };
function moveItem(arr, i, d) { const j = i + d; if (j < 0 || j >= arr.length) return; const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
H['s-up'] = { click: function (el) { const id = el.closest('.sub-row').dataset.sid; moveItem(S.subjects, S.subjects.findIndex(function (s) { return s.id === id; }), -1); commit(); } };
H['s-down'] = { click: function (el) { const id = el.closest('.sub-row').dataset.sid; moveItem(S.subjects, S.subjects.findIndex(function (s) { return s.id === id; }), 1); commit(); } };
H['s-add'] = { click: function () {
  const id = 's' + Date.now().toString(36);
  S.subjects.push({ id: id, short: 'NEW', code: '', name: 'New subject', faculty: '', credits: 1, color: S.subjects.length % 8 });
  commit(); const rows = $$('.sub-row'); const last = rows[rows.length - 1]; if (last) { const inp = $('input', last); if (inp) { inp.focus(); inp.select(); } }
} };
H['s-del'] = { click: function (el) {
  const id = el.closest('.sub-row').dataset.sid, s = subj(S, id); if (!s) return;
  confirmBox({ title: 'Remove ' + s.short + '?', body: 'Its timetable slots become empty and its marks are deleted. Attendance you recorded for it disappears from the totals. This cannot be undone.', ok: 'Remove subject', danger: true }).then(function (yes) {
    if (!yes) return;
    S.subjects = S.subjects.filter(function (x) { return x.id !== id; }); delete S.marks[id]; commit();
  });
} };
H['tt-kind'] = { change: function (el) {
  const d = +el.dataset.day, pid = el.dataset.pid, v = el.value, old = S.tt[d][pid];
  if (v === 'n') S.tt[d][pid] = { k: 'n', l: old && old.l || '' };
  else if (v === 'b') S.tt[d][pid] = { k: 'b', m: {} };
  else S.tt[d][pid] = { k: 's', s: v.slice(2) };
  saveSoon(); refreshTT();
} };
H['tt-batch'] = { change: function (el) { const slot = S.tt[+el.dataset.day][el.dataset.pid]; if (slot && slot.k === 'b') { slot.m = slot.m || {}; if (el.value) slot.m[el.dataset.b] = el.value; else delete slot.m[el.dataset.b]; } saveSoon(); } };
H['tt-label'] = { input: function (el) { const slot = S.tt[+el.dataset.day][el.dataset.pid]; if (slot && slot.k === 'n') slot.l = el.value; saveSoon(); } };
H['p-f'] = { input: function (el) { const p = S.periods[+el.dataset.i]; if (p) p[el.dataset.f] = el.value; saveSoon(); } };
H['p-left'] = { click: function (el) { moveItem(S.periods, +el.dataset.i, -1); saveSoon(); refreshTT(); } };
H['p-right'] = { click: function (el) { moveItem(S.periods, +el.dataset.i, 1); saveSoon(); refreshTT(); } };
H['p-add'] = { click: function () {
  const id = 'p' + Date.now().toString(36);
  S.periods.push({ id: id, label: String(S.periods.length + 1), time: '', brk: '' });
  [0, 1, 2, 3, 4].forEach(function (d) { S.tt[d][id] = { k: 'n', l: '' }; });
  saveSoon(); refreshTT();
} };
H['p-del'] = { click: function (el) {
  const i = +el.dataset.i, p = S.periods[i]; if (!p) return;
  if (S.periods.length <= 1) { toast('Keep at least one period'); return; }
  confirmBox({ title: 'Remove period ' + p.label + '?', body: 'Its slot is removed from every weekday. Attendance already marked in that period stops counting.', ok: 'Remove period', danger: true }).then(function (yes) {
    if (!yes) return;
    S.periods.splice(i, 1); [0, 1, 2, 3, 4].forEach(function (d) { delete S.tt[d][p.id]; }); saveSoon(); refreshTT();
  });
} };
H.batches = { change: function (el) {
  const seen = {}, list = el.value.split(',').map(function (x) { return x.trim(); }).filter(function (x) { if (!x || seen[x]) return false; seen[x] = 1; return true; }).slice(0, 8);
  if (!list.length) { toast('Keep at least one batch'); el.value = S.settings.batches.join(', '); return; }
  S.settings.batches = list; if (list.indexOf(S.settings.batch) < 0) S.settings.batch = list[0]; commit();
} };
H['tt-reset'] = { click: function () {
  confirmBox({ title: 'Restore the college timetable?', body: 'Subjects, periods, the weekly timetable and batch names go back to the defaults. Your attendance marks and entered marks are kept.', ok: 'Restore', danger: true }).then(function (yes) {
    if (!yes) return;
    const d = defaultState(); S.subjects = d.subjects; S.periods = d.periods; S.tt = d.tt; S.settings.batches = d.settings.batches;
    if (S.settings.batches.indexOf(S.settings.batch) < 0) S.settings.batch = S.settings.batches[0]; commit(); toast('College timetable restored');
  });
} };
/* export */
H.prof = { input: function (el) { S.profile[el.dataset.f] = el.value; saveSoon(); refreshPreview(); } };
H['exp-pdf'] = { click: function () { saveFile('present-summary-' + fileStamp() + '.pdf', buildPDF(S, TODAY), 'application/pdf'); } };
H['exp-csv'] = { click: function () { saveFile('present-summary-' + fileStamp() + '.csv', reportCSV(S, TODAY), 'text/csv'); } };
H['exp-copy'] = { click: function () { copyText(reportText(S, TODAY)); } };
H['exp-json'] = { click: function () { saveFile('present-backup-' + fileStamp() + '.json', JSON.stringify(S, null, 1), 'application/json'); } };
H.imp = { change: function (el) {
  const f = el.files && el.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = function () {
    let s = null; try { s = sanitizeState(JSON.parse(rd.result)); } catch (e) { s = null; }
    el.value = '';
    if (!s) { toast('That file is not a Present backup'); return; }
    confirmBox({ title: 'Restore this backup?', body: 'It replaces everything currently in the app on this device.', ok: 'Restore', danger: true }).then(function (yes) {
      if (!yes) return;
      S = s; if (S.settings.theme) document.documentElement.setAttribute('data-theme', S.settings.theme); saveNow(); UI.openDay = null; UI.attGroup = null; renderView(); toast('Backup restored');
    });
  };
  rd.readAsText(f);
} };
H['reset-all'] = { click: function () {
  confirmBox({ title: 'Reset everything?', body: 'This clears all attendance marks, entered marks, calendar edits and timetable changes on this device, and restores the college defaults. Download a backup first if you might want them back.', ok: 'Reset everything', danger: true }).then(function (yes) {
    if (!yes) return;
    const th = S.settings.theme; S = defaultState(); S.settings.theme = th; UI.openDay = null; UI.attGroup = null; saveNow(); renderView(); toast('Reset to the college defaults');
  });
} };

function dispatch(e, type) {
  const el = e.target.closest ? e.target.closest('[data-act]') : null;
  if (!el) return;
  const h = H[el.dataset.act];
  if (h && h[type]) h[type](el, e);
}
['click', 'change', 'input'].forEach(function (t) { document.addEventListener(t, function (e) { dispatch(e, t); }); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(false); });
window.addEventListener('hashchange', function () { const t = location.hash.slice(1); if (t && t !== UI.tab && VIEWS[t]) setTab(t, true); });

/* ---------- boot ---------- */
(function boot() {
  try { localStorage.setItem('present.probe', '1'); localStorage.removeItem('present.probe'); } catch (e) { storageOK = false; }
  if (S.settings.theme === 'dark' || S.settings.theme === 'light') document.documentElement.setAttribute('data-theme', S.settings.theme);
  const h0 = (location.hash || '').slice(1);
  if (VIEWS[h0]) UI.tab = h0;
  if (UI.tab === 'attendance') UI.attGroup = groupOf(focusDay());
  renderView();
})();


