"""Small shared helpers: text normalisation, the question hash (must match js/ai.js), language checks, atomic JSON files."""
import json, os, re, tempfile

_AR = re.compile(r'[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]')


def norm_ws(s):
    return re.sub(r'\s+', ' ', s or '').strip()


# ---------- the question fingerprint ----------
# The explanation depends on: the wording, the options and the key the site currently uses.
# If any of them changes (a corrected key in js/fixes.js, a fixed typo) the hash changes and the cached
# explanation stops being shown until it is regenerated.  js/ai.js implements the SAME function (IM.aiHash).
def fingerprint(q):
    parts = [norm_ws(q['stem'])]
    for o in q['opts']:
        parts.append(o['o'] + ':' + norm_ws(o['t']))
    parts.append('K:' + ','.join(sorted(q['keys'])))
    return '\n'.join(parts)


def fnv1a(s):
    h = 0x811C9DC5
    for b in s.encode('utf-8'):
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return '%08x' % h


def q_hash(q):
    return fnv1a(fingerprint(q))


# ---------- language ----------
def letters(s):
    return [c for c in (s or '') if c.isalpha()]


def arabic_ratio(s):
    L = letters(s)
    if not L:
        return 0.0
    return sum(1 for c in L if _AR.match(c)) / float(len(L))


def starts_arabic(s):
    for c in (s or ''):
        if c.isalpha():
            return bool(_AR.match(c))
    return False


def has_arabic_early(s, n=60):
    return any(_AR.match(c) for c in (s or '')[:n])


# ---------- files ----------
def read_json(path, default=None):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return default


def write_json(path, obj, compact=False):
    d = os.path.dirname(path) or '.'
    os.makedirs(d, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix='.tmp-', dir=d)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            if compact:
                json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))
            else:
                json.dump(obj, f, ensure_ascii=False, indent=1)
            f.write('\n')
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def append_jsonl(path, obj):
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    with open(path, 'a', encoding='utf-8') as f:
        f.write(json.dumps(obj, ensure_ascii=False) + '\n')
