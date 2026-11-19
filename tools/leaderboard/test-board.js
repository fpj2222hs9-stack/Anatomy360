/* اختبارات وحدة لـ Code.gs على محاكي Apps Script: node tools/leaderboard/test-board.js */
'use strict';
const assert = require('assert'), { createEnv } = require('./harness');
let pass = 0; function ok(c, m) { assert.ok(c, m); pass++; console.log('PASS', m); }
const env = createEnv(); env.setup();
const S = (o) => Object.assign({ tier: 1, idx: 72, xp: 4000, n: 400 }, o || {});

/* join: serials are sequential and zero-padded */
const a = env.post(Object.assign({ a: 'join', dev: 'dev-aaaaaaaaaa', name: 'محمد سيف' }, S()));
ok(a.ok === 1 && a.serial === 'IMH-000001' && a.token && a.token.length === 32, 'first join gets IMH-000001 + token');
const b = env.post(Object.assign({ a: 'join', dev: 'dev-bbbbbbbbbb', name: 'نور' }, S({ idx: 90, xp: 6000, n: 600, tier: 3 })));
ok(b.serial === 'IMH-000002', 'second join gets IMH-000002');
const c = env.post(Object.assign({ a: 'join', dev: 'dev-cccccccccc', name: 'كريم' }, S({ idx: 55, xp: 1500, n: 200, tier: 0 })));
ok(c.serial === 'IMH-000003', 'third join gets IMH-000003');

/* join is idempotent for the same device (lost response) */
const a2 = env.post(Object.assign({ a: 'join', dev: 'dev-aaaaaaaaaa', name: 'محمد س' }, S()));
ok(a2.serial === a.serial && a2.token === a.token && a2.again === 1, 'same device re-join returns the same serial and token');
ok(env.rows().length === 4, 'no duplicate row was created (header + 3)');

/* validation */
ok(env.post({ a: 'join', dev: 'short', name: 'x', tier: 0, idx: 1, xp: 1, n: 1 }).err === 'bad-device', 'bad device id rejected');
ok(env.post(Object.assign({ a: 'join', dev: 'dev-dddddddddd', name: 'x' }, S({ idx: 101 }))).err === 'bad-stats', 'index above 100 rejected');
ok(env.post(Object.assign({ a: 'join', dev: 'dev-dddddddddd', name: 'x' }, S({ xp: 999999, n: 10 }))).err === 'bad-stats', 'impossible XP for the answer count rejected');
ok(env.post(Object.assign({ a: 'join', dev: 'dev-dddddddddd', name: 'x' }, S({ idx: 60, n: 5, xp: 10 }))).err === 'bad-stats', 'high index with almost no answers rejected');
ok(env.post(Object.assign({ a: 'join', dev: 'dev-dddddddddd', name: 'x' }, S({ idx: 'abc' }))).err === 'bad-stats', 'non-numeric index rejected');
ok(env.rows().length === 4, 'rejected joins do not consume serials');

/* name sanitising */
const e = env.post(Object.assign({ a: 'join', dev: 'dev-eeeeeeeeee', name: '=HYPERLINK("x")  <b>طالب</b> جدًا جدًا جدًا جدًا' }, S({ idx: 40, xp: 900, n: 150, tier: 0 })));
const nm = env.rows()[4][3];
ok(e.serial === 'IMH-000004' && !/^[=+\-@]/.test(nm) && nm.indexOf('<') < 0 && nm.length <= 20, 'name is stripped of formulas/markup and capped at 20 chars: "' + nm + '"');
const emp = env.post(Object.assign({ a: 'join', dev: 'dev-ffffffffff', name: '   ' }, S({ idx: 30, xp: 500, n: 80, tier: 0 })));
ok(emp.err === 'bad-name' && env.rows().length === 5, 'an empty name is rejected (bad-name) and does not consume a serial');
const f = env.post(Object.assign({ a: 'join', dev: 'dev-ffffffffff', name: 'منى' }, S({ idx: 30, xp: 500, n: 80, tier: 0 })));
ok(f.serial === 'IMH-000005', 'a normal name gets the next serial (IMH-000005)');

