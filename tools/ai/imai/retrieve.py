"""Free local retrieval (BM25) with the same two attempts as the File Search flow: focused first, expanded only when the first attempt
did not give decisive evidence. An optional Gemini File Search adapter (kind = file_search) is included but OFF by default."""
import json, math, os, re

from . import ROOT
from .util import read_json

_STOP = set('''a an and are as at be been being by for from had has have having he her his how i if in into is it its of on or our she so such than that the their them then there these they this those
to was we were what when where which who whom whose why will with would you your not no yes all any each both either only other more most less least can could may might must shall should also very
following true false correct incorrect except statement statements choose select best answer one two three four following about above below between during after before over under per via
which following regarding case patient male female year old came hospital'''.split())
_NEG = re.compile(r'\b(except|not|false|incorrect|wrong|least|never|exception)\b', re.I)
_TOK = re.compile(r"[^\W_]+(?:[-'][^\W_]+)*", re.U)


def _stem(w):
    if len(w) > 4 and w.endswith('ies'):
        return w[:-3] + 'y'
    if len(w) > 4 and re.search(r'(ches|shes|xes|zes|sses)$', w):
        return w[:-2]
    if len(w) > 3 and w.endswith('s') and not re.search(r'(ss|us|is)$', w):
        return w[:-1]
    if len(w) > 6 and w.endswith('ing'):
        return w[:-3]
    if len(w) > 5 and w.endswith('ed'):
        return w[:-2]
    return w


def tokenize(text, keep_stop=False):
    out = []
    for m in _TOK.findall((text or '').lower()):
        parts = [m] + (m.replace("'", '-').split('-') if ('-' in m or "'" in m) else [])
        for p in parts:
            if not p or (len(p) < 2 and not p.isdigit()):
                continue
            if not keep_stop and p in _STOP:
                continue
            out.append(_stem(p))
    return out


class Index:
    def __init__(self, passages, k1=1.2, b=0.75):
        self.p = passages
        self.k1, self.b = k1, b
        self.tf, self.dl, self.df = [], [], {}
        for ps in passages:
            toks = tokenize(ps['heading'] + ' ' + ps['heading'] + ' ' + ps['body'])       # heading counts double
            d = {}
            for t in toks:
                d[t] = d.get(t, 0) + 1
            self.tf.append(d)
            self.dl.append(len(toks))
            for t in d:
                self.df[t] = self.df.get(t, 0) + 1
        self.N = len(passages)
        self.avg = (sum(self.dl) / float(self.N)) if self.N else 1.0
        self.vocab_by_prefix = {}
        for t in self.df:
            if len(t) >= 6:
                self.vocab_by_prefix.setdefault(t[:5], []).append(t)

    def idf(self, t):
        n = self.df.get(t, 0)
        return math.log(1 + (self.N - n + 0.5) / (n + 0.5))

    def score_all(self, qterms):
        """qterms: {term: weight} -> list of scores per passage."""
        sc = [0.0] * self.N
        for t, w in qterms.items():
            if t not in self.df:
                continue
            idf = self.idf(t)
            for i, d in enumerate(self.tf):
                f = d.get(t)
                if f:
                    sc[i] += w * idf * (f * (self.k1 + 1)) / (f + self.k1 * (1 - self.b + self.b * self.dl[i] / self.avg))
        return sc

    def top(self, qterms, k, exclude=()):
        sc = self.score_all(qterms)
        order = sorted(range(self.N), key=lambda i: (-sc[i], i))
        out = []
        for i in order:
            if sc[i] <= 0 or len(out) >= k:
                break
            if self.p[i]['id'] in exclude:
                continue
            out.append((sc[i], i))
        return out


# ---------- query building ----------
def _add(d, toks, w):
    for t in toks:
        d[t] = max(d.get(t, 0), w) if t in d else w


def focused_query(q):
    """exact stem phrase terms + the concept of the stored answer + the decisive term of every option."""
    d = {}
    _add(d, tokenize(q['stem']), 1.0)
    key_txt = ' '.join(o['t'] for o in q['opts'] if o['o'] in q['keys'])
    _add(d, tokenize(key_txt), 1.6)
    for o in q['opts']:
        if o['o'] not in q['keys']:
            _add(d, tokenize(o['t']), 0.7)
    return d


_syn = None


def _synonyms():
    global _syn
    if _syn is None:
        g = (read_json(os.path.join(ROOT, 'synonyms.json'), {}) or {}).get('groups', [])
        _syn = {}
        for grp in g:
            toks = [tokenize(x) for x in grp]
            flat = sorted({t for ts in toks for t in ts})
            for t in flat:
                _syn.setdefault(t, set()).update(flat)
    return _syn


