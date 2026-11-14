"""Book sources -> passages. A passage is one printed section (heading + text), split into overlapping windows when long.
Sources (see sources.json): site-book (text exported from the site's own library), text (md/txt files in tools/ai/books/), passages (ready JSON)."""
import json, os, re

from . import ROOT
from .util import read_json, norm_ws

BOOKS_DIR = os.path.join(ROOT, 'books')
DATA_DIR = os.path.join(ROOT, 'data')
_HEAD_MD = re.compile(r'^\s{0,3}#{1,6}\s+(.*\S)\s*$')
_PAGE_MARK = re.compile(r'^\s*(?:\[\[p(?:age)?\.?\s*(\d+)\]\]|<<p(?:age)?\.?\s*(\d+)>>)\s*$', re.I)


def _windows(words, size, overlap=40):
    if len(words) <= size:
        return [' '.join(words)]
    out, i = [], 0
    step = max(1, size - overlap)
    while i < len(words):
        out.append(' '.join(words[i:i + size]))
        if i + size >= len(words):
            break
        i += step
    return out


def _mk(pid, sid, book, chapter, heading, page, body, size):
    """one section -> passages; the heading is repeated as the first line of every window so the printed heading is always inside the block."""
    res = []
    words = body.split()
    for k, w in enumerate(_windows(words, size) if words else ['']):
        head = heading or 'Relevant section'
        res.append({'id': '%s#%d' % (pid, k), 'sid': sid, 'book': book, 'chapter': chapter, 'heading': heading or '',
                    'page': page, 'body': w, 'text': (head + '\n' + w).strip()})
    return res


def from_site_book(sid, src, size):
    data = read_json(os.path.join(DATA_DIR, 'books.json'), {}) or {}
    chapters = (data.get(sid) or {}).get('chapters') or []
    out = []
    for ci, ch in enumerate(chapters):
        cname = ch.get('en') or ch.get('id') or ''
        for si, sec in enumerate(ch.get('sections') or []):
            out += _mk('%s:%s:%d:%d' % (src['id'], ch.get('id') or ci, ci, si), sid, src.get('title') or src['id'], cname,
                       norm_ws(sec.get('heading')), sec.get('page') or '', (sec.get('text') or '').strip(), size)
    return out


def from_text_file(sid, src, path, size):
    """markdown / plain text: '# Heading' lines (or ALL-CAPS short lines) start a section; a line [[p.12]] sets the page."""
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        lines = f.read().split('\n')
    title = src.get('title') or os.path.basename(path)
    out, heading, page, buf, chapter, n = [], '', '', [], '', 0

    def flush():
        nonlocal buf, n
        body = '\n'.join(buf).strip()
        if body:
            out.extend(_mk('%s:%s:%d' % (src['id'], os.path.basename(path), n), sid, title, chapter, heading, page, body, size))
            n += 1
        buf = []
    for ln in lines:
        pm = _PAGE_MARK.match(ln)
        if pm:
            page = pm.group(1) or pm.group(2)
            continue
        hm = _HEAD_MD.match(ln)
        caps = src.get('caps', True) and (not hm) and 4 <= len(ln.strip()) <= 90 and re.search(r'[A-Z]{3}', ln) and ln.strip() == ln.strip().upper() and not re.search(r'[.:;]\s*$', ln.strip())
        if hm or caps:
            flush()
            heading = norm_ws(hm.group(1) if hm else ln)
            if hm and ln.lstrip().startswith('# '):
                chapter = heading
            continue
        buf.append(ln)
    flush()
    return out


def from_passages_json(sid, src, path, size):
    arr = read_json(path, []) or []
    out = []
    for i, p in enumerate(arr):
        out += _mk('%s:%s:%d' % (src['id'], os.path.basename(path), i), sid, src.get('title') or src['id'], p.get('chapter', ''),
                   norm_ws(p.get('heading')), p.get('page', ''), (p.get('text') or '').strip(), size)
    return out


def load_sources(sources_cfg, sid, max_words=260):
    """-> ordered list of (source_id, [passages]) for a subject."""
    res = []
    for src in sources_cfg.get(sid) or []:
        if not source_ready(src, sid):
            continue                      # مصدر نصه مش موجود (مثلاً الكتب مش على الجهاز ده): نتخطّاه بدل ما نكسر أو نولّد من غير كتاب
        kind = src.get('kind')
        if kind == 'site-book':
            ps = from_site_book(sid, src, max_words)
        elif kind in ('text', 'passages'):
            ps = []
            base = os.path.join(BOOKS_DIR, src.get('dir') or sid)
            files = [os.path.join(base, src['file'])] if src.get('file') else \
                sorted(os.path.join(base, f) for f in (os.listdir(base) if os.path.isdir(base) else [])
                       if f.lower().endswith(('.md', '.txt') if kind == 'text' else ('.json',)))
            for fp in files:
                ps += from_text_file(sid, src, fp, max_words) if kind == 'text' else from_passages_json(sid, src, fp, max_words)
        else:
            raise ValueError('unknown source kind: %r' % kind)
        res.append((src['id'], ps))
    return res


def source_ready(src, sid):
    """is the source's text actually here? (a text/passages source whose folder is missing or empty must NOT count as a source:
    otherwise a bake on a machine without the books would silently fall back to general knowledge for the whole subject)"""
    kind = src.get('kind')
    if kind == 'site-book':
        data = read_json(os.path.join(DATA_DIR, 'books.json'), {}) or {}
        return bool((data.get(sid) or {}).get('chapters'))
    if kind in ('text', 'passages'):
        base = os.path.join(BOOKS_DIR, src.get('dir') or sid)
        exts = ('.md', '.txt') if kind == 'text' else ('.json',)
        if src.get('file'):
            return os.path.isfile(os.path.join(base, src['file']))
        return os.path.isdir(base) and any(f.lower().endswith(exts) for f in os.listdir(base))
    return False
