// A small in-memory stand-in for the parts of Firestore (firebase-admin) that the Cloud Functions use.
// It checks the LOGIC of our code (quota counting, cache, transactions, queries), not Firestore itself.
// Real Firestore behaviour is checked by tools/firebase/selftest.mjs (against the real project) and the rules by tests/rules (emulator, CI).
class Ts { constructor(ms) { this.ms = ms; } toMillis() { return this.ms; } }
export function makeFakeFirestore(o) {
  o = o || {};
  const clock = o.now || (() => Date.now());
  const cols = new Map(); let lock = Promise.resolve(); let ops = 0;
  const col = n => { if (!cols.has(n)) cols.set(n, new Map()); return cols.get(n); };
  const SERVER_TS = { __fv: 'ts' };
  const FV = { serverTimestamp: () => SERVER_TS, increment: n => ({ __fv: 'inc', n }) };
  const resolve = (cur, v) => (v && v.__fv === 'ts') ? new Ts(clock()) : (v && v.__fv === 'inc') ? (Number(cur) || 0) + v.n : v;
  const apply = (base, patch) => { const out = Object.assign({}, base); for (const [k, v] of Object.entries(patch)) out[k] = resolve(out[k], v); return out; };
  const alreadyExists = p => Object.assign(new Error('6 ALREADY_EXISTS: ' + p), { code: 6 });
  const notFound = p => Object.assign(new Error('5 NOT_FOUND: ' + p), { code: 5 });
  class Snap { constructor(ref, data) { this.ref = ref; this._d = data; this.exists = data !== undefined; this.id = ref.id; } data() { return this._d === undefined ? undefined : Object.assign({}, this._d); } }
  class Ref {
    constructor(c, id) { this.c = c; this.id = id; this.path = c + '/' + id; }
    async get() { ops++; return new Snap(this, col(this.c).get(this.id)); }
    async set(d, opt) { ops++; const cur = col(this.c).get(this.id); col(this.c).set(this.id, opt && opt.merge ? apply(cur || {}, d) : apply({}, d)); }
    async create(d) { ops++; if (col(this.c).has(this.id)) throw alreadyExists(this.path); col(this.c).set(this.id, apply({}, d)); }
    async update(d) { ops++; if (!col(this.c).has(this.id)) throw notFound(this.path); col(this.c).set(this.id, apply(col(this.c).get(this.id), d)); }
    async delete() { ops++; col(this.c).delete(this.id); }
  }
  class Query {
    constructor(c, f, ord, lim) { this.c = c; this.f = f || []; this.ord = ord || null; this.lim = lim || null; }
    where(field, op, val) { return new Query(this.c, this.f.concat([[field, op, val]]), this.ord, this.lim); }
    orderBy(field, dir) { return new Query(this.c, this.f, [field, dir || 'asc'], this.lim); }
    limit(n) { return new Query(this.c, this.f, this.ord, n); }
    select() { return this; }
    count() { const self = this; return { get: async () => ({ data: () => ({ count: self._rows().length }) }) }; }
    _rows() {
      let rows = [...col(this.c).entries()].filter(([, d]) => this.f.every(([k, op, v]) => {
        const x = d[k]; const xv = x instanceof Ts ? x.ms : x;
        if (op === '==') return xv === v; if (op === '<') return xv < v; if (op === '<=') return xv <= v; if (op === '>') return xv > v; if (op === '>=') return xv >= v;
        throw new Error('fake: op ' + op);
      }));
      if (this.ord) { const [k, dir] = this.ord; rows.sort((a, b) => { const x = a[1][k] instanceof Ts ? a[1][k].ms : a[1][k], y = b[1][k] instanceof Ts ? b[1][k].ms : b[1][k]; return (x < y ? -1 : x > y ? 1 : 0) * (dir === 'desc' ? -1 : 1); }); }
      if (this.lim) rows = rows.slice(0, this.lim);
      return rows;
    }
    async get() {
      ops++; const snaps = this._rows().map(([id, d]) => new Snap(new Ref(this.c, id), d));
      return { docs: snaps, size: snaps.length, empty: !snaps.length, forEach: fn => snaps.forEach(fn) };
    }
  }
  const db = {
    collection: n => { const q = new Query(n); q.doc = id => new Ref(n, id); return q; },
    batch() { const ops_ = []; return { delete: r => { ops_.push(() => col(r.c).delete(r.id)); }, set: (r, d) => { ops_.push(() => col(r.c).set(r.id, apply({}, d))); }, commit: async () => { ops_.forEach(f => f()); } }; },
    async runTransaction(fn) {                       // serialised: enough to model Firestore's optimistic retry for our purposes
      const run = lock.then(async () => {
        const writes = [];
        const tx = {
          get: async r => new Snap(r, col(r.c).get(r.id)),
          set: (r, d, opt) => { writes.push(() => { const cur = col(r.c).get(r.id); col(r.c).set(r.id, opt && opt.merge ? apply(cur || {}, d) : apply({}, d)); }); },
          update: (r, d) => { writes.push(() => { if (!col(r.c).has(r.id)) throw notFound(r.path); col(r.c).set(r.id, apply(col(r.c).get(r.id), d)); }); },
        };
        const out = await fn(tx); writes.forEach(w => w()); return out;
      });
      lock = run.catch(() => {}); return run;
    },
  };
  return { db, FV, Ts, cols, col, opsCount: () => ops, put: (c, id, d) => col(c).set(id, apply({}, d)), dump: c => Object.fromEntries(col(c)) };
}
