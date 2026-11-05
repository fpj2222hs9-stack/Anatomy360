/* Imhotep · إمحتب — home: the pyramid, the sunrise, the next peak, the scale of performance */
(function(){
'use strict';
var IM=window.IM, h=IM.h, icon=IM.icon;

IM.modeName={train:'تدريب الألواح',mix:'خلط الرمال',water:'الساعة المائية'};
IM.sessLabel=function(s){
  var c=s.cfg, sub=IM.bank.subs[c.sid]; var parts=[sub?sub.ar:IM.subName(c.sid)];
  if(c.secs&&c.secs.length===1&&sub&&sub.secs[c.secs[0]]) parts=[sub.secs[c.secs[0]].en];
  else if(c.secs&&c.secs.length>1) parts.push(c.secs.length+' أقسام');
  if(c.wrongOnly) parts=['كفّة الأغلاط'].concat(parts.slice(c.secs&&c.secs.length===1?0:0));
  if(c.marksOnly) parts=['البردية'].concat(parts);
  return parts.join(' · ');
};

function noteBlock(view){
  var pend=IM.pendingNotices(), all=IM.corrections();
  if(!all.length) return null;
  var dismissed=IM.st.seen['home-note'];
  if(!pend.length&&dismissed) return null;
  var perSub={}; all.forEach(function(c){ perSub[c.q.sid]=(perSub[c.q.sid]||0)+1; });
  var subs=Object.keys(perSub).map(function(sid){ return perSub[sid]+' في '+IM.subName(sid); }).join(' و');
  var txt=pend.length?h('div.note-t',{},h('b',{text:'اتصحّح مفتاح '+pend.length+' سؤال جاوبته قبل كده.'}),' اتأكد إنك مذاكر الإجابة الصح.')
    :h('div.note-t',{},h('b',{text:'اتصحّح '+all.length+' مفتاح'}),' ('+subs+') بعد مراجعة الدكتور. اتأكد إنك مذاكر الإجابة الصح.');
  var n=h('div.note.rv',{},icon('feather',22),txt,
    h('a.btn.ghost.sm',{href:'#/corrections'},'شوف التصحيحات'),
    pend.length?null:h('button.iconbtn.sm',{type:'button','aria-label':'إخفاء',onclick:function(){ IM.st.seen['home-note']=Date.now(); IM.save('seen'); n.remove(); }},icon('cross',16)));
  return n;
}

IM.screens.home=function(view){
  var subs=IM.subjects.filter(function(s){return s.ready}).map(function(s){return s.id});
  var last=IM.lastSession();
  var cur=(last&&IM.bank.subs[last.cfg.sid]&&last.cfg.sid)||subs.slice().sort(function(a,b){ return IM.statsFor(b).answered-IM.statsFor(a).answered; })[0]||subs[0];
  var wrap=h('div.home');
  view.appendChild(wrap);

  function pyramidBlock(){
    var S=IM.bank.subs[cur], a=IM.statsFor(cur), t=IM.tiers(a), cls=IM.subClass(cur);
    var left=t.on>=6?h('div.muted.pyr-n',{text:'وصلت لقمة الهرم. كمّل عشان تثبّت مستواك.'}):h('div.muted.pyr-n',{text:'فاضل '+t.left+' سؤال للدرجة الجاية'});
    var chips=h('div.sub-pick',{role:'group','aria-label':'اختار المادة'});
    subs.forEach(function(id){ chips.appendChild(h('button.tog'+(id===cur?'.on':''),{type:'button','aria-pressed':String(id===cur),onclick:function(){ cur=id; render(); }},IM.subName(id))); });
    return h('div.hero-pyr',{},
      h('div.hero-m.'+cls,{html:IM.pyr(t.on,{anim:true,cls:'big'})}),
      h('div.hero-s.'+cls,{},
        h('span.chip.sub',{},h('span.dot'),IM.subName(cur)),
        h('div.display.big-n',{},String(t.on),' ',h('span.muted.big-of',{text:'من 6'})),
        h('div.muted',{text:'درجات في هرمك'}),left,
        h('div.muted.mono.pyr-c',{text:a.answered+' / '+a.total+' سؤال'})),
      chips);
  }
  function heroBlock(){
    var nm=IM.st.user?IM.st.user.name:'';
    var lastBtn;
    if(last){ lastBtn=h('a.btn',{href:'#/run/'+last.id},'كمّل آخر لفافة'); }
    else lastBtn=h('button.btn',{type:'button',disabled:true,title:'مفيش لفافة شغالة'},'كمّل آخر لفافة');
    var info=last?h('div.muted.mono.hero-last',{},'آخر لفافة: ',IM.sessLabel(last),' · سؤال ',String(Math.min(last.idx+1,last.items.length)),' من ',String(last.items.length)):null;
    var first=IM.totalAnswered()===0;
    return h('div.hero-txt',{},
      h('div.eyebrow.rv',{style:'animation-delay:.1s',text:'أهلًا بيك يا '+nm}),
      h('h1.display.hero-h.rv',{style:'animation-delay:.25s',text:'اصعد درجة درجة'}),
      h('p.muted.hero-p.rv',{style:'animation-delay:.4s',text:first?'هرمك 6 درجات لكل مادة، وكل سدس من أسئلتها بتخلّصه بيزوّدك درجة. ابدأ أول لفافة من أي لوح.':'هرمك 6 درجات، وكل سدس من أسئلة المادة بتخلّصه بيزوّدك درجة. كمّل من حيث وقفت، أو ابدأ لفافة جديدة من أي لوح.'}),
      h('div.hero-cta.rv',{style:'animation-delay:.55s'},h('a.btn.primary.lg',{href:'#/train'},icon('play',20),'ابدأ لفافة جديدة'),lastBtn,h('a.btn.ghost',{href:'#/mixed'},icon('mix',18),'لفافة شاملة')),
      info);
  }
  function sunriseCard(){
    var s=IM.streak(), wk=IM.week(), todayN=s.todayN, need=Math.max(0,IM.DAY_GOAL-todayN);
    var prog=Math.min(1,todayN/IM.DAY_GOAL);   /* the sun climbs as the day's answers add up */
    var scene=h('div.scene'+(s.todayLit?'':'.dawn'),{style:'width:118px;height:96px;flex:none'},h('div.sunb',{style:'left:calc(50% - 16px);bottom:22px;width:28px;height:28px'+(s.todayLit?'':';transform:translateY('+Math.round(40*(1-prog))+'px);opacity:'+(0.4+0.6*prog).toFixed(2))}),h('div.horizon',{style:'height:28px'}));
    return h('div.card.hcard',{},
      h('div.hc-h',{},h('h3.display',{text:'الشروق'}),h('span.chip.ok',{text:s.now?s.now+(s.now===1?' يوم':' أيام'):'لسه'})),
      h('div.hc-b',{},scene,h('p.muted',{text:s.todayLit?'الشمس طلعت النهارده. كل يوم متتالي بيطلّع شمس جديدة.':'حل '+need+' '+(need===1||need>10?'سؤال':'أسئلة')+(todayN?' كمان':'')+' عشان تطلع شمس النهارده ('+todayN+' من '+IM.DAY_GOAL+').'})),
      h('div.week',{},wk.map(function(d){ return h('div.wd',{},h('span.wdot'+(d.on?'.on':''),{title:d.n+' سؤال'}),h('span',{text:d.name})); })),
      s.best>1?h('div.muted.hc-f',{text:'أطول سلسلة: '+s.best+' أيام'}):null);
  }
  function peakCard(){
    var p=IM.planInfo(), head=h('div.hc-h',{},h('h3.display',{text:'القمة الجاية'}),icon('peak',22));
    if(!p) return h('div.card.hcard',{},head,h('p.muted',{text:'حدّد امتحانك وتاريخه، وإمحتب يحسب لك كام سؤال في اليوم تخلّص بيهم.'}),h('div.hc-f',{},h('button.btn.sm',{type:'button',onclick:function(){ IM.planDialog(render); }},'حدّد القمة')));
    var nm=p.sid==='all'?'كل المواد':IM.subName(p.sid);
    var when=p.past?'التاريخ عدّى':(p.daysLeft===0?'النهارده':'بعد '+p.daysLeft+' '+(p.daysLeft<=10?'أيام':'يوم'));
    return h('div.card.hcard',{},head,
      h('div',{},h('div.hc-t',{text:(p.plan.label||('امتحان '+nm))}),h('div.muted',{text:when+' · '+IM.fmtDate(p.plan.date)})),
      h('div.hc-bars',{},h('div.hc-row',{},h('span.muted',{text:'اللي خلص من الأسئلة'}),h('span.mono',{text:p.answered+' / '+p.total})),
        h('div.bar',{},h('i',{style:'width:'+p.pct+'%'})),
        h('div.muted.hc-s',{text:p.left===0?'خلّصت كل الأسئلة، راجع الأغلاط.':(p.past?'':'محتاج حوالي '+p.perDay+' سؤال في اليوم')})),
      h('div.hc-f',{},h('button.btn.ghost.sm',{type:'button',onclick:function(){ IM.planDialog(render); }},'تعديل')));
  }
  function scaleCard(){
    var rows=subs.map(function(id){ var a=IM.statsFor(id); return h('div.'+IM.subClass(id),{},
      h('div.sc-r',{},h('span.sc-n',{},h('span.dot'),IM.subName(id)),h('span.mono',{text:a.answered?a.acc+'%':'—'})),
      h('div.bar.sm',{},h('i',{style:'width:'+(a.answered?a.acc:0)+'%;background:var(--p)'}))); });
    var w=IM.wrongIds().length;
    return h('div.card.hcard',{},
      h('div.hc-h',{},h('h3.display',{text:'ميزان الأداء'}),icon('scale',22)),
      h('div.sc-rows',{},rows),
      h('a.hc-link',{href:w?'#/papyrus/wrong':'#/scales'},w?'كفّة الأغلاط: '+w+' سؤال محتاجين مراجعة':'كفّة الأغلاط فاضية. كمّل كده.'));
  }
  function render(){
    IM.clear(wrap);
    var nb=noteBlock(view); if(nb) wrap.appendChild(nb);
    wrap.appendChild(h('section.hero',{},heroBlock(),pyramidBlock()));
    wrap.appendChild(h('section.cards3',{},sunriseCard(),peakCard(),scaleCard()));
  }
  render();
  var off=IM.on('answer',function(){ /* stay calm while reading; refresh on return */ });
  return {destroy:function(){ off(); }};
};

/* plan dialog: the next peak (exam) */
IM.planDialog=function(done){
  var p=IM.st.plan||{}, subs=IM.subjects.filter(function(s){return s.ready});
  var sel=h('select.field-i',{'aria-label':'المادة'},h('option',{value:'all',text:'كل المواد'}),subs.map(function(s){ return h('option',{value:s.id,text:s.ar}); }));
  sel.value=p.sid||'all';
  var d=h('input.field-i',{type:'date',value:p.date||'',min:IM.dayKey(),'aria-label':'تاريخ الامتحان',dir:'ltr'});
  var lab=h('input.field-i',{type:'text',maxlength:40,value:p.label||'',placeholder:'مثال: امتحان نصف الترم','aria-label':'اسم الامتحان'});
  var msg=h('p.g-msg',{role:'alert'});
  var body=h('div.form',{},h('label.label',{},'المادة'),sel,h('label.label',{},'تاريخ الامتحان'),d,h('label.label',{},'اسم (اختياري)'),lab,msg);
  var dlg=IM.modal({title:'القمة الجاية',body:body,foot:[
    h('button.btn.primary',{type:'button',onclick:function(){ if(!d.value){ msg.textContent='اختار التاريخ.'; return; } if(d.value<IM.dayKey()){ msg.textContent='التاريخ لازم يكون النهارده أو بعده.'; return; } IM.setPlan({sid:sel.value,date:d.value,label:lab.value.trim()}); dlg.close(); done&&done(); }},'حفظ'),
    p.date?h('button.btn.ghost',{type:'button',onclick:function(){ IM.setPlan(null); dlg.close(); done&&done(); }},'شيل القمة'):null,
    h('button.btn.ghost',{type:'button',onclick:function(){ dlg.close(); }},'إلغاء')]});
};
})();
