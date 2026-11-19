/* Imhotep · إمحتب — لوحة الشرف (Google Apps Script web app)
 *
 * بيشتغل جوه شيت جديد (غير شيت البلاغات). كل طالب بيشترك بإرادته، وبياخد رقم تسلسلي متتابع
 * IMH-000001 و IMH-000002 …، وبيبعت مؤشره ونقاطه، واللوحة بتتجاب مرتبة.
 *
 * التركيب (مرة واحدة):
 *  1) اعمل Google Sheet جديد اسمه مثلًا «IMHOTEP لوحة الشرف».
 *  2) Extensions ← Apps Script ← امسح أي كود ← الصق الملف ده كله ← احفظ.
 *  3) اختار الدالة setup من القايمة فوق ← Run ← وافق على الصلاحيات (بينشئ تبويب Board).
 *  4) Deploy ← New deployment ← النوع Web app ← Execute as: Me ← Who has access: Anyone ← Deploy.
 *  5) انسخ رابط الـ Web app (بينتهي بـ /exec) والصقه في js/board-config.js في الموقع.
 *  أي تعديل على الكود بعد كده: Deploy ← Manage deployments ← ✏️ ← Version: New version ← Deploy
 *  (على نفس الـ deployment عشان الرابط ما يتغيّرش).
 *
 * الإدارة من الشيت: لإخفاء طالب من اللوحة اكتب hidden في عمود Status (بيفضل رقمه محفوظ).
 * ما تمسحش صفوف: رقم الصف = الرقم التسلسلي + 1. العمود B (Token) سري، ما تشاركش الشيت مع حد.
 *
 * حماية من الجهاز القديم: لو طالب بيذاكر على لينكين/جهازين، الجهاز اللي تقدّمه أقدم كان بيبعت أرقام أقل وينزّل صفه في اللوحة.
 * دلوقتي عدد الأسئلة (Answered) وعدد المحاولات (Attempts، عمود L) ما بيقلّوش أبدًا لنفس الرقم التسلسلي، فأي تحديث أقدم بيترفض برد err:'stale'
 * ومعاه الأرقام الحالية، والموقع بيشرح للطالب إن جهازه متأخر. (لو عندك شيت قديم: العمود L بيتضاف لوحده، ومفيش حاجة تتعمل.)
 *
 * أسماء الظهور ما بتتكررش: الاسم بيتقارن بعد توحيده (مسافات، تشكيل، تطويل، الألف والهمزات، الياء والألف المقصورة، التاء المربوطة والهاء،
 * الأرقام العربي والهندي، حروف كبيرة/صغيرة، والنقط والرموز)، فـ «محمد  سيف» و«مُحَمَّد-سيف» و«Mohamed Saif» و«MOHAMED SAIF» كل واحد منهم اسم واحد.
 * الاسم المحجوز بيرجع برد err:'name-taken'، والاسم اللي مفيهوش حروف ولا أرقام بيرجع err:'bad-name'. نفس الجهاز يقدر يكمّل بنفس اسمه ويغيّره.
 * اللي اشترك قبل القاعدة دي باسم متكرر بيكمّل بدون ما يتأثر (القاعدة بتتطبّق عند الاشتراك أو تغيير الاسم بس). الصف الممسوح (x) اسمه بيتفضّى فالاسم بيرجع متاح.
 *
 * حماية من الانهيار: لو وصل تحديث بنفس عدد الأسئلة (أو أكتر) لكن الـXP أو المؤشر أقل من نصّ المسجّل، بيترفض برد err:'suspect'
 * (إلا لو الطالب داس «حدّث دلوقتي»، بيبعت ovr:1). ده بيحمي من جهاز حسب المؤشر قبل ما الأسئلة تتحمّل. الأرقام الأعلى بتتقبل دايمًا.
 *
 * ملاحظة أمان: الأرقام بتيجي من متصفح الطالب، فممكن حد يزوّرها. الكود بيرفض القيم المستحيلة
 * ويمنع تعديل صف حد تاني (توكن لكل جهاز)، لكن اللوحة «شرف» مش امتحان رسمي.
 */

var SHEET = 'Board';
var HEAD = ['Serial', 'Token', 'Device', 'Name', 'Tier', 'Index', 'XP', 'Answered', 'Joined', 'Updated', 'Status', 'Attempts'];
var C = { serial: 1, token: 2, dev: 3, name: 4, tier: 5, idx: 6, xp: 7, n: 8, joined: 9, upd: 10, status: 11, att: 12 };
var MIN_GAP_MS = 15000;     // أقل فاصل بين تحديثين لنفس الطالب
var CACHE_SEC = 60;         // اللوحة بتتخزّن دقيقة عشان الشيت ما يتقرأش مع كل زيارة
var TOP_DEFAULT = 50, TOP_MAX = 100, NAME_MAX = 20;

