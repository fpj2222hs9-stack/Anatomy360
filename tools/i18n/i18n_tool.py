#!/usr/bin/env python3
"""i18n_tool: extract Arabic UI string literals from js/*.js and check an English dictionary against them.
  python3 tools/i18n/i18n_tool.py extract js/ui.js js/home.js        # list: file:line<TAB>literal
  python3 tools/i18n/i18n_tool.py check tools/i18n/en/ui.json js/ui.js js/home.js   # list literals not covered + bad placeholders
  python3 tools/i18n/i18n_tool.py build                               # merge tools/i18n/en/*.json -> js/i18n-en.js
Dictionary format: {"<arabic text or template with {}>": "<english, {1} {2}.. for the placeholders>", "__skip__": ["<arabic literal that must stay Arabic>", ...]}"""
import sys, re, json, glob, os
AR = re.compile(r'[؀-ۿ]')
REGEX_PREV = set('(,=:[!&|?{};+-*%<>~')
def scan(src):
    """yield (line, literal) for every ' " ` string literal that has Arabic; skips comments and regex literals"""
    i, n, line, prev = 0, len(src), 1, ''
    out = []
    while i < n:
        c = src[i]
        if c == '\n': line += 1; i += 1; continue
        if c == '/' and i + 1 < n and src[i+1] == '/':
            while i < n and src[i] != '\n': i += 1
            continue
        if c == '/' and i + 1 < n and src[i+1] == '*':
            j = src.find('*/', i + 2); j = n if j < 0 else j + 2
            line += src.count('\n', i, j); i = j; continue
        if c in '\'"`':
            q, j, buf, start = c, i + 1, [], line
            while j < n:
                d = src[j]
                if d == '\\' and j + 1 < n:
                    e = src[j+1]
                    if e == 'n': buf.append('\n'); j += 2
                    elif e == 't': buf.append('\t'); j += 2
                    elif e == 'u' and re.match(r'[0-9a-fA-F]{4}', src[j+2:j+6]): buf.append(chr(int(src[j+2:j+6], 16))); j += 6
                    elif e == 'x' and re.match(r'[0-9a-fA-F]{2}', src[j+2:j+4]): buf.append(chr(int(src[j+2:j+4], 16))); j += 4
                    elif e == '\n': line += 1; j += 2
                    else: buf.append(e); j += 2
                    continue
                if d == q: break
                if d == '\n':
                    line += 1
                    if q != '`': break
                if q == '`' and d == '$' and j + 1 < n and src[j+1] == '{':
                    buf.append('{}'); depth = 1; j += 2
                    while j < n and depth:
                        if src[j] == '{': depth += 1
                        elif src[j] == '}': depth -= 1
                        elif src[j] == '\n': line += 1
                        j += 1
                    continue
                buf.append(d); j += 1
            lit = ''.join(buf)
            if AR.search(lit): out.append((start, lit))
            i = j + 1; prev = 'x'; continue
        if c == '/' and (prev == '' or prev in REGEX_PREV):
            j, incls = i + 1, False
            while j < n and src[j] != '\n':
                if src[j] == '\\': j += 2; continue
                if src[j] == '[': incls = True
                elif src[j] == ']': incls = False
                elif src[j] == '/' and not incls: break
                j += 1
            i = j + 1; prev = 'x'; continue
        if not c.isspace(): prev = c
        i += 1
    return out

def key_re(k):
    parts = k.split('{}')
    return re.compile('^' + '(.+?)'.join(re.escape(p) for p in parts) + '$', re.S)

def norm(s): return re.sub(r'\s+', ' ', s).strip()

def check(dict_path, files):
    d = json.load(open(dict_path, encoding='utf-8'))
    skip = set(norm(x) for x in d.get('__skip__', []))
    keys = {norm(k): v for k, v in d.items() if not k.startswith('__')}
    bad = 0
    for k, v in keys.items():                                   # placeholder sanity
        nk = k.count('{}') + k.count('{#}'); idx = sorted(set(int(x) for x in re.findall(r'\{(\d+)[?}]', v)))
        if nk and not (idx and max(idx) <= nk and 1 in idx) and idx != list(range(1, nk + 1)):
            print(f'BAD-PLACEHOLDERS {k!r} -> {v!r} (key has {nk} {{}}, value uses {idx})'); bad += 1
        if not nk and re.search(r'\{\d+[?}]', v): print(f'BAD-PLACEHOLDERS (value has {{n}} but key has no {{}}) {k!r}'); bad += 1
        if AR.search(v): print(f'ARABIC-IN-VALUE {k!r} -> {v!r}'); bad += 1
    tkeys = [k for k in keys if '{}' in k]
    segs = [norm(s) for k in keys for s in k.split('{}') if norm(s)]
    def covered(t):
        if t in keys or t in skip: return True
        if any(key_re(k).match(t) for k in tkeys): return True
        if any(t in s for s in segs): return True            # fragment of a template
        if any(t in k for k in keys): return True            # fragment of a longer key (text split across nodes)
        return False
    missing = []
    for f in files:
        for line, lit in scan(open(f, encoding='utf-8').read()):
            t = norm(lit)
            if '<' in t and '>' in t:                         # html literal: each text fragment between tags is its own text node
                frs = [norm(x) for x in re.split(r'<[^>]*>', t)]
                frs = [x for x in frs if AR.search(x)]
                if frs and all(covered(x) for x in frs): continue
                for x in frs:
                    if not covered(x): missing.append((f, line, x))
                continue
            if not covered(t): missing.append((f, line, lit))
    for f, line, lit in missing: print(f'MISSING {f}:{line}\t{lit!r}')
    print(f'-- {len(keys)} entries, {len(missing)} Arabic literals not covered, {bad} problems')
    return not missing and not bad


