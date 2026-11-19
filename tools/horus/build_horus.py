#!/usr/bin/env python3
"""Horus (حورس) — logo generator. One source of truth for every asset.
Usage: python3 tools/horus/build_horus.py <out_dir> [--js <path/to/js/horus.js>]
Writes: static + animated SVGs (light / dark / auto), and js/horus.js (inline builder used by the site)."""
import math, os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from geom import spiral, star

# ---------- geometry (mark space: 240 x ~224, eye centre = 119,97) ----------
def _bez(p, t):
    (x0,y0),(x1,y1),(x2,y2),(x3,y3) = p; u = 1-t
    return (u**3*x0+3*u*u*t*x1+3*u*t*t*x2+t**3*x3, u**3*y0+3*u*u*t*y1+3*u*t*t*y2+t**3*y3)
def _y_at(p, x):
    lo, hi = 0.0, 1.0
    for _ in range(50):
        m = (lo+hi)/2
        if _bez(p, m)[0] < x: lo = m
        else: hi = m
    return _bez(p, lo)[1]
A = (30,108); B = (208,96)
LO = [A,(76,144),(156,146),B]
CX, CY = 119, 97
XT, XS = 96, 170
YT = _y_at(LO, XT) - 2
YS = _y_at(LO, XS) - 2
ALMOND = "M30 108C66 50 152 36 208 96C156 146 76 144 30 108Z"
LID_U = "M30 108C66 50 152 36 208 96"
LID_L = "M30 108C76 144 156 146 208 96"
BROW = "M24 80C62 28 160 16 216 64"
TEAR = "M%d %.1fV%.1f" % (XT, YT, YT+50)
_sp = spiral(XS, YS+16, [18,14,10,7,4], math.pi, False)
SPIRAL = "M%d %.1fV%.1f %s" % (XS, YS, YS+16, _sp[_sp.index('A'):])
STAR = star(0, 0, 20, 0.16)
RAYS = "".join("M%.2f %.2fL%.2f %.2f" % (math.cos(a)*19, math.sin(a)*19, math.cos(a)*26, math.sin(a)*26)
               for a in [i*math.pi/4 for i in range(8)])
ARCH = "M12 258V122A108 108 0 0 1 228 122V258Q228 266 220 266H20Q12 266 12 258Z"
MARK_VB = "0 0 240 224"
BADGE_VB = "0 0 240 268"
SUN_C = (120, 66)
BADGE_T = "translate(120 172) scale(.76) translate(-119 -95)"

