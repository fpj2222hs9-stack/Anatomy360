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
ok(env.post(Object.assign({ a: 'join', dev: 'dev-ffffffffff', name: '   ' }, S({ idx: 30, xp: 500, n: 80, tier: 0 }))).ok === 1 && env.rows()[5][3] === 'طالب', 'empty name falls back to «طالب»');

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
console.log('\nall', pass, 'checks passed');