def expanded_query(q, idx):
    """focused terms + synonyms/abbreviations + prefix variants + every option claim as its own mini query (negative stems keep the positive rule)."""
    d = focused_query(q)
    base = dict(d)
    syn = _synonyms()
    for t, w in base.items():
        for s in syn.get(t, ()):
            if s != t:
                _add(d, [s], w * 0.8)
        if len(t) >= 6:
            for v in idx.vocab_by_prefix.get(t[:5], ()):
                if v != t:
                    _add(d, [v], w * 0.45)
    for o in q['opts']:
        _add(d, tokenize(o['t']), 0.9)
    return d


def has_negation(stem):
    return bool(_NEG.search(stem or ''))


class LocalRetriever:
    def __init__(self, source_passages, cfg):
        """source_passages: [(source_id, [passages])] in the order the server wants (first source is tried first)."""
        self.sources = [(sid, Index(ps)) for sid, ps in source_passages if ps]
        self.cfg = cfg

    def available(self):
        return bool(self.sources)

    def _run(self, qterms, k):
        # one connected source at a time, in order; the first source that reaches the score floor wins, otherwise the best of all
        floor = self.cfg.get('min_top_score', 4.0)
        best = []
        for sid, idx in self.sources:
            hits = [(sc, i, idx) for sc, i in idx.top(qterms, k)]
            if hits and hits[0][0] >= floor:
                return hits
            if hits and (not best or hits[0][0] > best[0][0]):
                best = hits
        return best

    def focused(self, q):
        hits = self._run(focused_query(q), self.cfg.get('focused_k', 6))
        return self._pack(hits)

    def expanded(self, q):
        qt = None
        hits = []
        floor = self.cfg.get('min_top_score', 4.0)
        for sid, idx in self.sources:
            qt = expanded_query(q, idx)
            h = [(sc, i, idx) for sc, i in idx.top(qt, self.cfg.get('expanded_k', 10))]
            if h and (not hits or h[0][0] > hits[0][0]):
                hits = h
            if h and h[0][0] >= floor:
                break
        return self._pack(hits)

    def _pack(self, hits_by_idx):
        """hits_by_idx: [(score, index, Index)] -> evidence blocks. Each block = the hit section + the next section (and the previous one when the hit is short),
        every section starting with its printed heading, so the model has enough surrounding context. A section never appears in two blocks."""
        used, blocks = set(), []
        for score, i, idx in hits_by_idx:
            if idx.p[i]['id'] in used:
                continue
            parts = [idx.p[i]['text']]
            used.add(idx.p[i]['id'])
            short = len(idx.p[i]['body'].split()) < 40
            for j, cap in ((i - 1, 60 if short else 0), (i + 1, 90)):
                if cap and 0 <= j < idx.N and idx.p[j]['chapter'] == idx.p[i]['chapter'] and idx.p[j]['id'] not in used:
                    w = idx.p[j]['text'].split('\n', 1)
                    body = ' '.join((w[1] if len(w) > 1 else '').split()[:cap])
                    ctx = (w[0] + '\n' + body).strip()
                    parts = ([ctx] + parts) if j < i else (parts + [ctx])
                    used.add(idx.p[j]['id'])
            p = idx.p[i]
            blocks.append({'id': p['id'], 'score': round(score, 2), 'text': '\n\n'.join(parts), 'heading': p['heading'], 'book': p['book'],
                           'chapter': p['chapter'], 'page': p['page']})
        return blocks


# ---------- optional: Gemini File Search (needs a key and an indexed store; not tested offline) ----------
class FileSearchRetriever:
    """Runs the owner's retrieval prompts (01 focused / 02 expanded) against Gemini with the file_search tool and turns the grounding
    chunks into evidence blocks. A reply containing NO_DECISIVE_EVIDENCE gives no blocks. Both REST casings are handled."""
    def __init__(self, provider, store, prompts_mod):
        self.provider, self.store, self.P = provider, store, prompts_mod

    def available(self):
        return True

    def _call(self, q, attempt, **kw):
        system = self.P.retrieval_system(attempt)
        user = self.P.build_input(q, **kw)
        text, raw = self.provider.generate_with_file_search(system, user, self.store)
        if self.P.NO_EVIDENCE in (text or ''):
            return []
        meta = (raw.get('candidates') or [{}])[0]
        gm = meta.get('groundingMetadata') or meta.get('grounding_metadata') or {}
        chunks = gm.get('groundingChunks') or gm.get('grounding_chunks') or []
        blocks = []
        for c in chunks:
            rc = c.get('retrievedContext') or c.get('retrieved_context') or {}
            t = (rc.get('text') or '').strip()
            if t:
                blocks.append({'id': 'fs%d' % len(blocks), 'score': 0, 'text': t, 'heading': '', 'book': rc.get('title', ''), 'chapter': '', 'page': ''})
        return blocks

    def focused(self, q, **kw):
        return self._call(q, 'focused', **kw)

    def expanded(self, q, **kw):
        return self._call(q, 'expanded', **kw)
