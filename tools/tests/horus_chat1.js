/* horus_chat1: الشات العايم بتاع حورس في المتصفح (Supabase وهمي على 8790 فيه نقطة horus وجدول horus_chat).
   بيغطّي: التفعيل (pilot)، الزرار، البوابة، سؤال وإجابة (markdown/مصادر)، الحد اليومي، الأخطاء، المحادثة المحفوظة بين الأجهزة، المسح،
   قفل الامتحان، زرار «اسأل حورس» في شاشة السؤال، والأنيميشن. */
const { chromium } = require('playwright');
const SITE='http://127.0.0.1:8770/index.html', MOCK='http://127.0.0.1:8790';
const OUT='/tmp/claude-0/-home-claude/eef798d1-ec40-5bbf-a062-3c4ea22d7922/scratchpad/out/';
require('fs').mkdirSync(OUT,{recursive:true});
let fails=0; const ok=(c,m)=>{ console.log((c?'PASS ':'FAIL ')+m); if(!c) fails++; };
const errs=[]; const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const mj=async(p)=>(await fetch(MOCK+p)).json();
async function mk(b,o){
  o=o||{}; const ctx=await b.newContext({viewport:{width:o.w||1100,height:o.h||900},colorScheme:o.dark?'dark':'light'});
  /* the shipped js/ai-config.js has chat.pilot:false (Horus open to every signed-in student), so the pilot tests force pilot:true here; {realAi:true} uses the file as shipped */
  if(!o.realAi) await ctx.route('**/js/ai-config.js',r=>r.fulfill({contentType:'application/javascript',body:"window.IM=window.IM||{};window.IM.AI={on:false,base:'ai/',chat:{on:true,pilot:true,path:'/functions/v1/horus'}};"}));
  await ctx.route('**/js/cloud-config.js',r=>r.fulfill({contentType:'application/javascript',body:"window.IM.CLOUD={on:true,pilot:false,required:false,url:'"+MOCK+"',anon:'sb_publishable_testkey',debounceMs:300,minGapMs:0,pollMs:600000};"}));
  await ctx.addInitScript(()=>{ try{ if(!localStorage.getItem('im_seen')) localStorage.setItem('im_seen',JSON.stringify({'tour-v1':1,'ann-honor-1':1,'ann-honor-ready':1})); if(!localStorage.getItem('im_user')) localStorage.setItem('im_user',JSON.stringify({name:'محمد سيف',year:1})); }catch(e){} });
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
  p.on('console',m=>{ if(m.type()==='error'&&!/fonts\.g|Failed to load resource|googletagmanager|net::ERR/.test(m.text())) errs.push('CONSOLE '+m.text()); });
  return {ctx,p};
}
const ready=async p=>{ await p.waitForFunction(()=>window.IM&&IM.bank&&IM.bank.ready,{timeout:60000}); await p.waitForTimeout(600); };
const open=async(p,hash)=>{ await p.goto(SITE+(hash||'')); await ready(p); };
async function waitFor(p,fn,arg,ms){ try{ await p.waitForFunction(fn,arg,{timeout:ms||8000}); return true; }catch(e){ return false; } }
async function signIn(p,email){
  await mj('/__next?email='+encodeURIComponent(email)+'&name=Student');
  await Promise.all([p.waitForNavigation({url:/code=|127\.0\.0\.1:8770/,timeout:20000}).catch(()=>{}),p.evaluate(()=>IM.cloudSignIn())]);
  await ready(p); await p.waitForTimeout(1500);
}
const fabShown=p=>p.evaluate(()=>{ const f=document.querySelector('.hc-fab'); return !!f&&!f.hidden&&getComputedStyle(f).display!=='none'; });
const panelState=p=>p.evaluate(()=>IM.horusChat&&IM.horusChat.state());
const msgs=p=>p.evaluate(()=>[...document.querySelectorAll('.hc-body .hc-m')].map(m=>({u:m.classList.contains('u'),t:m.innerText.trim()})));
const closeP=async p=>{ await p.evaluate(()=>IM.horusChat.close()); await waitFor(p,()=>IM.horusChat.state()==='closed',null,6000); await p.waitForTimeout(150); };
async function openPanel(p,wait){ await p.click('.hc-fab'); await waitFor(p,()=>IM.horusChat.state()==='open',null,9000); await p.waitForTimeout(wait||200); }
async function ask(p,text){ await p.fill('.hc-in',text); await p.click('.hc-send'); await waitFor(p,()=>!document.querySelector('.hc-think')&&!document.querySelector('.hc-in').disabled||!!document.querySelector('.hc-err'),null,9000); await p.waitForTimeout(250); }

