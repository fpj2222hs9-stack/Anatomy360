/* index3 (v31): الانتظام 5 نقاط بس، التقييم الأسبوعي من الأسئلة المحلولة قبل كده بس، علامة الإشعار بالفتح الفعلي، ومسح التحديثات والنتايج بس
   الاستخدام: node tools/tests/index3.js   (محتاج servers.sh: 8770 الموقع؛ بيشغّل محاكي اللوحة بتاعه على 8785)  | SITE=... لتجربة الزيب أو الملف الواحد */
const { chromium } = require('playwright');
const fs = require('fs');
const { spawn } = require('child_process');
const SITE = process.env.SITE || 'http://127.0.0.1:8770/index.html', BPORT = 8785, BOARD = 'http://127.0.0.1:' + BPORT + '/exec', BOARD_ROOT = 'http://127.0.0.1:' + BPORT;   /* محاكي لوحة خاص بالاختبار ده عشان ما يلوّثش 8780 */
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const errs = [];
const OLD_W = { mastery: 50, accuracy: 20, consistency: 15, improvement: 10, achievements: 5 };
const NEW_W = { mastery: 55, accuracy: 25, consistency: 5, improvement: 10, achievements: 5 };

async function mk(b, o) {
  o = o || {};
  const ctx = await b.newContext({ viewport: o.vp || { width: 1100, height: 900 }, colorScheme: o.dark ? 'dark' : 'light' });
  if (o.board) await ctx.route('**/js/board-config.js', r => r.fulfill({ contentType: 'application/javascript', body: "window.IM.BOARD_URL='" + BOARD + "';" }));
  await ctx.addInitScript((o) => { try { localStorage.setItem('im_lang','ar');
    if (sessionStorage.getItem('__i3')) return; sessionStorage.setItem('__i3', '1');
    localStorage.clear(); localStorage.setItem('im_lang','ar');
    localStorage.setItem('im_seen', JSON.stringify({ 'tour-v1': 1, 'ann-honor-1': 1, 'ann-honor-ready': 1, 'ann-fix-1120': 1 }));
    localStorage.setItem('im_user', JSON.stringify({ name: o.name || 'طالب', v: 1, created: Date.parse('2026-09-01') }));
  } catch (e) {} }, o);
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|Failed to load resource|googletagmanager|fonts\.g/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
  await p.goto(SITE); await p.waitForFunction(() => window.IM && IM.bank && IM.bank.ready, { timeout: 90000 }); await p.waitForTimeout(500);
  return { ctx, p };
}
/* طالب تجريبي: n إجابة (نسبة الصح من أول مرة fo) + أيام شروق lit في آخر أيام */
const SEED = `(n, fo, lit, skip) => {
  let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const ids = IM.bank.order.filter(id => IM.bank.q[id].elig && !IM.isPartial(IM.bank.q[id].sid) && (!skip || skip.indexOf(id) < 0));
  const wrongOf = Q => { const o = Q.opts.find(o => Q.keys.indexOf(o.o) < 0); return o ? o.o : Q.keys[0]; };
  IM.st.ans = {}; IM.st.wrong = {}; IM.st.days = {}; IM.st.seals = {}; IM.st.carto.trials = {};
  const pick = ids.slice().sort(() => r() - .5).slice(0, n); const keep = (typeof window.__keep !== 'undefined') ? window.__keep : [];
  keep.concat(pick).forEach(id => { const Q = IM.bank.q[id]; IM.record(Q, r() < fo ? Q.keys[0] : wrongOf(Q), 8000); });
  const d = IM.dayKey(); for (let i = 0; i < lit; i++) IM.st.days[IM.addDays(d, -i)] = { n: 60, ok: 54, ms: 1e5 };
  IM.levelReset(); return Object.keys(IM.st.ans).length;
}`;

