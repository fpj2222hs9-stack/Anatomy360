#!/usr/bin/env python3
"""يولّد subjects/physiology/physiology.content.js من بنوك أسئلة د. محمد ماهر (MHR): الدم (185) والجهاز العصبي اللاإرادي (100).
المصدر 1: Blood_MCQ_Bank_MHR_112416.pdf (185 سؤال + جدول المفاتيح في آخر صفحة) ← tools/blood_parsed.json
المصدر 2: ANS_MCQ.pdf (100 سؤال + جدول المفاتيح) ← tools/ans_parsed.json (tools/parse_ans_pdf.py)
usage: python3 tools/gen_physiology.py blood_parsed.json ans_parsed.json subjects/physiology/physiology.content.js
الملفات المتحلّلة فيها نص الأسئلة والمفاتيح كما في الـPDF حرفيًا."""
import json, sys, html, re
src, src2, out = sys.argv[1], sys.argv[2], sys.argv[3]
d = json.load(open(src, encoding='utf-8')); K = d['keys']
d2 = json.load(open(src2, encoding='utf-8')); K2 = d2['keys']
SECS = [('Body Fluids', 1, 9), ('Measurement of Body Fluids & Homeostasis', 10, 17), ('Plasma Proteins', 18, 48),
        ('Erythrocytes & Erythropoiesis', 49, 78), ('Vitamin B12', 79, 95), ('Iron', 96, 121),
        ('Anemia & Polycythemia', 122, 135), ('Hemostasis', 136, 172), ('Blood Groups & Rh', 173, 185)]
# فصل 2: الجهاز العصبي اللاإرادي. «Sympathetic» و«Parasympathetic» عناوين مطبوعة في الملف؛ الاسمين التانيين من عندنا لأن الملف مفيهوش عناوين للأسئلة 1–16 و50–100.
SECS2 = [('Introduction & Autonomic Ganglia', 1, 16), ('Sympathetic', 17, 25), ('Parasympathetic', 26, 49), ('Transmitters, Receptors & Drugs', 50, 100)]
# تطبيع حروف مطابقة شكليًا طلعت من الـPDF (سيريليك بدل لاتيني) — المعروض في الصفحة «PO4»
HOMO = {'О': 'O', 'Р': 'P'}
def fix(t): return ''.join(HOMO.get(c, c) for c in t)
# أسئلة مفتاحها المطبوع على الأرجح غلط (راجعتها علميًا): بتتعلّم «مشكوك فيه» والمحسوب للطالب هو المطبوع
DOUBT = {155: 'الـthrombomodulin بيرتبط بالـthrombin ويكوّن مركّبًا بينشّط الـprotein C (مش protein S)، والـprotein S عامل مساعد للـprotein C المنشَّط. فنص الاختيار D غالبًا خطأ مطبعي (المقصود protein C).'}
DOUBT2 = {76: 'حجب مستقبلات α بيقلّل المقاومة الطرفية وضغط الدم (الاختيار D)، وبيوسّع القصبات الهوائية شوية مش بيضيّقها. فالمفتاح المطبوع B (قطر القصبات) غالبًا غلط.'}
e = lambda t: html.escape(t, quote=False)
def build(chap, data, keys, secs, prefix, doubt, ids):
    """-> (option tags for the section picker, section markup list, total)"""
    def sec_of(n):
        for i, (t, a, b) in enumerate(secs):
            if a <= n <= b: return i
    secs_html, gsel = [], []
    for i, (title, a, b) in enumerate(secs):
        sid = '%s_t%02d' % (ids, i + 1); qs = [q for q in data['qs'] if sec_of(q['n']) == i]
        assert len(qs) == b - a + 1, (title, len(qs))
        gsel.append('<option value="%s">%s (%d)</option>' % (sid, e(title), len(qs)))
        body = ''
        for q in qs:
            n = q['n']; k = keys[str(n)].lower(); letters = [o[0] for o in q['opts']]; assert k in letters, (n, k)
            attrs = 'data-id="%s-%03d" data-k="%s"' % (prefix, n, k)
            tags = ''
            if q.get('past'): tags += '<span class="gtag" dir="ltr">Past exam</span>'
            if n in doubt:
                attrs += ' data-alt="" data-fx="%s"' % html.escape(doubt[n], quote=True)
                tags += '<span class="gtag warn" dir="rtl">مفتاح الملزمة مشكوك فيه</span>'
            opts = ''.join('<li data-o="%s" tabindex="0">%s- %s</li>' % (l, l, e(fix(t))) for l, t in q['opts'])
            body += '<div class="gq" %s><p class="qt" dir="ltr">%d- %s%s</p><ul class="opts" dir="ltr">%s</ul><p class="res" hidden></p></div>' % (attrs, n, e(fix(q['stem'])), tags, opts)
        secs_html.append('<section class="tsec gsec" data-g="%s"><h3>%s <small>— %d سؤال</small></h3><div class="tbar"><button class="btn clear sm gclear" type="button" data-g="%s">Clear</button></div>%s</section>' % (sid, e(title), len(qs), sid, body))
    return gsel, secs_html, len(data['qs'])