/* شغّلها مرة واحدة من المحرّر */
function setup() { sheet_(); return 'ok'; }

/* ---------- web app ---------- */
function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    var a = String(p.a || 'ping');
    if (a === 'board') return out_(board_(p.by === 'xp' ? 'xp' : 'idx', clampInt_(p.n, 1, TOP_MAX, TOP_DEFAULT)));
    if (a === 'rank') { var rk = rankOf_(String(p.s || ''), p.by === 'xp' ? 'xp' : 'idx'); var me = meOf_(p.s); if (me) rk.me = me; return out_(rk); }
    return out_({ ok: 1, name: 'imhotep-board' });
  } catch (err) { return out_({ ok: 0, err: 'server' }); }
}

function doPost(e) {
  try {
    var b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var a = String(b.a || '');
    if (a === 'join') return out_(join_(b));
    if (a === 'up') return out_(update_(b));
    if (a === 'del') return out_(remove_(b));
    return out_({ ok: 0, err: 'bad-action' });
  } catch (err) { return out_({ ok: 0, err: 'bad-request' }); }
}

/* ---------- actions ---------- */
function join_(b) {
  var dev = String(b.dev || '');
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(dev)) return { ok: 0, err: 'bad-device' };
  var st = stats_(b); if (!st) return { ok: 0, err: 'bad-stats' };
  var name = cleanName_(b.name), key = nameKey_(name);
  if (!key) return { ok: 0, err: 'bad-name' };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = sheet_(), now = now_(), row = findDevice_(sh, dev);
    if (row) {   /* نفس الجهاز اشترك قبل كده (مثلًا الرد ضاع في الطريق): نرجّع نفس الرقم */
      var rec = sh.getRange(row, 1, 1, HEAD.length).getValues()[0];
      if (rec[C.status - 1] !== 'x') {
        if (nameKey_(rec[C.name - 1]) !== key && nameTaken_(sh, key, row)) return { ok: 0, err: 'name-taken' };
        if (!stale_(st, rec) && !collapsed_(st, rec)) writeStats_(sh, row, name, st, rec, now);
        drop_();
        return { ok: 1, serial: rec[C.serial - 1], token: rec[C.token - 1], name: name, again: 1 };
      }
    }
    if (nameTaken_(sh, key, 0)) return { ok: 0, err: 'name-taken' };
    var seq = Math.max(1, sh.getLastRow());           /* الصف الأول عنوان، فأول طالب = 1 */
    var serial = 'IMH-' + pad_(seq, 6), token = Utilities.getUuid().replace(/-/g, '');
    var r = seq + 1;
    sh.getRange(r, 1, 1, HEAD.length).setValues([[serial, token, dev, name, st.tier, st.idx, st.xp, st.n, now, now, 'ok', st.att == null ? '' : st.att]]);
    drop_();
    return { ok: 1, serial: serial, token: token, name: name };
  } finally { lock.releaseLock(); }
}

function update_(b) {
  var st = stats_(b); if (!st) return { ok: 0, err: 'bad-stats' };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = sheet_(), row = rowOf_(sh, String(b.s || ''), String(b.t || ''));
    if (!row) return { ok: 0, err: 'auth' };
    var rec = sh.getRange(row, 1, 1, HEAD.length).getValues()[0], now = now_();
    if (rec[C.status - 1] === 'x') return { ok: 0, err: 'gone' };
    if (stale_(st, rec)) return { ok: 0, err: 'stale', cur: cur_(rec) };      /* جهاز أقدم من اللي في اللوحة */
    if (b.ovr !== 1 && collapsed_(st, rec)) return { ok: 0, err: 'suspect', cur: cur_(rec) };      /* انهيار مفاجئ في الأرقام: يتحط في الحسبان إنه حساب على بنك أسئلة لسه ما اتحمّلش */
    var name = b.name != null ? (cleanName_(b.name) || rec[C.name - 1]) : rec[C.name - 1];
    if (nameKey_(name) !== nameKey_(rec[C.name - 1])) {            /* تغيير اسم: لازم يكون متاح (الاسم القديم المتكرر بيكمّل عادي) */
      if (!nameKey_(name)) return { ok: 0, err: 'bad-name' };
      if (nameTaken_(sh, nameKey_(name), row)) return { ok: 0, err: 'name-taken' };
    }
    if (now - Number(rec[C.upd - 1] || 0) < MIN_GAP_MS) return { ok: 1, throttled: 1 };
    writeStats_(sh, row, name, st, rec, now);
    drop_();
    var rk = rankOf_(String(b.s), 'idx'), rx = rankOf_(String(b.s), 'xp');
    return { ok: 1, rank: rk.rank, rankXp: rx.rank, total: rk.total };
  } finally { lock.releaseLock(); }
}

