/* محاكي Google Apps Script: بيشغّل Code.gs الحقيقي في node بشيت وقفل وكاش من الذاكرة.
   للاختبار بس (مش بيتنشر). الاستخدام:
     node tools/leaderboard/harness.js 8780        ← سيرفر محلي على /exec بنفس بروتوكول الـ web app
     const { createEnv } = require('./harness')    ← لاختبارات الوحدة */
'use strict';
const vm = require('vm'), fs = require('fs'), path = require('path'), http = require('http'), crypto = require('crypto');

function createEnv() {
  let clock = 1.8e12;
  const sheets = {};
  const FDate = class extends Date { constructor(...a) { if (a.length) super(...a); else super(clock); } static now() { return clock; } };

  function mkSheet(name) {
    const rows = [];     /* rows[0] = الصف 1 */
    const at = (r, c) => (rows[r - 1] && rows[r - 1][c - 1] !== undefined) ? rows[r - 1][c - 1] : '';
    const put = (r, c, v) => { while (rows.length < r) rows.push([]); const row = rows[r - 1]; while (row.length < c) row.push(''); row[c - 1] = v; };
    const lastRow = () => { for (let i = rows.length; i > 0; i--) if (rows[i - 1].some(v => v !== '' && v != null)) return i; return 0; };
    function range(a, b, c, d) {
      let r1, c1, nr, nc, whole = false;
      if (typeof a === 'string') { const m = /^([A-Z]+):([A-Z]+)$/.exec(a); const col = s => s.split('').reduce((x, ch) => x * 26 + ch.charCodeAt(0) - 64, 0); c1 = col(m[1]); nc = col(m[2]) - c1 + 1; r1 = 1; nr = Math.max(1, lastRow()); whole = true; }
      else { r1 = a; c1 = b; nr = c || 1; nc = d || 1; }
      return {
        getValues: () => { const o = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) row.push(at(r1 + i, c1 + j)); o.push(row); } return o; },
        setValues: v => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) put(r1 + i, c1 + j, v[i][j]); },
        setValue: v => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) put(r1 + i, c1 + j, v); },
        getValue: () => at(r1, c1),
        setNumberFormat: () => {},
        getRow: () => r1,
        createTextFinder: text => { const f = { entire: false, matchEntireCell(x) { this.entire = x; return this; }, findNext() { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) { const v = String(at(r1 + i, c1 + j)); if (this.entire ? v === text : v.indexOf(text) > -1) return { getRow: () => r1 + i }; } return null; } }; return f; }
      };
    }
    return { name, rows, getRange: range, getLastRow: lastRow, setFrozenRows: () => {} };
  }
  const cacheMap = new Map();
  const ctx = vm.createContext({
    Date: FDate,
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = mkSheet(n)) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({
      get: k => { const e = cacheMap.get(k); return e && e.until > clock ? e.v : null; },
      put: (k, v, s) => cacheMap.set(k, { v, until: clock + s * 1000 }),
      remove: k => cacheMap.delete(k) }) },
    Utilities: { getUuid: () => crypto.randomUUID() },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ getContent: () => s, setMimeType() { return this; } }) }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8'), ctx, { filename: 'Code.gs' });
  const parse = o => JSON.parse(o.getContent());
  return {
    setup: () => ctx.setup(),
    post: body => parse(ctx.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } })),
    get: params => parse(ctx.doGet({ parameter: params || {} })),
    advance: ms => { clock += ms; },
    rows: () => (sheets.Board ? sheets.Board.rows.map(r => r.slice()) : []),
    setCell: (r, c, v) => { const row = sheets.Board.rows[r - 1]; while (row.length < c) row.push(''); row[c - 1] = v; cacheMap.clear(); }
  };
}

function serve(port) {
  const env = createEnv(); env.setup();
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    const send = o => { res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, cors)); res.end(JSON.stringify(o)); };
    if (u.pathname === '/__advance') { env.advance(+u.searchParams.get('ms') || 0); return send({ ok: 1 }); }
    if (u.pathname === '/__rows') return send(env.rows());
    if (u.pathname === '/__set') { env.setCell(+u.searchParams.get('row'), +u.searchParams.get('col'), u.searchParams.get('v')); return send({ ok: 1 }); }
    if (u.pathname !== '/exec') { res.writeHead(404, cors); return res.end(); }
    if (u.searchParams.get('__fail')) { res.writeHead(500, cors); return res.end('x'); }
    if (req.method === 'POST') { let b = ''; req.on('data', d => b += d); req.on('end', () => send(env.post(b))); return; }
    send(env.get(Object.fromEntries(u.searchParams)));
  });
  srv.listen(port, '127.0.0.1', () => console.log('board mock on', port));
  return srv;
}
module.exports = { createEnv, serve };
if (require.main === module) serve(+process.argv[2] || 8780);
