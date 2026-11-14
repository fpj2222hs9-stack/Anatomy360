#!/usr/bin/env python3
"""Exports every book passage (the same ones tools/ai uses for BM25) for the Horus live chat.
  out/horus-passages.csv     -> import it in Supabase: Table Editor > horus_passages > Insert > Import data from CSV   (PRIVATE: contains the department books)
  out/horus-passages-<sid>.sql -> alternative: paste in the SQL Editor (one subject per file)
  out/passages.json          -> used by the local tests only
Nothing here is published: tools/horus/out/ is excluded from the repo (.gitignore) and from site.zip."""
import csv, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'ai'))
from imai import books  # noqa: E402

AI = os.path.join(HERE, '..', 'ai')
OUT = os.path.join(HERE, 'out')
FIELDS = ['sid', 'src', 'ord', 'seq', 'book', 'chapter', 'heading', 'page', 'body']


def collect():
    cfg = json.load(open(os.path.join(AI, 'sources.json'), encoding='utf-8'))
    rows = []
    for sid in sorted(k for k in cfg if not k.startswith('_')):
        for ord_, (src_id, ps) in enumerate(books.load_sources(cfg, sid, 260)):
            for seq, p in enumerate(ps):
                rows.append({'sid': sid, 'src': src_id, 'ord': ord_, 'seq': seq, 'book': p['book'], 'chapter': p['chapter'],
                             'heading': p['heading'], 'page': str(p['page'] or ''), 'body': p['body']})
    return rows


def q(s):
    # dollar-quoting with a tag that cannot appear in the text
    tag = 'h'
    while ('$' + tag + '$') in s:
        tag += 'x'
    return '$%s$%s$%s$' % (tag, s, tag)


def main():
    os.makedirs(OUT, exist_ok=True)
    rows = collect()
    with open(os.path.join(OUT, 'horus-passages.csv'), 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, quoting=csv.QUOTE_MINIMAL, lineterminator='\n')
        w.writeheader()
        w.writerows(rows)
    with open(os.path.join(OUT, 'passages.json'), 'w', encoding='utf-8') as f:
        json.dump(rows, f, ensure_ascii=False)
    for sid in sorted({r['sid'] for r in rows}):
        part = [r for r in rows if r['sid'] == sid]
        with open(os.path.join(OUT, 'horus-passages-%s.sql' % sid), 'w', encoding='utf-8') as f:
            f.write('-- Horus passages: %s (%d rows). Run once in the Supabase SQL Editor (it does not delete anything).\n' % (sid, len(part)))
            for i in range(0, len(part), 40):
                f.write('insert into public.horus_passages (sid, src, ord, seq, book, chapter, heading, page, body) values\n')
                f.write(',\n'.join('(%s)' % ', '.join([q(r['sid']), q(r['src']), str(r['ord']), str(r['seq']), q(r['book']), q(r['chapter']),
                                                       q(r['heading']), q(r['page']), q(r['body'])]) for r in part[i:i + 40]))
                f.write(';\n')
    by = {}
    for r in rows:
        by.setdefault(r['sid'], 0)
        by[r['sid']] += 1
    print('passages:', len(rows), by)
    print('chars   :', sum(len(r['body']) for r in rows))


if __name__ == '__main__':
    main()