/* update: token required, throttle, tier never drops, rank */
ok(env.post(Object.assign({ a: 'up', s: a.serial, t: 'wrong' }, S())).err === 'auth', 'update with a wrong token rejected');
ok(env.post(Object.assign({ a: 'up', s: 'IMH-000099', t: a.token }, S())).err === 'auth', 'update of an unknown serial rejected');
ok(env.post(Object.assign({ a: 'up', s: b.serial, t: a.token }, S())).err === 'auth', "someone else's token cannot update this row");
env.advance(20000);
const u1 = env.post(Object.assign({ a: 'up', s: a.serial, t: a.token }, S({ idx: 80, xp: 5000, n: 500, tier: 2 })));
ok(u1.ok === 1 && !u1.throttled && u1.rank === 2 && u1.total === 5, 'update applies and returns rank 2 of 5 (by index)');
const u2 = env.post(Object.assign({ a: 'up', s: a.serial, t: a.token }, S({ idx: 85, xp: 5200, n: 520, tier: 2 })));
ok(u2.ok === 1 && u2.throttled === 1 && env.rows()[1][5] === 80, 'a second update within 15s is throttled and not saved');
env.advance(20000);
env.post(Object.assign({ a: 'up', s: a.serial, t: a.token }, S({ idx: 60, xp: 5200, n: 520, tier: 0 })));
ok(env.rows()[1][4] === 2 && env.rows()[1][5] === 60, 'index may drop but the tier (high-water mark) never does');
env.advance(20000);
env.post(Object.assign({ a: 'up', s: a.serial, t: a.token, name: 'سيف يسري' }, S({ idx: 82, xp: 5300, n: 530, tier: 2 })));
ok(env.rows()[1][3] === 'سيف يسري', 'display name can be changed');

/* board: ordering, caching, hidden rows */
let bd = env.get({ a: 'board', by: 'idx', n: '10' });
ok(bd.ok === 1 && bd.total === 5 && bd.rows[0].s === 'IMH-000002' && bd.rows[1].s === 'IMH-000001', 'board sorted by index (90 then 82)');
ok(!('t' in bd.rows[0]) && !('token' in bd.rows[0]) && !('dev' in bd.rows[0]), 'board rows never expose token or device');
bd = env.get({ a: 'board', by: 'xp', n: '2' });
ok(bd.rows.length === 2 && bd.rows[0].s === 'IMH-000002', 'board by XP honours n');
env.setCell(3, 11, 'hidden');       /* owner hides IMH-000002 */
bd = env.get({ a: 'board' });
ok(bd.total === 4 && bd.rows.every(r => r.s !== 'IMH-000002'), 'a row marked hidden disappears from the board');
ok(env.get({ a: 'rank', s: 'IMH-000001' }).rank === 1 && env.get({ a: 'rank', s: 'IMH-000002' }).rank === 0, 'rank lookup works and hidden rows have no rank');

/* delete + re-join gets a new serial, old serial stays reserved */
ok(env.post({ a: 'del', s: c.serial, t: 'nope' }).err === 'auth', 'delete needs the token');
ok(env.post({ a: 'del', s: c.serial, t: c.token }).ok === 1, 'delete with the token works');
const r3 = env.rows()[3];
ok(r3[10] === 'x' && r3[3] === '' && r3[1] === '' && r3[2] === '', 'deleted row is wiped (token, device, name) and kept as a reserved serial');
ok(env.post(Object.assign({ a: 'up', s: c.serial, t: c.token }, S())).err === 'auth', 'a deleted account can no longer update');
const c2 = env.post(Object.assign({ a: 'join', dev: 'dev-cccccccccc', name: 'كريم' }, S({ idx: 55, xp: 1500, n: 200, tier: 0 })));
ok(c2.ok === 1 && c2.serial === 'IMH-000006', 're-join after delete gets a fresh serial (IMH-000006)');
ok(env.get({ a: 'board' }).rows.every(r => r.s !== 'IMH-000003'), 'deleted serial is not on the board');

/* junk input */
ok(env.post('not json').err === 'bad-request', 'garbage body does not crash');
ok(env.post({ a: 'nope' }).err === 'bad-action', 'unknown action handled');
ok(env.get({}).name === 'imhotep-board', 'ping works');