# ---------- css ----------
THEME_LIGHT = "--hz-l:#1E3F8F;--hz-i:#167370;--hz-s:#E3A93A;--hz-p:#0C1626;--hz-a:#1E3F8F;--hz-c:#F6EEDA;--hz-sun:#E3A93A"
THEME_DARK  = "--hz-l:#E0B25A;--hz-i:#4FD0C8;--hz-s:#FFD98A;--hz-p:#0C1626;--hz-a:#E0B25A;--hz-c:#0A1322;--hz-sun:#0A1322"
# inside a badge the lines are the paper colour and the eye gets a solid sclera
BADGE_L = ".hzb{--hz-l:var(--hz-c);--hz-sc:var(--hz-c)}"
RULES = """
.hz{overflow:visible}
.hz .hz-ln{fill:none;stroke:var(--hz-l);stroke-linecap:round;stroke-linejoin:round}
.hz .hz-sclera{fill:var(--hz-sc,none)}
.hz .hz-iris{fill:var(--hz-i)}.hz .hz-pupil{fill:var(--hz-p)}.hz .hz-star{fill:var(--hz-s)}
.hz .hz-arch{fill:var(--hz-a)}.hz .hz-sunc{fill:var(--hz-sun)}.hz .hz-rays{fill:none;stroke:var(--hz-sun);stroke-width:3.4;stroke-linecap:round}
.hz .hz-ring{fill:none;stroke:var(--hz-s);stroke-width:2.6;stroke-dasharray:3 7;stroke-linecap:round;opacity:0}
.hz .hz-ripple{fill:none;stroke:var(--hz-s);stroke-width:4;opacity:0}
.hz .hz-eye,.hz .hz-gaze,.hz .hz-starw,.hz .hz-irisw,.hz .hz-ring,.hz .hz-ripple{transform-origin:119px 97px}
.hz .hz-sunw{transform-origin:120px 66px}
.hz .hz-rays{transform-origin:0 0}
.hz .hz-brow{transform-origin:119px 40px}
@keyframes hzDraw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
@keyframes hzFade{from{opacity:0}to{opacity:1}}
@keyframes hzPop{0%{transform:scale(0)}60%{transform:scale(1.14)}100%{transform:scale(1)}}
@keyframes hzStarIn{0%{transform:scale(0) rotate(-90deg)}65%{transform:scale(1.25) rotate(8deg)}100%{transform:scale(1) rotate(0)}}
@keyframes hzSunUp{from{opacity:0;transform:translateY(14px) scale(.6)}to{opacity:1;transform:none}}
@keyframes hzBlink{0%,90%,100%{transform:scaleY(1)}93.5%{transform:scaleY(.07)}97%{transform:scaleY(1)}}
@keyframes hzBrow{0%,90%,100%{transform:translateY(0)}93.5%{transform:translateY(3px)}97%{transform:translateY(0)}}
@keyframes hzGaze{0%,30%,100%{transform:translate(0,0)}38%,52%{transform:translate(-10px,1px)}60%,66%{transform:translate(0,0)}74%,88%{transform:translate(9px,-1px)}}
@keyframes hzTwinkle{0%,62%,100%{transform:rotate(0) scale(1)}74%{transform:rotate(90deg) scale(1.2)}86%{transform:rotate(90deg) scale(1)}}
@keyframes hzRays{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:1;transform:scale(1.1)}}
@keyframes hzSpin{to{transform:rotate(360deg)}}
@keyframes hzBeat{0%,100%{transform:scale(1)}50%{transform:scale(1.2)}}
@keyframes hzScan{0%,100%{transform:translate(0,0)}25%{transform:translate(-9px,0)}75%{transform:translate(9px,0)}}
@keyframes hzIrisBeat{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
@keyframes hzRipple{0%{opacity:.95;transform:scale(.9)}100%{opacity:0;transform:scale(2.7)}}
@keyframes hzFlash{0%{transform:scale(1)}30%{transform:scale(1.55)}100%{transform:scale(1)}}
@keyframes hzIrisFound{0%{transform:scale(1)}30%{transform:scale(1.16)}100%{transform:scale(1)}}
/* intro: lines are drawn, then iris, star and sun arrive */
.hz-in .hz-draw{stroke-dasharray:1;animation:hzDraw .95s cubic-bezier(.55,.05,.25,1) backwards}
.hz-in .hz-brow{animation-delay:.05s}.hz-in .hz-lidU{animation-delay:.25s}.hz-in .hz-lidL{animation-delay:.35s}
.hz-in .hz-tear{animation-delay:.85s;animation-duration:.55s}.hz-in .hz-spiral{animation-delay:.95s;animation-duration:.9s}
.hz-in .hz-sclera{animation:hzFade .5s ease-out .9s backwards}
.hz-in .hz-irisw{animation:hzPop .6s cubic-bezier(.3,1.4,.5,1) 1.0s backwards}
.hz-in .hz-starw{animation:hzStarIn .7s cubic-bezier(.3,1.3,.5,1) 1.3s backwards}
.hz-in .hz-sunw{animation:hzSunUp .7s cubic-bezier(.3,1.2,.5,1) .15s backwards}
.hz-in .hz-arch{animation:hzFade .45s ease-out backwards}
/* idle: blink, glance, sparkle (starts after the intro when both classes are set) */
.hz-idle .hz-eye{animation:hzBlink 6.5s ease-in-out infinite 2.2s}
.hz-idle .hz-brow{animation:hzBrow 6.5s ease-in-out infinite 2.2s}
.hz-idle .hz-gaze{animation:hzGaze 13s ease-in-out infinite 3s}
.hz-idle .hz-starw{animation:hzTwinkle 4.6s ease-in-out infinite 2.4s}
.hz-idle .hz-rays{animation:hzRays 5s ease-in-out infinite;transform-origin:0 0}
.hz-in.hz-idle .hz-starw{animation:hzStarIn .7s cubic-bezier(.3,1.3,.5,1) 1.3s backwards,hzTwinkle 4.6s ease-in-out 2.4s infinite}
.hz-in.hz-idle .hz-irisw{animation:hzPop .6s cubic-bezier(.3,1.4,.5,1) 1.0s backwards}
/* thinking: the star turns, the ring scans, the iris breathes */
.hz-think .hz-starw{animation:hzSpin 2.6s linear infinite}
.hz-think .hz-star{transform-box:fill-box;transform-origin:center;animation:hzBeat 1.3s ease-in-out infinite}
.hz-think .hz-ring{opacity:.9;animation:hzSpin 3.2s linear infinite reverse}
.hz-think .hz-irisw{animation:hzIrisBeat 1.3s ease-in-out infinite}
.hz-think .hz-gaze{animation:hzScan 2.6s ease-in-out infinite}
.hz-think .hz-rays{animation:hzRays 1.3s ease-in-out infinite}
/* found: one bright pulse when an answer is ready */
.hz-found .hz-ripple{animation:hzRipple 1.1s ease-out 1}
.hz-found .hz-starw{animation:hzFlash .9s ease-out 1}
.hz-found .hz-irisw{animation:hzIrisFound .9s ease-out 1}
@media (prefers-reduced-motion:reduce){.hz *,.hz{animation:none!important}.hz-think .hz-ring{opacity:.9}}
"""