function remove_(b) {
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = sheet_(), row = rowOf_(sh, String(b.s || ''), String(b.t || ''));
    if (!row) return { ok: 0, err: 'auth' };
    var blank = ['', '', '', '', '', '', '', '', ''];
    sh.getRange(row, C.token, 1, 9).setValues([blank]);      /* التوكن والجهاز والاسم والأرقام */
    sh.getRange(row, C.att).setValue('');
    sh.getRange(row, C.status).setValue('x');
    drop_();
    return { ok: 1 };
  } finally { lock.releaseLock(); }
}

/* ---------- board ---------- */
function rows_() {
  var cache = CacheService.getScriptCache(), hit = cache.get('rows');
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  var sh = sheet_(), last = sh.getLastRow(), out = [];
  if (last > 1) {
    sh.getRange(2, 1, last - 1, HEAD.length).getValues().forEach(function (r) {
      if (r[C.status - 1] !== 'ok') return;
      out.push({ s: r[0], name: String(r[C.name - 1]), tier: +r[C.tier - 1] || 0, idx: +r[C.idx - 1] || 0, xp: +r[C.xp - 1] || 0, n: +r[C.n - 1] || 0 });
    });
  }
  var str = JSON.stringify(out);
  if (str.length < 90000) cache.put('rows', str, CACHE_SEC);
  return out;
}
function sorted_(by) {
  var a = rows_().slice();
  a.sort(function (x, y) {
    var d = by === 'xp' ? (y.xp - x.xp || y.idx - x.idx) : (y.idx - x.idx || y.xp - x.xp);
    return d || (x.s < y.s ? -1 : 1);
  });
  return a;
}
function board_(by, n) { var a = sorted_(by); return { ok: 1, by: by, total: a.length, rows: a.slice(0, n), ts: now_() }; }
function rankOf_(serial, by) {
  var a = sorted_(by);
  for (var i = 0; i < a.length; i++) if (a[i].s === serial) return { ok: 1, rank: i + 1, total: a.length, by: by };
  return { ok: 1, rank: 0, total: a.length, by: by };
}
/* أرقام الصف نفسه (للمقارنة مع جهاز الطالب): مفيهاش توكن ولا حاجة سرّية */
function meOf_(serial) {
  var m = /^IMH-(\d{6})$/.exec(String(serial || '')); if (!m) return null;
  var sh = sheet_(), row = parseInt(m[1], 10) + 1;
  if (row < 2 || row > sh.getLastRow()) return null;
  var rec = sh.getRange(row, 1, 1, HEAD.length).getValues()[0];
  return (rec[0] === serial && rec[C.status - 1] === 'ok') ? cur_(rec) : null;
}
function drop_() { try { CacheService.getScriptCache().remove('rows'); } catch (e) {} }

/* ---------- helpers ---------- */
function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET);
    sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]);
    sh.setFrozenRows(1);
    sh.getRange('A:D').setNumberFormat('@');          /* نص عادي: الأسماء ما تتحولش لصيغ */
  }
  if (sh.getRange(1, C.att).getValue() !== HEAD[C.att - 1]) sh.getRange(1, C.att).setValue(HEAD[C.att - 1]);      /* شيت قديم: نضيف عنوان العمود L */
  return sh;
}
function findDevice_(sh, dev) {
  var f = sh.getRange('C:C').createTextFinder(dev).matchEntireCell(true).findNext();
  return f ? f.getRow() : 0;
}
function rowOf_(sh, serial, token) {
  var m = /^IMH-(\d{6})$/.exec(serial); if (!m || !token) return 0;
  var row = parseInt(m[1], 10) + 1;
  if (row < 2 || row > sh.getLastRow()) return 0;
  var rec = sh.getRange(row, 1, 1, 2).getValues()[0];
  return (rec[0] === serial && rec[1] && rec[1] === token) ? row : 0;
}
function writeStats_(sh, row, name, st, rec, now) {
  var tier = Math.max(st.tier, +rec[C.tier - 1] || 0);   /* المرحلة ما بتنزلش */
  sh.getRange(row, C.name, 1, 5).setValues([[name, tier, st.idx, st.xp, st.n]]);
  if (st.att != null) sh.getRange(row, C.att).setValue(st.att);
  sh.getRange(row, C.upd).setValue(now);
}
function stats_(b) {
  var tier = int_(b.tier, 0, 6), idx = int_(b.idx, 0, 100), xp = int_(b.xp, 0, 5000000), n = int_(b.n, 0, 6000);
  var att = (b.att == null) ? null : int_(b.att, 0, 50000000);
  if (tier == null || idx == null || xp == null || n == null || (b.att != null && att == null)) return null;
  if (xp > 16 * n + 2200) return null;                    /* أعلى نقاط ممكنة لعدد الأسئلة ده */
  if (idx > 20 && n < 20) return null;                    /* مؤشر عالي من غير إجابات */
  return { tier: tier, idx: idx, xp: xp, n: n, att: att };
}
/* التحديث «أقدم»؟ بنقارن (عدد الأسئلة، عدد المحاولات): عدد الأسئلة ما بيقلّش أبدًا لنفس الرقم، ولو اتساوى بنبص على المحاولات
   (كل إجابة بتزوّدها). يعني اللي ذاكر أكتر أو أحدث بيكسب، واللي نسخته أقدم بيترفض. */