def frag_list(files):
    """unique, normalized Arabic fragments of the given files in source order (HTML literals split at tags)"""
    seen, out = set(), []
    for f in files:
        for line, lit in scan(open(f, encoding='utf-8').read()):
            t = lit.replace('&nbsp;', ' ')
            parts = re.split(r'<[^>]*>', t) if ('<' in t and '>' in t) else [t]
            for x in parts:
                x = norm(x)
                if AR.search(x) and x not in seen: seen.add(x); out.append(x)
    return out

def done_keys():
    have = set()
    for p in glob.glob(os.path.join(os.path.dirname(__file__), 'en', '*.json')):
        d = json.load(open(p, encoding='utf-8'))
        have |= set(norm(k) for k in d if not k.startswith('__'))
        have |= set(norm(k) for k in d.get('__skip__', []))
    return have

def cmd_work(name, files):
    have = done_keys()
    items = [x for x in frag_list(files) if x not in have]
    wd = os.path.join(os.path.dirname(__file__), 'work'); os.makedirs(wd, exist_ok=True)
    with open(os.path.join(wd, name + '.tsv'), 'w', encoding='utf-8') as fh:
        for i, x in enumerate(items, 1): fh.write(f'{i}\t{x}\n')
    print(f'{name}: {len(items)} fragments (already covered: {len(frag_list(files)) - len(items)}) -> work/{name}.tsv')

def cmd_merge(name):
    wd = os.path.join(os.path.dirname(__file__), 'work')
    ar = {}
    for ln in open(os.path.join(wd, name + '.tsv'), encoding='utf-8'):
        ln = ln.rstrip('\n')
        if ln: i, x = ln.split('\t', 1); ar[int(i)] = x
    out, skip, bad = {}, [], 0
    for ln in open(os.path.join(wd, name + '.en.tsv'), encoding='utf-8'):
        ln = ln.rstrip('\n')
        if not ln.strip(): continue
        try: i, v = re.split(r'[ \t]+', ln.strip(), 1)
        except ValueError: print('BAD LINE', ln[:80]); bad += 1; continue
        i = int(i); v = v.strip()
        if i not in ar: print('UNKNOWN ID', i); bad += 1; continue
        if v == '-': skip.append(ar[i]); continue
        nk = ar[i].count('{}'); idx = sorted(set(int(y) for y in re.findall(r'\{(\d+)[?}]', v)))
        if (idx and max(idx) > nk) or AR.search(v): print('BAD', i, ar[i], '->', v); bad += 1; continue
        out[ar[i]] = v
    got = {l.split()[0] for l in open(os.path.join(wd, name + '.en.tsv'), encoding='utf-8') if l.strip()}
    missing = [i for i in ar if str(i) not in got]
    if missing: print('NOT TRANSLATED ids:', missing[:40], '...' if len(missing) > 40 else '')
    out['__skip__'] = skip
    json.dump(out, open(os.path.join(os.path.dirname(__file__), 'en', name + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print(f'{name}: {len(out)-1} entries, {len(skip)} skipped, {bad} problems, {len(missing)} missing')

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'extract':
        for f in sys.argv[2:]:
            for line, lit in scan(open(f, encoding='utf-8').read()): print(f'{f}:{line}\t{lit!r}')
    elif cmd == 'work': cmd_work(sys.argv[2], sys.argv[3:])
    elif cmd == 'merge': cmd_merge(sys.argv[2])
    elif cmd == 'check': sys.exit(0 if check(sys.argv[2], sys.argv[3:]) else 1)
    elif cmd == 'build':
        root = os.path.join(os.path.dirname(__file__), '..', '..')
        merged, skips = {}, []
        for p in sorted(glob.glob(os.path.join(os.path.dirname(__file__), 'en', '*.json'))):
            for k, v in json.load(open(p, encoding='utf-8')).items():
                if k.startswith('__'): continue
                k = norm(k)
                if k in merged and merged[k] != v: print(f'CONFLICT {k!r}: {merged[k]!r} vs {v!r} ({os.path.basename(p)})', file=sys.stderr)
                merged[k] = v
        isT = lambda k: '{}' in k or '{#}' in k
        exact = {k: v for k, v in merged.items() if not isT(k)}
        tpl = sorted(([k, v] for k, v in merged.items() if isT(k)), key=lambda kv: -len(kv[0].replace('{}', '').replace('{#}', '')))
        out = os.path.join(root, 'js', 'i18n-en.js')
        with open(out, 'w', encoding='utf-8') as fh:
            fh.write('/* Imhotep — English dictionary (GENERATED by tools/i18n/i18n_tool.py build from tools/i18n/en/*.json; do not edit by hand).\n   x = exact Arabic text -> English; t = templates ({} = a value, {1} {2} = the same values in the English text). */\n')
            fh.write('window.IM=window.IM||{};IM.EN={x:' + json.dumps(exact, ensure_ascii=False, separators=(',', ':')) + ',\nt:' + json.dumps(tpl, ensure_ascii=False, separators=(',', ':')) + '};\n')
        print(f'built {out}: {len(exact)} exact + {len(tpl)} templates, {os.path.getsize(out)//1024} KB')
    else: print(__doc__)