def art(uid, badge=False):
    """The drawing itself (no <svg> wrapper). uid keeps clipPath ids unique when several are inline."""
    s = ''
    if badge:
        s += '<path class="hz-arch" d="%s"/>' % ARCH
        s += '<g class="hz-sunw"><g transform="translate(%d %d)"><g class="hz-rays"><path d="%s"/></g></g><circle class="hz-sunc" cx="%d" cy="%d" r="12.5"/></g>' % (SUN_C[0], SUN_C[1], RAYS, SUN_C[0], SUN_C[1])
        s += '<g transform="%s">' % BADGE_T
    s += '<path class="hz-ln hz-draw hz-brow" pathLength="1" stroke-width="13" d="%s"/>' % BROW
    s += '<g class="hz-eye"><path class="hz-sclera" d="%s"/>' % ALMOND
    s += '<g clip-path="url(#hzc%s)"><g class="hz-gaze"><g class="hz-irisw"><circle class="hz-iris" cx="%d" cy="%d" r="29"/><circle class="hz-pupil" cx="%d" cy="%d" r="12"/><circle class="hz-ring" cx="%d" cy="%d" r="21"/></g>' % (uid, CX, CY, CX, CY, CX, CY)
    s += '<g class="hz-starw"><g transform="translate(%d %d)"><path class="hz-star" d="%s"/></g></g></g></g>' % (CX, CY, STAR)
    s += '<path class="hz-ln hz-draw hz-lidU" pathLength="1" stroke-width="10" d="%s"/>' % LID_U
    s += '<path class="hz-ln hz-draw hz-lidL" pathLength="1" stroke-width="10" d="%s"/></g>' % LID_L
    s += '<path class="hz-ln hz-draw hz-tear" pathLength="1" stroke-width="10" d="%s"/>' % TEAR
    s += '<path class="hz-ln hz-draw hz-spiral" pathLength="1" stroke-width="10" d="%s"/>' % SPIRAL
    s += '<circle class="hz-ripple" cx="%d" cy="%d" r="30"/>' % (CX, CY)
    if badge: s += '</g>'
    return s

def defs(uid): return '<defs><clipPath id="hzc%s"><path d="%s"/></clipPath></defs>' % (uid, ALMOND)

def svg_file(badge=False, theme='auto', animate='none', title='حورس · Horus'):
    """Standalone SVG. theme: light|dark|auto (auto follows prefers-color-scheme). animate: none|intro|loop."""
    vb = BADGE_VB if badge else MARK_VB
    cls = 'hz' + (' hzb' if badge else '')
    if animate in ('intro', 'loop'): cls += ' hz-in'
    if animate == 'loop': cls += ' hz-idle'
    css = ':root{%s}' % (THEME_DARK if theme == 'dark' else THEME_LIGHT)
    if theme == 'auto': css += '@media (prefers-color-scheme:dark){:root{%s}}' % THEME_DARK
    css += BADGE_L + RULES if animate != 'none' else BADGE_L + RULES.split('@keyframes')[0]
    # static files carry no animation rules: strip them so viewers that ignore CSS animation see the final state
    w, h = [int(x) for x in vb.split()[2:]]
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s" width="%d" height="%d" class="%s" role="img" aria-label="%s">'
            '<title>%s</title><style>%s</style>%s%s</svg>') % (vb, w, h, cls, title, title, css, defs('x'), art('x', badge))


# ---------- site integration (inline markup + css that follows the site's own tokens) ----------
SITE_THEME = (".hz{--hz-l:var(--mark);--hz-i:var(--tur);--hz-s:var(--sun);--hz-p:#0C1626;--hz-a:var(--mark);--hz-c:var(--bg);--hz-sun:var(--sun)}\n"
              + BADGE_L + "\n"
              + ':root[data-theme="dark"] .hzb{--hz-sun:var(--bg)}\n'
              + '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .hzb{--hz-sun:var(--bg)}}\n')