function stale_(st, rec) {
  var curN = +rec[C.n - 1] || 0, curA = +rec[C.att - 1] || 0;
  if (st.n < curN) return true;
  if (st.n === curN && st.att != null && curA && st.att < curA) return true;
  return false;
}
/* انهيار مفاجئ؟ عدد الأسئلة نفسه أو أكتر لكن الـXP أو المؤشر وقعوا لأقل من النص عن المسجّل. المذاكرة العادية مبتعملش كده أبدًا (الـXP ما بينزلش، والمؤشر بيتحرّك بالنقطتين-تلاتة).
   حصلت فعلًا (18 نوفمبر): جهاز حسب المؤشر قبل ما بنك الأسئلة يتحمّل فبعت 2 و400 لطالبة عندها 1267 سؤال. الأرقام الأعلى بتتقبل دايمًا، فالصف بيتصلّح أول ما الطالب يفتح الموقع.
   الزرار «حدّث دلوقتي» في الموقع بيبعت ovr:1 عشان لو النزول حقيقي (مثلًا تغيّر في الأسئلة) يتقبل. */
function collapsed_(st, rec) {
  var cn = +rec[C.n - 1] || 0, cx = +rec[C.xp - 1] || 0, ci = +rec[C.idx - 1] || 0;
  if (st.n < cn) return false;                           /* ده شغل stale_ */
  return (cx >= 300 && st.xp < cx * 0.5) || (ci >= 10 && st.idx < ci * 0.5);
}
function cur_(rec) { return { tier: +rec[C.tier - 1] || 0, idx: +rec[C.idx - 1] || 0, xp: +rec[C.xp - 1] || 0, n: +rec[C.n - 1] || 0, att: +rec[C.att - 1] || 0 }; }
function int_(v, lo, hi) { v = Number(v); if (!isFinite(v)) return null; v = Math.floor(v); return (v < lo || v > hi) ? null : v; }
function clampInt_(v, lo, hi, d) { v = parseInt(v, 10); return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; }
function cleanName_(s) {
  s = String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>"\\]/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/^[=+\-@\s]+/, '');                       /* ضد الصيغ في الشيت */
  return s.length > NAME_MAX ? s.slice(0, NAME_MAX).trim() : s;
}
/* مفتاح مقارنة الاسم: نفس الاسم بأي كتابة = نفس المفتاح. بيسيب الحروف والأرقام بس. */
function nameKey_(s) {
  s = String(s == null ? '' : s);
  try { s = s.normalize('NFKC'); } catch (e) {}
  s = s.toLowerCase()
    .replace(/[\u0640\u200c\u200d\u200e\u200f]/g, '')                      /* تطويل ومسافات صفرية */
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')                       /* آ أ إ ٱ ← ا */
    .replace(/\u0649/g, '\u064a').replace(/\u06cc/g, '\u064a')                /* ى ی ← ي */
    .replace(/\u0629/g, '\u0647')                                            /* ة ← ه */
    .replace(/\u0624/g, '\u0648').replace(/\u0626/g, '\u064a')                /* ؤ ← و ، ئ ← ي */
    .replace(/\u06a9/g, '\u0643')                                            /* ک ← ك */
    .replace(/[\u0660-\u0669]/g, function (c) { return String(c.charCodeAt(0) - 0x660); })
    .replace(/[\u06f0-\u06f9]/g, function (c) { return String(c.charCodeAt(0) - 0x6f0); });
  return s.replace(/[^\p{L}\p{N}]/gu, '');                                     /* مسافات وتشكيل ونقط ورموز بتتشال */
}
/* الاسم محجوز لحد تاني؟ (exceptRow = صف الطالب نفسه). الصفوف الممسوحة اسمها فاضي فمش بتتحسب. */
function nameTaken_(sh, key, exceptRow) {
  var last = sh.getLastRow(); if (last < 2) return false;
  var vals = sh.getRange(2, C.name, last - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (i + 2 === exceptRow) continue;
    if (nameKey_(vals[i][0]) === key) return true;
  }
  return false;
}
function pad_(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }
function now_() { return new Date().getTime(); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