(async()=>{
  const b=await chromium.launch();
  await mj('/__reset');

  /* ===== 1) التفعيل: pilot مقفول للطلبة ===== */
  { const {ctx,p}=await mk(b); await open(p);
    ok(!(await p.$('.hc-fab')),'pilot: no FAB for students without ?horus=1');
    ok(await p.evaluate(()=>IM.horusChat.on())===false,'pilot: IM.horusChat.on() is false');
    await open(p,'?horus=1'); await p.waitForTimeout(400);
    ok(await fabShown(p),'?horus=1 switches the pilot on: FAB is shown');
    ok(!/horus=/.test(p.url()),'?horus=1 is cleaned from the URL');
    await open(p); ok(await fabShown(p),'pilot flag is remembered after reload');
    await open(p,'?horus=0'); await p.waitForTimeout(300); ok(!(await fabShown(p)),'?horus=0 switches it off again');
    await ctx.close(); }

  /* ===== 1b) الإعداد المشحون فعلًا (pilot:false): حورس ظاهر لكل الطلبة من غير ?horus=1 ===== */
  { const {ctx,p}=await mk(b,{realAi:true}); await open(p);
    ok(await p.evaluate(()=>IM.AI.chat.pilot)===false,'shipped config: chat.pilot is false');
    ok(await p.evaluate(()=>IM.horusChat.on())===true,'shipped config: IM.horusChat.on() is true without ?horus=1');
    ok(await fabShown(p),'shipped config: FAB is shown for a normal visitor');
    await ctx.close(); }

  /* ===== 2) من غير تسجيل دخول: البوابة ===== */
  const A=await mk(b); await open(A.p,'?horus=1'); const p=A.p;
  ok(await fabShown(p),'FAB shown on the home page');
  await p.screenshot({path:OUT+'hc-fab.png'});
  await openPanel(p,300);
  ok(await p.evaluate(()=>!!document.querySelector('.hc .gate .btn.primary')),'signed out: panel shows the sign-in gate');
  ok(await p.evaluate(()=>document.querySelector('.hc-in').disabled&&document.querySelector('.hc-send').disabled),'signed out: composer is disabled');
  await p.screenshot({path:OUT+'hc-gate.png'});
  ok((await mj('/__horusreqs')).length===0,'signed out: no request to horus was sent');
  await p.keyboard.press('Escape'); await waitFor(p,()=>IM.horusChat.state()==='closed',null,5000);
  ok((await panelState(p))==='closed'&&await fabShown(p),'Escape closes the panel and brings the FAB back');

  /* ===== 3) تسجيل دخول + سؤال وجواب ===== */
  await signIn(p,'a@x.com'); await open(p);
  ok(await fabShown(p),'FAB survives the sign-in redirect');
  await openPanel(p,300);
  ok(await p.evaluate(()=>!!document.querySelector('.hc-empty')&&!document.querySelector('.gate')),'signed in: empty state with suggestions');
  ok((await p.evaluate(()=>document.querySelector('.hc-left').textContent)).includes('3 من 3'),'daily counter from ?me=1: "3 من 3" ('+(await p.evaluate(()=>document.querySelector('.hc-left').textContent))+')');
  await p.screenshot({path:OUT+'hc-empty.png'});
  await ask(p,'اشرحلي glycolysis');
  let ms=await msgs(p);
  ok(ms.length===2&&ms[0].u&&/glycolysis/.test(ms[0].t)&&!ms[1].u,'question + answer rendered ('+ms.length+' messages)');
  ok(await p.evaluate(()=>!!document.querySelector('.hc-m.a .hc-md b')&&document.querySelectorAll('.hc-m.a .hc-md li').length===2),'markdown: bold and 2 list items rendered as DOM nodes');
  ok(await p.evaluate(()=>!!document.querySelector('.hc-m.a bdi.lat')),'Latin terms are wrapped in LTR isolates');
  ok(await p.evaluate(()=>!!document.querySelector('.hc-m.a .chip.ok')&&!!document.querySelector('.hc-m.a details.hc-src li')),'book answer: "من الكتاب" chip and the sources list');
  ok((await p.evaluate(()=>document.querySelector('.hc-left').textContent)).includes('2 من 3'),'counter dropped to 2 of 3');
  const req1=(await mj('/__horusreqs'))[0];
  ok(req1&&req1.mode==='chat'&&req1.text==='اشرحلي glycolysis'&&req1.sid==='all'&&Array.isArray(req1.hist)&&req1.hist.length===0,'request body: chat mode, text, sid=all, empty hist');
  await p.screenshot({path:OUT+'hc-answer.png'});
  /* اختيار مادة + سؤال تاني بيبعت hist */
  await p.click('.hc-chip[data-sid="biochemistry"]');
  await ask(p,'وإيه الـ ATP الناتج؟');
  const req2=(await mj('/__horusreqs'))[1];
  ok(req2&&req2.sid==='biochemistry'&&req2.hist.length===2&&req2.hist[0].r==='u'&&req2.hist[1].r==='a','2nd request: subject scope kept and the last turn is sent as history');
  ok(await p.evaluate(()=>localStorage.getItem('im_hc_sid')==='"biochemistry"'),'chosen subject is remembered');

  /* ===== 4) المحادثة محفوظة: على الجهاز وعلى الحساب وعلى جهاز تاني ===== */
  await p.waitForTimeout(3500);
  let chat=await mj('/__chat'); const row=Object.values(chat)[0];
  ok(row&&row.msgs.length===4,'conversation saved on the account (horus_chat): '+(row&&row.msgs.length)+' messages');
  ok(row&&row.msgs.every(m=>typeof m.i==='string'&&(m.r==='u'||m.r==='a')),'saved messages have the expected shape');
  await open(p); ok(await fabShown(p),'FAB after reload'); await openPanel(p,300);
  ok((await msgs(p)).length===4,'reload: the 4 messages come back from the device');
  const B=await mk(b); await open(B.p,'?horus=1'); await signIn(B.p,'a@x.com'); await open(B.p); await openPanel(B.p,1200);
  ok((await msgs(B.p)).length===4,'second device, same account: history arrives from the account ('+(await msgs(B.p)).length+')');
  const C=await mk(b); await open(C.p,'?horus=1'); await signIn(C.p,'other@x.com'); await open(C.p); await openPanel(C.p,1200);
  ok((await msgs(C.p)).length===0,'a different student never sees this history');
  await C.ctx.close();

  /* ===== 5) مسح المحادثة (بيتمسح على الأجهزة كمان) ===== */
  await p.click('.hc-clr'); await p.waitForTimeout(150); ok(await p.evaluate(()=>document.querySelector('.hc-clr').classList.contains('armed')),'clear needs a 2nd press');
  ok((await msgs(p)).length===4,'1st press does not delete');
  await p.click('.hc-clr'); await p.waitForTimeout(600);
  ok((await msgs(p)).length===0,'2nd press clears the conversation');
  await p.waitForTimeout(1500);
  chat=await mj('/__chat'); const row2=Object.values(chat)[0];
  ok(row2&&row2.msgs.length===1&&row2.msgs[0].i==='~','the account copy holds only the clear marker');
  await B.p.reload(); await ready(B.p); await openPanel(B.p,1500);
  ok((await msgs(B.p)).length===0,'device B: cleared history does not come back (union merge respects the marker)');
  await B.ctx.close();

  /* ===== 6) الأخطاء ===== */
  await mj('/__horus?reset=1&lim=10'); await open(p); await openPanel(p,300);
  for(const [mode,re,label] of [['busy',/ضغط/,'busy'],['ai',/الذكاء الاصطناعي/,'ai'],['slow',/بسرعة/,'slow'],['off',/واقف/,'off']]){
    await mj('/__horus?mode='+mode); await ask(p,'سؤال '+mode);
    const t=await p.evaluate(()=>{ const e=document.querySelector('.hc-err'); return e?e.innerText:''; });
    ok(re.test(t),'error "'+label+'" is explained in Arabic');
    ok(await p.evaluate((x)=>document.querySelector('.hc-in').value===x,'سؤال '+mode),'error "'+label+'": the question text goes back to the input');
    ok((await msgs(p)).filter(m=>m.u).length===0,'error "'+label+'": the failed question is not kept in the history');
  }
  await mj('/__horus?mode=limit'); await ask(p,'تاني'); ok(/خلّصت/.test(await p.evaluate(()=>document.querySelector('.hc-err').innerText)),'limit error shown');
  ok(await p.evaluate(()=>document.querySelector('.hc-in').disabled&&document.querySelector('.hc-left').classList.contains('zero')),'limit: composer disabled and the counter turns red');
  await p.screenshot({path:OUT+'hc-limit.png'});
  await mj('/__horus?reset=1&lim=10'); await open(p); await openPanel(p,400);
  ok(!(await p.evaluate(()=>document.querySelector('.hc-in').disabled)),'next page load: limit is re-read from the server, composer enabled again');
  await mj('/__horus?mode=general'); await ask(p,'سؤال عام');
  ok(await p.evaluate(()=>!!document.querySelector('.hc-m.a:last-child .chip.doubt')&&!document.querySelector('.hc-m.a:last-child details.hc-src')&&/غير موجودة بشكل واضح/.test(document.querySelector('.hc-m.a:last-child').innerText)),'general answer: "معرفة طبية عامة" chip, disclosure sentence, no sources');
  await mj('/__horus?mode=long'); await ask(p,'اشرح القائمة كلها');
  { const r=await p.evaluate(()=>{ const m=document.querySelector('.hc-m.a:last-child'); const t=m.innerText; return {li:[...m.querySelectorAll('li')].filter(x=>/^العنصر \d+ من 80/.test(x.innerText.trim())).length,last:/LAST80/.test(t),first:/LAST1\b/.test(t),len:t.length}; });
    ok(r.li===80&&r.last&&r.first,'long complete answer: all 80 list items rendered, first and last present ('+r.li+' items, '+r.len+' chars)');
    await p.waitForTimeout(3800); const saved=await mj('/__chat'); ok(/LAST80/.test(JSON.stringify(saved)),'long complete answer: saved whole on the account (nothing cut)'); }
  await mj('/__horus?mode=ok');

  /* ===== 7) سؤال من شاشة السؤال (اسأل حورس) ===== */
  await closeP(p);
  await p.evaluate(()=>{ const c={mode:'mix',sid:'anatomy',secs:null,groups:null,dup:true,spectate:false,count:5,minutes:0}; const s=IM.newSession(c); IM.saveSession(s); IM.go('#/run/'+s.id); });
  await p.waitForTimeout(900);
  ok(!(await fabShown(p)),'FAB is hidden on #/run/*');
  const Qid=await p.evaluate(()=>{ const s=IM.lastSession(); return s.items[0].q; });
  /* جاوب السؤال: اضغط أي اختيار */
  await p.click('button.opt'); await p.waitForTimeout(400);
  await p.waitForTimeout(300);
  let askBtn=await p.$('.ai-box .ai-go');
  ok(!!askBtn&&/اسأل حورس/.test(await askBtn.innerText()),'practice question with no baked explanation: "اسأل حورس عن السؤال ده" button');
  if(askBtn){
    const n0=(await mj('/__horusreqs')).length;
    await askBtn.click(); await waitFor(p,()=>IM.horusChat.state()==='open',null,9000); await waitFor(p,()=>!!document.querySelector('.hc-m.a .hc-ca'),null,9000);
    const rq=(await mj('/__horusreqs')); const last=rq[rq.length-1];
    ok(rq.length===n0+1&&last.mode==='q'&&last.q.id===Qid&&last.q.stem&&last.q.opts.length>=2&&Array.isArray(last.q.keys),'question mode request carries id, stem, options and the stored key');
    ok(await p.evaluate(()=>/الإجابة الأرجح/.test(document.querySelector('.hc-m.a:last-child .hc-ca').innerText)),'answer shows the likeliest option');
    await p.screenshot({path:OUT+'hc-q.png'});
    const hasKd=await p.evaluate(()=>!!document.querySelector('.hc-m.a:last-child .hc-kd'));
    const keyIsB=last.q.keys[0]==='b';
    ok(hasKd===!keyIsB,'key-difference note appears only when the stored key differs from the answer (stored key '+last.q.keys.join(',')+')');
    await closeP(p);
    await (await p.$('.ai-box .ai-go')).click(); await waitFor(p,()=>IM.horusChat.state()==='open',null,6000); await p.waitForTimeout(500);
    ok((await mj('/__horusreqs')).length===n0+1,'asking about the same question again does not send a new request');
    await closeP(p);
  }

  /* ===== 8) قفل الامتحان ===== */
  await p.evaluate(()=>{ const c={mode:'water',sid:'anatomy',secs:null,groups:null,dup:true,spectate:false,count:5,minutes:10}; const s=IM.newSession(c); IM.saveSession(s); IM.go('#/run/'+s.id); });
  await p.waitForTimeout(900);
  ok(!(await p.$('.ai-box .ai-go')),'exam run: no "ask Horus" button');
  ok(!(await fabShown(p)),'exam run: FAB hidden');
  await p.evaluate(()=>IM.go('#/')); await p.waitForTimeout(700);
  ok(await fabShown(p)&&await p.evaluate(()=>document.querySelector('.hc-fab').classList.contains('locked')),'exam still open on another page: FAB is shown but locked');
  await p.click('.hc-fab'); await p.waitForTimeout(400);
  ok((await panelState(p))==='closed'&&await p.evaluate(()=>/مقفول/.test(document.querySelector('.toasts').innerText)),'tapping the locked FAB only shows a toast');
  ok(await p.evaluate(()=>IM.horusChat.anyExam()===true),'anyExam() sees the open exam');
  /* بانل مفتوح وامتحان بيبدأ */
  await p.evaluate(()=>{ const all=IM.sessions(); Object.keys(all).forEach(k=>IM.dropSession(k)); }); await p.evaluate(()=>IM.go('#/library')); await p.waitForTimeout(500);
  await openPanel(p,300);
  await p.evaluate(()=>{ const c={mode:'water',sid:'anatomy',secs:null,groups:null,dup:true,spectate:false,count:5,minutes:10}; const s=IM.newSession(c); IM.saveSession(s); IM.go('#/run/'+s.id); });
  await p.waitForTimeout(900);
  ok((await panelState(p))==='closed','panel closes by itself when an exam starts');
  await p.evaluate(()=>IM.go('#/library')); await p.waitForTimeout(500);   /* خروج من اللفافة بيحفظها تاني: نمسحها بعد ما نبعد */
  await p.evaluate(()=>{ const all=IM.sessions(); Object.keys(all).forEach(k=>IM.dropSession(k)); }); await p.evaluate(()=>IM.go('#/train')); await p.waitForTimeout(500);
  ok(await fabShown(p)&&!(await p.evaluate(()=>document.querySelector('.hc-fab').classList.contains('locked'))),'exam gone: FAB is unlocked again');

  /* ===== 9) الأنيميشن ===== */
  await open(p); await p.waitForTimeout(400);                      /* صفحة جديدة: أول فتحة (مدّتها الكاملة) */
  const timeOpen=()=>p.evaluate(()=>new Promise(res=>{ const t=performance.now(); IM.horusChat.open(); const i=setInterval(()=>{ if(IM.horusChat.state()==='open'){ clearInterval(i); res(Math.round(performance.now()-t)); } },20); }));
  await p.evaluate(()=>{ window.__t=performance.now(); });
  const first=p.evaluate(()=>new Promise(res=>{ const t=performance.now(); IM.horusChat.open(); const i=setInterval(()=>{ if(IM.horusChat.state()==='open'){ clearInterval(i); res(Math.round(performance.now()-t)); } },20); }));
  ok(await waitFor(p,()=>!!document.querySelector('.hc-cur.in'),null,2000),'opening: the emblem curtain is playing');
  let n=0; for(const d of [450,500,500,450]){ await p.waitForTimeout(d); await p.screenshot({path:OUT+'hc-anim-'+(++n)+'.png'}); }
  const d1=await first; ok(d1>2300&&d1<4000,'first opening takes about 2.5-3 s ('+d1+' ms)');
  ok(!(await p.$('.hc-cur')),'curtain removed after the opening');
  await p.evaluate(()=>IM.horusChat.close()); await p.waitForTimeout(450);
  ok(await p.evaluate(()=>IM.horusChat.state())==='closing'&&!!(await p.$('.hc-cur.out')),'closing plays the reversed emblem');
  await p.screenshot({path:OUT+'hc-anim-close.png'});
  ok(await waitFor(p,()=>IM.horusChat.state()==='closed',null,4000),'closing ends and the FAB returns');
  const d2=await timeOpen(); ok(d2>1000&&d2<2000,'later openings are the short version ('+d2+' ms)');
  await closeP(p);
  /* skip بالضغط */
  await p.click('.hc-fab'); await p.waitForTimeout(250); await p.click('.hc-cur'); ok(await waitFor(p,()=>IM.horusChat.state()==='open',null,1500),'tapping the curtain skips to the open state');
  await closeP(p);
  /* حركة مقفولة */
  await p.evaluate(()=>document.documentElement.classList.add('calm'));
  await p.click('.hc-fab'); ok(await waitFor(p,()=>IM.horusChat.state()==='open',null,600),'calm mode: opens at once, no curtain');
  await p.click('.hc-x'); ok(await waitFor(p,()=>IM.horusChat.state()==='closed',null,600),'calm mode: closes at once');
  await p.evaluate(()=>document.documentElement.classList.remove('calm'));

  /* ===== 10) موبايل + ليلي ===== */
  { const M=await mk(b,{w:390,h:800}); await open(M.p,'?horus=1'); await signIn(M.p,'a@x.com'); await open(M.p);
    const r=await M.p.evaluate(()=>{ const f=document.querySelector('.hc-fab').getBoundingClientRect(), t=document.querySelector('.tabbar'); const tb=t?t.getBoundingClientRect():null; return {fabBottom:Math.round(f.bottom),tabTop:tb?Math.round(tb.top):null,h:innerHeight}; });
    ok(!r.tabTop||r.fabBottom<=r.tabTop,'mobile: FAB sits above the tab bar ('+JSON.stringify(r)+')');
    await M.p.screenshot({path:OUT+'hc-m-fab.png'});
    await M.p.click('.hc-fab'); await waitFor(M.p,()=>IM.horusChat.state()==='open',null,9000); await M.p.waitForTimeout(300);
    const pr=await M.p.evaluate(()=>{ const r=document.querySelector('.hc').getBoundingClientRect(); return {w:Math.round(r.width),h:Math.round(r.height),iw:innerWidth,ih:innerHeight}; });
    ok(pr.w===pr.iw&&pr.h===pr.ih,'mobile: the panel is full screen ('+JSON.stringify(pr)+')');
    await ask(M.p,'اشرحلي glycolysis'); await M.p.screenshot({path:OUT+'hc-m-answer.png'});
    await M.ctx.close(); }
  { const D=await mk(b,{dark:true}); await open(D.p,'?horus=1'); await signIn(D.p,'a@x.com'); await open(D.p);
    await D.p.click('.hc-fab'); await waitFor(D.p,()=>IM.horusChat.state()==='open',null,9000); await ask(D.p,'اشرحلي glycolysis'); await D.p.screenshot({path:OUT+'hc-dark.png'});
    await D.p.click('.hc-x'); await waitFor(D.p,()=>IM.horusChat.state()==='closed',null,4000);
    await D.p.click('.hc-fab'); await D.p.waitForTimeout(1000); await D.p.screenshot({path:OUT+'hc-dark-anim.png'}); await D.ctx.close(); }

  /* ===== 11) الخروج بيمسح اللي على الجهاز ===== */
  await open(p); const had=await p.evaluate(()=>Object.keys(localStorage).filter(k=>k.indexOf('im_hc_')===0&&k!=='im_hc_sid'&&k!=='im_hc_seen').length);
  await p.evaluate(()=>IM.cloudSignOut()); await p.waitForTimeout(500);
  const left=await p.evaluate(()=>Object.keys(localStorage).filter(k=>k.indexOf('im_hc_')===0&&k!=='im_hc_sid'&&k!=='im_hc_seen').length);
  ok(had===1&&left===0,'signing out removes the local chat copy ('+had+' -> '+left+')');
  await p.click('.hc-fab'); await waitFor(p,()=>IM.horusChat.state()==='open',null,9000); ok(await p.evaluate(()=>!!document.querySelector('.hc .gate')),'after sign-out the panel shows the gate again');

  console.log('ERRS',errs.length?'\n'+errs.join('\n'):'none'); if(errs.length) fails++;
  console.log(fails?('FAILED '+fails):'ALL OK'); await b.close(); process.exit(fails?1:0);
})();