def css_block():
    rules = "\n".join(l for l in RULES.strip().splitlines())
    return "/* horus:start — generated by tools/horus/build_horus.py (do not edit by hand) */\n" + SITE_THEME + rules + "\n/* horus:end */\n"

def js_module():
    j = lambda x: json.dumps(x, ensure_ascii=False)
    mark = art('{u}', False); badge = art('{u}', True)
    return ("/* حورس (Horus): لوجو مساعد الذكاء الاصطناعي. بيتولّد من tools/horus/build_horus.py، متعدّلوش بإيدك.\n"
            "   IM.horus({badge:true, size:34, state:'in idle', label:'حورس'}) ← نص SVG جاهز يتحط في h('span',{html:...}).\n"
            "   الحالات: in (رسم تدريجي) · idle (رمشة ونظرة ولمعة) · think (بيفكّر) · found (نبضة). IM.horusState(svg,'think'). */\n"
            "(function(){\n'use strict';\nvar IM=window.IM=window.IM||{}, n=0;\n"
            "var MARK=%s, BADGE=%s, DEF=%s;\n"
            "var VB={m:[240,224],b:[240,268]};\n"
            "IM.horus=function(o){\n"
            "  o=o||{}; var b=o.badge!==false, d=VB[b?'b':'m'], w=o.size||48, u=(++n)+'', st=String(o.state||'').split(/\\s+/).filter(Boolean).map(function(x){return 'hz-'+x;}).join(' ');\n"
            "  var a=o.label?'role=\"img\" aria-label=\"'+String(o.label).replace(/\"/g,'&quot;')+'\"':'aria-hidden=\"true\" focusable=\"false\"';\n"
            "  return '<svg class=\"hz'+(b?' hzb':'')+(st?' '+st:'')+'\" viewBox=\"0 0 '+d[0]+' '+d[1]+'\" width=\"'+w+'\" height=\"'+Math.round(w*d[1]/d[0])+'\" '+a+'>'+DEF.replace(/\\{u\\}/g,u)+(b?BADGE:MARK).replace(/\\{u\\}/g,u)+'</svg>';\n"
            "};\n"
            "/* بيغيّر حالة SVG موجود. found نبضة واحدة وبترجّع للحالة اللي قبلها. */\n"
            "IM.horusState=function(svg,state){\n"
            "  if(!svg||!svg.classList) return;\n"
            "  var all=['hz-in','hz-idle','hz-think','hz-found'], prev=all.filter(function(c){return svg.classList.contains(c);});\n"
            "  if(state==='found'){\n"
            "    all.forEach(function(c){svg.classList.remove(c);}); void svg.getBoundingClientRect(); svg.classList.add('hz-found');\n"
            "    setTimeout(function(){ svg.classList.remove('hz-found'); prev.filter(function(c){return c!=='hz-in'&&c!=='hz-found';}).forEach(function(c){svg.classList.add(c);}); },1150);\n"
            "    return;\n"
            "  }\n"
            "  all.forEach(function(c){svg.classList.remove(c);}); void svg.getBoundingClientRect();\n"
            "  String(state||'').split(/\\s+/).filter(Boolean).forEach(function(x){svg.classList.add('hz-'+x);});\n"
            "};\n"
            "})();\n") % (j(mark), j(badge), j(defs('{u}')))

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '.'
    os.makedirs(out, exist_ok=True)
    jobs = {
        'horus-mark.svg': dict(badge=False), 'horus-mark-dark.svg': dict(badge=False, theme='dark'),
        'horus-badge.svg': dict(badge=True), 'horus-badge-dark.svg': dict(badge=True, theme='dark'),
        'horus-mark-animated.svg': dict(badge=False, animate='loop'), 'horus-badge-animated.svg': dict(badge=True, animate='loop'),
    }
    if '--js' in sys.argv:
        open(sys.argv[sys.argv.index('--js')+1], 'w', encoding='utf-8').write(js_module()); print('wrote js')
    if '--css' in sys.argv:
        pth = sys.argv[sys.argv.index('--css')+1]
        cur = open(pth, encoding='utf-8').read()
        blk = css_block()
        if '/* horus:start' in cur:
            a = cur.index('/* horus:start'); e = cur.index('/* horus:end */') + len('/* horus:end */\n')
            cur = cur[:a] + blk + cur[e:]
        else:
            cur = cur.rstrip('\n') + '\n\n' + blk
        open(pth, 'w', encoding='utf-8').write(cur); print('css updated')
    for name, kw in jobs.items():
        open(os.path.join(out, name), 'w', encoding='utf-8').write(svg_file(**kw))
        print('wrote', name)
