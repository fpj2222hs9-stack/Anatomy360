/* Imhotep · إمحتب — مؤشر إمحتب (مستواك من 100)، مراحل الخراطيش، وامتحان الترقية.
   كله بيتحسب على جهازك من تقدّمك المسجّل. مفيش سيرفر. المؤشر ممكن يطلع وينزل، لكن المرحلة اللي وصلتلها بتفضل ليك. */
(function(){
'use strict';
var IM=window.IM;

/* ---------- المراحل: الحد الأدنى للمؤشر + بوابات لازم تتحقق مع بعض ---------- */
var STAGES=[
  {n:1,id:'scribe', en:'SCRIBE', ar:'الكاتب',        tag:'',            min:70, open:50, days:7,  trial:0,   tq:0,   mat:'طين وبردي'},
  {n:2,id:'vizier', en:'VIZIER', ar:'الوزير',        tag:'',            min:80, open:65, days:15, trial:80,  tq:60,  mat:'لازورد'},
  {n:3,id:'vizier2',en:'VIZIER', ar:'الوزير الأعلى', tag:'الأعلى',      min:85, open:75, days:25, trial:85,  tq:60,  mat:'لازورد وذهب'},
  {n:4,id:'pharaoh',en:'PHARAOH',ar:'فرعون',         tag:'',            min:91, open:85, days:35, trial:90,  tq:60,  mat:'ذهب'},
  {n:5,id:'imhotep',en:'IMHOTEP',ar:'إمحتب',         tag:'',            min:96, open:95, days:45, trial:95,  tq:60,  mat:'ذهب وفيروز'},
  {n:6,id:'imhotep1',en:'IMHOTEP',ar:'إمحتب',        tag:'الطبيب الأول',min:98, open:100,days:60, trial:97,  tq:100, mat:'ذهب مشعّ'}
];
IM.STAGES=STAGES;
IM.stageName=function(s){ return s.en+(s.tag?' · '+s.tag:''); };
IM.stageAr=function(s){ return s.ar+(s.tag&&s.n===6?' ('+s.tag+')':''); };

/* أوزان المؤشر (المجموع 100) */
var W={mastery:50,accuracy:20,consistency:15,improvement:10,achievements:5};
IM.LEVEL_WEIGHTS=W;

function clamp(x,a,b){ return Math.max(a,Math.min(b,x)); }

/* ---------- تثبيت السؤال ---------- */
/* السؤال «مثبّت» لو إجابته الأخيرة صح، و(جاوبته صح من أول مرة، أو غلط وبعدين صح في يوم تاني). بيانات الموقع القديم بتتحسب مثبّتة. */
function secured(a){ if(!a||!a.lo) return false; if(a.fo||a.mst) return true; return !a.d0; }
/* اتثبّت قبل كده ولو بعدها غلطت (للـXP بس، عشان ماينزلش) */
function everSecured(a){ return !!(a&&(a.fo||a.mst||(!a.d0&&a.c>0))); }
function credit(a){ return secured(a)?(a.h?0.5:1):0; }       /* الإجابة الصح بعد 50/50 بنص قيمة */

/* ---------- مجموعات الأسئلة (المكرر بيتحسب مرة واحدة) ---------- */
var G=null, memo=null, memoDay='';
function groups(){
  if(G) return G;
  var m={}, order=[];
  (IM.bank&&IM.bank.order||[]).forEach(function(id){ var Q=IM.bank.q[id]; if(!Q||!Q.elig||IM.isPartial(Q.sid)) return; var k=Q.dupOf||Q.id; if(!m[k]){ m[k]=[]; order.push(k); } m[k].push(id); });
  G=order.map(function(k){ return m[k]; });
  return G;
}
function drop(){ memo=null; }
IM.levelReset=drop;
IM.on('bank',function(){ G=null; memo=null; });
IM.on('answer',drop); IM.on('seal',drop); IM.on('carto',drop);

function litDays(){ var n=0; Object.keys(IM.st.days).forEach(function(k){ if(IM.lit(k)) n++; }); return n; }

/* ---------- المؤشر ---------- */
IM.level=function(){
  var today=IM.dayKey();
  if(memo&&memoDay===today) return memo;
  var gs=groups(), Gn=gs.length, ans=IM.st.ans, C=IM.st.carto;
  var openN=0, cred=0, securedG=0, pend=0, answered=0, fo=0, fixed=0, xpq=0, per={}, pen=0, errOpen=0;
  gs.forEach(function(g){
    var o=false, c=0, sec=false, ev=0, sid=IM.bank.q[g[0]].sid;
    g.forEach(function(id){
      var a=ans[id]; if(!a) return;
      o=true; answered++; if(a.fo) fo++; else{ var ew=IM.errW(a); pen+=ew; if(ew) errOpen++; }
      var cr=credit(a); if(cr>c) c=cr; if(secured(a)){ sec=true; if(!a.fo) fixed++; }
      else if(a.lo&&!a.fo) pend++;
      if(everSecured(a)){ var x=10; if(!a.fo) x*=1.5; if(a.w) x*=1.25; if(a.h) x*=0.5; if(x>ev) ev=x; }
    });
    var p=per[sid]||(per[sid]={sid:sid,total:0,opened:0,secured:0}); p.total++; if(o){ openN++; p.opened++; } if(sec){ securedG++; p.secured++; }
    cred+=c; xpq+=ev;
  });
  var wrongNow=IM.wrongIds().filter(function(id){ return !IM.isPartial(IM.bank.q[id].sid); }).length;

  /* 1) التثبيت */
  var M=Gn?cred/Gn:0;
  /* 2) الدقة: غلطة أول مرة بتتمحي بالتدريج بالمراجعة (1 ← 0.5 ← 0)، والنقطة الكاملة عند 90% (مخففة لو العدد قليل) */
  var ramp=Math.min(1,answered/60), acc=answered?fo/answered:0, accEff=answered?(answered-pen)/answered:0;
  var A=answered?clamp((accEff-0.5)/0.40,0,1)*ramp:0;
  /* 3) الانتظام: أيام الشروق في آخر 30 يوم */
  var lit30=0; for(var i=0;i<30;i++){ if(IM.lit(IM.addDays(today,-i))) lit30++; }
  var Cn=Math.min(1,lit30/26);          /* 26 يوم من 30 كفاية (4 أيام راحة) */
  /* 4) التحسّن: تصليح الأغلاط + اتجاه الدقة آخر أسبوعين */
  var Ia=(fixed+wrongNow)?fixed/(fixed+wrongNow):1;
  var nR=0,okR=0,nP=0,okP=0;
  for(var j=0;j<14;j++){ var d1=IM.st.days[IM.addDays(today,-j)], d2=IM.st.days[IM.addDays(today,-14-j)]; if(d1){ nR+=d1.n; okR+=d1.ok; } if(d2){ nP+=d2.n; okP+=d2.ok; } }
  var accR=nR?okR/nR:0, accP=nP?okP/nP:0, trend;
  if(nR<20) trend=0.5; else if(accR>=0.9) trend=1; else if(nP>=20) trend=clamp(0.6+(accR-accP)*2,0,1); else trend=0.6;
  var I=ramp*(0.6*Ia+0.4*trend);
  /* 5) الإنجازات: الأختام اللي ممكن توصلها + امتحانات الترقية */
  var E=IM.statsFor('all').total, reach=IM.SEALS.filter(function(s){ return s<=E; }), sealsN=reach.filter(function(s){ return IM.st.seals[s]; }).length;
  var passed=0; STAGES.forEach(function(s){ if(s.trial&&C.trials[s.n]&&C.trials[s.n].pass) passed++; });
  var Ach=0.5*(reach.length?sealsN/reach.length:0)+0.5*(passed/5);

  var parts={mastery:M,accuracy:A,consistency:Cn,improvement:I,achievements:Ach}, pts={}, raw=0;
  Object.keys(W).forEach(function(k){ pts[k]=parts[k]*W[k]; raw+=pts[k]; });
  var idx=raw>=99.995?100:Math.floor(raw+1e-9);
  var litAll=litDays();
  var xp=Math.round(xpq+20*litAll+100*Object.keys(IM.st.seals).length+300*passed);

  memoDay=today;
  memo={raw:raw,idx:idx,parts:parts,pts:pts,groups:Gn,opened:openN,openPct:Gn?openN/Gn*100:0,secured:securedG,pending:pend,answered:answered,first:fo,acc:acc,accEff:accEff,errOpen:errOpen,pen:pen,
    lit30:lit30,litAll:litAll,fixed:fixed,wrongNow:wrongNow,trend:{recent:accR,prior:accP,nR:nR,nP:nP},seals:sealsN,sealsOf:reach.length,passed:passed,xp:xp,
    per:Object.keys(per).map(function(k){ return per[k]; })};
  return memo;
};

/* ---------- شروط كل مرحلة ---------- */
IM.stageReqs=function(s,L){
  L=L||IM.level(); var tr=IM.st.carto.trials[s.n];
  var r=[{id:'index',have:L.idx,need:s.min,ok:L.idx>=s.min},
         {id:'open',have:Math.floor(L.openPct),need:s.open,ok:L.openPct>=s.open},
         {id:'days',have:L.litAll,need:s.days,ok:L.litAll>=s.days}];
  if(s.trial) r.push({id:'trial',have:tr?Math.floor(tr.best||0):0,need:s.trial,ok:!!(tr&&tr.pass),tries:tr?tr.tries||0:0});
  return r;
};
/* الامتحان بيتفتح لما باقي الشروط تتحقق */
IM.trialOpen=function(s,L){ return IM.stageReqs(s,L).filter(function(x){ return x.id!=='trial'; }).every(function(x){ return x.ok; }); };

/* ---------- كود الخرطوشة (محلي بالكامل، مش رقم رسمي) ---------- */
function fnv(str,seed){ var x=seed>>>0; for(var i=0;i<str.length;i++){ x^=str.charCodeAt(i); x=Math.imul(x,16777619)>>>0; } return x>>>0; }
IM.cartoCode=function(name,ts){
  var s=String(name||'').trim().toLowerCase()+'|'+IM.dayKey(new Date(ts||Date.now()))+'|imhotep';
  var AL='23456789ABCDEFGHJKMNPQRSTUVWXYZ', out='', a=fnv(s,2166136261), b=fnv(s.split('').reverse().join(''),0x9e3779b1), i;
  for(i=0;i<3;i++){ out+=AL[a%AL.length]; a=Math.floor(a/AL.length); }
  for(i=0;i<3;i++){ out+=AL[b%AL.length]; b=Math.floor(b/AL.length); }
  return 'IMH-'+out;
};

/* ---------- الترقية ---------- */
function award(n){
  var C=IM.st.carto, s=STAGES[n-1]; C.tier=n; C.at[n]=Date.now(); C.cele=n;
  if(n===1&&!C.code){ var u=IM.st.user||{}; C.code=IM.cartoCode(u.name,C.at[1]); }
  IM.save('carto');
  IM.notify({id:'tier-'+n,icon:'award',title:'خرطوشة جديدة: '+IM.stageName(s),text:'وصلت لمرحلة «'+IM.stageAr(s)+'». الخرطوشة بتفضل ليك مهما حصل.',link:{label:'شوف خرطوشتك',hash:'#/cartouche'}});
  IM.emit('carto',n);
}
IM.cartoCheck=function(){
  if(!IM.bank||!IM.bank.order||!IM.bank.order.length) return false;
  var C=IM.st.carto, changed=false, guard=0;
  while(C.tier<STAGES.length&&guard++<8){
    var s=STAGES[C.tier];
    if(!IM.stageReqs(s,IM.level()).every(function(x){ return x.ok; })) break;
    award(s.n); changed=true;
  }
  if(changed) maybeCelebrate();
  return changed;
};
var chk=0;
IM.on('answer',function(){ clearTimeout(chk); chk=setTimeout(IM.cartoCheck,60); });

/* نتيجة امتحان الترقية، بتتسجل لما اللفافة تتسلّم */
IM.trialDone=function(t,n,ok){
  var s=STAGES[(t&&t.stage||0)-1]; if(!s||!n) return null;
  var pct=Math.round(ok/n*1000)/10, pass=ok*100>=s.trial*n;
  var tr=IM.st.carto.trials[s.n]||(IM.st.carto.trials[s.n]={best:0,tries:0});
  tr.tries=(tr.tries||0)+1; tr.last=pct; tr.lastAt=Date.now(); if(pct>(tr.best||0)) tr.best=pct;
  if(pass&&!tr.pass){ tr.pass=1; tr.at=Date.now();
    IM.notify({id:'trial-'+s.n,icon:'check',title:'اجتزت امتحان الترقية: '+IM.stageName(s),text:'جبت '+pct+'% والمطلوب '+s.trial+'%.',link:{label:'شوف خرطوشتك',hash:'#/cartouche'}}); }
  IM.save('carto'); IM.emit('carto'); drop();
  IM.cartoCheck();
  return {stage:s.n,pass:pass,pct:pct,need:s.trial,n:n,ok:ok};
};

/* ابدأ امتحان الترقية: ساعة مائية مختلطة من كل المواد، الأسئلة عشوائية بنسبة حجم كل مادة */
IM.startTrial=function(n){
  var s=STAGES[n-1]; if(!s||!s.trial) return;
  if(!IM.trialOpen(s)){ IM.toast('لسه باقي شروط الامتحان ماتحققتش.',{kind:'bad'}); return; }
  var ids=IM.subjects.filter(function(x){ return x.ready&&!x.partial&&IM.bank.subs[x.id]; }).map(function(x){ return x.id; });
  var c={mode:'water',sid:'all',secs:null,groups:null,dup:true,spectate:false,count:0,minutes:Math.ceil(s.tq*0.75),
    mixed:{subs:ids,count:s.tq,how:'size',first:'rand'},trial:{stage:n,pass:s.trial}};
  var sess=IM.newSession(c); if(!sess.items.length){ IM.toast('مفيش أسئلة كفاية.',{kind:'bad'}); return; }
  IM.saveSession(sess); IM.go('#/run/'+sess.id);
};

/* ---------- احتفال بخرطوشة جديدة (بعد الخروج من أي لفافة شغّالة) ---------- */
function maybeCelebrate(){
  var C=IM.st.carto; if(!C.cele||!IM.celebrate) return;
  if(/^#\/run\//.test(location.hash)) return;
  if(document.querySelector('.tour-root')||document.querySelector('.ov')) { setTimeout(maybeCelebrate,1500); return; }
  var n=C.cele; C.cele=0; IM.save('carto'); setTimeout(function(){ IM.celebrate(n); },500);
}
window.addEventListener('hashchange',function(){ setTimeout(maybeCelebrate,800); });
IM.maybeCelebrate=maybeCelebrate;
})();
