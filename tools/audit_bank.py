#!/usr/bin/env python3
"""فحص أسئلة كل المواد للقراءة بس: بيطلّع تقرير بالأخطاء المؤكدة (ميكانيكية) ومعاها قايمة مرشّحات غير مؤكدة منفصلة. مابيعدّلش أي ملف داتا.

usage:  python3 tools/audit_bank.py <questions.json> <site-dir> <report.json>
  questions.json : ناتج tools/ai/export_bank.js (الأسئلة زي ما الموقع بيشوفها، المفاتيح المصحّحة متطبّقة)
  site-dir       : فولدر الموقع (للتأكد إن ملفات الصور موجودة)

أخطاء مؤكدة (errors): حاجة غلط بالتعريف مش رأي:
  no-stem, one-option, option-gap, dup-letter, empty-option, key-missing, key-not-in-options, no-key,
  dup-option-text, key-on-duplicate-text, bad-char, mixed-script, entity-leak, fig-missing, dup-id,
  same-question-conflicting-key
مرشّحات (candidates): ممكن تكون غلط وممكن لأ، محتاجة عين بشرية: بتتحط لوحدها ومش بتتحسب خطأ."""
import json, os, re, sys, unicodedata
from collections import defaultdict

qf, site, out = sys.argv[1], sys.argv[2], sys.argv[3]
Q = json.load(open(qf, encoding='utf-8'))

errors, cands, info = [], [], defaultdict(list)


def ws(s): return re.sub(r'\s+', ' ', str(s or '')).strip()


