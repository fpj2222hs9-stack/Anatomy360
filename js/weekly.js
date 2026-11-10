/* Imhotep · إمحتب — التقييم الأسبوعي.
   امتحان بالساعة المائية أغلبه من أخطائك القديمة (محفوظة في إجاباتك حتى لو كفّة الأغلاط مسحتها)، والباقي أسئلة عادية.
   لو جبت 85% أو أكتر: كل غلطة أول مرة جاوبتها صح تاني بتتمحي بالتدريج (1 ← 0.5 ← 0) فتزيد دقتك ومؤشرك.
   إجباري أسبوعيًا بمعنى إن المحو الكامل مابيحصلش إلا هنا. مفيش خصم لو فوّت أسبوع أو جبت أقل من 85%. */
(function(){
'use strict';
var IM=window.IM, h=IM.h, icon=IM.icon, DAY=864e5, HOUR=36e5;
var CFG=IM.WEEKLY={n:60,minutes:50,errShare:0.6,pass:85,gapH:48,perWeek:3,dueDays:7,minAnswered:100,retestDays:3};

function log(){ return IM.st.carto.weekly; }
function rnd(){ return Math.random(); }
function parseDay(k){ var p=String(k||'').split('-'); if(p.length!==3) return 0; return new Date(+p[0],+p[1]-1,+p[2]).getTime(); }
function dayOf(ts){ return IM.dayKey(new Date(ts)); }

/* ---------- حالة التقييم: مستحق؟ ينفع يبدأ دلوقتي؟ ---------- */
IM.weeklyInfo=function(){
  var now=Date.now(), L=log(), last=L.length?L[L.length-1]:null;
  var eligible=!!(IM.bank&&IM.bank.order&&IM.bank.order.length)&&IM.totalAnswered()>=CFG.minAnswered;
  var week=L.filter(function(x){ return x.ts>now-7*DAY; });
  var since=last?now-last.ts:Infinity;
  var gapOk=!last||since>=CFG.gapH*HOUR, capOk=week.length<CFG.perWeek;
  var next=0; if(!gapOk) next=last.ts+CFG.gapH*HOUR; else if(!capOk) next=week[0].ts+7*DAY;
  return {eligible:eligible,last:last,week:week.length,due:eligible&&(!last||since>=CFG.dueDays*DAY),canStart:eligible&&gapOk&&capOk,nextAt:next,
    dueAt:last?last.ts+CFG.dueDays*DAY:0};
};

/* ---------- اختيار الأسئلة ---------- */
var blocks=null;
function blockMap(){
  if(blocks) return blocks; blocks={};
  IM.bank.order.forEach(function(id){ var Q=IM.bank.q[id]; if(Q&&Q.elig&&Q.block&&!IM.isPartial(Q.sid)){ (blocks[Q.block]||(blocks[Q.block]=[])).push(id); } });
  return blocks;
}
IM.on('bank',function(){ blocks=null; });

/* توزيع العدد على المواد بنسبة المتاح (أكبر باقي)، وجوه كل مادة بالترتيب */
function allocate(bySid,total){
  var sids=Object.keys(bySid), cnt=0, take={}, used=0, rem=[];
  sids.forEach(function(s){ cnt+=bySid[s].length; });
  var goal=Math.min(total,cnt); if(!goal) return [];
  sids.forEach(function(s){ var x=goal*bySid[s].length/cnt, f=Math.min(bySid[s].length,Math.floor(x)); take[s]=f; used+=f; rem.push({s:s,r:x-Math.floor(x)}); });
  rem.sort(function(a,b){ return b.r-a.r; });
  var guard=0; while(used<goal&&guard++<2000){ var moved=false; for(var i=0;i<rem.length&&used<goal;i++){ var s=rem[i].s; if(take[s]<bySid[s].length){ take[s]++; used++; moved=true; } } if(!moved) break; }
  var out=[]; sids.forEach(function(s){ out=out.concat(bySid[s].slice(0,take[s])); }); return out;
}
function groupBySid(items){ var m={}; items.forEach(function(x){ (m[x.sid]||(m[x.sid]=[])).push(x); }); Object.keys(m).forEach(function(s){ m[s].sort(function(a,b){ return b.key-a.key; }); }); return m; }

/* خطة التقييم: errs = أخطاء مستحقة المراجعة، fresh = أسئلة عادية */
IM.weeklyPlan=function(){
  var now=Date.now(), today=IM.dayKey(), groups={}, openErr=0;
  IM.bank.order.forEach(function(id){
    var Q=IM.bank.q[id]; if(!Q||!Q.elig||IM.isPartial(Q.sid)) return;
    var g=Q.dupOf||Q.id, a=IM.st.ans[id], G=groups[g]||(groups[g]={err:null,fresh:null,blocked:false});
    var everWrong=!!(a&&a.n>a.c), wrongAtt=everWrong?a.n-a.c:0;
    if(everWrong){
      var r=IM.rOf(a), open=false, due=false, tier=2;
      if(!a.fo){ tier=1; open=r<2; if(open){ openErr++; due=r===0?(a.d0!==today):((now-(a.rt||a.mst||0))>=CFG.retestDays*DAY); } }
      else { due=dayOf(a.ts||now)!==today; }
      if(due){
        var age=a.d0?Math.max(0,(now-parseDay(a.d0))/DAY):0;
        var key=wrongAtt+Math.min(2,age/30)+(tier===1?1:0)+rnd()*0.5;
        if(!G.err||key>G.err.key) G.err={id:id,sid:Q.sid,key:key};
        return;
      }
      if(open||tier===2&&!due){ G.blocked=true; return; }       /* غلطة لسه ماجاش ميعادها: ماتتسحبش ولا تتحسب عادية */
    }
    if(!G.fresh){
      var recent=!!(a&&a.ts&&a.ts>now-3*DAY), w=!a?1.2:(a.lo?(a.fo?0.4:1.0):2.5);
      G.fresh={id:id,sid:Q.sid,recent:recent,key:Math.pow(Math.max(1e-9,rnd()),1/w)};
    }
  });
  var errs=[], fresh=[], freshRecent=[];
  Object.keys(groups).forEach(function(g){ var G=groups[g]; if(G.err) errs.push(G.err); else if(!G.blocked&&G.fresh){ (G.fresh.recent?freshRecent:fresh).push(G.fresh); } });
  var errTarget=Math.round(CFG.n*CFG.errShare);
  var pickE=allocate(groupBySid(errs),errTarget);
  var need=CFG.n-pickE.length;
  var pickF=allocate(groupBySid(fresh),need);
  if(pickF.length<need) pickF=pickF.concat(allocate(groupBySid(freshRecent),need-pickF.length));
  var ids=[], seen={};
  function add(id){ if(!seen[id]){ seen[id]=1; ids.push(id); } }
  pickE.forEach(function(x){ add(x.id); }); pickF.forEach(function(x){ add(x.id); });
  var bm=blockMap();                                                    /* سؤال الحالة يفضل معاه باقي أسئلته */
  ids.slice().forEach(function(id){ var b=IM.bank.q[id].block; if(b&&bm[b]) bm[b].forEach(add); });
  return {ids:ids,errN:pickE.length,errDue:errs.length,openErr:openErr};
};

/* ---------- البدء ---------- */
function nextText(t){ var m=Math.max(1,Math.ceil((t-Date.now())/HOUR)); return m>=48?('بعد '+Math.ceil(m/24)+' أيام'):('بعد '+m+' ساعة'); }
IM.startWeekly=function(){
  var inf=IM.weeklyInfo();
  if(!inf.eligible){ IM.toast('جاوب '+CFG.minAnswered+' سؤال على الأقل الأول.',{kind:'bad'}); return; }
  if(!inf.canStart){ IM.toast('التقييم الجاي '+nextText(inf.nextAt)+'.',{kind:'bad'}); return; }
  var plan=IM.weeklyPlan(); if(plan.ids.length<20){ IM.toast('مفيش أسئلة كفاية دلوقتي.',{kind:'bad'}); return; }
  var minutes=Math.max(10,Math.round(plan.ids.length*CFG.minutes/CFG.n));
  var c={mode:'water',sid:'all',secs:null,groups:null,dup:false,spectate:false,count:0,minutes:minutes,ids:plan.ids,weekly:{n:plan.ids.length,errN:plan.errN}};
  var sess=IM.newSession(c); if(!sess.items.length){ IM.toast('مفيش أسئلة كفاية دلوقتي.',{kind:'bad'}); return; }
  IM.saveSession(sess); IM.go('#/run/'+sess.id);
};

/* ---------- التسليم: لقطة قبل تسجيل الإجابات، وبعدها المحو ---------- */
IM.weeklySnap=function(ids){
  var m={}; ids.forEach(function(id){ var a=IM.st.ans[id]; if(a) m[id]={fo:a.fo?1:0,r:IM.rOf(a),rt:a.rt||a.mst||0}; });
  var L=IM.level(); return {m:m,idx:L.idx,raw:L.raw,open:L.errOpen};
};
IM.weeklyDone=function(w,rows,snap){
  var n=rows.length; if(!n) return null;
  var ok=0; rows.forEach(function(x){ if(x.ok) ok++; });
  var pct=Math.round(ok/n*1000)/10, pass=ok*100>=CFG.pass*n, now=Date.now(), erased=0, back=0, errN=0, m=snap&&snap.m||{};
  rows.forEach(function(x){
    var p=m[x.id], a=IM.st.ans[x.id]; if(!p||!a||p.fo) return;
    if(p.r<2) errN++;
    if(!pass) return;                                                   /* أقل من 85%: مفيش محو ومفيش خصم */
    if(x.ok){ if(p.r===1&&now-p.rt>=CFG.retestDays*DAY){ a.r=2; erased++; } }
    else if(x.ans&&p.r>=1){ a.r=p.r-1; a.rt=now; back++; }
  });
  IM.save('ans'); IM.levelReset();
  var L=IM.level(), rec={ts:now,n:n,ok:ok,pct:pct,pass:pass?1:0,erased:erased,back:back,errN:errN};
  var lg=log(); lg.push(rec); if(lg.length>40) IM.st.carto.weekly=lg.slice(-40);
  IM.save('carto');
  IM.notify({id:'weekly-'+now,icon:pass?'check':'flag',title:pass?'نجحت في التقييم الأسبوعي':'التقييم الأسبوعي',
    text:pass?('جبت '+pct+'%'+(erased?' واتمحت '+erased+' غلطة':'')+'. مؤشرك '+L.idx+'.'):('جبت '+pct+'% والمطلوب '+CFG.pass+'%. مفيش حاجة اتخصمت، والتقييم الجاي بعد '+CFG.gapH+' ساعة.'),
    link:{label:'خرطوشتي',hash:'#/cartouche'}});
  IM.emit('carto'); IM.emit('answer');
  return {pass:pass,pct:pct,need:CFG.pass,n:n,ok:ok,erased:erased,back:back,errN:errN,idx0:snap?snap.idx:L.idx,raw0:snap?snap.raw:L.raw,raw:L.raw,idx:L.idx,open:L.errOpen};
};

/* ---------- تنبيه في الجرس لما يبقى مستحق (مرة لكل دورة) ---------- */
function checkDue(){
  try{
    var inf=IM.weeklyInfo(); if(!inf.due) return;
    IM.notify({id:'wdue-'+(inf.last?inf.last.ts:0),icon:'water',title:'التقييم الأسبوعي مستحق',text:'امتحان '+CFG.n+' سؤال أغلبه من أخطائك القديمة. لو جبت '+CFG.pass+'% فأكتر، غلطاتك بتتمحي ومؤشرك بيطلع.',link:{label:'ابدأ التقييم',hash:'#/cartouche'}});
  }catch(e){}
}
IM.on('bank',function(){ setTimeout(checkDue,1500); });
IM.on('answer',function(){ clearTimeout(checkDue.t); checkDue.t=setTimeout(checkDue,4000); });

/* ---------- واجهة: بانر النتيجة + كارت الصفحة + شارة الرئيسية ---------- */
IM.weeklyBanner=function(r){
  var bad=!r.pass;
  var msg=r.pass
    ?('جبت '+r.pct+'% والمطلوب '+r.need+'%. '+(r.erased?('اتمحت '+r.erased+' غلطة خالص'):'ماكانش في غلطات جاهزة للمحو')+(r.back?'، ورجعت '+r.back+' غلطة خطوة لأنها اتغلطت تاني':'')+'. مؤشرك '+(r.idx>r.idx0?'طلع من '+r.idx0+' لـ '+r.idx:r.idx+(r.raw>r.raw0+0.04?' (زاد '+(r.raw-r.raw0).toFixed(1)+' نقطة)':''))+'.')
    :('جبت '+r.pct+'% والمطلوب '+r.need+'% عشان المحو يتطبّق. مفيش حاجة اتخصمت، راجع أغلاطك وجرّب تاني بعد '+CFG.gapH+' ساعة.');
  return h('section.card.cp-tb'+(bad?'.bad':'.ok'),{},icon(bad?'flag':'award',26),
    h('div',{},h('h3.display',{text:r.pass?'نجحت في التقييم الأسبوعي':'التقييم الأسبوعي'}),h('p.muted',{text:msg}),r.open?h('p.muted',{text:'فاضل '+r.open+' غلطة لسه مش ممحية.'}):null),
    h('a.btn.sm.ghost',{href:'#/cartouche'},'طريقك للـ100'));
};

IM.weeklyCard=function(){
  var inf=IM.weeklyInfo(), L=IM.level(), last=inf.last;
  var state, btn;
  if(!inf.eligible) state='بيتفتح بعد '+CFG.minAnswered+' إجابة. إنت جاوبت '+IM.totalAnswered()+'.';
  else if(inf.due) state='مستحق الأسبوع ده.';
  else if(last) state='آخر تقييم: '+IM.fmtDate(dayOf(last.ts))+' ('+last.pct+'%'+(last.pass?'، نجحت':'، ماجتزتش')+'). الإجباري الجاي بعد '+Math.max(1,Math.ceil((inf.dueAt-Date.now())/DAY))+' أيام.';
  else state='';
  btn=h('button.btn.primary'+(inf.canStart?'':'.dis'),{type:'button',disabled:!inf.canStart,onclick:function(){ IM.startWeekly(); }},icon('water',18),'ابدأ التقييم الأسبوعي');
  var wait=(inf.eligible&&!inf.canStart)?h('p.muted.cp-th',{text:'التقييم الجاي '+nextText(inf.nextAt)+(inf.week>=CFG.perWeek?' (وصلت للحد الأقصى '+CFG.perWeek+' تقييمات في الأسبوع).':'.')}):null;
  return h('section.card.cp-wk'+(inf.due?'.due':''),{},
    h('div.cp-wh',{},icon('water',22),h('div',{},h('h2.display',{text:'التقييم الأسبوعي'}),h('span.muted',{text:state}))),
    h('p.muted',{text:CFG.n+' سؤال في '+CFG.minutes+' دقيقة بالساعة المائية، أغلبه (حوالي '+Math.round(CFG.errShare*100)+'%) من أخطائك القديمة، والباقي أسئلة عادية. لو جبت '+CFG.pass+'% أو أكتر، كل غلطة أول مرة جاوبتها صح بعد مراجعة قبل كده بتتمحي خالص، وكل غلطة راجعتها مرة بتبقى نص قيمة. أقل من '+CFG.pass+'% مفيهوش خصم.'+(L.errOpen?' عندك '+nf(L.errOpen)+' غلطة لسه مش ممحية.':' مفيش عندك غلطات مفتوحة.')}),
    h('div.cp-acts',{},btn),wait);
};
function nf(n){ return Number(n).toLocaleString('en-US'); }

IM.weeklyChip=function(){
  var inf; try{ inf=IM.weeklyInfo(); }catch(e){ return null; }
  if(!inf.due) return null;
  return h('a.ct-chip.wk',{href:'#/cartouche',title:'التقييم الأسبوعي'},icon('water',16),h('span',{},h('b',{text:'التقييم الأسبوعي مستحق'}),h('span.muted',{text:' · بيمحي أغلاطك'})));
};
})();
