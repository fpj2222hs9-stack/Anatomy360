/* حورس (Horus): لوجو مساعد الذكاء الاصطناعي. بيتولّد من tools/horus/build_horus.py، متعدّلوش بإيدك.
   IM.horus({badge:true, size:34, state:'in idle', label:'حورس'}) ← نص SVG جاهز يتحط في h('span',{html:...}).
   الحالات: in (رسم تدريجي) · idle (رمشة ونظرة ولمعة) · think (بيفكّر) · found (نبضة). IM.horusState(svg,'think'). */
(function(){
'use strict';
var IM=window.IM=window.IM||{}, n=0;
var MARK="<path class=\"hz-ln hz-draw hz-brow\" pathLength=\"1\" stroke-width=\"13\" d=\"M24 80C62 28 160 16 216 64\"/><g class=\"hz-eye\"><path class=\"hz-sclera\" d=\"M30 108C66 50 152 36 208 96C156 146 76 144 30 108Z\"/><g clip-path=\"url(#hzc{u})\"><g class=\"hz-gaze\"><g class=\"hz-irisw\"><circle class=\"hz-iris\" cx=\"119\" cy=\"97\" r=\"29\"/><circle class=\"hz-pupil\" cx=\"119\" cy=\"97\" r=\"12\"/><circle class=\"hz-ring\" cx=\"119\" cy=\"97\" r=\"21\"/></g><g class=\"hz-starw\"><g transform=\"translate(119 97)\"><path class=\"hz-star\" d=\"M0.00 -20.00 C3.20 -9.60 9.60 -3.20 20.00 0.00 C9.60 3.20 3.20 9.60 0.00 20.00 C-3.20 9.60 -9.60 3.20 -20.00 0.00 C-9.60 -3.20 -3.20 -9.60 0.00 -20.00Z\"/></g></g></g></g><path class=\"hz-ln hz-draw hz-lidU\" pathLength=\"1\" stroke-width=\"10\" d=\"M30 108C66 50 152 36 208 96\"/><path class=\"hz-ln hz-draw hz-lidL\" pathLength=\"1\" stroke-width=\"10\" d=\"M30 108C76 144 156 146 208 96\"/></g><path class=\"hz-ln hz-draw hz-tear\" pathLength=\"1\" stroke-width=\"10\" d=\"M96 131.6V181.6\"/><path class=\"hz-ln hz-draw hz-spiral\" pathLength=\"1\" stroke-width=\"10\" d=\"M170 119.8V135.8 A18.0 18.0 0 0 0 188.00 153.77 A14.0 14.0 0 0 0 202.00 139.77 A10.0 10.0 0 0 0 192.00 129.77 A7.0 7.0 0 0 0 185.00 136.77 A4.0 4.0 0 0 0 189.00 140.77\"/><circle class=\"hz-ripple\" cx=\"119\" cy=\"97\" r=\"30\"/>", BADGE="<path class=\"hz-arch\" d=\"M12 258V122A108 108 0 0 1 228 122V258Q228 266 220 266H20Q12 266 12 258Z\"/><g class=\"hz-sunw\"><g transform=\"translate(120 66)\"><g class=\"hz-rays\"><path d=\"M19.00 0.00L26.00 0.00M13.44 13.44L18.38 18.38M0.00 19.00L0.00 26.00M-13.44 13.44L-18.38 18.38M-19.00 0.00L-26.00 0.00M-13.44 -13.44L-18.38 -18.38M-0.00 -19.00L-0.00 -26.00M13.44 -13.44L18.38 -18.38\"/></g></g><circle class=\"hz-sunc\" cx=\"120\" cy=\"66\" r=\"12.5\"/></g><g transform=\"translate(120 172) scale(.76) translate(-119 -95)\"><path class=\"hz-ln hz-draw hz-brow\" pathLength=\"1\" stroke-width=\"13\" d=\"M24 80C62 28 160 16 216 64\"/><g class=\"hz-eye\"><path class=\"hz-sclera\" d=\"M30 108C66 50 152 36 208 96C156 146 76 144 30 108Z\"/><g clip-path=\"url(#hzc{u})\"><g class=\"hz-gaze\"><g class=\"hz-irisw\"><circle class=\"hz-iris\" cx=\"119\" cy=\"97\" r=\"29\"/><circle class=\"hz-pupil\" cx=\"119\" cy=\"97\" r=\"12\"/><circle class=\"hz-ring\" cx=\"119\" cy=\"97\" r=\"21\"/></g><g class=\"hz-starw\"><g transform=\"translate(119 97)\"><path class=\"hz-star\" d=\"M0.00 -20.00 C3.20 -9.60 9.60 -3.20 20.00 0.00 C9.60 3.20 3.20 9.60 0.00 20.00 C-3.20 9.60 -9.60 3.20 -20.00 0.00 C-9.60 -3.20 -3.20 -9.60 0.00 -20.00Z\"/></g></g></g></g><path class=\"hz-ln hz-draw hz-lidU\" pathLength=\"1\" stroke-width=\"10\" d=\"M30 108C66 50 152 36 208 96\"/><path class=\"hz-ln hz-draw hz-lidL\" pathLength=\"1\" stroke-width=\"10\" d=\"M30 108C76 144 156 146 208 96\"/></g><path class=\"hz-ln hz-draw hz-tear\" pathLength=\"1\" stroke-width=\"10\" d=\"M96 131.6V181.6\"/><path class=\"hz-ln hz-draw hz-spiral\" pathLength=\"1\" stroke-width=\"10\" d=\"M170 119.8V135.8 A18.0 18.0 0 0 0 188.00 153.77 A14.0 14.0 0 0 0 202.00 139.77 A10.0 10.0 0 0 0 192.00 129.77 A7.0 7.0 0 0 0 185.00 136.77 A4.0 4.0 0 0 0 189.00 140.77\"/><circle class=\"hz-ripple\" cx=\"119\" cy=\"97\" r=\"30\"/></g>", DEF="<defs><clipPath id=\"hzc{u}\"><path d=\"M30 108C66 50 152 36 208 96C156 146 76 144 30 108Z\"/></clipPath></defs>";
var VB={m:[240,224],b:[240,268]};
IM.horus=function(o){
  o=o||{}; var b=o.badge!==false, d=VB[b?'b':'m'], w=o.size||48, u=(++n)+'', st=String(o.state||'').split(/\s+/).filter(Boolean).map(function(x){return 'hz-'+x;}).join(' ');
  var a=o.label?'role="img" aria-label="'+String(o.label).replace(/"/g,'&quot;')+'"':'aria-hidden="true" focusable="false"';
  return '<svg class="hz'+(b?' hzb':'')+(st?' '+st:'')+'" viewBox="0 0 '+d[0]+' '+d[1]+'" width="'+w+'" height="'+Math.round(w*d[1]/d[0])+'" '+a+'>'+DEF.replace(/\{u\}/g,u)+(b?BADGE:MARK).replace(/\{u\}/g,u)+'</svg>';
};
/* بيغيّر حالة SVG موجود. found نبضة واحدة وبترجّع للحالة اللي قبلها. */
IM.horusState=function(svg,state){
  if(!svg||!svg.classList) return;
  var all=['hz-in','hz-idle','hz-think','hz-found'], prev=all.filter(function(c){return svg.classList.contains(c);});
  if(state==='found'){
    all.forEach(function(c){svg.classList.remove(c);}); void svg.getBoundingClientRect(); svg.classList.add('hz-found');
    setTimeout(function(){ svg.classList.remove('hz-found'); prev.filter(function(c){return c!=='hz-in'&&c!=='hz-found';}).forEach(function(c){svg.classList.add(c);}); },1150);
    return;
  }
  all.forEach(function(c){svg.classList.remove(c);}); void svg.getBoundingClientRect();
  String(state||'').split(/\s+/).filter(Boolean).forEach(function(x){svg.classList.add('hz-'+x);});
};
})();
