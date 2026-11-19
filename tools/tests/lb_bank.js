/* lb_bank: حادثة 18 نوفمبر — جهاز بيحسب المؤشر قبل ما بنك الأسئلة يتحمّل فبيبعت 2 و400 للوحة (طالبة عندها 1267 سؤال).
   بيعيد الحادثة بمتصفح حقيقي: البنك بيتحمّل ببطء (أكتر من 8 ثواني، وهو موعد الإرسال التلقائي بعد فتح الصفحة).
   الاستخدام (الأربع سيرفرات لازم تكون شغّالة، شوف الأسطر اللي تحت):
     OLD_SITE=http://127.0.0.1:8773/index.html NEW_SITE=http://127.0.0.1:8772/index.html OLD_BOARD=http://127.0.0.1:8782/exec NEW_BOARD=http://127.0.0.1:8781/exec node tools/tests/lb_bank.js
   (OLD = نسخة 24 الحية بكودها القديم، NEW = نسخة التصحيح). */
const { chromium } = require('playwright');
const OLD_SITE = process.env.OLD_SITE || 'http://127.0.0.1:8773/index.html', NEW_SITE = process.env.NEW_SITE || 'http://127.0.0.1:8772/index.html';
const OLD_BOARD = process.env.OLD_BOARD || 'http://127.0.0.1:8782/exec', NEW_BOARD = process.env.NEW_BOARD || 'http://127.0.0.1:8781/exec';
const RUN = ' ' + Math.floor(100 + Math.random() * 900);          /* الأسماء مبتتكررش في اللوحة، فكل تشغيل باسماء جديدة */
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const errs = [];
const jget = async (u) => (await fetch(u)).json();
const rowOf = async (board, serial) => (await jget(board.replace('/exec', '/__rows')))[+serial.slice(4)];       /* [serial, token, dev, name, tier, idx, xp, n, joined, upd, status, att] */

async function ctxFor(b, site, board, storage, delayMs) {
  const ctx = await b.newContext({ viewport: { width: 1100, height: 900 }, serviceWorkers: 'block', storageState: storage });
  await ctx.route('**/js/board-config.js', r => r.fulfill({ contentType: 'application/javascript', body: "window.IM.BOARD_URL='" + board + "';" }));
  if (delayMs) await ctx.route('**/subjects/anatomy/anatomy.content.js', r => setTimeout(() => r.continue().catch(() => {}), delayMs));      /* أول ملف في البنك بيتأخر: بنك بطيء */
  await ctx.addInitScript(() => { try { localStorage.setItem('im_seen', JSON.stringify({ 'tour-v1': 1, 'ann-honor-1': 1, 'ann-honor-ready': 1 })); } catch (e) {} });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  p.posts = []; p.on('request', q => { if (q.url().startsWith(board) && q.method() === 'POST') { try { p.posts.push(JSON.parse(q.postData() || '{}')); } catch (e) { p.posts.push({}); } } });
  return { ctx, p };
}

/* طالب عنده 150 إجابة صح، مشترك في اللوحة، والصف في اللوحة سليم */
async function setup(b, site, board, name) {
  const { ctx, p } = await ctxFor(b, site, board, undefined, 0);
  await p.goto(site); await p.waitForFunction(() => window.IM && IM.bank && IM.bank.ready, { timeout: 90000 }); await p.waitForTimeout(500);
  await p.evaluate(() => { IM.bank.order.filter(id => IM.bank.q[id].elig && !IM.isPartial(IM.bank.q[id].sid)).slice(0, 150).forEach(id => { const Q = IM.bank.q[id]; IM.record(Q, Q.keys[0], 5000); }); IM.flush(); });
  const J = await p.evaluate((n) => IM.boardJoin(n).then(r => ({ ok: 1, serial: r.serial }), e => ({ ok: 0, e: String(e.message) })), name);
  const L = await p.evaluate(() => { const l = IM.level(); return { idx: l.idx, xp: l.xp, n: Object.keys(IM.st.ans).length }; });
  await p.waitForTimeout(400);
  const storage = await ctx.storageState(); await ctx.close();
  await fetch(board.replace('/exec', '/__advance?ms=120000'));          /* ساعة الشيت الوهمية: عدّى وقت أكتر من MIN_GAP */
  return { J, L, storage };
}

async function slowLoad(b, site, board, storage, waitMs) {
  const { ctx, p } = await ctxFor(b, site, board, storage, 11000);          /* أول ملف في البنك (التشريح) بيتأخر 11 ثانية */
  await p.goto(site, { waitUntil: 'commit' }); await p.waitForTimeout(waitMs || 10000);
  const readyAt10 = await p.evaluate(() => !!(IM.bank && IM.bank.ready));
  await p.waitForFunction(() => window.IM && IM.bank && IM.bank.ready, { timeout: 120000 });
  await p.waitForTimeout(11000);          /* موعد الإرسال التلقائي بعد جهوزية البنك */
  const afterLevel = await p.evaluate(() => { const l = IM.level(); return { idx: l.idx, xp: l.xp }; });
  const posts = p.posts.slice(); await ctx.close(); return { readyAt10, posts, afterLevel };
}

