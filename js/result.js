/* Imhotep · إمحتب — result of a scroll: the scale settles, tiers gained, review of every question */
(function(){
'use strict';
var IM=window.IM, h=IM.h, icon=IM.icon;

function verdict(p){
  if(p>=90) return {t:'اتزن الميزان',s:'أداء ممتاز. الكفّتين متعادلة.',cls:'ok'};
  if(p>=70) return {t:'الميزان قرّب يتزن',s:'مستوى كويس. راجع الأغلاط وهتثبّت.',cls:'ok'};
  if(p>=50) return {t:'الميزان بيميل شوية',s:'نص الطريق. الأغلاط محتاجة مراجعة.',cls:'bad'};
  return {t:'الكفّة تقلت',s:'مفيش مشكلة. اللي غلطت فيه هو اللي هيتحفر في الذاكرة.',cls:'bad'};
}
function scaleBig(cls){
  var wrap=h('div.rs-scale.res.'+cls);
  wrap.innerHTML='<svg viewBox="0 0 64 56" width="190" height="166" fill="none" stroke="var(--ink)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="overflow:visible"><path d="M32 12V46M20 48H44"/><g class="beam"><path d="M8 12H56M8 12L0 30M8 12L16 30M56 12L48 30M56 12L64 30"/></g><g class="pan l"><path d="M0 30H16A8 8 0 0 1 0 30Z"/><path d="M8 28C6 25 6 22 8 19C10 22 10 25 8 28Z" stroke="var(--sun)"/></g><g class="pan"><path d="M48 30H64A8 8 0 0 1 48 30Z"/><circle cx="56" cy="26" r="3" stroke="var(--ink-2)"/></g><circle cx="32" cy="12" r="2" fill="var(--sun)" stroke="none"/></svg>';
  return wrap;
}

IM.screens.result=function(view,params){
  var sess=IM.findSession(params[0]);
  if(!sess||sess.state!=='done'){ IM.go(sess?'#/run/'+sess.id:'#/train'); return {}; }
  var cfg=sess.cfg, S=IM.bank.subs[cfg.sid], water=cfg.mode==='water';
  var first=sess.items.filter(function(it){ return !it.r; });
  var n=first.length, okN=0, badN=0, noN=0, ms=0, slow=null;
  var rows=first.map(function(it){
    var Q=IM.Q(it.q), r=sess.res[it.u], st=!r?'none':(r.ok?'ok':'bad');
    if(st==='ok') okN++; else if(st==='bad') badN++; else noN++;
    if(r&&r.ms){ ms+=r.ms; if(!slow||r.ms>slow.ms) slow={ms:r.ms,Q:Q}; }
    return {it:it,Q:Q,r:r,st:st};
  });
  var pct=IM.pct(okN,n), v=verdict(pct);
  var t1=IM.tiers(IM.statsFor(cfg.sid)).on, t0=sess.tier0==null?t1:sess.tier0, gained=Math.max(0,t1-t0);
  var wrap=h('div.rs'); view.appendChild(wrap);

  /* top: scale + numbers */
  var head=h('section.rs-hero.card.'+IM.subClass(cfg.sid),{},
    scaleBig(v.cls),
    h('div.rs-txt',{},
      IM.eyebrow(IM.sessLabel(sess)+' · '+IM.modeName[cfg.mode]),
      h('h1.display.rs-h',{style:'color:var(--'+(v.cls==='ok'?'ok':'bad')+')',text:v.t}),
      h('p.muted',{text:v.s}),
      h('div.rs-big',{},h('span.display.rs-pct',{},String(pct),h('small',{text:'%'})),h('span.muted.mono',{text:okN+' / '+n+' صح'})),
      h('div.rs-stats',{},
        stat('صح',okN,'ok'),stat('غلط',badN,'bad'),noN?stat('من غير إجابة',noN):null,
        stat('الوقت',IM.fmtTime(sess.score?sess.score.ms:sess.spent)),
        stat('متوسط السؤال',ms&&n?Math.round(ms/Math.max(1,okN+badN)/1000)+' ث':'—'))));
  wrap.appendChild(head);
  if(sess.trial&&IM.trialBanner) wrap.appendChild(IM.trialBanner(sess.trial));
  function stat(l,v2,c){ return h('div.rs-st'+(c?'.'+c:''),{},h('b.mono',{text:String(v2)}),h('span.muted',{text:l})); }

  /* pyramid progress */
  if(!cfg.spectate){
    var a=IM.statsFor(cfg.sid), tt=IM.tiers(a);
    wrap.appendChild(h('section.card.rs-pyr.'+IM.subClass(cfg.sid),{},
      h('div.rs-pm',{html:IM.pyr(t1,{anim:true,cls:'mid'})}),
      h('div.rs-pt',{},
        h('h3.display',{text:gained?('طلعت '+(gained===1?'درجة':gained+' درجات')+' في هرم '+IM.subName(cfg.sid)):('هرم '+IM.subName(cfg.sid))}),
        h('p.muted',{text:gained?('وصلت للدرجة '+t1+' من 6.'):(t1>=6?'إنت على القمة. كمّل عشان تثبّت مستواك.':('إنت في الدرجة '+t1+' من 6. فاضل '+tt.left+' سؤال للدرجة الجاية.'))}),
        h('div.bar',{},h('i',{style:'width:'+IM.pct(a.answered,a.total)+'%;background:var(--p)'})),
        h('div.muted.mono.rs-pc',{text:a.answered+' / '+a.total+' سؤال اتفتح'}))));
  }

  /* actions */
  var wrongIds=rows.filter(function(r){return r.st!=='ok'&&r.Q.keys.length}).map(function(r){return r.Q.id});
  var acts=h('section.rs-acts',{});
  function retry(c){ var ns=IM.newSession(c); if(!ns.items.length){ IM.toast('مفيش أسئلة.',{kind:'bad'}); return; } ns.tier0=IM.tiers(IM.statsFor(c.sid)).on; IM.saveSession(ns); IM.go('#/run/'+ns.id); }
  if(wrongIds.length&&!cfg.spectate) acts.appendChild(h('button.btn.primary.lg',{type:'button',onclick:function(){ retry({mode:'train',sid:cfg.sid,secs:null,groups:null,dup:false,spectate:false,count:0,ids:wrongIds,minutes:0}); }},icon('reset',20),'تدرّب على الغلط ('+wrongIds.length+')'));
  acts.appendChild(h('button.btn'+(wrongIds.length?'':'.primary.lg'),{type:'button',onclick:function(){ var c=Object.assign({},cfg); retry(c); }},icon('play',18),'حاول تاني'));
  acts.appendChild(h('a.btn',{href:'#/papyrus/wrong'},icon('scale',18),'كفّة الأغلاط'));
  acts.appendChild(h('a.btn.ghost',{href:'#/train'},'ورشة الألواح'));
  acts.appendChild(h('button.btn.ghost',{type:'button',onclick:function(){ IM.printDialog(Object.assign({},cfg,{ids:first.map(function(it){return it.q}),count:0,secs:null,groups:null,dup:false,wrongOnly:false,marksOnly:false,spectate:true})); }},icon('print',18),'تصدير PDF'));
  wrap.appendChild(acts);
  if(slow&&slow.ms>=20000) wrap.appendChild(h('p.muted.rs-slow',{},icon('clock',16),' أبطأ سؤال عندك أخد '+Math.round(slow.ms/1000)+' ثانية: ',h('span.mono',{dir:'ltr',text:slow.Q.stem.slice(0,70)+(slow.Q.stem.length>70?'…':'')})));

  /* review */
  var filter='all', list=h('div.rv-list'), fbar=h('div.chips.rv-f',{role:'group','aria-label':'تصفية'});
  function chips(){
    IM.clear(fbar);
    [['all','الكل',rows.length],['bad','الغلط',badN],['ok','الصح',okN]].concat(noN?[['none','من غير إجابة',noN]]:[]).forEach(function(x){
      fbar.appendChild(h('button.tog'+(filter===x[0]?'.on':''),{type:'button','aria-pressed':String(filter===x[0]),onclick:function(){ filter=x[0]; chips(); paint(); }},x[1],h('span.mono.tog-n',{text:x[2]})));
    });
  }
  function paint(){
    IM.clear(list);
    var shown=rows.filter(function(r){ return filter==='all'||r.st===filter; });
    if(!shown.length){ list.appendChild(h('p.muted.pad',{text:'مفيش حاجة هنا.'})); return; }
    shown.forEach(function(r){
      var i=rows.indexOf(r), open=false, body=null;
      var ic=r.st==='ok'?icon('check',16):(r.st==='bad'?icon('cross',16):icon('clock',16));
      var Q=r.Q, keyTxt=Q.keys.length?Q.keys.map(function(k){return k.toUpperCase()}).join('+'):'—', pk=r.r?r.r.pick.toUpperCase():'—';
      var row=h('div.rv-i.'+r.st,{},
        h('button.rv-h',{type:'button','aria-expanded':'false',onclick:function(){ open=!open; row.classList.toggle('open',open); this.setAttribute('aria-expanded',String(open)); if(open&&!body){ body=h('div.rv-b',{}); var qb=IM.questionBlock(Q,{item:r.it,res:function(){ return r.r?{pick:r.r.pick,ok:r.r.ok}:{pick:'',ok:false}; },cut:function(){return null},spectate:true,tools:false,onMark:function(){ IM.toggleMark(Q.id); },onReport:function(){ IM.reportDialog(Q,r.r&&r.r.pick); }}); body.appendChild(qb.el); row.appendChild(body); } else if(body) body.hidden=!open; }},
          h('span.rv-ic.'+r.st,{},ic),h('span.mono.rv-n',{text:String(i+1)}),
          h('span.rv-q',{dir:'ltr',lang:'en',text:Q.stem}),
          h('span.rv-k.mono',{dir:'ltr'},r.st==='ok'?keyTxt:(pk+' → '+keyTxt)),
          icon('chevd',16)));
      list.appendChild(row);
    });
  }
  chips(); paint();
  wrap.appendChild(h('section.rv',{},h('div.sec-h',{},h('div',{},h('h2.display',{text:'راجع أسئلة اللفافة'}),h('p.muted',{text:'اضغط على أي سؤال عشان تشوفه بإجابته وملاحظاته.'}))),fbar,list));
  return {};
};
})();
