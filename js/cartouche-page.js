/* Imhotep · إمحتب — صفحة خرطوشتي + الشارة في الرئيسية والأفاتار + احتفال الترقية + بانر امتحان الترقية */
(function(){
'use strict';
var IM=window.IM, h=IM.h, icon=IM.icon;

function nm(){ return (IM.st.user&&IM.st.user.name)||'اسمك'; }
function nf(n){ return Number(n).toLocaleString('en-US'); }
function dateOf(ts){ return IM.fmtDate(IM.dayKey(new Date(ts))); }
function tierOf(){ return IM.st.carto.tier||0; }
function nextStage(){ var t=tierOf(); return t<IM.STAGES.length?IM.STAGES[t]:null; }

var REQ_LABEL={index:'مؤشر إمحتب',open:'أسئلة اتفتحت',days:'أيام شروق',trial:'امتحان الترقية'};
function reqRow(r){
  var pc=(r.id==='open'||r.id==='trial')?'%':'', txt;
  if(r.id==='trial') txt=r.ok?'✓':(r.tries?r.have+'% / '+r.need+'%':r.need+'%');
  else txt=r.have+pc+' / '+r.need+pc;
  return h('li.cp-rq'+(r.ok?'.ok':''),{},h('span.cp-ri',{},icon(r.ok?'check':'cross',14)),h('span.cp-rl',{text:REQ_LABEL[r.id]}),h('span.cp-rv.mono',{dir:'ltr',text:txt}));
}

/* ---------- طريقك للـ100: أكتر حاجات ناقصة وإزاي تكمّلها ---------- */
function pathSection(L){
  var P=L.pts, W=IM.LEVEL_WEIGHTS, inf=IM.weeklyInfo(), items=[];
  function miss(k){ return W[k]-P[k]; }
  if(miss('mastery')>=0.2) items.push({m:miss('mastery'),t:'التثبيت',x:'فاضل '+nf(Math.max(0,L.groups-L.secured))+' سؤال مش مثبّت. افتح أسئلة جديدة وصلّح اللي غلطت فيه (الصح بعد 50/50 بنص قيمة).',a:{label:'ورشة الألواح',href:'#/train'}});
  if(miss('accuracy')>=0.2){
    var wk=inf.canStart?{label:'ابدأ التقييم الأسبوعي',fn:IM.startWeekly}:null;
    items.push({m:miss('accuracy'),t:'الدقة',x:L.errOpen?('لسه '+nf(L.errOpen)+' غلطة أول مرة مش ممحية، والتقييم الأسبوعي هو اللي بيمحيها. دقتك بعد المحو '+Math.round(L.accEff*100)+'% والنقطة الكاملة عند 90%.'):('دقتك '+Math.round(L.accEff*100)+'% والنقطة الكاملة عند 90%. جاوب أسئلة جديدة بتركيز.'),a:wk});
  }
  if(miss('consistency')>=0.2) items.push({m:miss('consistency'),t:'الانتظام',x:'ناقصك '+Math.max(1,26-L.lit30)+' يوم شروق من آخر 30 يوم (الكاملة عند 26 يوم، يعني 50 إجابة في اليوم).',a:{label:'الرئيسية',href:'#/'}});
  if(miss('improvement')>=0.2) items.push({m:miss('improvement'),t:'التحسّن',x:'في كفّة الأغلاط '+nf(L.wrongNow)+' سؤال. صلّحهم، وخلّي دقة آخر أسبوعين 90% فأكتر.',a:{label:'كفّة الأغلاط',href:'#/papyrus'}});
  if(miss('achievements')>=0.2) items.push({m:miss('achievements'),t:'الإنجازات',x:(function(){ var sm=Math.max(0,L.sealsOf-L.seals), pm=Math.max(0,5-L.passed), a=[]; if(sm) a.push(sm+' ختم'); if(pm) a.push(pm+' من امتحانات الترقية'); return 'ناقصك '+(a.join(' و')||'حاجات بسيطة')+'. الأختام بتتفتح مع عدد إجاباتك، وامتحانات الترقية من خراطيش السلّم.'; })(),a:null});
  items.sort(function(a,b){ return b.m-a.m; });
  var top=items.slice(0,3), left=Math.max(0,100-L.raw);
  var list=h('div.cp-path',{});
  if(!top.length) list.appendChild(h('div.card.cp-pi',{},icon('award',22),h('div',{},h('b',{text:'كل المكوّنات كاملة تقريبًا'}),h('p.muted',{text:'مؤشرك '+L.raw.toFixed(1)+' من 100.'}))));
  top.forEach(function(it){
    var act=null;
    if(it.a&&it.a.href) act=h('a.btn.sm',{href:it.a.href},it.a.label);
    else if(it.a&&it.a.fn) act=h('button.btn.sm.primary',{type:'button',onclick:it.a.fn},it.a.label);
    list.appendChild(h('div.card.cp-pi',{},h('div.cp-pm',{},h('b.display',{text:'-'+it.m.toFixed(1)}),h('span.muted',{text:'نقطة'})),h('div.cp-px',{},h('b',{text:it.t}),h('p.muted',{text:it.x})),act));
  });
  return h('section',{},IM.section('طريقك للـ100','ناقصك '+left.toFixed(1)+' نقطة. دي أكتر ثلاث حاجات هتقرّبك، ومعاها إزاي تكمّلها.'),list,
    h('p.muted.cp-pn',{text:'المؤشر 100 معناه إن كل مكوّن كامل. آخر مرحلة (الطبيب الأول) بتتفتح من مؤشر 98 وامتحانها 97% على 100 سؤال.'}));
}

/* ---------- الصفحة ---------- */
IM.screens.cartouche=function(view){
  IM.cartoCheck();
  var C=IM.st.carto, L=IM.level(), t=C.tier, ns=nextStage();
  var wrap=h('div.cp'); view.appendChild(wrap);
  wrap.appendChild(h('div.pg-h',{},h('div',{},IM.eyebrow('المقام'),h('h1.display',{text:'خرطوشتي'})),h('p.muted',{text:'اسمك مكتوب جوه خرطوشة بتكبر وتتزخرف مع كل مرحلة توصلها. المرحلة اللي وصلتلها بتفضل ليك مهما حصل.'})));

  /* hero: the cartouche + the numbers */
  var shown=t||1;
  var cv=IM.cartoView(shown,{name:nm(),sub:t?IM.stageName(IM.STAGES[t-1]):'',locked:!t,label:t?('خرطوشتك: '+IM.stageName(IM.STAGES[t-1])):'خرطوشة لسه مقفولة'});
  var code=(IM.boardSerial&&IM.boardSerial())||C.code, acts=h('div.cp-acts',{});
  if(t){
    acts.appendChild(h('button.btn.primary',{type:'button',onclick:function(){ var b=this; b.disabled=true; IM.cartoPNG().then(function(bl){ return IM.cartoSave(bl,false); }).then(function(){ IM.toast('اتحفظت صورة الخرطوشة.',{icon:'check'}); },function(){ IM.toast('تعذّر تجهيز الصورة.',{kind:'bad'}); }).then(function(){ b.disabled=false; }); }},icon('download',18),'حمّل الصورة'));
    if(navigator.share&&navigator.canShare) acts.appendChild(h('button.btn',{type:'button',onclick:function(){ var b=this; b.disabled=true; IM.cartoPNG().then(function(bl){ return IM.cartoSave(bl,true); }).catch(function(){ IM.toast('تعذّرت المشاركة.',{kind:'bad'}); }).then(function(){ b.disabled=false; }); }},icon('link',18),'شارك'));
  }
  var codeRow=h('div.cp-code',{},h('span.muted',{text:(IM.boardSerial&&IM.boardSerial())?'الرقم التسلسلي':'الكود'}),h('b.mono',{dir:'ltr',text:code||'—'}),code?h('button.iconbtn.sm',{type:'button','aria-label':'انسخ الكود',onclick:function(){ IM.copy(code).then(function(){ IM.toast('اتنسخ الكود.',{icon:'check'}); },function(){ IM.toast('تعذّر النسخ.',{kind:'bad'}); }); }},icon('link',16)):h('span.muted.cp-ch',{text:'بيتولّد مع أول خرطوشة'}));
  var hero=h('section.card.cp-hero',{},
    h('div.cp-art',{},cv),
    h('div.cp-info',{},
      h('div.cp-st',{},t?h('span.cp-tier.display',{text:IM.stageName(IM.STAGES[t-1])}):h('span.cp-tier.display.muted',{text:'لسه من غير خرطوشة'}),t?h('span.muted',{text:IM.stageAr(IM.STAGES[t-1])+' · '+dateOf(C.at[t])}):h('span.muted',{text:ns?'أول خرطوشة (الكاتب) عند مؤشر '+ns.min:''})),
      h('div.cp-num',{},h('div.cp-n1',{},h('span.display.cp-big',{text:String(L.idx)}),h('span.muted',{text:'/ 100'})),h('div.muted.cp-nl',{text:'مؤشر إمحتب'})),
      h('div.cp-xp',{},icon('star',16),h('b.mono',{text:nf(L.xp)}),h('span.muted',{text:'XP (عدّاد تشجيعي، مش هو اللي بيحدد المرحلة)'})),
      codeRow,acts));
  wrap.appendChild(hero);
  if(IM.boardCard) wrap.appendChild(IM.boardCard());

  /* the ladder bar */
  var bar=h('div.cp-bar',{role:'img','aria-label':'مؤشرك '+L.idx+' من 100'},h('i',{style:'width:'+Math.max(2,L.idx)+'%'}));
  IM.STAGES.forEach(function(s){ bar.appendChild(h('span.cp-tk'+(t>=s.n?'.on':''),{style:'left:'+s.min+'%',title:IM.stageName(s)+' عند '+s.min},h('b.mono',{text:String(s.min)}))); });
  wrap.appendChild(h('section.card.cp-lad',{},h('div.cp-lh',{},h('h2.display',{text:'مؤشر إمحتب'}),h('span.muted',{text:'بيتحسب من خمس حاجات. بيطلع وينزل مع مذاكرتك، لكن خرطوشتك مابتنزلش.'})),bar));
  wrap.appendChild(pathSection(L));
  if(IM.weeklyCard) wrap.appendChild(IM.weeklyCard());

  /* breakdown */
  var P=L.parts, PT=L.pts, W=IM.LEVEL_WEIGHTS, tr=L.trend;
  var rows=[
    ['mastery','التثبيت','ثبّتّ '+nf(L.secured)+' من '+nf(L.groups)+' سؤال ('+Math.round(P.mastery*100)+'%)'+(L.pending?'، و'+L.pending+' سؤال محتاجين إجابة صح في يوم تاني عشان يتثبّتوا':'')+'. الإجابة الصح بعد 50/50 بنص قيمة.'],
    ['accuracy','الدقة',(L.answered?Math.round(L.accEff*100):0)+'% بعد محو الأغلاط اللي راجعتها (أول مرة '+(L.answered?Math.round(L.acc*100):0)+'% على '+nf(L.answered)+' سؤال). غلطة أول مرة وزنها 1، وبعد مراجعة صح بتبقى نص، وبعد المراجعة التانية في التقييم الأسبوعي بتتمحي. كاملة عند 90%.'+(L.errOpen?' لسه '+nf(L.errOpen)+' غلطة مش ممحية.':'')],
    ['consistency','الانتظام',L.lit30+' يوم شروق من آخر 30 يوم. الكاملة عند 26 يوم.'],
    ['improvement','التحسّن','صلّحت '+nf(L.fixed)+' غلطة وفاضل '+nf(L.wrongNow)+' في كفّة الأغلاط'+(tr.nR>=20?'، ودقتك آخر أسبوعين '+Math.round(tr.recent*100)+'%':'')+'.'],
    ['achievements','الإنجازات',L.seals+' من '+L.sealsOf+' أختام و'+L.passed+' من 5 امتحانات ترقية.']];
  var bd=h('div.cp-bd',{});
  rows.forEach(function(r){ var k=r[0], p=Math.round(P[k]*100); bd.appendChild(h('div.cp-b',{},h('div.cp-bt',{},h('b',{text:r[1]}),h('span.muted.mono',{dir:'ltr',text:PT[k].toFixed(1)+' / '+W[k]})),h('div.bar',{},h('i',{style:'width:'+p+'%'})),h('p.muted.cp-bp',{text:r[2]}))); });
  wrap.appendChild(h('section',{},IM.section('إزاي اتحسب مؤشرك','خمس حاجات بأوزان ثابتة، كلها من تقدّمك على الجهاز.'),bd));

  /* the ladder: six stages */
  var grid=h('div.cp-lg',{});
  IM.STAGES.forEach(function(s){
    var earned=t>=s.n, isNext=ns&&ns.n===s.n, rq=IM.stageReqs(s,L);
    var card=h('article.card.cp-sg'+(earned?'.earned':'')+(isNext?'.next':''),{},
      IM.cartoView(s.n,{name:earned?nm():'',small:true,locked:!earned,cls:'mini',label:IM.stageName(s)}),
      h('div.cp-sh',{},h('h3.display',{text:IM.stageName(s)}),h('span.muted',{text:IM.stageAr(s)+' · '+s.mat})),
      earned?h('div.cp-ok',{},icon('check',16),h('span',{text:'اتفتحت '+dateOf(C.at[s.n])})):h('ul.cp-rl',{},rq.map(reqRow)));
    if(isNext&&s.trial){
      var open=IM.trialOpen(s,L), tr2=C.trials[s.n];
      card.appendChild(h('div.cp-tr',{},
        h('p.muted',{text:'امتحان الترقية: '+s.tq+' سؤال من كل المواد بالساعة المائية ('+Math.ceil(s.tq*0.75)+' دقيقة) ولازم '+s.trial+'%.'+(tr2&&tr2.tries?' أحسن نتيجة عندك '+tr2.best+'% في '+tr2.tries+(tr2.tries===1?' محاولة':' محاولات')+'.':'')}),
        h('button.btn.primary'+(open?'':'.dis'),{type:'button',disabled:!open,onclick:function(){ IM.startTrial(s.n); }},icon('water',18),'ابدأ امتحان الترقية'),
        open?null:h('p.muted.cp-th',{text:'بيتفتح لما المؤشر والأسئلة المفتوحة وأيام الشروق يوصلوا للمطلوب.'})));
    }
    if(!earned&&!isNext&&s.n===6) card.appendChild(h('p.muted.cp-th',{text:'المرحلة الأخيرة: نفس اسم إمحتب بزخارف استثنائية. بتتفتح من مؤشر 98 وامتحانها 97% على 100 سؤال.'}));
    grid.appendChild(card);
  });
  wrap.appendChild(h('section',{},IM.section('سلّم الخراطيش','ست مراحل. كل مرحلة ليها شروط بتتحقق مع بعض.'),grid));

  /* achievements */
  var st=IM.streak(), rec=[
    ['أسئلة مثبّتة',nf(L.secured)],['أسئلة اتفتحت',nf(L.opened)+' من '+nf(L.groups)],['أيام شروق',String(L.litAll)],['أطول سلسلة',st.best+(st.best===1?' يوم':' أيام')],['أختام',L.seals+' من '+L.sealsOf],['امتحانات ترقية',L.passed+' من 5']];
  var ach=h('div.cp-ac',{}); rec.forEach(function(r){ ach.appendChild(h('div.cp-a',{},h('b.display',{text:r[1]}),h('span.muted',{text:r[0]}))); });
  wrap.appendChild(h('section',{},IM.section('إنجازاتك','كل اللي حققته بيتجمّع هنا ومابيتمسحش.'),ach));

  /* per subject */
  if(L.per&&L.per.length){
    var ps=h('div.cp-ps',{});
    L.per.forEach(function(p){ var pc=p.total?Math.round(p.secured/p.total*100):0, oc=p.total?Math.round(p.opened/p.total*100):0;
      ps.appendChild(h('div.cp-p.'+IM.subClass(p.sid),{},h('div.cp-pt',{},h('span.chip.sub',{},h('span.dot'),IM.subName(p.sid)),h('b.mono',{text:pc+'%'})),h('div.bar',{},h('i.o',{style:'width:'+oc+'%'}),h('i',{style:'width:'+pc+'%;background:var(--p)'})),h('p.muted.cp-bp',{text:'مثبّت '+nf(p.secured)+' · مفتوح '+nf(p.opened)+' من '+nf(p.total)}))); });
    wrap.appendChild(h('section',{},IM.section('حسب المادة','المرحلة واحدة لكل المواد، وده تقدّمك في كل مادة.'),ps));
  }

  wrap.appendChild(h('div.card.cp-note',{},icon('info',20),h('p.muted',{text:'الخرطوشة والمؤشر والـXP تحفيز ليك بس. مش شهادة رسمية ومش بتتشرى، وكلها بتتحسب على جهازك من تقدّمك المسجّل. الكود ده محلي وبيتولّد من اسمك وتاريخ أول خرطوشة، مش رقم تسلسلي رسمي.'})));
  return {destroy:function(){}};
};

/* ---------- شارة صغيرة في الرئيسية ---------- */
IM.cartoChip=function(){
  var t=tierOf(), L=IM.level(), ns=nextStage(), S=t?IM.STAGES[t-1]:null;
  var txt=S?h('span',{},h('b',{text:IM.stageName(S)}),h('span.muted',{text:' · مؤشرك '+L.idx})):h('span',{},h('b',{text:'مؤشر إمحتب '+L.idx+' / 100'}),h('span.muted',{text:ns?' · الكاتب عند '+ns.min:''}));
  return h('a.ct-chip'+(t?'.t'+t:''),{href:'#/cartouche',title:'خرطوشتي'},icon('award',16),txt);
};
/* حلقة ملوّنة على الأفاتار حسب المرحلة */
IM.cartoDecorate=function(btn){
  function paint(){ var t=tierOf(); for(var i=1;i<=6;i++) btn.classList.remove('tier-'+i); if(t){ btn.classList.add('tier-'+t); btn.title='الإعدادات وحسابك · خرطوشة '+IM.stageName(IM.STAGES[t-1]); } }
  paint(); IM.on('carto',paint);
};
/* كارت صغير جوه الإعدادات */
IM.cartoMini=function(onGo){
  var t=tierOf(), L=IM.level(), S=t?IM.STAGES[t-1]:null;
  return h('a.cp-mini',{href:'#/cartouche',onclick:function(){ if(onGo) onGo(); }},
    IM.cartoView(t||1,{name:nm(),small:true,locked:!t,cls:'mini'}),
    h('div',{},h('b',{text:S?IM.stageName(S):'لسه من غير خرطوشة'}),h('span.muted',{text:' مؤشر إمحتب '+L.idx+' / 100'}),h('span.cp-go',{},'شوف خرطوشتك',icon('next',14))));
};

/* ---------- احتفال بخرطوشة جديدة ---------- */
IM.celebrate=function(n){
  var S=IM.STAGES[n-1]; if(!S) return;
  var cv=IM.cartoView(n,{name:nm(),sub:IM.stageName(S),cls:'big',label:'خرطوشة '+IM.stageName(S)});
  var body=h('div.cel',{},cv,h('p.cel-t.display',{text:'وصلت لمرحلة «'+IM.stageAr(S)+'»'}),h('p.muted',{text:n===1?'دي أول خرطوشة ليك. هتكبر وتتزخرف مع كل مرحلة.':'خرطوشتك اتطوّرت. وهتفضل ليك مهما حصل.'}));
  var d=IM.modal({title:'خرطوشة جديدة',body:body,cls:'dlg-cel',focus:'.btn.primary',foot:[
    h('a.btn.primary',{href:'#/cartouche',onclick:function(){ d.close(); }},icon('award',18),'شوف خرطوشتي'),
    h('button.btn.ghost',{type:'button',onclick:function(){ d.close(); }},'تمام')]});
};

/* ---------- بانر نتيجة امتحان الترقية (صفحة النتيجة) ---------- */
IM.trialBanner=function(r){
  var S=IM.STAGES[r.stage-1]; if(!S) return null;
  return h('section.card.cp-tb'+(r.pass?'.ok':'.bad'),{},icon(r.pass?'award':'flag',26),
    h('div',{},h('h3.display',{text:r.pass?('اجتزت امتحان الترقية: '+IM.stageName(S)):('امتحان الترقية: '+IM.stageName(S))}),
      h('p.muted',{text:'جبت '+r.pct+'% والمطلوب '+r.need+'%.'+(r.pass?(IM.st.carto.tier>=r.stage?' خرطوشتك اتفتحت.':' الخرطوشة بتتفتح لما باقي الشروط تفضل متحققة.'):' راجع الأغلاط وجرّب تاني في أي وقت.')})),
    h('a.btn.sm.ghost',{href:'#/cartouche'},'خرطوشتي'));
};
})();
