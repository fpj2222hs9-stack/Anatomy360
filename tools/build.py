#!/usr/bin/env python3
"""Bundle the Imhotep site tree into ONE self-contained HTML file.
usage: python3 tools/build.py <site-dir> <output.html>

- css/*.css and js/*.js are inlined (fonts inside the css become data URIs)
- the 5 original question files are embedded as base64 payloads, byte for byte (text/im-src)
- every image under assets/img is embedded as a base64 payload (text/im-asset), decoded lazily in the browser
Nothing in the data is modified: the payloads are the exact bytes of the files in subjects/."""
import os, re, sys, base64, hashlib

SITE, OUT = sys.argv[1], sys.argv[2]
def rb(p): return open(os.path.join(SITE, p), 'rb').read()
def rt(p): return rb(p).decode('utf-8')
MIME = {'.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2'}
DATA = ['subjects/anatomy/anatomy.content.js', 'subjects/anatomy/data.js', 'subjects/histology/histology.content.js', 'subjects/biochemistry/biochemistry.content.js', 'subjects/biochemistry/data.js', 'subjects/physiology/physiology.content.js']

html = rt('index.html')

def between(s, a, b):
    i = s.index(a); j = s.index(b, i)
    return i, j + len(b)

# ---- css
i, j = between(html, '<!--@im-css-->', '<!--/@im-css-->')
css_files = re.findall(r'<link rel="stylesheet" href="(css/[^"]+)">', html[i:j])
css = ''
for p in css_files:
    t = rt(p)
    def font(m):
        path = os.path.normpath(os.path.join(os.path.dirname(p), m.group(1))).replace('\\', '/')
        ext = os.path.splitext(path)[1].lower()
        return 'url(data:%s;base64,%s)' % (MIME[ext], base64.b64encode(rb(path)).decode())
    t = re.sub(r'url\((\.\./assets/fonts/[^)]+)\)', font, t)
    assert '</style' not in t
    css += '/* %s */\n%s\n' % (p, t)
html = html[:i] + '<style>\n' + css + '</style>' + html[j:]

# ---- js
i, j = between(html, '<!--@im-js-->', '<!--/@im-js-->')
js_files = re.findall(r'<script src="(js/[^"]+)"></script>', html[i:j])
js = ''
for p in js_files:
    t = rt(p)
    assert '</script' not in t, p
    js += '/* %s */\n%s\n;\n' % (p, t)
html = html[:i] + '<script>\n' + js + '</script>' + html[j:]

# ---- no manifest/service worker in the single file (they need real URLs)
i, j = between(html, '<!--@im-pwa-->', '<!--/@im-pwa-->')
html = html[:i] + html[j:]

# ---- data payloads + images
parts = []
for p in DATA:
    parts.append('<script type="text/im-src" data-path="%s">%s</script>' % (p, base64.b64encode(rb(p)).decode()))
n_img = 0
for name in sorted(os.listdir(os.path.join(SITE, 'assets/img'))):
    ext = os.path.splitext(name)[1].lower()
    if ext not in MIME: continue
    path = 'assets/img/' + name
    parts.append('<script type="text/im-asset" data-path="%s" data-mime="%s">%s</script>' % (path, MIME[ext], base64.b64encode(rb(path)).decode()))
    n_img += 1
i, j = between(html, '<!--@im-bank-->', '<!--/@im-bank-->')
html = html[:i] + '\n'.join(parts) + '\n' + html[j:]

open(OUT, 'w', encoding='utf-8', newline='').write(html)
print('built %s: %.2f MB, %d data files, %d images' % (OUT, len(html.encode('utf-8')) / 1e6, len(DATA), n_img))

# ---- self-check: payloads decode back to the exact source bytes
s = open(OUT, encoding='utf-8').read()
for p in DATA:
    m = re.search(r'<script type="text/im-src" data-path="%s">([^<]*)</script>' % re.escape(p), s)
    assert hashlib.sha256(base64.b64decode(m.group(1))).hexdigest() == hashlib.sha256(rb(p)).hexdigest(), p
print('payload check: all %d data files identical to subjects/*' % len(DATA))