(async () => {
  const b = await chromium.launch();
  const ups = (r) => r.posts.filter(x => x.a === 'up');

  /* ---------- أ) الكود القديم كله: الحادثة بتتكرر ---------- */
  console.log('\n== A) OLD client + OLD server (the incident) ==');
  const A = await setup(b, OLD_SITE, OLD_BOARD, 'طالب أ'+RUN);
  ok(A.J.ok && A.L.idx >= 5 && A.L.xp >= 1000 && A.L.n === 150, 'setup: healthy student on the board (idx ' + A.L.idx + ', xp ' + A.L.xp + ', n ' + A.L.n + ')');
  const A1 = await slowLoad(b, OLD_SITE, OLD_BOARD, A.storage);
  const rA = await rowOf(OLD_BOARD, A.J.serial);
  ok(!A1.readyAt10 && ups(A1).length >= 1, 'old client: the bank was NOT ready after 10 s and the client sent an update anyway');
  ok(+rA[6] < A.L.xp * 0.5 && +rA[7] === 150, 'old client + old server: the incident reproduces. XP collapsed (' + A.L.xp + ' -> ' + rA[6] + ', idx ' + A.L.idx + ' -> ' + rA[5] + ') while the answer count stayed ' + rA[7]);

  /* ---------- ب) كلاينت قديم + سيرفر جديد ---------- */
  console.log('\n== B) OLD client + NEW server (cached old pages keep working, the server protects the row) ==');
  const B = await setup(b, OLD_SITE, NEW_BOARD, 'طالب ب'+RUN);
  const B1 = await slowLoad(b, OLD_SITE, NEW_BOARD, B.storage);
  const rB = await rowOf(NEW_BOARD, B.J.serial);
  ok(ups(B1).length >= 1, 'old client still tries to send the collapsed numbers');
  ok(+rB[5] === B.L.idx && +rB[6] === B.L.xp, 'new server refused them: the row is unchanged (idx ' + rB[5] + ', xp ' + rB[6] + ')');

  /* ---------- ج) كلاينت جديد + سيرفر جديد ---------- */
  console.log('\n== C) NEW client + NEW server ==');
  const C = await setup(b, NEW_SITE, NEW_BOARD, 'طالب ج'+RUN);
  const C1 = await slowLoad(b, NEW_SITE, NEW_BOARD, C.storage);
  const rC = await rowOf(NEW_BOARD, C.J.serial);
  ok(!C1.readyAt10, '(the bank really was still loading after 10 s)');
  ok(ups(C1).length === 0, 'new client: NOTHING was sent while the bank was loading, and nothing after (numbers unchanged)');
  ok(+rC[5] === C.L.idx && +rC[6] === C.L.xp, 'the row is unchanged (idx ' + rC[5] + ', xp ' + rC[6] + ')');
  ok(C1.afterLevel.idx === C.L.idx && C1.afterLevel.xp === C.L.xp, 'once the bank is ready the client computes the same healthy numbers');

  /* ---------- د) إصلاح صف مكسور ---------- */
  console.log('\n== D) a row already broken (2 / 400) heals when the student opens the new site ==');
  const D = await setup(b, NEW_SITE, NEW_BOARD, 'طالب د'+RUN);
  await fetch(NEW_BOARD.replace('/exec', '/__set?row=' + (+D.J.serial.slice(4) + 1) + '&col=6&v=2')); await fetch(NEW_BOARD.replace('/exec', '/__set?row=' + (+D.J.serial.slice(4) + 1) + '&col=7&v=400'));
  const { ctx: cD, p: pD } = await ctxFor(b, NEW_SITE, NEW_BOARD, D.storage, 0);
  await pD.evaluate(() => 0).catch(() => {});
  await pD.goto(NEW_SITE); await pD.waitForFunction(() => window.IM && IM.bank && IM.bank.ready, { timeout: 90000 });
  await pD.evaluate(() => { try { const B = JSON.parse(localStorage.getItem('im_board') || '{}'); B.sent = { idx: 2, xp: 400, n: 150, tier: 0 }; localStorage.setItem('im_board', JSON.stringify(B)); } catch (e) {} });
  await pD.reload(); await pD.waitForFunction(() => window.IM && IM.bank && IM.bank.ready, { timeout: 90000 }); await pD.waitForTimeout(11000);
  const rD = await rowOf(NEW_BOARD, D.J.serial);
  ok(+rD[5] === D.L.idx && +rD[6] === D.L.xp, 'the broken row (2/400) was repaired to idx ' + rD[5] + ' / xp ' + rD[6] + ' by itself');
  await cD.close();

  /* ---------- هـ) الشغل العادي بعد جهوزية البنك ---------- */
  console.log('\n== E) normal studying still reaches the board ==');
  const E = await setup(b, NEW_SITE, NEW_BOARD, 'طالب هـ'+RUN);
  const { ctx: cE, p: pE } = await ctxFor(b, NEW_SITE, NEW_BOARD, E.storage, 0);
  await pE.goto(NEW_SITE); await pE.waitForFunction(() => window.IM && IM.bank && IM.bank.ready, { timeout: 90000 }); await pE.waitForTimeout(800);
  await pE.evaluate(() => { IM.bank.order.filter(id => IM.bank.q[id].elig && !IM.isPartial(IM.bank.q[id].sid) && !IM.st.ans[id]).slice(0, 12).forEach(id => { const Q = IM.bank.q[id]; IM.record(Q, Q.keys[0], 5000); }); });
  await pE.waitForTimeout(9000);
  const rE = await rowOf(NEW_BOARD, E.J.serial);
  ok(+rE[7] === 162 && +rE[6] > E.L.xp, 'after 12 more answers the board shows n 162 and a higher XP (' + E.L.xp + ' -> ' + rE[6] + ')');
  await cE.close();

  console.log('\nerrors', errs.length ? errs.slice(0, 5) : 'none');
  await b.close(); console.log(fails ? 'FAILS ' + fails : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
