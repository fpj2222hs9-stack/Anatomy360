/* Exports the question bank and the book text exactly as the site sees them (corrected keys from js/fixes.js already applied)
   so the Python pipeline and the browser agree on every question (same hash).
   usage:  NODE_PATH=$(npm root -g) node tools/ai/export_bank.js <site-dir> [out-dir]
   writes: <out-dir>/questions.json  <out-dir>/books.json  <out-dir>/bank_meta.json   (default out-dir = tools/ai/data)
   needs Playwright (the same one used for the site tests). No network: it opens index.html from disk. */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const SITE = path.resolve(process.argv[2] || path.join(__dirname, '..', '..'));
const OUT = path.resolve(process.argv[3] || path.join(__dirname, 'data'));

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { try { localStorage.setItem('im_seen', JSON.stringify({ 'tour-v1': 1, 'ann-honor-1': 1 })); localStorage.setItem('im_user', JSON.stringify({ name: 'export', v: 1 })); } catch (e) {} });
  await p.goto('file://' + path.join(SITE, 'index.html'), { waitUntil: 'load' });
  await p.waitForFunction(() => window.IM && IM.bank && IM.bank.ready, { timeout: 90000 });

  const data = await p.evaluate(() => {
    /* readable text from book markup: block elements break lines, table cells are joined with " | " */
    function textOf(el) {
      var out = [];
      (function walk(n) {
        if (n.nodeType === 3) { out.push(n.nodeValue); return; }
        if (n.nodeType !== 1) return;
        var t = n.tagName;
        if (t === 'SCRIPT' || t === 'STYLE' || t === 'IMG' || t === 'SVG') return;
        var block = /^(P|DIV|LI|UL|OL|TR|H1|H2|H3|H4|H5|H6|SECTION|TABLE|BLOCKQUOTE|BR)$/.test(t);
        for (var c = n.firstChild; c; c = c.nextSibling) {
          walk(c);
          if ((c.tagName === 'TD' || c.tagName === 'TH') && c.nextElementSibling) out.push(' | ');
        }
        if (block) out.push('\n');
      })(el);
      return out.join('').replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    }
    var questions = [], books = {};
    var firstOfBlock = {};
    IM.bank.order.forEach(function (id) { var Q = IM.bank.q[id]; if (Q.block && !firstOfBlock[Q.block]) firstOfBlock[Q.block] = id; });
    Object.keys(IM.bank.subs).forEach(function (sid) {
      var S = IM.bank.subs[sid];
      S.qids.forEach(function (id) {
        var Q = IM.bank.q[id], part = S.parts.filter(function (p) { return p.id === Q.part; })[0] || {}, sec = S.secs[Q.sec] || {};
        var fb = Q.block ? firstOfBlock[Q.block] : '';
        questions.push({
          id: Q.id, sid: sid, subject: S.en || sid, part: { id: part.id || '', num: part.num || 0, en: part.en || '', ar: part.ar || '' },
          sec: { id: sec.id || '', en: sec.en || '', ar: sec.ar || '' }, n: Q.n || '', stem: Q.stem,
          opts: Q.opts.map(function (o) { return { o: o.o, t: o.t }; }), keys: Q.keys.slice(), canc: !!Q.canc, alt: Q.alt || '',
          review: !!Q.review, fix: !!Q.fix, bk: Q.bk || '', block: Q.block || '', caseOf: (fb && fb !== Q.id) ? fb : '', fig: Q.fig || '',
          tags: Q.tags.slice(), h: IM.aiHash(Q)
        });
      });
      books[sid] = { title: S.en || sid, chapters: S.chapters.map(function (c) {
        var d = new DOMParser().parseFromString(c.html, 'text/html'), root = d.querySelector('section.chapter') || d.body;
        var secs = [];
        Array.prototype.forEach.call(root.querySelectorAll('.bk-sec'), function (s) {
          if (s.closest('details.orig')) return;                    /* the collapsed "original text" duplicate, if any */
          var top = s.querySelector('.bk-top'), body = s.querySelector('.bk-body'), page = '', heading = '';
          if (top) {
            var pg = top.querySelector('[class*="pg"],[class*="page"],.pn,bdi');
            var pt = pg ? textOf(pg) : '';
            var full = textOf(top);
            var m = pt.match(/(\d+)/) || full.match(/^p\.?\s*(\d+)/i);
            page = m ? m[1] : '';
            heading = pg ? full.replace(pt, '').trim() : full.replace(/^p\.?\s*\d+\s*/i, '').trim();
          }
          secs.push({ page: page, heading: heading, text: body ? textOf(body) : textOf(s) });
        });
        return { id: c.id, num: c.num, en: c.en, ar: c.ar, pages: c.pages, sections: secs };
      }) };
    });
    return { questions: questions, books: books };
  });

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'questions.json'), JSON.stringify(data.questions));
  fs.writeFileSync(path.join(OUT, 'books.json'), JSON.stringify(data.books));
  const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16);
  const meta = {
    exported: new Date().toISOString(), questions: data.questions.length,
    books: Object.fromEntries(Object.entries(data.books).map(([k, v]) => [k, { chapters: v.chapters.length, sections: v.chapters.reduce((a, c) => a + c.sections.length, 0) }])),
    sha: { questions: sha(path.join(OUT, 'questions.json')), books: sha(path.join(OUT, 'books.json')) }
  };
  fs.writeFileSync(path.join(OUT, 'bank_meta.json'), JSON.stringify(meta, null, 1) + '\n');
  console.log(JSON.stringify(meta, null, 1));
  if (errs.length) { console.error('page errors:', errs); process.exitCode = 1; }
  await b.close();
})();
