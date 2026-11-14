/* Imhotep · Horus — BM25 retrieval over the book passages (a faithful port of tools/ai/imai/retrieve.py).
   Pure functions, no I/O: the Edge Function loads the passages from the database and hands them in. */
const STOP = new Set(('a an and are as at be been being by for from had has have having he her his how i if in into is it its of on or our she so such than that the their them then there these they this those ' +
  'to was we were what when where which who whom whose why will with would you your not no yes all any each both either only other more most less least can could may might must shall should also very ' +
  'following true false correct incorrect except statement statements choose select best answer one two three four following about above below between during after before over under per via ' +
  'which following regarding case patient male female year old came hospital').split(/\s+/).filter(Boolean));
const TOK = /[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu;

export function stem(w) {
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 4 && /(ches|shes|xes|zes|sses)$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
  if (w.length > 6 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 5 && w.endsWith('ed')) return w.slice(0, -2);
  return w;
}

export function tokenize(text, keepStop) {
  const out = [];
  const ms = String(text || '').toLowerCase().match(TOK) || [];
  for (const m of ms) {
    const parts = [m];
    if (m.includes('-') || m.includes("'")) for (const x of m.replace(/'/g, '-').split('-')) parts.push(x);
    for (const p of parts) {
      if (!p || (p.length < 2 && !/^\d$/.test(p))) continue;
      if (!keepStop && STOP.has(p)) continue;
      out.push(stem(p));
    }
  }
  return out;
}

export class Index {
  constructor(passages, k1 = 1.2, b = 0.75) {
    this.p = passages; this.k1 = k1; this.b = b;
    this.tf = []; this.dl = []; this.df = new Map();
    for (const ps of passages) {
      const toks = tokenize(ps.heading + ' ' + ps.heading + ' ' + ps.body);
      const d = new Map();
      for (const t of toks) d.set(t, (d.get(t) || 0) + 1);
      this.tf.push(d); this.dl.push(toks.length);
      for (const t of d.keys()) this.df.set(t, (this.df.get(t) || 0) + 1);
    }
    this.N = passages.length;
    this.avg = this.N ? this.dl.reduce((a, c) => a + c, 0) / this.N : 1;
    this.prefix = new Map();
    for (const t of this.df.keys()) if (t.length >= 6) { const k = t.slice(0, 5); if (!this.prefix.has(k)) this.prefix.set(k, []); this.prefix.get(k).push(t); }
  }
  idf(t) { const n = this.df.get(t) || 0; return Math.log(1 + (this.N - n + 0.5) / (n + 0.5)); }
  scoreAll(qterms) {
    const sc = new Array(this.N).fill(0);
    for (const [t, w] of qterms) {
      if (!this.df.has(t)) continue;
      const idf = this.idf(t);
      for (let i = 0; i < this.N; i++) {
        const f = this.tf[i].get(t);
        if (f) sc[i] += w * idf * (f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + this.b * this.dl[i] / this.avg));
      }
    }
    return sc;
  }
  top(qterms, k, exclude) {
    const sc = this.scoreAll(qterms);
    const order = sc.map((_, i) => i).sort((a, b) => (sc[b] - sc[a]) || (a - b));
    const out = [];
    for (const i of order) {
      if (sc[i] <= 0 || out.length >= k) break;
      if (exclude && exclude.has(this.p[i].id)) continue;
      out.push([sc[i], i]);
    }
    return out;
  }
}

/* ---------- query building (term -> weight, a Map) ---------- */
export function add(d, toks, w) { for (const t of toks) d.set(t, d.has(t) ? Math.max(d.get(t), w) : w); }

/* the MCQ flavour: stem + the stored answer's concept + every other option (same weights as the Python pipeline) */
export function focusedQuery(q) {
  const d = new Map();
  add(d, tokenize(q.stem), 1.0);
  add(d, tokenize(q.opts.filter(o => q.keys.includes(o.o)).map(o => o.t).join(' ')), 1.6);
  for (const o of q.opts) if (!q.keys.includes(o.o)) add(d, tokenize(o.t), 0.7);
  return d;
}

export function makeSynonyms(groups) {
  const syn = new Map();
  for (const grp of groups || []) {
    const flat = [...new Set(grp.flatMap(x => tokenize(x)))].sort();
    for (const t of flat) { if (!syn.has(t)) syn.set(t, new Set()); for (const s of flat) syn.get(t).add(s); }
  }
  return syn;
}

/* synonyms/abbreviations + prefix variants of the terms already in d (as in expanded_query) */
export function expandTerms(d, idx, syn) {
  const base = new Map(d);
  for (const [t, w] of base) {
    for (const s of (syn && syn.get(t)) || []) if (s !== t) add(d, [s], w * 0.8);
    if (t.length >= 6 && idx) for (const v of idx.prefix.get(t.slice(0, 5)) || []) if (v !== t) add(d, [v], w * 0.45);
  }
  return d;
}

export function expandedQuery(q, idx, syn) {
  const d = expandTerms(focusedQuery(q), idx, syn);
  for (const o of q.opts) add(d, tokenize(o.t), 0.9);
  return d;
}

/* a free-form student question: the text, the English keywords Gemini extracted from it (Arabic questions), the previous student turn */
export function chatQuery(text, keywords, prevUser) {
  const d = new Map();
  const en = x => tokenize(String(x || '').replace(/[^\x00-\x7F]+/g, ' '));   // the books are English: Arabic words can never match
  add(d, en(text), 1.0);
  if (keywords) add(d, en(keywords), 1.3);
  if (prevUser) add(d, en(prevUser), 0.5);
  return d;
}

/* ---------- running a query over one subject's sources (the first source that reaches the floor wins, else the best) ---------- */
export function runSources(sources, qterms, k, floor, syn) {
  let best = [];
  for (const [, idx] of sources) {
    const terms = syn ? expandTerms(new Map(qterms), idx, syn) : qterms;
    const hits = idx.top(terms, k).map(([sc, i]) => [sc, i, idx]);
    if (hits.length && hits[0][0] >= floor) return hits;
    if (hits.length && (!best.length || hits[0][0] > best[0][0])) best = hits;
  }
  return best;
}


/* ---------- free questions: a score that means the same thing in every book ----------
   Raw BM25 depends on the size of each book (a small book gives big IDF), so across subjects it cannot be compared or thresholded.
   ratio = what the passage scores / the most any passage could score for this query in this book (terms the book never mentions count as
   maximal-IDF misses). 1 = the passage has every query term. Hits come back as [ratio, indexInBook, Index, rawScore]. */
export function chatHits(sources, base, k, syn) {
  const out = [];
  const maxOf = (terms, idx) => { let m = 0; for (const [t, w] of terms) m += w * (idx.df.has(t) ? idx.idf(t) : Math.log(1 + (idx.N + 0.5) / 0.5)) * (idx.k1 + 1); return m; };
  for (const [, idx] of sources) {
    const mb = maxOf(base, idx);
    if (!mb) continue;
    const exp = expandTerms(new Map(base), idx, syn), me = maxOf(exp, idx);
    const sc = idx.scoreAll(exp), sb = idx.scoreAll(base);
    const order = sc.map((_, i) => i).filter(i => sc[i] > 0).sort((a, b) => (sc[b] - sc[a]) || (a - b)).slice(0, k);
    for (const i of order) out.push([Math.max(sb[i] / mb, sc[i] / me), i, idx, sc[i]]);
  }
  return out.sort((a, b) => b[0] - a[0]);
}

/* hit section + next section (+ previous when short), each starting with its printed heading; a section never appears twice */
export function pack(hits) {
  const used = new Set(), blocks = [];
  for (const [score, i, idx] of hits) {
    if (used.has(idx.p[i].id)) continue;
    let parts = [idx.p[i].text];
    used.add(idx.p[i].id);
    const short = idx.p[i].body.split(/\s+/).filter(Boolean).length < 40;
    for (const [j, cap] of [[i - 1, short ? 60 : 0], [i + 1, 90]]) {
      if (cap && j >= 0 && j < idx.N && idx.p[j].chapter === idx.p[i].chapter && !used.has(idx.p[j].id)) {
        const w = idx.p[j].text.split('\n');
        const head = w[0], rest = w.slice(1).join('\n');
        const body = rest.split(/\s+/).filter(Boolean).slice(0, cap).join(' ');
        const ctx = (head + '\n' + body).trim();
        parts = j < i ? [ctx, ...parts] : [...parts, ctx];
        used.add(idx.p[j].id);
      }
    }
    const p = idx.p[i];
    blocks.push({ id: p.id, score: Math.round(score * 100) / 100, text: parts.join('\n\n'), heading: p.heading, book: p.book, chapter: p.chapter, page: p.page, sid: p.sid });
  }
  return blocks;
}

/* passages rows from the database -> {sid: [[src, Index], ...]} in source-priority order */
export function buildSources(rows) {
  const bySid = new Map();
  for (const r of rows) {
    const head = r.heading || 'Relevant section';
    const ps = { id: r.id, sid: r.sid, src: r.src, ord: r.ord, seq: r.seq, book: r.book, chapter: r.chapter || '', heading: r.heading || '', page: r.page || '', body: r.body, text: (head + '\n' + r.body).trim() };
    if (!bySid.has(r.sid)) bySid.set(r.sid, new Map());
    const m = bySid.get(r.sid);
    if (!m.has(r.src)) m.set(r.src, { ord: r.ord, list: [] });
    m.get(r.src).list.push(ps);
  }
  const out = {};
  for (const [sid, m] of bySid) {
    out[sid] = [...m.entries()].sort((a, b) => a[1].ord - b[1].ord)
      .map(([src, v]) => [src, new Index(v.list.sort((a, b) => (a.seq - b.seq) || (a.id - b.id)))]);
  }
  return out;
}

export function arabicRatio(s) {
  let L = 0, A = 0;
  for (const ch of String(s || '')) { if (/\p{L}/u.test(ch)) { L++; if (/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(ch)) A++; } }
  return L ? A / L : 0;
}
export function latinTokens(s) { return tokenize(String(s || '').replace(/[^\x00-\x7F]+/g, ' ')); }
