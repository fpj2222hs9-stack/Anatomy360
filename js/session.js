/* Imhotep · إمحتب — the scroll (لفافة): one question at a time or a list, 50/50, repeat of mistakes, water clock, keyboard */
(function(){
'use strict';
var IM=window.IM, h=IM.h, icon=IM.icon;
var LET='abcdefgh';

function findSession(id){ var all=IM.sessions(), k; for(k in all) if(all[k].id===id) return all[k]; return null; }
IM.findSession=findSession;

/* the balance: same drawing as the design board, driven by the result class */
function scaleSVG(){
  return '<svg viewBox="0 0 64 56" width="84" height="74" fill="none" stroke="var(--ink)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="overflow:visible;margin-top:4px"><path d="M32 12V46M20 48H44"/><g class="beam"><path d="M8 12H56M8 12L0 30M8 12L16 30M56 12L48 30M56 12L64 30"/></g><g class="pan l"><path d="M0 30H16A8 8 0 0 1 0 30Z"/><path d="M8 28C6 25 6 22 8 19C10 22 10 25 8 28Z" stroke="var(--sun)"/></g><g class="pan"><path d="M48 30H64A8 8 0 0 1 48 30Z"/><circle cx="56" cy="26" r="3" stroke="var(--ink-2)"/></g><circle cx="32" cy="12" r="2" fill="var(--sun)" stroke="none"/></svg>';
}
function fmtKeys(Q){ return Q.keys.map(function(k){return k.toUpperCase()}).join(' + '); }

/* ---------- the notes under an answer (status, corrections, doubts) ---------- */
IM.noteFor=function(Q,pick){
  var out=[], bk=Q.bk, both=bk&&Q.keys.indexOf(bk)>-1;
  if(Q.fix&&bk){
    out.push(h('p.res-note.fix',{},icon('scale',16),h('span',{},both?'عُدِّل مفتاح السؤال: المطبوع ':'اتصحّح مفتاح السؤال: المطبوع في الملزمة ',IM.n(bk.toUpperCase()),both?'، والمقبول دلوقتي ':'، والصحيح ',IM.n(fmtKeys(Q)),'. ',Q.fx||'')));
    if(pick&&pick===bk&&!both) out.push(h('p.res-note.warn',{},icon('flag',16),h('span',{text:'إجابتك كانت المفتاح القديم. المفتاح الجديد هو اللي بيتحسب.'})));
  } else if(Q.fx){ out.push(h('p.res-note',{},icon('info',16),h('span',{text:'ملاحظة: '+Q.fx}))); }
  if(Q.alt) out.push(h('p.res-note.doubt',{},icon('scale',16),h('span',{},'مفتاح الملزمة هنا شكله غير دقيق علميًا'+(Q.alt!=='?'?'، والإجابة الأرجح: ':' (مش مطابق لنص السؤال)'),Q.alt!=='?'?IM.n(Q.alt.toUpperCase()):'','. المحسوب لك هو المفتاح المطبوع.')));
  if(Q.review&&!Q.alt) out.push(h('p.res-note.doubt',{},icon('eye',16),h('span',{text:'السؤال قيد المراجعة. المحسوب لك هو مفتاح الملزمة.'})));
  if(Q.canc) out.push(h('p.res-note.doubt',{},icon('cross',16),h('span',{text:'السؤال ده ملغي في جدول الملزمة. بيظهر بمفتاحه المطبوع بس ومش بيتحسب.'})));
  if(!Q.keys.length) out.push(h('p.res-note.doubt',{},icon('warn',16),h('span',{text:Q.rv?Q.rv:'مفيش مفتاح مطبوع للسؤال ده في الملزمة، فمش بيتحسب.'})));
  if(Q.keys.length>1) out.push(h('p.res-note',{},icon('check',16),h('span',{},'الإجابات المقبولة: ',IM.n(fmtKeys(Q)))));
  return out;
};

/* ---------- one question block, shared by both layouts ---------- */
IM.questionBlock=function(Q,o){
  /* o: {item, res(), cut(), spectate, water, onPick(letter), onHint(), onMark(), onReport(), showNum, tools} */
  var el=h('div.qb.'+IM.subClass(Q.sid)), st=IM.statusOf(Q); el.setAttribute('data-q',Q.id);
  var chips=h('div.q-chips',{},h('span.chip.sub',{},h('span.dot'),IM.subName(Q.sid)));
  Q.tags.forEach(function(t){ chips.appendChild(h('span.chip.src',{text:t})); });
  chips.appendChild(IM.statusChip(st));
  if(o.item&&o.item.r) chips.appendChild(h('span.chip.ok',{title:'سؤال غلطته قبل شوية ورجع'},icon('reset',14),'رجع تاني'));
  var sec=IM.bank.subs[Q.sid].secs[Q.sec];
  var num=h('div.q-num',{},h('span.mono.q-n',{text:Q.n?'س '+Q.n:''}),h('span.muted.q-s',{text:sec?(sec.en+(sec.ar?' · '+sec.ar:'')):''}));
  var stem=h('p.q-stem',{dir:'ltr',lang:'en',text:Q.stem});
  var fig=Q.fig?h('img.qfig',{src:IM.asset(Q.fig),alt:'شكل السؤال',loading:'lazy'}):null;
  var opts=h('div.q-opts',{dir:'ltr',lang:'en'}), btns={};
  Q.opts.forEach(function(op,i){
    var k=h('span.k',{text:op.o.toUpperCase()});
    var b=h('button.opt',{type:'button',dataset:{o:op.o},onclick:function(){ o.onPick&&o.onPick(op.o); }},k,h('span.opt-t',{text:op.t}));
    btns[op.o]={b:b,k:k}; opts.appendChild(b);
  });
  var tools=h('div.q-tools'), cutBtn=null, cutHint=null;
  if(o.tools){
    cutBtn=h('button.btn.ghost.cut',{type:'button',onclick:function(){ o.onHint&&o.onHint(); }},h('span.mono',{text:'50/50'}));
    cutHint=h('span.muted.cut-h'); tools.appendChild(cutBtn); tools.appendChild(cutHint);
  }
  var resBox=h('div.res.card',{hidden:true,'aria-live':'polite'});
  var actions=h('div.q-acts');
  var mk=h('button.q-act',{type:'button',onclick:function(){ o.onMark&&o.onMark(); paint(); }});
  var rp=h('button.q-act.rp',{type:'button',onclick:function(){ o.onReport&&o.onReport(); }},icon('flag',15),'اعترض على المفتاح');
  actions.appendChild(mk); actions.appendChild(rp);
  el.appendChild(chips); el.appendChild(num); el.appendChild(stem); if(fig) el.appendChild(fig); el.appendChild(opts); if(o.tools) el.appendChild(tools); el.appendChild(resBox); el.appendChild(actions);

  function paint(){
    var r=o.res(), cut=o.cut()||[], answered=!!r&&!o.water, spec=o.spectate, reveal=answered||spec;
    var marked=IM.isMarked(Q.id);
    IM.clear(mk); mk.appendChild(icon('bookmark',15)); mk.appendChild(document.createTextNode(marked?'في البردية':'احفظ في البردية')); mk.classList.toggle('on',marked); mk.setAttribute('aria-pressed',String(marked));
    Q.opts.forEach(function(op){
      var B=btns[op.o], isKey=Q.keys.indexOf(op.o)>-1, picked=r&&r.pick===op.o, c='';
      B.b.className='opt'; IM.clear(B.k); B.k.textContent=op.o.toUpperCase(); B.b.disabled=false;
      if(reveal){
        if(isKey&&Q.keys.length){ c='correct'; IM.clear(B.k); B.k.appendChild(icon('check',18)); }
        else if(picked){ c='wrong'; IM.clear(B.k); B.k.appendChild(icon('cross',18)); }
        else c='dim';
        B.b.disabled=true;
      } else if(o.water&&picked){ c='picked'; }
      else if(cut.indexOf(op.o)>-1){ c='dim'; B.b.disabled=true; }
      if(c) B.b.classList.add(c);
      if(spec) B.b.disabled=true;
    });
    if(cutBtn){ var used=cut.length>0; cutBtn.disabled=used||answered; cutBtn.style.opacity=used?'.5':'1'; cutHint.textContent=used?'اتشالت إجابتين غلط.':(answered?'':'بيشيل إجابتين غلط من قدامك.'); tools.hidden=answered; }
    IM.clear(resBox);
    if(reveal){
      resBox.hidden=false;
      var ok=r?r.ok:null, cls=spec||ok==null?'':(ok?' ok':' bad');
      resBox.className='res card'+cls;
      var title=h('div.res-t',{});
      if(!spec&&ok!=null&&Q.keys.length){
        title.appendChild(h('h2.display',{style:'color:var(--'+(ok?'ok':'bad')+')',text:ok?'اتزن الميزان':'الكفّة تقلت'}));
        if(ok) title.appendChild(h('div.seal',{},icon('feather',22)));
      } else title.appendChild(h('h2.display',{text:Q.keys.length?'الإجابة الصحيحة':'من غير مفتاح'}));
      var line=!Q.keys.length?null:h('p.res-l',{},(spec?'الإجابة الصحيحة: ':(ok?'إجابة صح. الإجابة الصحيحة: ':'غلط. الإجابة الصحيحة: ')),IM.n(fmtKeys(Q)));
      var optl=(Q.keys.length===1)?h('p.res-o',{dir:'ltr',lang:'en',text:IM.optText(Q,Q.keys[0])}):null;
      var inner=h('div.res-in',{},title,line,optl,IM.noteFor(Q,r&&r.pick));
      resBox.appendChild(h('div.res-row',{},h('span.res-sc',{html:scaleSVG()}),inner));
    } else resBox.hidden=true;
    if(o.onPaint) o.onPaint();
  }
  paint();
  return {el:el,paint:paint,Q:Q};
};

/* ---------- water clock ---------- */
function clockSVG(){
  return '<svg class="wclock" viewBox="0 0 40 58" width="34" height="50" aria-hidden="true"><defs><clipPath id="wcClip"><path d="M6 4h28l-3.2 40a4 4 0 0 1-4 3.6H13.2a4 4 0 0 1-4-3.6Z"/></clipPath></defs><rect class="wl" clip-path="url(#wcClip)" x="0" y="4" width="40" height="44" fill="var(--tur)" opacity=".55"/><path d="M6 4h28l-3.2 40a4 4 0 0 1-4 3.6H13.2a4 4 0 0 1-4-3.6ZM4 4h32" fill="none" stroke="var(--ink)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 48v4" stroke="var(--ink-2)" stroke-width="1.6" stroke-linecap="round"/><circle class="drip" cx="20" cy="53" r="1.6" fill="var(--tur)"/></svg>';
}

/* ---------- the screen ---------- */
IM.screens.session=function(view,params){
  var sess=findSession(params[0]);
  if(!sess){ IM.toast('اللفافة دي مش موجودة.',{kind:'bad'}); IM.go('#/train'); return {}; }
  if(sess.state==='done'){ IM.go('#/result/'+sess.id); return {}; }
  IM.chrome(false);
  var cfg=sess.cfg, water=cfg.mode==='water', spec=!!cfg.spectate;
  var layout=spec?'list':(IM.st.set.layout||'one');
  var S=IM.bank.subs[cfg.sid];
  var watch=IM.Watch(120000), qb=null, qbs={}, ended=false, tick=null, lastSaved=0, saveT=0, mapOpen=false;
  var items=sess.items;
  if(sess.tier0==null){ var a0=IM.statsFor(cfg.sid); sess.tier0=IM.tiers(a0).on; sess.ans0=a0.answered; }
  function Qof(it){ return IM.Q(it.q); }
  function resOf(it){ return sess.res[it.u]; }

  var root=h('div.run.'+IM.subClass(cfg.sid)+(water?'.is-water':''));
  view.appendChild(root);

  /* ----- header ----- */
  var title=h('div.run-title',{},h('div.run-m',{text:cfg.trial&&IM.STAGES[cfg.trial.stage-1]?('امتحان ترقية · '+IM.stageName(IM.STAGES[cfg.trial.stage-1])):('لفافة · '+IM.modeName[cfg.mode])}),h('div.run-c.mono'));
  var scoreEl=h('div.run-sc.mono'), timeEl=h('div.run-tm.mono');
  var clock=water?h('div.run-clock',{html:clockSVG()}):null;
  var markBtn=h('button.iconbtn',{type:'button','aria-label':'احفظ في البردية',onclick:function(){ var it=items[sess.idx]; if(!it) return; IM.toggleMark(it.q); if(qb) qb.paint(); paintHead(); }});
  var back=h('button.iconbtn',{type:'button','aria-label':'خروج وحفظ',onclick:exit},icon('back',22));
  var mapBtn=h('button.iconbtn.map-b',{type:'button','aria-label':'خريطة الأسئلة',onclick:function(){ mapOpen=!mapOpen; side.classList.toggle('open',mapOpen); }},icon('grid',20));
  var head=h('header.run-top',{},back,h('div.run-mid',{},title,h('div.run-st',{},scoreEl,timeEl)),clock,mapBtn,markBtn);
  var prog=h('div.run-prog',{},h('i'));
  var main=h('div.run-main'), foot=h('div.run-foot');
  var side=h('aside.run-side',{},h('div.run-side-h',{},h('b',{text:'خريطة الأسئلة'}),h('button.iconbtn.sm.map-x',{type:'button','aria-label':'إغلاق',onclick:function(){ mapOpen=false; side.classList.remove('open'); }},icon('cross',16))),h('div.map'),h('div.map-lg.muted',{},h('span',{},h('i.mp.ok'),'صح'),h('span',{},h('i.mp.bad'),'غلط'),h('span',{},h('i.mp'),'لسه'),h('span',{},h('i.mp.rep'),'رجع')));
  root.appendChild(head); root.appendChild(prog);
  root.appendChild(h('div.run-body',{},h('div.run-col',{},main,foot),side));
  var mapEl=IM.$('.map',side);

  /* ----- counters ----- */
  function counts(){ var ok=0,bad=0,done=0; items.forEach(function(it){ var r=resOf(it); if(r){ done++; if(!water&&it.r===0){ if(r.ok) ok++; else bad++; } } }); return {ok:ok,bad:bad,done:done}; }
  function paintHead(){
    var c=counts(), n=items.length, i=Math.min(sess.idx+1,n);
    IM.$('.run-c',title).textContent=(layout==='list'?c.done:i)+' / '+n;
    scoreEl.innerHTML=water?('<span>'+c.done+' مجاوب</span>'):(spec?'':'<span class="g-ok">✓ '+c.ok+'</span> <span class="g-bad">✗ '+c.bad+'</span>');
    prog.firstChild.style.width=Math.round((layout==='list'?c.done:c.done)/Math.max(1,n)*100)+'%';
    var it=items[sess.idx]; if(it){ var mk=IM.isMarked(it.q); markBtn.classList.toggle('on',mk); markBtn.setAttribute('aria-pressed',String(mk)); IM.clear(markBtn); markBtn.appendChild(icon('bookmark',22)); if(mk) markBtn.firstChild.setAttribute('fill','currentColor'); }
    paintMap();
  }
  function paintMap(){
    IM.clear(mapEl);
    items.forEach(function(it,i){
      var r=resOf(it), c='mp'; if(r&&!water) c+=r.ok?' ok':' bad'; else if(r&&water) c+=' pick'; if(it.r) c+=' rep'; if(i===sess.idx&&layout==='one') c+=' cur';
      mapEl.appendChild(h('button.'+c.split(' ').join('.'),{type:'button','aria-label':'سؤال '+(i+1),text:String(i+1),onclick:function(){ jump(i); }}));
    });
  }
  function tickTime(){
    var spent=sess.spent+(Date.now()-sess.since);
    if(water){
      var left=Math.max(0,sess.left-(Date.now()-sess.since)), total=Math.max(1,sess.total||sess.left);
      timeEl.textContent=IM.fmtTime(left); timeEl.classList.toggle('low',left<total*.2);
      var wl=IM.$('.wl',clock); if(wl){ var f=left/total, y=4+(1-f)*44; wl.setAttribute('y',y.toFixed(1)); wl.setAttribute('height',(48-y).toFixed(1)); }
      if(left<=0&&!ended){ finish('time'); }
    } else timeEl.textContent=IM.fmtTime(spent);
  }
  sess.since=Date.now(); sess.total=water?(sess.total||sess.left):0;
  tick=setInterval(function(){ if(document.hidden) return; tickTime(); },500);
  tickTime();

  /* ----- persistence ----- */
  function bank(){ var now=Date.now(); sess.spent+=now-sess.since; if(water) sess.left=Math.max(0,sess.left-(now-sess.since)); sess.since=now; }
  function persist(force){
    var now=Date.now();
    if(!force&&now-lastSaved<400){ if(!saveT) saveT=setTimeout(function(){ saveT=0; if(!ended) persist(true); },450); return; }
    lastSaved=now; if(saveT){ clearTimeout(saveT); saveT=0; }
    bank(); sess.upd=now; var copy=Object.assign({},sess); delete copy.since; IM.saveSession(copy);
  }
  function onHide(){ if(document.hidden) persist(true); }
  document.addEventListener('visibilitychange',onHide); function onPageHide(){ if(!ended) persist(true); }
  window.addEventListener('pagehide',onPageHide);

  /* ----- actions ----- */
  function ctxFor(it){
    var Q=Qof(it);
    return {item:it,water:water,spectate:spec,tools:!water&&!spec,
      res:function(){ return resOf(it); },
      cut:function(){ return sess.cut[it.u]; },
      onPick:function(l){ pick(it,l); },
      onHint:function(){ hint(it); },
      onMark:function(){ IM.toggleMark(Q.id); paintHead(); },
      onReport:function(){ IM.reportDialog(Q,resOf(it)&&resOf(it).pick); },
      onPaint:function(){}};
  }
  function pick(it,l){
    if(spec||ended) return;
    var Q=Qof(it), r=resOf(it), ms=watch.stop();
    if(water){ sess.res[it.u]={pick:l,ms:(r&&r.ms||0)+ms}; watch.start(); }
    else {
      if(r) return;
      var ok=IM.record(Q,l,ms,{h:sess.cut[it.u]?1:0}); sess.res[it.u]={pick:l,ok:ok,ms:ms};
      if(!ok&&it.r===0&&sess.reps<Math.max(6,Math.round(sess.items.length*.4))){ var at=Math.min(items.length,sess.idx+5+sess.reps%3); items.splice(at,0,{u:String(sess.uid++),q:it.q,r:1}); sess.reps++; }
      if(layout==='one') watch.start();
    }
    var b=qbs[it.u]; if(b) b.paint();
    paintHead(); paintFoot(); persist();
  }
  function hint(it){
    var Q=Qof(it); if(resOf(it)||sess.cut[it.u]) return;
    var wrong=Q.opts.filter(function(o){ return Q.keys.indexOf(o.o)<0; }).map(function(o){return o.o;});
    var n=Math.min(2,wrong.length-1); if(n<1){ IM.toast('مفيش اختيارات كفاية لـ50/50 هنا.'); return; }
    sess.cut[it.u]=IM.shuffle(wrong).slice(0,n); var b=qbs[it.u]; if(b) b.paint(); persist();
  }
  function jump(i){ if(layout==='list'){ var b=qbs[items[i].u]; if(b) b.el.scrollIntoView({behavior:'smooth',block:'center'}); sess.idx=i; paintHead(); side.classList.remove('open'); return; } leave(); sess.idx=IM.clamp(i,0,items.length-1); showOne(); side.classList.remove('open'); persist(); }
  function leave(){ if(water&&layout==='one'){ var it=items[sess.idx], r=it&&resOf(it); var ms=watch.stop(); if(r) r.ms=(r.ms||0)+ms; } }
  function next(){
    if(layout!=='one') return;
    var it=items[sess.idx];
    if(sess.idx>=items.length-1){ if(!water&&resOf(it)||spec){ finish('done'); } else if(water){ confirmSubmit(); } return; }
    leave(); sess.idx++; showOne(); persist();
  }
  function prev(){ if(layout!=='one'||sess.idx<=0) return; leave(); sess.idx--; showOne(); persist(); }
  function exit(){
    persist(true); ended=true; cleanup();
    var c=counts();
    if(!c.done&&!water){ IM.dropSession(sess.key); }
    else IM.toast('اتحفظت لفافتك. كمّلها من الرئيسية.',{icon:'check'});
    IM.go('#/train');
  }
  function confirmSubmit(){
    var left=items.length-counts().done;
    if(!left){ finish('submit'); return; }
    var d=IM.modal({title:'تسليم اللفافة؟',body:h('p',{text:'فاضل '+left+' سؤال من غير إجابة، وهيتحسبوا غلط.'}),foot:[h('button.btn.primary',{type:'button',onclick:function(){ d.close(); finish('submit'); }},'سلّم'),h('button.btn.ghost',{type:'button',onclick:function(){ d.close(); }},'كمّل')]});
  }
  function finish(why){
    if(ended) return; ended=true; leave(); bank();
    if(spec){ IM.dropSession(sess.key); cleanup(); IM.toast('خلّصت المشاهدة.',{icon:'check'}); IM.go('#/train'); return; }
    var okN=0, n=0;
    items.forEach(function(it){
      var Q=Qof(it), r=resOf(it);
      if(water&&r){ var ok=IM.record(Q,r.pick,r.ms||0,{w:1}); r.ok=ok; }
      if(it.r===0){ n++; if(r&&r.ok) okN++; }
    });
    sess.state='done'; sess.end=Date.now(); sess.why=why; sess.score={n:n,ok:okN,ms:sess.spent};
    if(cfg.trial&&IM.trialDone) sess.trial=IM.trialDone(cfg.trial,n,okN);
    IM.addHist({id:sess.id,ts:sess.end,sid:cfg.sid,mode:cfg.mode,n:n,ok:okN,ms:sess.spent,label:IM.sessLabel(sess)});
    var copy=Object.assign({},sess); delete copy.since; IM.saveSession(copy);
    cleanup(); IM.go('#/result/'+sess.id);
  }
  function cleanup(){ clearInterval(tick); if(saveT){ clearTimeout(saveT); saveT=0; } document.removeEventListener('visibilitychange',onHide); document.removeEventListener('keydown',onKey); window.removeEventListener('pagehide',onPageHide); watch.off(); }

  /* ----- rendering ----- */
  function paintFoot(){
    IM.clear(foot);
    var it=items[sess.idx], r=it&&resOf(it);
    if(layout==='list'){
      var c=counts();
      foot.appendChild(h('div.muted.foot-h',{text:water?'جاوب براحتك، وسلّم لما تخلّص.':(spec?'وضع المشاهدة: الإجابات ظاهرة.':'جاوب على الأسئلة تحت. تقدر تخرج وتكمّل بعدين.')}));
      foot.appendChild(h('button.btn.primary.fin',{type:'button',onclick:function(){ if(water) confirmSubmit(); else finish('done'); }},water?'تسليم':(spec?'خلّصت':'شوف النتيجة')));
      return;
    }
    var last=sess.idx>=items.length-1;
    var answered=!!r&&!water;
    if(water){
      foot.appendChild(h('button.iconbtn.nx-b',{type:'button','aria-label':'السابق',disabled:sess.idx===0,onclick:prev},icon('back',22)));
      foot.appendChild(h('div.muted.foot-h',{text:r?'اتسجّلت إجابتك. تقدر تغيّرها.':'اختار إجابة.'}));
      foot.appendChild(last?h('button.btn.primary.fin',{type:'button',onclick:confirmSubmit},'تسليم'):h('button.btn.primary.fin',{type:'button',onclick:next},'اللي بعده',icon('next',20)));
      return;
    }
    if(answered||spec){
      foot.appendChild(h('button.btn.primary.fin',{type:'button',onclick:next},last?(spec?'خلّصت':'شوف النتيجة'):'السؤال اللي بعده',last?null:icon('next',20)));
      if(!spec) foot.appendChild(h('button.iconbtn',{type:'button','aria-label':'إعادة السؤال',title:'إعادة السؤال',onclick:function(){ delete sess.res[it.u]; delete sess.cut[it.u]; watch.start(); if(qb) qb.paint(); paintHead(); paintFoot(); persist(); }},icon('reset',22)));
    } else {
      foot.appendChild(h('button.iconbtn.nx-b',{type:'button','aria-label':'السابق',disabled:sess.idx===0,onclick:prev},icon('back',22)));
      foot.appendChild(h('div.muted.foot-h',{text:'اختار إجابة عشان الميزان يتحرك'}));
      foot.appendChild(h('button.btn.ghost.skip',{type:'button',onclick:next},last?'خلّصت':'تخطّي'));
    }
  }
  function showOne(){
    IM.clear(main); qbs={};
    var it=items[sess.idx]; qb=IM.questionBlock(Qof(it),ctxFor(it)); qbs[it.u]=qb; main.appendChild(qb.el);
    if(!resOf(it)||water) watch.start();
    paintHead(); paintFoot(); window.scrollTo(0,0);
  }
  function showList(){
    IM.clear(main); qbs={}; var shown=0, B=15;
    var wrap=h('div.qlist'); main.appendChild(wrap);
    var sentinel=h('div.sentinel');
    function more(){
      var to=Math.min(items.length,shown+B);
      for(;shown<to;shown++){
        (function(i){ var it=items[i], ctx=ctxFor(it); var box=h('section.qli'); box.appendChild(h('div.qli-n.mono',{text:(i+1)+' / '+items.length})); var q=IM.questionBlock(Qof(it),ctx); qbs[it.u]=q; box.appendChild(q.el); wrap.appendChild(box); })(shown);
      }
      if(shown>=items.length&&sentinel.parentNode) sentinel.remove(); else if(!sentinel.parentNode) main.appendChild(sentinel);
    }
    more(); watch.start();
    if('IntersectionObserver' in window){ var io=new IntersectionObserver(function(es){ if(es.some(function(e){return e.isIntersecting})) more(); },{rootMargin:'600px'}); io.observe(sentinel); }
    else { var btn=h('button.btn',{type:'button',onclick:more},'أكتر'); main.appendChild(btn); }
    paintHead(); paintFoot();
  }

  /* ----- keyboard ----- */
  function onKey(e){
    if(!IM.st.set.keys||e.ctrlKey||e.metaKey||e.altKey||document.querySelector('.ov')) return;
    if(/INPUT|TEXTAREA|SELECT/.test((e.target||{}).tagName||'')) return;
    var k=e.key, it=items[sess.idx]; if(!it) return;
    if(k==='Escape'){ e.preventDefault(); exit(); return; }
    if(layout!=='one') return;
    var Q=Qof(it), idx=-1;
    if(/^[1-6]$/.test(k)) idx=+k-1; else if(/^[a-fA-F]$/.test(k)&&!e.shiftKey) idx=LET.indexOf(k.toLowerCase());
    if(idx>-1&&Q.opts[idx]){ e.preventDefault(); var B=IM.$('.opt[data-o="'+Q.opts[idx].o+'"]',main); if(B&&!B.disabled) pick(it,Q.opts[idx].o); return; }
    if(k==='Enter'||k==='ArrowLeft'){ e.preventDefault(); if(resOf(it)||spec||water) next(); }
    else if(k==='ArrowRight'||k==='Backspace'){ e.preventDefault(); prev(); }
    else if(k==='s'||k==='S'){ e.preventDefault(); IM.toggleMark(Q.id); if(qb) qb.paint(); paintHead(); }
    else if((k==='h'||k==='H')&&!water&&!spec){ e.preventDefault(); hint(it); }
    else if(k==='m'||k==='M'){ mapOpen=!mapOpen; side.classList.toggle('open',mapOpen); }
  }
  document.addEventListener('keydown',onKey);

  /* ----- go ----- */
  if(sess.idx>=items.length) sess.idx=items.length-1;
  if(layout==='list') showList(); else showOne();
  root.classList.toggle('as-list',layout==='list');
  return {destroy:function(){ if(!ended){ persist(true); } cleanup(); IM.chrome(true); }};
};

IM.shortcutsHelp=function(){
  var rows=[['1 – 6  /  A – F','اختار الإجابة'],['Enter  /  ←','السؤال اللي بعده'],['→  /  Backspace','السؤال اللي قبله'],['S','احفظ في البردية'],['H','50/50 (شيل إجابتين غلط)'],['M','خريطة الأسئلة'],['Esc','خروج وحفظ اللفافة'],['?','القايمة دي']];
  var t=h('table.kbd');
  rows.forEach(function(r){ t.appendChild(h('tr',{},h('td',{},h('kbd.mono',{dir:'ltr',text:r[0]})),h('td',{text:r[1]}))); });
  IM.modal({title:'اختصارات الكيبورد',body:t});
};
})();
