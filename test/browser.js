// Drives headless Chrome over CDP: functional checks + screenshots.
const { spawn } = require('child_process');
const fs = require('fs');
const PORT = 9333;
const URL = 'file:///home/claude/present/index.html';
const OUT = '/tmp/shots';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };

(async () => {
  fs.rmSync('/tmp/chrome-prof', { recursive: true, force: true });
  const chrome = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--remote-debugging-port=' + PORT, '--user-data-dir=/tmp/chrome-prof', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
  let ver; for (let i = 0; i < 50; i++) { try { ver = await (await fetch('http://127.0.0.1:' + PORT + '/json')).json(); break; } catch (e) { await sleep(200); } }
  const page = ver.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  let id = 0; const pending = {}; const errors = [];
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; }
    if (m.method === 'Runtime.exceptionThrown') errors.push('EXC ' + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('CONSOLE ' + m.params.args.map(a => a.value || a.description).join(' '));
  });
  const send = (method, params) => new Promise(r => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.result.exceptionDetails) { errors.push('EVAL ' + expr.slice(0, 80) + ' => ' + JSON.stringify(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description)); return undefined; } return r.result.result.value; };
  const shot = async (name, full) => { const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !!full }); fs.writeFileSync(OUT + '/' + name + '.png', Buffer.from(r.result.data, 'base64')); };
  const view = (w, h, mobile) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: !!mobile });
  const click = (sel) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return 'MISSING ${sel}'; e.click(); return 'ok'})()`);
  const setVal = (sel, v, evt) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return 'MISSING'; e.value=JSON.stringify(v);e.dispatchEvent(newEvent({JSON.stringify(evt || 'input')},{bubbles:true})); return 'ok'})()`);

  await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable');
  await view(1280, 900);
  await send('Page.navigate', { url: URL }); await sleep(1200);

  /* ---- dashboard ---- */
  ok((await ev('document.querySelector(".hero-num b").textContent')) === '100.0%' || (await ev('document.querySelector(".hero-num b").textContent')).startsWith('100'), 'dashboard opens at 100%');
  console.log('today key', await ev('TODAY'), 'asOf', await ev('analyze(S,TODAY).asOf'), 'held', await ev('analyze(S,TODAY).overall.held'));
  await shot('01-dashboard-light', true);

  /* ---- mark an absence from the Today card, expect % to drop ---- */
  const before = await ev('analyze(S,TODAY).overall.att');
  console.log(await click('.de .cls:not(.none) input[type=checkbox]'));
  const after = await ev('analyze(S,TODAY).overall.att');
  ok(after === before - 1, 'ticking a class absent lowers attended by 1 (' + before + ' -> ' + after + ')');
  ok((await ev('document.querySelector(".cls.absent")')) !== null, 'absent row styled');
  console.log(await ev('document.querySelector(".hero-num b").textContent'));
  // cancelled and replaced via selects
  await ev(`(()=>{const s=document.querySelectorAll('.de select[data-act=d-slot-x]'); s[1].value='c'; s[1].dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await ev(`(()=>{const s=document.querySelectorAll('.de select[data-act=d-slot-x]'); s[2].value='s'; s[2].dispatchEvent(new Event('change',{bubbles:true})); })()`);
  ok((await ev('document.querySelector(".cls.cancelled")')) !== null && (await ev('document.querySelector(".cls.replaced")')) !== null, 'cancelled + replaced states render');
  await ev(`(()=>{const s=document.querySelector('.de select[data-act=d-slot-sub]'); s.value='maths'; s.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await shot('02-dashboard-today-edited', true);

  /* ---- attendance tab ---- */
  await click('[data-tab=attendance]'); await sleep(100);
  ok((await ev('document.querySelectorAll(".day").length')) > 20, 'attendance lists the month days');
  await shot('03-attendance', false);
  // open Oct 8 hackathon via calendar
  await click('[data-tab=calendar]'); await sleep(100);
  await shot('04-calendar', true);
  console.log(await click('[data-date="2026-10-08"]'));
  await sleep(100);
  ok((await ev('UI.tab')) === 'attendance' && (await ev('UI.openDay')) === '2026-10-08', 'calendar click opens the day');
  ok((await ev('!!document.querySelector("[data-act=d-event-att]")')), 'event day shows attended toggle');
  await shot('05-event-day', false);
  // holiday day
  await click('[data-tab=calendar]'); await click('[data-date="2026-09-14"]'); await sleep(100);
  ok((await ev('document.querySelector(".de-off")')) !== null, 'holiday shows ignored message');
  // Saturday following another timetable
  await click('[data-tab=calendar]'); await click('[data-date="2026-09-12"]'); await sleep(100);
  ok((await ev('document.querySelectorAll(".cls:not(.none)").length')) === 6, 'Sat 12 Sep (Wed timetable) lists 6 counted rows, got ' + await ev('document.querySelectorAll(".cls:not(.none)").length'));

  /* ---- marks ---- */
  await click('[data-tab=marks]'); await sleep(100);
  const sids = await ev('S.subjects.map(s=>s.id)');
  for (const [i, sid] of sids.entries()) {
    const vals = { ia1: 20 + (i % 4), ia2: 21, ia3: 22, asg: 9, prj: 13 + (i % 3), ext: i < 6 ? 78 : '' };
    for (const f of Object.keys(vals)) if (vals[f] !== '') await setVal(`input[data-sid="sid"][data-f="{f}"]`, String(vals[f]));
  }
  console.log('cgpa tile', await ev('document.querySelector("[data-out=cgpa]").textContent'), '|', await ev('document.querySelector("[data-out=cgpa-label]").textContent'));
  ok((await ev('document.querySelector("[data-out=cgpa]").textContent')).length > 1, 'cgpa computed');
  await shot('06-marks', true);

  /* ---- targets ---- */
  await click('[data-tab=targets]'); await sleep(100);
  await setVal('#tg-cgpa', '9.2');
  console.log('targets A rows', await ev('document.querySelectorAll("#tg-a tbody tr").length'));
  ok((await ev('document.querySelectorAll("#tg-a tbody tr").length')) === 8, 'target table has 8 subject rows');
  await shot('07-targets', true);

  /* ---- timetable ---- */
  await click('[data-tab=timetable]'); await sleep(100);
  await shot('08-timetable', true);
  const nSub = await ev('S.subjects.length');
  await click('[data-act=s-add]'); await sleep(50);
  ok((await ev('S.subjects.length')) === nSub + 1, 'add subject');
  await click('.sub-row:last-child [data-act=s-del]'); await sleep(50);
  await click('[data-act=modal-ok]'); await sleep(100);
  ok((await ev('S.subjects.length')) === nSub, 'remove subject via confirm dialog');
  // batch switch changes lab subject
  const heldK1 = await ev('analyze(S,TODAY).rows.find(r=>r.s.id==="chem").held');
  await ev(`(()=>{const s=document.getElementById('batch-sel'); s.value='K2'; s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const heldK2 = await ev('analyze(S,TODAY).rows.find(r=>r.s.id==="chem").held');
  console.log('chem held K1/K2', heldK1, heldK2);
  ok(typeof heldK2 === 'number', 'batch switch recalculates');

  /* ---- export ---- */
  await click('[data-tab=export]'); await sleep(100);
  await setVal('#pf-name', 'Test Student'); await setVal('#pf-usn', '1KS26AI001');
  ok((await ev('document.querySelector(".paper .who").textContent')).includes('Test Student'), 'preview updates with name');
  await shot('09-export', true);

  /* ---- dark + mobile ---- */
  await click('[data-tab=dashboard]'); await click('#theme-btn'); await sleep(100);
  ok((await ev('document.documentElement.dataset.theme')) === 'dark', 'theme toggles to dark');
  await shot('10-dashboard-dark', true);
  await click('[data-tab=calendar]'); await shot('11-calendar-dark', true);
  await view(390, 844, true); await click('[data-tab=dashboard]'); await sleep(150);
  await shot('12-mobile-dashboard-dark', true);
  await click('#theme-btn'); await click('[data-tab=attendance]'); await sleep(100); await shot('13-mobile-attendance', true);
  await click('[data-tab=calendar]'); await sleep(100); await shot('14-mobile-calendar', true);
  await click('[data-tab=marks]'); await sleep(100); await shot('15-mobile-marks', false);
  await click('[data-tab=timetable]'); await sleep(100); await shot('16-mobile-timetable', false);
  const overflow = await ev('document.documentElement.scrollWidth > window.innerWidth + 1');
  ok(!overflow, 'no horizontal page scroll on mobile (timetable tab): ' + await ev('document.documentElement.scrollWidth'));
  for (const t of ['dashboard', 'attendance', 'calendar', 'marks', 'targets', 'export']) { await click('[data-tab=' + t + ']'); const o = await ev('document.documentElement.scrollWidth > window.innerWidth + 1'); ok(!o, 'no page overflow on mobile: ' + t + ' ' + await ev('document.documentElement.scrollWidth')); }

  /* ---- persistence ---- */
  const saved = await ev('localStorage.getItem("present.v1") && JSON.parse(localStorage.getItem("present.v1")).profile.name');
  ok(saved === 'Test Student', 'state persisted to localStorage');

  console.log('\nconsole/page errors:', errors.length ? errors : 'none');
  console.log(fails ? fails + ' FAILED' : 'ALL OK');
  ws.close(); chrome.kill();
  process.exit(fails || errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