gsel1, secs1, total1 = build(1, d, K, SECS, 'ph1m', DOUBT, 'ph1'); assert total1 == 185
gsel2, secs2, total2 = build(2, d2, K2, SECS2, 'ph2m', DOUBT2, 'ph2'); assert total2 == 100
total = total1 + total2; nsec = len(SECS) + len(SECS2)
note = 'أسئلة اختيار من متعدد في علم وظائف الأعضاء من بنوك أسئلة د. محمد ماهر، بمفاتيحها المطبوعة في جدول المفاتيح: الفصل الأول الدم، والتاني الجهاز العصبي اللاإرادي. باقي الفصول بتتضاف لما تنزل.'
SRC = 'data-src="maher" data-srclabel="Dr. Mohamed Maher MCQs"'
body_html = ('<main><section id="tab-galal" class="tabpane" role="tabpanel" hidden><div class="card-bar"><p class="note">%s</p></div>'
             '<div class="gnav"><label for="gSel">القسم:</label><select id="gSel"><option value="">كل الأقسام (%d سؤال)</option>'
             '<optgroup label="Chapter 1 — Blood" %s>%s</optgroup><optgroup label="Chapter 2 — Autonomic Nervous System" %s>%s</optgroup></select></div>'
             '<div class="gpart" data-part="1" data-ch="p1"><h2 dir="ltr">Chapter 1 · Blood <small>— الدم · %d سؤال · <bdi dir="ltr">Dr. Mohamed Maher MCQs</bdi></small></h2>%s</div>'
             '<div class="gpart" data-part="2" data-ch="p2"><h2 dir="ltr">Chapter 2 · Autonomic Nervous System <small>— الجهاز العصبي اللاإرادي · %d سؤال · <bdi dir="ltr">Dr. Mohamed Maher MCQs</bdi></small></h2>%s</div></section></main>'
             % (e(note), total, SRC, ''.join(gsel1), SRC, ''.join(gsel2), total1, ''.join(secs1), total2, ''.join(secs2)))
pkg = {'headA': '<div class="eyebrow">Physiology · Dr. Mohamed Maher MCQs</div>',
       'headB': '<p class="lede">%s</p><div class="stats"><div><b>2</b><span>فصل</span></div><div><b>%d</b><span>قسمًا</span></div><div><b>%d</b><span>سؤال بمفتاح</span></div></div>' % (e(note), nsec, total),
       'body': body_html}
js = '/* محتوى مادة physiology (فصلين لحد ما ينزل باقي المادة: الدم والجهاز العصبي اللاإرادي): بنوك أسئلة د. محمد ماهر. مولَّد من tools/gen_physiology.py */\n(function(M){(M.pkg=M.pkg||{})["physiology"]=' + json.dumps(pkg, ensure_ascii=False).replace('</', '<\\/') + '})(window.MG=window.MG||{});\n'
open(out, 'w', encoding='utf-8', newline='\n').write(js)
print('wrote', out, len(js.encode('utf-8')), 'bytes;', total, 'questions;', nsec, 'sections')