/* ======== أسماء الظهور ما بتتكررش ======== */
const N = (dev, name, extra) => env.post(Object.assign({ a: 'join', dev: 'dev-' + dev.repeat(10), name }, S({ idx: 50, xp: 1000, n: 120, tier: 0 }), extra || {}));
const rowsBefore = env.rows().length;
const base = N('1', 'خالد علي');
ok(base.ok === 1, 'name «خالد علي» registered');
const same = [
  ['خالد علي', 'exactly the same'], ['خالد  علي', 'extra spaces'], ['  خالد علي  ', 'surrounding spaces'], ['خالد-علي', 'dash instead of a space'],
  ['خالد.علي', 'dot instead of a space'], ['خالدعلي', 'no space'], ['خَالِد عَلِي', 'tashkeel (diacritics)'], ['خـالـد عـلـي', 'tatweel'],
  ['خالد علىّ', 'alef maqsura instead of ya'], ['خــالد علي🙂', 'emoji and tatweel'], ['خالد\u200c علي', 'zero-width non-joiner']
];
same.forEach(([nm, why], i) => ok(N('x' + i, nm).err === 'name-taken', 'taken: «' + nm + '» (' + why + ')'));
const eq = [['أحمد', 'احمد'], ['إسلام', 'اسلام'], ['آية', 'ايه'], ['هدى', 'هدي'], ['فاطمة', 'فاطمه'], ['رؤف', 'روف'], ['مُصطفى', 'مصطفي']];
eq.forEach(([a1, b1], i) => { const r1 = N('e' + i + 'a', a1); const r2 = N('e' + i + 'b', b1); ok(r1.ok === 1 && r2.err === 'name-taken', 'letter variants are one name: «' + a1 + '» / «' + b1 + '»'); });
ok(N('l1', 'Mohamed Saif').ok === 1 && N('l2', 'MOHAMED  saif').err === 'name-taken' && N('l3', 'mohamed.saif').err === 'name-taken', 'Latin names: case, spaces and dots do not make a new name');
ok(N('d1', 'طالب١٢').ok === 1 && N('d2', 'طالب12').err === 'name-taken' && N('d3', 'طالب۱۲').err === 'name-taken', 'Arabic-Indic and Persian digits equal Western digits');
ok(N('p1', 'خالد علي 2').ok === 1 && N('p2', 'خالد علي٣').ok === 1, 'a different name (extra digit) is allowed');
ok(N('b1', '...').err === 'bad-name' && N('b2', '🙂🙂').err === 'bad-name' && N('b3', '=+-').err === 'bad-name', 'a name with no letters or digits is bad-name');
const cnt = env.rows().length;
ok(N('r1', 'خالد علي').err === 'name-taken' && env.rows().length === cnt, 'a rejected join consumes no serial and writes no row');

/* the same device keeps its own name and may re-join */
const again = N('1', 'خالد علي');
ok(again.ok === 1 && again.again === 1 && again.serial === base.serial, 'same device re-joining with its own name is accepted (same serial)');
const again2 = N('1', 'خَالِد  عَلِي');
ok(again2.ok === 1 && again2.again === 1, 'same device re-joining with a different spelling of its own name is accepted');
const again3 = N('1', 'منى');
ok(again3.err === 'name-taken', 'same device re-joining with a name that someone else has is rejected');
ok(env.rows()[+base.serial.slice(4)][3] === 'خَالِد عَلِي', 'and its stored name is the new spelling of the same name');

/* rename through update */
env.advance(20000);
const U = (r, name, extra) => env.post(Object.assign({ a: 'up', s: r.serial, t: r.token, name }, S({ idx: 52, xp: 1100, n: 130, tier: 0 }), extra || {}));
const ren1 = U(base, 'منى');
ok(ren1.err === 'name-taken', 'renaming to a taken name is rejected');
const rowAfter = env.rows()[+base.serial.slice(4)];
ok(rowAfter[5] === 50 && rowAfter[7] === 120, 'a rejected rename does not apply the new numbers either');
env.advance(20000);
ok(U(base, 'خالد  علي').ok === 1, 'renaming to a re-spelling of its own name is accepted');
env.advance(20000);
ok(U(base, 'خالد الكبير').ok === 1 && env.rows()[+base.serial.slice(4)][3] === 'خالد الكبير', 'renaming to a free name works');
ok(N('q1', 'خالد علي').ok === 1, 'the old name is free again after the rename');
env.advance(20000);
ok(U(base, '###').err === 'bad-name', 'renaming to a name with no letters is bad-name');
env.advance(20000);
ok(env.post({ a: 'up', s: base.serial, t: base.token, name: 'خالد الكبير', tier: 0, idx: 53, xp: 1200, n: 140 }).ok === 1, 'a normal update with the unchanged name never fails');

/* students who registered before the rule (duplicate names) are not affected */
const L1 = N('o1', 'Old Name'), L2 = N('o2', 'Old Name Two');
const r2 = +L2.serial.slice(4) + 1; env.setCell(r2, 4, 'Old  NAME');         /* legacy duplicate written straight into the sheet */
env.advance(20000);
ok(U(L2, 'Old  NAME').ok === 1, 'a legacy duplicate keeps updating normally with its existing name');
env.advance(20000);
ok(U(L2, 'Old Name').ok === 1, 'legacy: re-casing is allowed');   /* its key equals its own current key */
env.advance(20000);
ok(U(L2, 'Old Name Three').ok === 1 && U(L1, 'Old Name Three').err === 'name-taken', 'but once changed, the uniqueness rule applies');

