#!/usr/bin/env python3
"""Prove the question data is untouched.
usage: python3 tools/verify_data.py <site-dir> <original-single-file.html>

The original single-file site embeds its images as data URIs inside the question files. The tree keeps those images as real files
(assets/img/*) and the question files point to them. This script puts the images back into each question file in memory and compares
the result, byte for byte, with the text inside the original file."""
import os, re, sys, base64, hashlib
SITE, ORIG = sys.argv[1], sys.argv[2]
MIME = {'.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml'}
DATA = ['subjects/anatomy/anatomy.content.js', 'subjects/anatomy/data.js', 'subjects/histology/histology.content.js', 'subjects/biochemistry/biochemistry.content.js', 'subjects/biochemistry/data.js']
s = open(ORIG, 'rb').read().decode('utf-8')
rx = re.compile(r'<(script|style)\b[^>]*>'); pos = 0; bodies = {}
while True:
    m = rx.search(s, pos)
    if not m: break
    end = s.find('</' + m.group(1) + '>', m.end())
    mp = re.search(r'data-mg-path="([^"]+)"', m.group(0))
    if mp: bodies[mp.group(1)] = s[m.end():end]
    pos = end + len(m.group(1)) + 3
bad = 0
for f in DATA:
    t = open(os.path.join(SITE, f), encoding='utf-8', newline='').read()
    def back(m):
        name = m.group(1); ext = os.path.splitext(name)[1].lower()
        return 'data:%s;base64,%s' % (MIME[ext], base64.b64encode(open(os.path.join(SITE, 'assets/img', name), 'rb').read()).decode())
    t = re.sub(r'assets/img/([A-Za-z0-9_.-]+)', back, t)
    same = f in bodies and t == bodies[f]
    bad += (not same)
    print(('OK   ' if same else 'DIFF ') + f, hashlib.sha256(t.encode()).hexdigest()[:16])
EXTRA = ['subjects/physiology/physiology.content.js']  # مواد اتضافت بعد الأصل: مفيش نسخة أصلية تتقارن بيها
for f in EXTRA: print('NEW  ' + f, hashlib.sha256(open(os.path.join(SITE, f), 'rb').read()).hexdigest()[:16], '(مضافة بعد الأصل، مولّدة من tools/gen_physiology.py)')
print('all identical' if not bad else '%d file(s) differ' % bad); sys.exit(1 if bad else 0)