(async () => {
  const b = await chromium.launch();

  /* ---------- 1) المؤشر: الانتظام 5 نقاط ---------- */
  let { ctx, p } = await mk(b);
  const w = await p.evaluate(() => Object.assign({}, IM.LEVEL_WEIGHTS));
  ok(JSON.stringify(w) === JSON.stringify(NEW_W), 'weights are mastery 55 · accuracy 25 · consistency 5 · improvement 10 · achievements 5 ' + JSON.stringify(w));
  ok(Object.values(w).reduce((a, x) => a + x, 0) === 100, 'weights sum to 100');

  const streakOnly = await p.evaluate((SEED) => { eval('(' + SEED + ')')(0, 1, 30); const L = IM.level(); return { cons: L.pts.consistency, idx: L.idx, raw: L.raw, lit30: L.lit30 }; }, SEED);
  ok(streakOnly.lit30 === 30 && Math.abs(streakOnly.cons - 5) < 1e-9 && streakOnly.idx === 5, 'a perfect 30-day streak with no learning is worth exactly 5 points (idx ' + streakOnly.idx + ', was 15)');

  const cmp = await p.evaluate(({ SEED, OLD_W, NEW_W }) => {
    const out = [];
    [[150, .86, 14], [800, .90, 26], [2000, .92, 28], [1500, .90, 8], [3000, .95, 0], [600, .80, 30]].forEach(([n, fo, lit]) => {
      eval('(' + SEED + ')')(n, fo, lit);
      Object.assign(IM.LEVEL_WEIGHTS, OLD_W); IM.levelReset(); const o = IM.level(); const raw0 = o.raw, idx0 = o.idx;
      Object.assign(IM.LEVEL_WEIGHTS, NEW_W); IM.levelReset(); const L = IM.level(); const P = L.parts;
      const expect = raw0 + 5 * P.mastery + 5 * P.accuracy - 10 * P.consistency;
      out.push({ n, lit, idx0, idx1: L.idx, raw0, raw1: L.raw, expect, d: Math.abs(expect - L.raw) });
    });
    return out;
  }, { SEED, OLD_W, NEW_W });
  cmp.forEach(c => console.log('  · ' + c.n + ' answers / ' + c.lit + ' lit days: index ' + c.idx0 + ' → ' + c.idx1 + ' (raw ' + c.raw0.toFixed(1) + ' → ' + c.raw1.toFixed(1) + ')'));
  ok(cmp.every(c => c.d < 1e-9), 'only the weights changed: new = old + 5·mastery + 5·accuracy − 10·consistency, for 6 student profiles');
  ok(cmp[4].idx1 > cmp[4].idx0 && cmp[3].idx1 > cmp[3].idx0, 'heavy learners with a weak streak go UP (3000 answers / 0 days, 1500 / 8 days)');
  ok(cmp[1].idx0 - cmp[1].idx1 <= 5 && cmp[2].idx0 - cmp[2].idx1 <= 5, 'regular students drop by at most 5 points');

  /* صفحة الخرطوشة بتعرض الأوزان الجديدة */
  await p.evaluate((SEED) => { eval('(' + SEED + ')')(800, .9, 20); }, SEED);
  await p.evaluate(() => IM.go('#/cartouche')); await p.waitForSelector('.cp-bd .cp-b', { timeout: 8000 }); await p.waitForTimeout(300);
  const bd = await p.evaluate(() => [...document.querySelectorAll('.cp-bd .cp-b')].map(e => e.querySelector('.cp-bt').textContent.replace(/\s+/g, ' ').trim()));
  ok(bd.length === 5 && /الانتظام.*\/ 5$/.test(bd[2]) && /التثبيت.*\/ 55$/.test(bd[0]) && /الدقة.*\/ 25$/.test(bd[1]), 'cartouche page shows the new denominators: ' + bd.join(' | '));
  const wkText = await p.evaluate(() => (document.querySelector('.cp-wk') || {}).textContent || '');
  ok(/جاوبتها قبل كده/.test(wkText) && /مفيش سؤال جديد عليك/.test(wkText), 'weekly card says all questions come from ones already answered');
  await ctx.close();

  /* ---------- 2) التقييم الأسبوعي: من اللي اتجاوب قبل كده بس ---------- */
  for (const [n, fo] of [[110, .9], [400, .85], [1500, .92], [3000, .95]]) {
    ({ ctx, p } = await mk(b));
    const r = await p.evaluate(({ SEED, n, fo }) => {
      eval('(' + SEED + ')')(n, fo, 10);
      const now = Date.now(); const ids = Object.keys(IM.st.ans);
      /* غلطات قديمة متراجعة وغلطات مستحقة: نرجّع تاريخ كل الإجابات 6 أيام ورا */
      ids.forEach((id, i) => { const a = IM.st.ans[id]; a.d0 = a.fo ? a.d0 : IM.addDays(IM.dayKey(), -6); a.ts = now - (i % 5 === 0 ? 3600e3 : 6 * 864e5); if (!a.fo && i % 3 === 0) { a.mst = now - 5 * 864e5; a.r = 1; a.rt = now - 5 * 864e5; } });
      IM.levelReset();
      let bad = 0, total = 0, runs = 0, min = 1e9, errTotal = 0;
      for (let k = 0; k < 25; k++) { const pl = IM.weeklyPlan(); runs++; pl.ids.forEach(id => { total++; if (!IM.st.ans[id]) bad++; }); min = Math.min(min, pl.ids.length); errTotal += pl.errN; }
      return { answered: ids.length, bad, total, min, runs, avgErr: errTotal / runs };
    }, { SEED, n, fo });
    ok(r.bad === 0 && r.total > 0, n + ' answered: 25 weekly plans (' + r.total + ' picks) — zero unanswered questions (plan size min ' + r.min + ', answered ' + r.answered + ')');
    ok(r.min >= 20, n + ' answered: plan always has enough questions to start (>= 20)');
    if (n === 1500) {
      /* تشغيل فعلي: اللفافة كلها من اللي جاوبه */
      await p.evaluate(() => { IM.startWeekly(); }); await p.waitForTimeout(800);
      const s = await p.evaluate(() => { const s = IM.lastSession(); return s ? { n: s.items.length, bad: s.items.filter(it => !IM.st.ans[it.q]).length, weekly: !!(s.cfg && s.cfg.weekly) } : null; });
      ok(s && s.weekly && s.n >= 20 && s.bad === 0, 'a real weekly session: ' + (s && s.n) + ' items, ' + (s && s.bad) + ' never answered before');
    }
    await ctx.close();
  }

  /* سؤال حالة: الأخ اللي ما اتجاوبش مابيتضافش مع أخوه المتجاوب */
  ({ ctx, p } = await mk(b));
  const blk = await p.evaluate(({ SEED }) => {
    const bl = {}; IM.bank.order.forEach(id => { const Q = IM.bank.q[id]; if (Q.elig && Q.block && !IM.isPartial(Q.sid)) (bl[Q.block] = bl[Q.block] || []).push(id); });
    const key = Object.keys(bl).find(k => bl[k].length >= 2); if (!key) return { none: 1 };
    const first = bl[key][0], rest = bl[key].slice(1);
    window.__keep = [first];
    eval('(' + SEED + ')')(130, .9, 5, bl[key]);
    const ids = Object.keys(IM.st.ans), hadFirst = !!IM.st.ans[first], restAns = rest.filter(x => IM.st.ans[x]).length;
    let leaked = 0, withFirst = 0; for (let k = 0; k < 40; k++) { const pl = IM.weeklyPlan(); if (pl.ids.indexOf(first) > -1) withFirst++; rest.forEach(x => { if (pl.ids.indexOf(x) > -1) leaked++; }); }
    return { key, size: bl[key].length, hadFirst, restAns, leaked, withFirst };
  }, { SEED });
  ok(blk.none || (blk.hadFirst && blk.restAns === 0 && blk.leaked === 0 && blk.withFirst > 0), 'case block "' + blk.key + '" (' + blk.size + ' questions): only the answered one can be drawn; ' + blk.leaked + ' unanswered siblings leaked, drawn in ' + blk.withFirst + '/40 plans');
  await ctx.close();

  /* ---------- 3) الإشعارات ---------- */
  ({ ctx, p } = await mk(b));
  await p.evaluate(() => {
    const t = Date.now();
    IM.notify({ id: 'weekly-' + t, icon: 'check', title: 'نجحت في التقييم الأسبوعي', text: 'جبت 90%.', link: { label: 'خرطوشتي', hash: '#/cartouche' } });
    IM.notify({ id: 'weekly-' + (t + 1), icon: 'flag', title: 'التقييم الأسبوعي (نتيجة من غير رابط)', text: 'جبت 70%.' });
    IM.notify({ id: 'seal-100', icon: 'feather', title: 'ختم جديد: 100 إجابة', text: 'وصلت لـ 100 إجابة.', link: { label: 'ميزان الأداء', hash: '#/scales' } });
    IM.notify({ id: 'wdue-0', icon: 'water', title: 'التقييم الأسبوعي مستحق', text: 'امتحان 60 سؤال.', link: { label: 'ابدأ التقييم', hash: '#/cartouche' } });
    IM.notify({ id: 'tier-1', icon: 'award', title: 'خرطوشة جديدة: SCRIBE', text: 'وصلت لمرحلة الكاتب.', link: { label: 'شوف خرطوشتك', hash: '#/cartouche' } });
    IM.notify({ id: 'honor-ready', icon: 'award', title: 'اتفتح لك الاشتراك في لوحة الشرف', text: 'وصلت.', link: { label: 'لوحة الشرف', hash: '#/honor' } });
    IM.st.ans['g3_fetmem-1'] = { f: 'c', l: 'c', n: 1, c: 0, fo: 0, lo: 0, ts: t, d0: IM.dayKey() }; IM.save('ans'); IM.emit('notes');
  });
  const un0 = await p.evaluate(() => IM.unreadCount());
  const sticky = await p.evaluate(() => IM.pendingNotices().length);
  ok(un0 >= 10 && sticky === 1, 'many unread notifications to start with (' + un0 + ') including one «corrections» item you answered with the old key');
  const badge = async () => p.evaluate(() => { const e = document.querySelector('.bell-b'); return e && !e.hidden ? e.textContent : ''; });
  ok((await badge()) === (un0 > 9 ? '9+' : String(un0)), 'bell badge shows it (' + (await badge()) + ')');

  const titles = async (sec) => p.evaluate((sec) => { const ls = [...document.querySelectorAll('.nc .nc-l')]; const l = sec === 'me' ? ls[0] : ls[ls.length - 1]; return l ? [...l.querySelectorAll('.nc-i .nc-top b')].map(e => e.textContent.trim()) : []; }, sec);
  const newCount = async () => p.evaluate(() => document.querySelectorAll('.nc-i.new').length);
  await p.click('.bellbtn'); await p.waitForSelector('.nc .nc-l .nc-i', { timeout: 4000 });
  ok((await p.$('.nc-all')) === null, 'the "mark all as read" button is gone');
  const nNewOpen = await newCount();
  ok((await p.textContent('.nc-bar')).includes('جديد'), 'the panel shows the unread count: «' + (await p.textContent('.nc-bar')).trim() + '»');

  /* قفل الجرس من غير فتح إشعار: مفيش حاجة بتتعلّم مقروءة */
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  ok((await p.evaluate(() => IM.unreadCount())) === un0, 'closing the bell does NOT mark anything as read (still ' + un0 + ')');
  await p.click('.bellbtn'); await p.waitForSelector('.nc .nc-l .nc-i'); await p.mouse.click(5, 5); await p.waitForTimeout(400);
  ok((await p.evaluate(() => IM.unreadCount())) === un0, 'clicking outside the panel does not mark anything either');

  /* فتح إشعار فعلًا: واحد بس بيتعلّم */
  await p.click('.bellbtn'); await p.waitForSelector('.nc .nc-l .nc-i');
  await p.evaluate(() => { const li = [...document.querySelectorAll('.nc .nc-i')].find(x => /اتغيّر حساب المؤشر/.test(x.textContent)); li.querySelector('.nc-top b').click(); });
  await p.waitForTimeout(200);
  ok((await p.evaluate(() => IM.unreadCount())) === un0 - 1 && (await newCount()) === nNewOpen - 1, 'opening the «index changed» notification marks just that one (' + (un0 - 1) + ' left)');
  /* إشعار من غير رابط: الضغط عليه هو فتحه */
  await p.evaluate(() => { const li = [...document.querySelectorAll('.nc .nc-i')].find(x => /من غير رابط/.test(x.textContent)); li.querySelector('.nc-p').click(); });
  await p.waitForTimeout(200);
  ok((await p.evaluate(() => IM.unreadCount())) === un0 - 2, 'a notification without a link is marked when you press it (' + (un0 - 2) + ' left)');
  /* رابط الإشعار: بيفتح الصفحة وبيعلّم الإشعار ده بس */
  await p.evaluate(() => { const li = [...document.querySelectorAll('.nc .nc-i')].find(x => /خرطوشة جديدة/.test(x.textContent)); li.querySelector('a.nc-a').click(); });
  await p.waitForTimeout(500);
  ok((await p.evaluate(() => location.hash)) === '#/cartouche' && (await p.evaluate(() => IM.unreadCount())) === un0 - 3, 'following a notification link opens the page and marks only that one (' + (un0 - 3) + ' left)');
  const sticky2 = await p.evaluate(() => IM.pendingNotices().length);
  ok(sticky2 === 1, 'the «corrections you answered with the old key» item is still waiting (it is cleared only on the corrections page)');

  /* المسح */
  await p.click('.bellbtn'); await p.waitForSelector('.nc .nc-l .nc-i');
  const upd0 = await titles('upd'), me0 = await titles('me'), notes0 = await p.evaluate(() => IM.st.notes.length);
  const clrs = await p.$$eval('.nc-clr', bs => bs.map(x => x.textContent.trim()));
  ok(clrs.length === 2 && clrs[0] === 'مسح النتايج' && clrs[1] === 'مسح التحديثات', 'two clear buttons, one per section: ' + clrs.join(' | '));
  const updBtn = (await p.$$('.nc-clr'))[1];
  await updBtn.click(); await p.waitForTimeout(150);
  ok((await titles('upd')).length === upd0.length && /تأكيد/.test(await updBtn.textContent()), 'first press only asks for confirmation (nothing removed yet)');
  await updBtn.click(); await p.waitForTimeout(300);
  const upd1 = await titles('upd');
  /* اللي لازم يفضل: كل مدخلات التصحيحات (fix-*) + شرح قواعد المؤشر والتقييم (weekly-1108 وidx-*) */
  const keepU = await p.evaluate(() => IM.UPDATES.filter(u => /^(fix-|weekly-1108$|idx-)/.test(u.id)).map(u => u.title));
  ok(keepU.length >= 5 && keepU.includes('اتغيّر حساب المؤشر والتقييم الأسبوعي') && keepU.includes('التقييم الأسبوعي وطريقك للـ100') && keepU.filter(t => /تصحيحات|اتصحّح/.test(t)).length >= 3, 'protected set is what we expect (' + keepU.length + ' entries incl. all corrections)');
  ok(keepU.every(t => upd1.includes(t)) && upd1.length === keepU.length, 'clearing updates keeps every corrections entry + the index/weekly explanations, removes the rest (' + upd0.length + ' → ' + upd1.length + ')');
  ok(!upd1.some(t => /الإبط|وظائف الأعضاء|اللفافة الشاملة/.test(t)), 'ordinary site updates are gone');
  const meBtn = (await p.$$('.nc-clr'))[0];
  await meBtn.click(); await p.waitForTimeout(150); await meBtn.click(); await p.waitForTimeout(300);
  const me1 = await titles('me');
  ok(!me1.some(t => /نجحت في التقييم الأسبوعي|من غير رابط|ختم جديد/.test(t)), 'weekly results and seals are cleared');
  ok(me1.includes('التقييم الأسبوعي مستحق') && me1.includes('خرطوشة جديدة: SCRIBE') && me1.includes('اتفتح لك الاشتراك في لوحة الشرف') && me1.some(t => /اتصحّح مفتاح/.test(t)), 'weekly-due, new cartouche, honor board and the corrections item stay: ' + me1.length + ' left');
  ok((await p.$$('.nc-clr')).length === 0, 'with nothing left to clear, the clear buttons disappear');
  const un1 = await p.evaluate(() => IM.unreadCount()), cnt = await p.evaluate(() => ({ notes: IM.st.notes.length, x: Object.keys(IM.st.seen).filter(k => /^x:/.test(k)).length }));
  ok(cnt.notes === notes0 && cnt.x >= 3, 'notes data is kept (' + cnt.notes + ' stored), clearing is just a flag (' + cnt.x + ' x: flags)');
  ok(un1 < un0 - 3, 'badge no longer counts cleared items (' + un1 + ')');
  await p.screenshot({ path: process.env.SHOTS ? process.env.SHOTS + '/bell-desktop.png' : '/tmp/bell-desktop.png' });

  /* بيفضل بعد إعادة التحميل */
  await p.evaluate(() => IM.flush && IM.flush()); await p.waitForTimeout(300);
  await p.reload(); await p.waitForFunction(() => window.IM && IM.bank && IM.bank.ready, { timeout: 60000 }); await p.waitForTimeout(500);
  await p.click('.bellbtn'); await p.waitForSelector('.nc .nc-l .nc-i');
  ok(JSON.stringify(await titles('upd')) === JSON.stringify(upd1), 'after a reload the cleared updates stay cleared');
  ok((await p.evaluate(() => IM.unreadCount())) === un1, 'and the unread count is the same (' + un1 + ')');
  await ctx.close();

  /* موبايل دارك: شكل اللوحة */
  ({ ctx, p } = await mk(b, { vp: { width: 390, height: 800 }, dark: true }));
  await p.click('.bellbtn'); await p.waitForSelector('.nc .nc-l .nc-i'); await p.waitForTimeout(400);
  const ov = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, w: document.querySelector('.nc').getBoundingClientRect().width }));
  ok(ov.sw <= ov.cw && ov.w <= ov.cw, 'mobile: the panel fits the screen with no horizontal scroll (' + ov.w + 'px in ' + ov.cw + 'px)');
  await p.screenshot({ path: process.env.SHOTS ? process.env.SHOTS + '/bell-mobile-dark.png' : '/tmp/bell-mobile-dark.png' });
  await ctx.close();

  /* ---------- 4) الطلبة الحاليين: الدرجة الجديدة بتوصل للوحة الشرف ---------- */
  let hs = null;
  if (/imhotep-v2\.html/.test(SITE)) console.log('SKIP board end-to-end: the single-file build inlines its board settings (nothing to override)');
  else try {
    hs = spawn('node', ['tools/leaderboard/harness.js', String(BPORT)], { cwd: __dirname + '/../..', stdio: 'ignore' });
    for (let i = 0; i < 40; i++) { try { await fetch(BOARD_ROOT + '/__rows'); break; } catch (e) { await new Promise(r => setTimeout(r, 250)); } }
    const name = 'طالب قديم ' + Math.floor(Math.random() * 1e5);
    ({ ctx, p } = await mk(b, { board: true, name }));
    const r0 = await p.evaluate(({ SEED, OLD_W, name }) => {
      eval('(' + SEED + ')')(800, .9, 26);
      Object.assign(IM.LEVEL_WEIGHTS, OLD_W); IM.levelReset();
      const old = IM.level().idx;
      return IM.boardJoin(name).then(r => ({ ok: 1, old }), e => ({ ok: 0, e: String(e.message), old }));
    }, { SEED, OLD_W, name });
    ok(r0.ok, 'a student joined the board under the OLD formula with index ' + r0.old);
    await fetch(BOARD_ROOT + '/__advance?ms=60000');
    const r1 = await p.evaluate((NEW_W) => { Object.assign(IM.LEVEL_WEIGHTS, NEW_W); IM.levelReset(); const nw = IM.level().idx; return IM.boardPush(false).then(r => ({ nw, r: r && { ok: r.ok, err: r.err } })); }, NEW_W);
    const rows = await (await fetch(BOARD_ROOT + '/__rows')).json();
    const row = (Array.isArray(rows) ? rows : []).find(x => Array.isArray(x) && String(x[3]) === name);
    ok(r1.r && r1.r.ok && row && +row[5] === r1.nw && r1.nw !== r0.old, 'on the next sync the board row moves from ' + r0.old + ' to the new formula\'s ' + r1.nw + ' (server accepted: ' + JSON.stringify(r1.r) + ', row idx ' + (row && row[5]) + ')');
    await ctx.close();
  } catch (e) { ok(false, 'board end-to-end failed: ' + e.message); } finally { if (hs) hs.kill(); }

  console.log('errors ' + (errs.length ? JSON.stringify(errs.slice(0, 6)) : 'none')); ok(!errs.length, 'no page or console errors');
  await b.close(); console.log(fails ? 'FAILED ' + fails : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