/* hidden rows keep their name reserved, deleted rows free it */
const H = N('h1', 'اسم مخفي');
env.setCell(+H.serial.slice(4) + 1, 11, 'hidden');
ok(N('h2', 'اسم  مخفي').err === 'name-taken', 'a hidden student keeps the name reserved');
ok(env.post({ a: 'del', s: H.serial, t: H.token }).ok === 1 && N('h3', 'اسم مخفي').ok === 1, 'after leaving the board (delete) the name is free');

/* two requests for the same name: the second one loses (script lock serialises them) */
const race1 = N('z1', 'سباق'), race2 = N('z2', 'سباق');
ok(race1.ok === 1 && race2.err === 'name-taken', 'two joins with one name: only the first wins');

/* ======== حماية الانهيار (18 نوفمبر): جهاز حسب المؤشر قبل ما البنك يتحمّل فبعت 2 و400 لطالبة عندها 1267 سؤال ======== */
const CJ = (dev, name, o) => env.post(Object.assign({ a: 'join', dev: 'dev-' + dev.repeat(10), name }, o));
const big = CJ('k', 'طالبة نشيطة', { tier: 0, idx: 49, xp: 10375, n: 1234, att: 1616 });
ok(big.ok === 1, 'collapse: a strong student is on the board (idx 49, xp 10375, n 1234)');
const bigRow = () => env.rows()[+big.serial.slice(4)];
const BU = (o) => env.post(Object.assign({ a: 'up', s: big.serial, t: big.token, name: 'طالبة نشيطة', tier: 0 }, o));
env.advance(20000);
const bad = BU({ idx: 2, xp: 400, n: 1234, att: 1616 });
ok(bad.err === 'suspect' && bad.cur && bad.cur.xp === 10375, 'collapse: the exact incident (idx 2, xp 400, same n) is refused with err:suspect and the current numbers');
ok(bigRow()[5] === 49 && bigRow()[6] === 10375, 'collapse: the row was NOT overwritten');
env.advance(20000);
const bad2 = BU({ idx: 2, xp: 400, n: 1240, att: 1640 });
ok(bad2.err === 'suspect' && bigRow()[5] === 49, 'collapse: even with MORE answers than the row, a collapsed index/XP is refused');
env.advance(20000);
ok(BU({ idx: 2, xp: 10375, n: 1240, att: 1640 }).err === 'suspect', 'collapse: index alone falling below half is enough');
env.advance(20000);
ok(BU({ idx: 49, xp: 400, n: 1240, att: 1640 }).err === 'suspect', 'collapse: XP alone falling below half is enough');
env.advance(20000);
ok(BU({ idx: 31, xp: 9000, n: 1250, att: 1660 }).ok === 1 && bigRow()[5] === 31, 'collapse: an ordinary index drop (49 -> 31) and a small XP drop are accepted');
env.advance(20000);
ok(BU({ idx: 2, xp: 400, n: 1260, att: 1680, ovr: 1 }).ok === 1 && bigRow()[6] === 400, 'collapse: the student\'s own "update now" (ovr:1) is accepted when the drop is real');
env.advance(20000);
const fix = BU({ idx: 55, xp: 12038, n: 1329, att: 1700 });
ok(fix.ok === 1 && bigRow()[5] === 55 && bigRow()[6] === 12038, 'repair: a row that was broken (2/400) takes the healthy numbers as soon as the student opens the site');
env.advance(20000);
const smallS = CJ('m', 'طالب صغير', { tier: 0, idx: 8, xp: 250, n: 60, att: 70 });
env.advance(20000);
const SU = (o) => env.post(Object.assign({ a: 'up', s: smallS.serial, t: smallS.token, name: 'طالب صغير', tier: 0 }, o));
ok(SU({ idx: 3, xp: 80, n: 61, att: 71 }).ok === 1, 'collapse: below 300 XP and below index 10 the guard does not apply (small accounts move freely)');
env.advance(20000);
ok(SU({ idx: 3, xp: 80, n: 40, att: 50 }).err === 'stale', 'collapse: fewer answers is still the old stale rule');
/* joining again from the same device with collapsed numbers must not overwrite either */
const jb = CJ('k', 'طالبة نشيطة', { tier: 0, idx: 2, xp: 400, n: 1340, att: 1710 });
ok(jb.ok === 1 && jb.again === 1 && bigRow()[5] === 55, 'collapse: re-join from the same device with collapsed numbers returns the serial but keeps the real numbers');
console.log('\nall', pass, 'checks passed');