def norm(s):
    s = unicodedata.normalize('NFKC', ws(s)).lower()
    s = re.sub(r'[\u2010-\u2015\u2212\u2013\u2014]', '-', s)          # all dash/minus variants -> '-'
    s = s.replace('\u207a', '+').replace('\u207b', '-')                  # superscript plus/minus
    s = re.sub(r'[^\w\s+\-=<>%]', ' ', s)                                 # keep the signs that carry meaning
    s = re.sub(r'(?<=\w)\s+(?=[+\-]\w)', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()


def add(kind, q, msg, lst=errors, **kw):
    lst.append(dict(kind=kind, id=q['id'], sid=q['sid'], n=q.get('n', ''), msg=msg, **kw))


# ---- scripts: a Latin word that contains a letter from another script (the classic lookalike: Cyrillic "о", "С", "Р" ...)
def script(c):
    if not c.isalpha(): return None
    try: nm = unicodedata.name(c)
    except ValueError: return 'UNKNOWN'
    return nm.split()[0]  # LATIN / CYRILLIC / GREEK / ARABIC ...


GREEK_OK = re.compile(r'[αβγδεζηθικλμνξοπρστυφχψωΔΣΩΘΛΦΨΓ]')
seen_ids = set()
for q in Q:
    if q['id'] in seen_ids: add('dup-id', q, 'id repeated in the bank')
    seen_ids.add(q['id'])
    canc = q['canc']
    stem = q['stem'] or ''
    opts = q['opts'] or []
    letters = [o['o'] for o in opts]
    # ---------- structure
    if len(re.sub(r'[\W_]', '', stem)) < 3: add('no-stem', q, 'stem empty or almost empty: %r' % stem)
    if len(opts) < 2 and not canc: add('one-option', q, 'only %d option(s)' % len(opts))
    if len(set(letters)) != len(letters): add('dup-letter', q, 'option letters repeat: %s' % ','.join(letters))
    exp = [chr(97 + i) for i in range(len(letters))]
    if letters != exp and len(set(letters)) == len(letters) and not canc:
        add('option-gap', q, 'option letters are %s, not %s' % (','.join(letters), ','.join(exp)), lst=info['letters-not-contiguous'])
    for o in opts:
        if not ws(o['t']): add('empty-option', q, 'option %s has no text' % o['o'])
    keys = q['keys'] or []
    if not canc:
        if not keys: add('no-key', q, 'no key and not cancelled')
        for k in keys:
            if k not in letters: add('key-not-in-options', q, 'key %s is not among options %s' % (k, ','.join(letters)))
    # same text under two options
    byt = defaultdict(list)
    for o in opts: byt[norm(o['t'])].append(o['o'])
    for t, ls in byt.items():
        if t and len(ls) > 1 and not canc:
            kk = [k for k in keys if k in ls]
            if kk: add('key-on-duplicate-text', q, 'options %s have identical text %r and the key %s is one of them' % (','.join(ls), t[:50], ','.join(kk)))
            else: add('dup-option-text', q, 'options %s have identical text %r' % (','.join(ls), t[:50]))
    # ---------- text artefacts
    texts = [('stem', stem)] + [('opt ' + o['o'], o['t']) for o in opts]
    for where, t in texts:
        t = t or ''
        bad = [c for c in t if c == '�' or (0xE000 <= ord(c) <= 0xF8FF) or (ord(c) < 32 and c not in '\n\t') or ord(c) == 0x7f]
        if bad: add('bad-char', q, '%s has undecodable/private-use/control character(s) %s' % (where, ' '.join('U+%04X' % ord(c) for c in sorted(set(bad)))))
        if re.search(r'&(?:amp|lt|gt|nbsp|quot|#\d+);', t): add('entity-leak', q, '%s shows an HTML entity as text: %r' % (where, re.search(r'&\w+;|&#\d+;', t).group(0)))
        if re.search(r'Ã.|â€', t): add('bad-char', q, '%s looks like mojibake: %r' % (where, re.search(r'Ã.|â€.?', t).group(0)))
        # mixed script inside one word
        for w in re.findall(r'\w+', t):
            sc = {script(c) for c in w if c.isalpha()} - {None}
            if 'CYRILLIC' in sc and sc - {'CYRILLIC'}:
                add('mixed-script', q, '%s: word %r mixes Cyrillic with other letters' % (where, w))
            elif 'CYRILLIC' in sc:
                add('mixed-script', q, '%s: word %r is entirely Cyrillic inside the question' % (where, w))
            elif 'ARABIC' in sc and 'LATIN' in sc:
                cands.append(dict(kind='arabic-latin-word', id=q['id'], sid=q['sid'], n=q.get('n', ''), msg='%s: word %r mixes Arabic and Latin letters' % (where, w)))
            elif 'GREEK' in sc and 'LATIN' in sc and not re.fullmatch(r'[A-Za-z0-9]*[αβγδεζηθικλμνξοπρστυφχψω][A-Za-z0-9]*', w):
                cands.append(dict(kind='greek-latin-word', id=q['id'], sid=q['sid'], n=q.get('n', ''), msg='%s: word %r mixes Greek and Latin letters' % (where, w)))
    # ---------- figures
    if q.get('fig'):
        p = os.path.join(site, q['fig'])
        if not os.path.exists(p): add('fig-missing', q, 'figure file not found: %s' % q['fig'])

# ---------- the same question twice with a different key
def sig(q): return norm(q['stem'])
groups = defaultdict(list)
for q in Q:
    if not q['canc'] and q['keys']: groups[sig(q)].append(q)
conf = 0
for s, g in groups.items():
    if len(g) < 2 or len(s) < 12: continue
    # compare only questions whose option TEXTS are the same set (so a re-ordered copy is recognised)
    base = defaultdict(list)
    for q in g: base[frozenset(norm(o['t']) for o in q['opts'])].append(q)
    for optset, same in base.items():
        if len(same) < 2: continue
        answers = {}
        for q in same:
            at = frozenset(norm(o['t']) for o in q['opts'] if o['o'] in q['keys'])
            answers.setdefault(at, []).append(q)
        if len(answers) > 1:
            conf += 1
            ids = [q['id'] for q in same]
            errors.append(dict(kind='same-question-conflicting-key', id=ids[0], sid=same[0]['sid'], n='', msg='the same question and options appear %d times with different correct answers' % len(same),
                               items=[dict(id=q['id'], sid=q['sid'], n=q['n'], key=','.join(q['keys']), key_text=' / '.join(o['t'] for o in q['opts'] if o['o'] in q['keys'])[:90]) for q in same]))
# the same question written twice (stem nearly identical, options mostly shared): the SAME option is the key in one copy
# and a wrong answer in the other = a real contradiction. Only candidates: the pair may still be a legitimate variation.
def toks(s): return set(norm(s).split())
def jac(a, b): return len(a & b) / len(a | b) if (a | b) else 0
live = [q for q in Q if not q['canc'] and q['keys'] and len(norm(q['stem'])) >= 12]
info_ = []
for q in live:
    q['_st'] = toks(q['stem']); q['_ot'] = {norm(o['t']) for o in q['opts']}
    q['_kt'] = {norm(o['t']) for o in q['opts'] if o['o'] in q['keys']}
reported = {tuple(sorted(i['id'] for i in e['items'])) for e in errors if e['kind'] == 'same-question-conflicting-key'}
by_sub = defaultdict(list)
for q in live: by_sub[q['sid']].append(q)
pairs = 0
for sid, lst in by_sub.items():
    for i in range(len(lst)):
        A = lst[i]
        for j in range(i + 1, len(lst)):
            B = lst[j]
            if jac(A['_st'], B['_st']) < 0.92 or jac(A['_ot'], B['_ot']) < 0.5: continue
            if A['_kt'] == B['_kt']: continue
            cross = (A['_kt'] & B['_ot']) - B['_kt'] or (B['_kt'] & A['_ot']) - A['_kt']
            if not cross: continue
            if tuple(sorted([A['id'], B['id']])) in reported: continue
            pairs += 1
            cands.append(dict(kind='near-duplicate-conflicting-key', id=A['id'], sid=sid, n='', msg='near-identical question; an option that is correct in one copy is a wrong answer in the other',
                              items=[dict(id=x['id'], n=x['n'], tags=x['tags'], key=','.join(x['keys']), key_text=' / '.join(o['t'] for o in x['opts'] if o['o'] in x['keys'])[:90], stem=x['stem'][:110]) for x in (A, B)]))

# an option that cites a letter the question does not have ("a and f" in a 5-option question), a label that leaked into the text
for q in Q:
    if q['canc']: continue
    letters = {o['o'] for o in q['opts']}
    for o in q['opts']:
        t = ws(o['t'])
        m = re.fullmatch(r'\(?([a-f])\)?(?:\s*(?:,|&|\+|and|or|&amp;)\s*\(?([a-f])\)?)+\.?', t, re.I)
        if m:
            cited = set(re.findall(r'(?<![A-Za-z])([a-f])(?![A-Za-z])', t, re.I)); cited = {c.lower() for c in cited}
            if cited - letters: add('option-cites-missing-letter', q, 'option %s says %r but the question has no option %s' % (o['o'], t, ','.join(sorted(cited - letters))))
            if o['o'] in cited: add('option-cites-itself', q, 'option %s says %r (refers to itself)' % (o['o'], t))
        if re.match(r'^[a-f]\s*[\)\-]\s*\S', t) and not re.match(r'^[a-f]\s*\-\s*(?:and|helix|[a-z]{2,})', t, re.I):
            cands.append(dict(kind='label-leak', id=q['id'], sid=q['sid'], n=q['n'], msg='option %s text starts like a label: %r' % (o['o'], t[:40])))
    if re.match(r'^\d{1,3}\s*[\.\)\-]\s', ws(q['stem'])): add('number-leak', q, 'stem starts with its own number: %r' % ws(q['stem'])[:30])

# ---------- information (not errors)
exact = defaultdict(list)
for q in Q:
    if not q['canc']: exact[(norm(q['stem']), tuple(sorted((norm(o['t'])) for o in q['opts'])), tuple(sorted(norm(o['t']) for o in q['opts'] if o['o'] in q['keys'])))].append(q['id'])
info['exact-duplicate-groups'] = [v for v in exact.values() if len(v) > 1]
for q in Q:
    if len(q['keys'] or []) > 1: info['multi-key'].append(q['id'])
    if q['canc']: info['cancelled'].append(q['id'])
    if len(q['opts']) not in (4, 5): info['option-count-not-4-or-5'].append('%s(%d)' % (q['id'], len(q['opts'])))

summary = defaultdict(int)
for e in errors: summary[e['kind']] += 1
per_sub = defaultdict(lambda: defaultdict(int))
for e in errors: per_sub[e['sid']][e['kind']] += 1
res = dict(total=len(Q), errors=errors, errors_by_kind=dict(summary), errors_by_subject={k: dict(v) for k, v in per_sub.items()},
           candidates=cands, info={k: len(v) for k, v in info.items()}, info_ids={k: v for k, v in info.items()})
json.dump(res, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('questions', len(Q), '| errors', len(errors), dict(summary), '| candidates', len(cands), '| info', {k: len(v) for k, v in info.items()})
