/* Imhotep · إمحتب — state: everything the student does lives on this device only */
(function(){
'use strict';
var IM=window.IM, S=IM.store;

var K={user:'im_user',set:'im_settings',ans:'im_ans',marks:'im_marks',wrong:'im_wrong',days:'im_days',hist:'im_hist',sess:'im_sess',last:'im_last',plan:'im_plan',seen:'im_seen',seals:'im_seals',cards:'im_cards',read:'im_read',notes:'im_notes',carto:'im_carto',mig:'im_migrated'};
IM.K=K;
IM.DAY_GOAL=50;           /* answers needed to light a day's sun */
IM.OLD_DAY_GOAL=5;        /* the goal before the 50-answer update */
IM.GOAL50_FROM='2026-11-05';   /* days before this date keep the old goal, so nobody's streak breaks */
IM.SEALS=[100,500,1000,2500,5000];

/* ---------- persisted maps with debounced saves ---------- */
var dirty={}, timer=null;
function flush(){ clearTimeout(timer); timer=null; Object.keys(dirty).forEach(function(k){ S.set(k,IM.st[dirty[k]]); }); dirty={}; }
function touch(name){ dirty[K[name]]=name; if(!timer) timer=setTimeout(flush,350); }
window.addEventListener('pagehide',flush);
document.addEventListener('visibilitychange',function(){ if(document.hidden) flush(); });
IM.flush=flush;

IM.st={
  user:S.get(K.user,null),
  set:Object.assign({theme:'auto',fs:1,bright:1,layout:'one',motion:'auto',keys:true},S.get(K.set,{})),
  ans:S.get(K.ans,{}), marks:S.get(K.marks,{}), wrong:S.get(K.wrong,{}), days:S.get(K.days,{}),
  hist:S.get(K.hist,[]), plan:S.get(K.plan,null), seen:S.get(K.seen,{}), seals:S.get(K.seals,{}),
  cards:S.get(K.cards,{}), read:S.get(K.read,{}), notes:S.get(K.notes,[]), carto:S.get(K.carto,{})
};
if(!Array.isArray(IM.st.hist)) IM.st.hist=[];
if(!Array.isArray(IM.st.notes)) IM.st.notes=[];
(function(){ var c=IM.st.carto; if(!c||typeof c!=='object'||Array.isArray(c)) c=IM.st.carto={}; c.tier=+c.tier||0; c.at=c.at||{}; c.trials=c.trials||{}; if(!Array.isArray(c.weekly)) c.weekly=[]; })();
IM.save=touch;

/* ---------- user + settings ---------- */
IM.setUser=function(u){ IM.st.user=u; S.set(K.user,u); IM.emit('user'); };
IM.initial=function(n){ var a=Array.from(String(n||'').trim()); return (a[0]||'؟').toUpperCase(); };
IM.setSetting=function(k,v){ IM.st.set[k]=v; S.set(K.set,IM.st.set); IM.applySettings(); IM.emit('settings'); };
IM.applySettings=function(){
  var r=document.documentElement, s=IM.st.set;
  if(s.theme==='light'||s.theme==='dark') r.setAttribute('data-theme',s.theme); else r.removeAttribute('data-theme');
  r.style.setProperty('--fs',String(IM.clamp(+s.fs||1,.85,1.35)));
  var b=IM.clamp(+s.bright||1,.7,1.15), veil=document.getElementById('veil');
  if(!veil){ veil=document.createElement('div'); veil.id='veil'; veil.setAttribute('aria-hidden','true'); document.body.appendChild(veil); }
  if(b<1){ veil.style.background='#000'; veil.style.opacity=String((1-b).toFixed(3)); veil.style.mixBlendMode='normal'; }
  else if(b>1){ veil.style.background='#fff'; veil.style.opacity=String(((b-1)*2.2).toFixed(3)); veil.style.mixBlendMode='soft-light'; }
  else { veil.style.opacity='0'; }
  r.classList.toggle('calm',s.motion==='off');
  var dark=(s.theme==='dark')||(s.theme!=='light'&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches);
  var m=document.querySelector('meta[name="theme-color"]'); if(m) m.setAttribute('content',dark?'#0A1322':'#F6EEDA');
};
IM.isDark=function(){ var t=IM.st.set.theme; return t==='dark'||(t!=='light'&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches); };

/* ---------- answers ---------- */
/* وزن غلطة أول مرة في الدقة: 1 قبل أي مراجعة، 0.5 بعد مراجعة صح في يوم تاني، 0 بعد المراجعة التانية (تقييم أسبوعي). الإجابات القديمة اللي اتثبّتت بتتحسب مراجعة واحدة. */
IM.rOf=function(a){ if(!a||a.fo) return 2; if(a.r!=null) return a.r; return a.mst?1:0; };
IM.errW=function(a){ var r=IM.rOf(a); return r>=2?0:(r===1?0.5:1); };
IM.record=function(Q,pick,ms,fl){
  var ok=Q.keys.indexOf(pick)>-1, now=Date.now(), a=IM.st.ans[Q.id], first=!a; fl=fl||{};
  if(first) a=IM.st.ans[Q.id]={n:0,c:0,f:pick,fo:ok?1:0,ms:ms||0,d0:IM.dayKey()};
  a.n++; a.l=pick; a.lo=ok?1:0; a.ts=now; if(ok) a.c++;
  /* for the level index: a question first missed counts as secured once it's answered right on a later day; w = right under exam conditions, h = right after 50/50 */
  if(ok){ a.w=fl.w?1:0; a.h=fl.h?1:0; if(!a.fo&&!a.mst&&a.d0&&IM.dayKey()!==a.d0) a.mst=now;
    /* r = كام مراجعة صح اتحسبت بعد غلطة أول مرة (0 → 1 → 2). المراجعة التانية (المحو الكامل) بتحصل في التقييم الأسبوعي بس */
    if(!a.fo){ if(a.r==null){ a.r=a.mst?1:0; if(a.r) a.rt=a.mst; }
      /* اتنزّلت لصفر في تقييم أسبوعي: أول إجابة صح في يوم تاني بعد التنزيل بترجّعها مراجعة واحدة */
      else if(a.r===0&&a.rt&&IM.dayKey(new Date(a.rt))!==IM.dayKey()){ a.r=1; a.rt=now; } } }
  if(ok) delete IM.st.wrong[Q.id]; else IM.st.wrong[Q.id]=now;
  var dk=IM.dayKey(), d=IM.st.days[dk]||(IM.st.days[dk]={n:0,ok:0,ms:0});
  d.n++; if(ok) d.ok++; d.ms+=ms||0;
  touch('ans'); touch('wrong'); touch('days');
  total=null; IM.emit('answer',Q,ok,first);
  var prev=IM._tot; var tot=IM.totalAnswered(); IM._tot=tot;
  for(var i=0;i<IM.SEALS.length;i++){ var s=IM.SEALS[i]; if(tot>=s&&!IM.st.seals[s]){ IM.st.seals[s]=now; touch('seals'); IM.emit('seal',s); } }
  return ok;
};
var total=null;
IM.totalAnswered=function(){ if(total==null) total=Object.keys(IM.st.ans).length; return total; };
IM.forgetAnswers=function(ids){ ids.forEach(function(id){ delete IM.st.ans[id]; delete IM.st.wrong[id]; }); total=null; touch('ans'); touch('wrong'); IM.emit('answer'); };

/* ---------- marks (البردية) and wrong pan (كفّة الأغلاط) ---------- */
IM.isMarked=function(id){ return !!IM.st.marks[id]; };
IM.toggleMark=function(id){ if(IM.st.marks[id]) delete IM.st.marks[id]; else IM.st.marks[id]=Date.now(); touch('marks'); IM.emit('marks',id); return !!IM.st.marks[id]; };
IM.wrongIds=function(sid){ return Object.keys(IM.st.wrong).filter(function(id){ var Q=IM.bank.q[id]; return Q&&Q.elig&&(!sid||Q.sid===sid); }); };
IM.markedIds=function(sid){ return Object.keys(IM.st.marks).filter(function(id){ var Q=IM.bank.q[id]; return Q&&(!sid||Q.sid===sid); }); };

/* ---------- aggregates (cached until the next answer) ---------- */
var cache={}; IM.on('answer',function(){ cache={}; }); IM.on('bank',function(){ cache={}; });
function agg(ids){
  var an=0,fo=0,ok=0,ms=0,msn=0,wr=0;
  for(var i=0;i<ids.length;i++){ var a=IM.st.ans[ids[i]]; if(!a) continue; an++; if(a.fo) fo++; if(a.lo) ok++; else wr++; if(a.ms){ ms+=a.ms; msn++; } }
  return {total:ids.length,answered:an,first:fo,last:ok,wrong:wr,acc:an?Math.round(fo/an*100):0,avgMs:msn?Math.round(ms/msn):0};
}
function eligIds(ids){ return ids.filter(function(id){ return IM.bank.q[id].elig; }); }
IM.statsFor=function(sid){ var k='s:'+sid; return cache[k]||(cache[k]=agg(eligIds(sid==='all'?IM.bank.order:IM.bank.subs[sid].qids))); };
IM.statsPart=function(sid,pid){ var k='p:'+sid+pid; return cache[k]||(cache[k]=agg(eligIds(IM.bank.subs[sid].parts.filter(function(p){return p.id===pid})[0].secs.reduce(function(a,s){return a.concat(s.qids)},[])))); };
IM.statsSec=function(sid,secId){ var k='c:'+secId; return cache[k]||(cache[k]=agg(eligIds(IM.bank.subs[sid].secs[secId].qids))); };
IM.statsIds=function(ids){ return agg(eligIds(ids)); };
/* pyramid: each tier = a sixth of the subject's questions you've touched */
IM.tiers=function(a){ var t=a.total||0; if(!t) return {on:0,left:0,size:0}; var sz=t/6, on=Math.min(6,Math.floor(a.answered/sz+1e-9)); return {on:on,size:Math.ceil(sz),left:on>=6?0:Math.ceil((on+1)*sz-a.answered-1e-9)}; };

/* ---------- days, streak (الشروق), plan (القمة) ---------- */
IM.dayN=function(k){ var d=IM.st.days[k]; return d?d.n:0; };
IM.goalFor=function(k){ return k<IM.GOAL50_FROM?IM.OLD_DAY_GOAL:IM.DAY_GOAL; };
IM.lit=function(k){ return IM.dayN(k)>=IM.goalFor(k); };
IM.streak=function(){
  var t=IM.dayKey(), k=IM.lit(t)?t:IM.addDays(t,-1), n=0;
  while(IM.lit(k)){ n++; k=IM.addDays(k,-1); }
  var best=0,cur=0,keys=Object.keys(IM.st.days).filter(IM.lit).sort(), prev=null;
  keys.forEach(function(d){ cur=(prev&&IM.daysBetween(prev,d)===1)?cur+1:1; if(cur>best) best=cur; prev=d; });
  return {now:n,best:Math.max(best,n),todayLit:IM.lit(t),todayN:IM.dayN(t)};
};
IM.week=function(){ /* last 7 days ending today, oldest first */
  var t=IM.dayKey(), out=[]; for(var i=6;i>=0;i--){ var k=IM.addDays(t,-i), p=k.split('-'), dow=new Date(+p[0],+p[1]-1,+p[2]).getDay(); out.push({k:k,n:IM.dayN(k),on:IM.lit(k),name:i===0?'اليوم':IM.dayNames[dow]}); }
  return out;
};
IM.setPlan=function(p){ IM.st.plan=p; S.set(K.plan,p); IM.emit('plan'); };
IM.planInfo=function(){
  var p=IM.st.plan; if(!p||!p.date) return null;
  var ids=[], subs=p.sid&&p.sid!=='all'?[p.sid]:Object.keys(IM.bank.subs);
  subs.forEach(function(sid){ var S2=IM.bank.subs[sid]; if(S2) ids=ids.concat(S2.qids); });
  var a=IM.statsIds(ids), daysLeft=IM.daysBetween(IM.dayKey(),p.date), left=Math.max(0,a.total-a.answered);
  return {plan:p,total:a.total,answered:a.answered,left:left,daysLeft:daysLeft,perDay:daysLeft>0?Math.ceil(left/daysLeft):left,pct:IM.pct(a.answered,a.total),past:daysLeft<0,sid:p.sid||'all'};
};

/* ---------- sessions (لفافة) saved per settings key ---------- */
IM.sessions=function(){ return S.get(K.sess,{}); };
IM.saveSession=function(sess){
  var all=IM.sessions(); all[sess.key]=sess;
  var keys=Object.keys(all).sort(function(a,b){ return (all[b].upd||0)-(all[a].upd||0); });
  keys.slice(6).forEach(function(k){ delete all[k]; });
  S.set(K.sess,all); S.set(K.last,sess.key);
};
IM.dropSession=function(key){ var all=IM.sessions(); delete all[key]; S.set(K.sess,all); if(S.get(K.last,'')===key) S.del(K.last); };
IM.lastSession=function(){ var all=IM.sessions(), k=S.get(K.last,''); var s=all[k]; if(s&&s.state==='run') return s; var runs=Object.keys(all).map(function(x){return all[x]}).filter(function(x){return x.state==='run'}).sort(function(a,b){return (b.upd||0)-(a.upd||0)}); return runs[0]||null; };
IM.addHist=function(rec){ IM.st.hist.push(rec); if(IM.st.hist.length>200) IM.st.hist=IM.st.hist.slice(-200); touch('hist'); };

/* ---------- selection: which questions go into a scroll ---------- */
IM.sessKey=function(c){
  return IM.hash([c.mode,c.sid,(c.secs||[]).slice().sort().join(','),(c.groups||[]).slice().sort().join(','),c.dup?1:0,c.count,c.wrongOnly?1:0,c.marksOnly?1:0,c.spectate?1:0,c.ids?c.ids.length+':'+IM.hash(c.ids.join(',')):'',c.mixed?JSON.stringify(c.mixed):'',c.trial?'T'+c.trial.stage:'',c.weekly?'W':''].join('|'));
};
IM.pool=function(c){
  var Sx=IM.bank.subs[c.sid], out=[], secSet=c.secs&&c.secs.length?c.secs.reduce(function(m,s){m[s]=1;return m},{}):null, gSet=c.groups&&c.groups.length?c.groups:null, seen={};
  var src=c.ids||Sx.qids;
  for(var i=0;i<src.length;i++){
    var Q=IM.bank.q[src[i]]; if(!Q) continue;
    if(!c.spectate&&!Q.elig) continue;
    if(secSet&&!secSet[Q.sec]) continue;
    if(gSet&&!Q.groups.some(function(g){return gSet.indexOf(g)>-1})) continue;
    if(c.wrongOnly&&!IM.st.wrong[Q.id]) continue;
    if(c.marksOnly&&!IM.st.marks[Q.id]) continue;
    if(c.dup){ var gk=Q.dupOf||Q.id; if(seen[gk]) continue; seen[gk]=1; }
    out.push(Q.id);
  }
  return out;
};
function weight(Q){
  var a=IM.st.ans[Q.id]; if(!a) return 1.2;
  var w=a.lo?0.45:3.0; if(a.lo&&!a.fo) w=1.7; if(a.ms&&a.ms>45000) w+=0.3; if(a.n===1&&a.fo) w=0.35; return w;
}
function keepBlocks(ids,pool){ /* a stimulus block stays together, in order */
  var inSet={}; ids.forEach(function(i){inSet[i]=1});
  pool.forEach(function(id){ var b=IM.bank.q[id].block; if(!b||inSet[id]) return; if(ids.some(function(x){ return IM.bank.q[x].block===b })){ ids.push(id); inSet[id]=1; } });
  var seenB={}, out=[];
  ids.forEach(function(id){ var b=IM.bank.q[id].block; if(!b){ out.push(id); return; } if(seenB[b]) return; seenB[b]=1; ids.filter(function(x){return IM.bank.q[x].block===b}).sort(function(a,b2){return IM.bank.q[a].seq-IM.bank.q[b2].seq}).forEach(function(x){out.push(x)}); });
  return out;
}
IM.pick=function(c,rnd){
  if(c.mixed&&IM.pickMixed) return IM.pickMixed(c,rnd);
  var pool=IM.pool(c), n=c.count>0?Math.min(c.count,pool.length):pool.length, ids;
  if(c.spectate){ return c.count>0?pool.slice(0,n):pool; }
  if(n>=pool.length&&c.mode!=='mix'&&c.mode!=='water'){ return keepBlocks(pool.slice(),pool); }
  if(c.mode==='train'){
    var un=[],wr=[],ok=[]; pool.forEach(function(id){ var a=IM.st.ans[id]; (!a?un:(a.lo?ok:wr)).push(id); });
    ids=un.concat(wr,ok).slice(0,n).sort(function(a,b){return IM.bank.q[a].seq-IM.bank.q[b].seq});
    return keepBlocks(ids,pool);
  }
  if(c.mode==='mix'){
    var keyed=pool.map(function(id){ var w=weight(IM.bank.q[id]); return {id:id,k:Math.pow(Math.max(1e-9,rnd()),1/w)}; }).sort(function(a,b){return b.k-a.k}).slice(0,n).map(function(x){return x.id});
    return keepBlocks(IM.shuffle(keyed,rnd),pool);
  }
  /* water: exact count spread over the selected tablets by largest remainder, then shuffled */
  var by={}, order=[]; pool.forEach(function(id){ var p=IM.bank.q[id].part; if(!by[p]){by[p]=[];order.push(p);} by[p].push(id); });
  var share=order.map(function(p){ var x=n*by[p].length/pool.length; return {p:p,f:Math.floor(x),r:x-Math.floor(x)}; });
  var left=n-share.reduce(function(a,s){return a+s.f},0);
  share.slice().sort(function(a,b){return b.r-a.r}).slice(0,left).forEach(function(s){ s.f++; });
  ids=[]; share.forEach(function(s){ ids=ids.concat(IM.shuffle(by[s.p],rnd).slice(0,s.f)); });
  return keepBlocks(IM.shuffle(ids,rnd),pool);
};
IM.newSession=function(c){
  var seed=IM.seed(), rnd=IM.rng(seed), ids=IM.pick(c,rnd);
  var items=ids.map(function(id,i){ return {u:String(i),q:id,r:0}; });
  var sess={id:IM.hash(Date.now()+':'+seed),key:IM.sessKey(c),cfg:c,seed:seed,items:items,uid:items.length,idx:0,res:{},cut:{},state:'run',
    t0:Date.now(),upd:Date.now(),spent:0,left:c.mode==='water'?(c.minutes||Math.ceil(items.length*0.75))*60000:0,reps:0};
  return sess;
};

/* ---------- key corrections you should know about (#33, local) ---------- */
IM.corrections=function(){ /* every question whose printed key changed, and whether your saved answer was the old key */
  var out=[]; IM.bank.order.forEach(function(id){ var Q=IM.bank.q[id]; if(!Q.fix||!Q.bk) return; var a=IM.st.ans[id]; out.push({q:Q,ans:a,hit:!!(a&&a.f===Q.bk&&Q.keys.indexOf(Q.bk)<0)}); });
  return out;
};
/* لما مفتاح سؤال يتصحّح بعد ما الطالب جاوبه، إجابته المحفوظة كانت متقيّمة على المفتاح القديم. بنعيد تقييم الصح/الغلط لمرة واحدة (علامة rk)
   عشان الدقة والكفّة والمؤشر يتحسبوا على المفتاح الجديد. الاختيار نفسه (f وl) ما بيتغيّرش، فتنبيه «جاوبتها بالقديم» لسه شغّال. */
IM.rescoreFixes=function(){
  var F=IM.FIXES||{}, ch=false;
  Object.keys(F).forEach(function(id){
    var Q=IM.bank.q[id], a=IM.st.ans[id], f=F[id]; if(!Q||!a||f.off||!Q.fix||a.rk===f.on) return;
    var fo=Q.keys.indexOf(a.f)>-1?1:0, lo=Q.keys.indexOf(a.l||a.f)>-1?1:0;
    a.fo=fo; a.lo=lo; if(a.n<=1) a.c=lo; if(fo) delete a.mst; delete a.r; delete a.rt; a.rk=f.on;
    if(lo) delete IM.st.wrong[id]; else IM.st.wrong[id]=a.ts||Date.now();
    ch=true;
  });
  if(ch){ touch('ans'); touch('wrong'); cache={}; IM.emit('answer'); }
};
IM.on('bank',function(){ IM.rescoreFixes(); });
IM.pendingNotices=function(){ return IM.corrections().filter(function(c){ return c.hit&&!IM.st.seen['fix:'+c.q.id]; }); };
IM.markNoticesSeen=function(){ IM.pendingNotices().forEach(function(c){ IM.st.seen['fix:'+c.q.id]=Date.now(); }); touch('seen'); };

/* ---------- one-time import of the previous site's progress (read-only, old keys stay) ---------- */
IM.migrateOld=function(){
  if(S.get(K.mig,0)) return false;
  var did=false;
  function old(k){ var v=S.raw(k); if(v==null) return null; try{ return JSON.parse(v) }catch(e){ return null } }
  var u=old('mg_user'); if(u&&u.name&&!IM.st.user){ IM.st.user={name:String(u.name).slice(0,24),photo:u.photo||null,created:u.created||Date.now()}; S.set(K.user,IM.st.user); did=true; }
  [['mg_galal'],['mg_tests'],['mg_h_zahra'],['mg_b_hesham']].forEach(function(p){
    var m=old(p[0]); if(!m||typeof m!=='object') return;
    Object.keys(m).forEach(function(id){ var Q=IM.bank.q[id], pick=m[id]; if(!Q||IM.st.ans[id]||typeof pick!=='string') return; var ok=Q.keys.indexOf(pick)>-1; IM.st.ans[id]={n:1,c:ok?1:0,f:pick,fo:ok?1:0,l:pick,lo:ok?1:0,ms:0,ts:0,mig:1}; did=true; });
  });
  [['mg_exam_wrong'],['mg_h_exam_wrong'],['mg_b_exam_wrong']].forEach(function(p){ var m=old(p[0]); if(!m||typeof m!=='object') return; Object.keys(m).forEach(function(id){ if(IM.bank.q[id]&&IM.st.ans[id]&&!IM.st.ans[id].lo&&m[id]) IM.st.wrong[id]=1; }); });
  [['mg_cards','anatomy'],['mg_b_cards','biochemistry']].forEach(function(p){ var m=old(p[0]); if(!m||typeof m!=='object') return; var c=IM.st.cards[p[1]]=IM.st.cards[p[1]]||{}; Object.keys(m).forEach(function(i){ if(m[i]===1||m[i]===0) c[i]=m[i]; did=true; }); });
  [['mg_prog','anatomy'],['mg_b_prog','biochemistry']].forEach(function(p){ var m=old(p[0]); if(!m||typeof m!=='object') return; IM.st.read[p[1]]=IM.st.read[p[1]]||{}; Object.keys(m).forEach(function(ch){ IM.st.read[p[1]][ch]=m[ch]; }); });
  var s=old('mg_settings'); if(s&&s.calm===true&&IM.st.set.motion==='auto'){ IM.st.set.motion='off'; S.set(K.set,IM.st.set); }
  total=null; ['ans','wrong','cards','read'].forEach(touch); flush(); S.set(K.mig,1);
  return did;
};

/* ---------- backup: export / import everything in one JSON ---------- */
IM.exportAll=function(){
  flush(); var o={app:'imhotep',v:1,at:Date.now()};
  Object.keys(K).forEach(function(k){ if(k==='sess'||k==='last'||k==='mig') return; o[k]=IM.st[k]; });
  o.sess=IM.sessions(); return JSON.stringify(o);
};
IM.importAll=function(text){
  var o; try{ o=JSON.parse(text); }catch(e){ return {ok:false,msg:'الملف مش صالح.'}; }
  if(!o||o.app!=='imhotep') return {ok:false,msg:'ده مش ملف تقدّم من إمحتب.'};
  var n=0;
  ['ans','marks','wrong','days','seen','seals','cards','read'].forEach(function(k){ if(o[k]&&typeof o[k]==='object'){ var cur=IM.st[k]; Object.keys(o[k]).forEach(function(id){ if(k==='ans'){ var a=cur[id], b=o[k][id]; if(!a||(b.ts||0)>(a.ts||0)){ cur[id]=b; n++; }
      var w=cur[id], rr=function(x){ return (x&&!x.fo)?IM.rOf(x):0; }; if(a&&b&&w&&!w.fo){ w.r=Math.max(rr(a),rr(b)); if(w.r>=1&&!w.rt) w.rt=a.rt||b.rt||a.mst||b.mst||Date.now(); } } else if(k==='days'){ var d=cur[id], e=o[k][id]; if(!d||e.n>d.n){ cur[id]=e; } } else if(cur[id]==null){ cur[id]=o[k][id]; } }); } });
  if(Array.isArray(o.hist)){ var seen={}; IM.st.hist.forEach(function(h){seen[h.id]=1}); o.hist.forEach(function(h){ if(!seen[h.id]) IM.st.hist.push(h); }); IM.st.hist.sort(function(a,b){return a.ts-b.ts}); IM.st.hist=IM.st.hist.slice(-200); }
  if(Array.isArray(o.notes)){ var nn={}; IM.st.notes.forEach(function(x){nn[x.id]=1}); o.notes.forEach(function(x){ if(x&&x.id&&!nn[x.id]) IM.st.notes.push(x); }); IM.st.notes.sort(function(a,b){return (b.ts||0)-(a.ts||0)}); IM.st.notes=IM.st.notes.slice(0,60); }
  if(o.carto&&typeof o.carto==='object'){ var C=IM.st.carto, oc=o.carto; if((+oc.tier||0)>C.tier) C.tier=+oc.tier;
    Object.keys(oc.at||{}).forEach(function(k){ if(!C.at[k]||oc.at[k]<C.at[k]) C.at[k]=oc.at[k]; });
    Object.keys(oc.trials||{}).forEach(function(k){ var t=oc.trials[k], c0=C.trials[k]; if(!c0) C.trials[k]=t; else{ if((t.best||0)>(c0.best||0)) c0.best=t.best; if(t.pass&&!c0.pass){ c0.pass=1; c0.at=t.at; } c0.tries=Math.max(c0.tries||0,t.tries||0); } });
    if(Array.isArray(oc.weekly)){ var wk={}; C.weekly.forEach(function(x){ wk[x.ts]=1; }); oc.weekly.forEach(function(x){ if(x&&x.ts&&!wk[x.ts]){ C.weekly.push(x); wk[x.ts]=1; } }); C.weekly.sort(function(x,y){ return x.ts-y.ts; }); C.weekly=C.weekly.slice(-40); }
    if(!C.code&&oc.code) C.code=oc.code; }
  if(o.plan&&!IM.st.plan) IM.st.plan=o.plan;
  if(o.user&&!IM.st.user) IM.st.user=o.user;
  total=null; Object.keys(K).forEach(function(k){ if(IM.st[k]!==undefined) S.set(K[k],IM.st[k]); }); IM.emit('answer'); IM.emit('user');
  return {ok:true,msg:'اتضاف تقدّمك ('+n+' إجابة جديدة).'};
};
IM.resetAll=function(){ IM.store.keys('im_').forEach(function(k){ IM.store.del(k); }); };
})();
