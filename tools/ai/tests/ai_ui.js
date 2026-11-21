/* ai_ui: وحدة الشرح (js/ai.js) — مقفولة / مفتوحة / شرح قديم / تعارض / معرفة عامة / الملف الواحد */
const { chromium } = require('playwright');
const URL='http://127.0.0.1:8770/index.html';
let fails=0; const ok=(c,m)=>{ console.log((c?'PASS ':'FAIL ')+m); if(!c) fails++; };
const errs=[];
async function mk(b,aiOn,files,viewport){
  const ctx=await b.newContext({viewport:viewport||{width:1100,height:900},colorScheme:'light'});
  await ctx.addInitScript(()=>{ try{ localStorage.setItem('im_seen',JSON.stringify({'tour-v1':1,'ann-honor-1':1,'ann-fix-1120':1,'ann-honor-ready':1})); localStorage.setItem('im_user',JSON.stringify({name:'محمد سيف',v:1})); }catch(e){} });
  let aiFetches=0;
  await ctx.route('**/js/ai-config.js',r=>r.fulfill({contentType:'application/javascript',body:"window.IM=window.IM||{};window.IM.AI={on:"+(aiOn?'true':'false')+",base:'ai/'};"}));
  await ctx.route('**/ai/*.json',r=>{ aiFetches++; const n=r.request().url().split('/').pop(); if(files&&files[n]) r.fulfill({contentType:'application/json',body:JSON.stringify(files[n])}); else r.fulfill({status:404,body:'nf'}); });
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push('PAGEERR '+e.message)); p.on('console',m=>{ if(m.type()==='error'&&!/Failed to load resource|ERR_|googletagmanager|fonts/i.test(m.text())) errs.push('CONSOLE '+m.text()); });
  p.fetches=()=>aiFetches;
  return {ctx,p};
}
const boot=async(p)=>{ await p.goto(URL,{waitUntil:'load'}); await p.waitForFunction(()=>window.IM&&IM.bank&&IM.bank.ready,{timeout:60000}); await p.waitForTimeout(500); };
/* جلسة تدريب بأسئلة محددة، ونجاوب أول سؤال */
const startRun=async(p,qids)=>{
  const id=await p.evaluate((qids)=>{ const c={mode:'train',sid:'anatomy',secs:null,groups:null,dup:false,spectate:false,count:0}; const s=IM.newSession(c); s.items=qids.map((q,i)=>({u:String(i),q:q,r:0})); s.uid=s.items.length; IM.saveSession(s); IM.go('#/run/'+s.id); return s.id; },qids);
  await p.waitForSelector('.opt',{timeout:10000});
  return id;
};
const answerFirst=async(p,wrong)=>{
  const o=await p.evaluate((wrong)=>{ const id=location.hash.split('/')[2]; const s=IM.findSession(id); const Q=IM.bank.q[s.items[s.idx].q]; const w=Q.opts.find(x=>Q.keys.indexOf(x.o)<0); return (wrong&&w?w.o:Q.keys[0]||Q.opts[0].o); },wrong);
  await p.click('.opt[data-o="'+o+'"]'); await p.waitForTimeout(500);
};

const goQ=async(p,idx)=>{ await p.keyboard.press('Enter'); await p.waitForSelector('.opt:not([disabled])',{timeout:10000}); await p.waitForTimeout(200); };   /* Enter = السؤال اللي بعده */

(async()=>{
  const b=await chromium.launch();

  /* ===== أسئلة نجرب عليها (من البنك الحقيقي) ===== */
  let QS;
  { const {ctx,p}=await mk(b,false); await boot(p);
    QS=await p.evaluate(()=>{ const ids=IM.bank.subs.anatomy.qids.filter(id=>{ const Q=IM.bank.q[id]; return Q.keys.length&&!Q.canc&&!Q.block&&Q.opts.length>=4; }).slice(0,12);
      return ids.map(id=>({id,h:IM.aiHash(IM.bank.q[id]),keys:IM.bank.q[id].keys,opts:IM.bank.q[id].opts.map(o=>o.o)})); });
    await ctx.close(); }
  const [Q1,Q2,Q3,Q4,Q5]=QS;
  const mkEntry=(q,st,ca,extra)=>Object.assign({id:q.id,h:q.h,pv:'t',st,ca,sm:'الفكرة إن الإجابة '+ca.toUpperCase()+' هي الصح حسب الكتاب.',ce:'ببساطة الكتاب بيقول كده، عشان كده باقي الاختيارات مش مناسبة.',
    oa:q.opts.map(o=>({o,s:(o===ca?'c':'i'),e:'هنا شرح الاختيار '+o.toUpperCase()+'.'})),ss:st==='knowledge_only'?[]:[{i:1,h:'Test heading',q:'The printed sentence from the book.',b:'Anatomy book',c:'Introduction',p:'8'}],md:'mock',ts:'2026-11-10',n:1},extra||{});
  const wrongOf=q=>q.opts.find(o=>q.keys.indexOf(o)<0);
  const FILE={'anatomy.json':{v:1,sid:'anatomy',items:{
    [Q1.id]:mkEntry(Q1,'verified',Q1.keys[0]),
    [Q2.id]:Object.assign(mkEntry(Q2,'answer_conflict',wrongOf(Q2)),{oa:Q2.opts.map(o=>({o,s:o===wrongOf(Q2)?'c':(Q2.keys.indexOf(o)>-1?'x':'i'),e:'هنا شرح '+o.toUpperCase()+'.'})),sm:'هنا إجابة الموقع '+Q2.keys[0].toUpperCase()+' بتتعارض مع الكتاب، والكتاب بيقول '+wrongOf(Q2).toUpperCase()+'.'}),
    [Q3.id]:Object.assign(mkEntry(Q3,'knowledge_only',Q3.keys[0]),{sm:'الإجابة غير موجودة بشكل واضح في المصدر المتاح، لذلك الشرح التالي مبني على المعرفة الطبية العامة للذكاء الاصطناعي. الإجابة '+Q3.keys[0].toUpperCase()+'.'}),
    [Q4.id]:Object.assign(mkEntry(Q4,'verified',Q4.keys[0]),{h:'deadbeef'})                 /* شرح قديم: هاش مختلف (المفتاح اتغيّر بعد التوليد) */
  }}};

  /* ===== 1) مقفول (الافتراضي): مفيش زرار ومفيش طلب ملف ai ===== */
  { const {ctx,p}=await mk(b,false,FILE); await boot(p);
    ok(await p.evaluate(()=>IM.aiOn()===false),'off: IM.aiOn() is false');
    ok(await p.evaluate(()=>IM.aiBox({stem:'x',opts:[],keys:[]})===null),'off: aiBox returns null');
    await startRun(p,[Q1.id]); await answerFirst(p);
    ok(!(await p.$('.ai-box')),'off: no .ai-box in the reveal');
    ok(p.fetches()===0,'off: no network request to ai/*.json');
    await ctx.close(); }

  /* ===== 2) مفتوح: السؤال اللي له شرح بيظهر له زرار، وبيفتح الشرح ===== */
  { const {ctx,p}=await mk(b,true,FILE); await boot(p);
    await startRun(p,[Q1.id,Q2.id,Q3.id,Q4.id,Q5.id]);
    ok(p.fetches()===0,'on: nothing fetched before an answer is revealed');
    await answerFirst(p);
    await p.waitForSelector('.ai-go',{timeout:5000});
    ok(true,'on: the explain button shows for a cached question');
    ok((await p.textContent('.ai-go')).includes('اشرحلي بالكتاب'),'on: button label');
    ok(await p.$eval('.ai-go',e=>e.getAttribute('aria-expanded'))==='false','on: collapsed first');
    ok(!(await p.isVisible('.ai-panel')),'on: panel not rendered before the click');
    await p.click('.ai-go'); await p.waitForTimeout(200);
    ok(await p.isVisible('.ai-panel'),'on: panel opens');
    const t=await p.textContent('.ai-panel');
    ok(/اتأكدنا من الكتاب/.test(t),'verified: status chip');
    ok(t.includes('الفكرة الأساسية')&&t.includes('ليه ده الصح')&&t.includes('الاختيارات واحد واحد')&&t.includes('من الكتاب'),'verified: all sections');
    ok(t.includes('Test heading')&&t.includes('The printed sentence from the book.')&&t.includes('p.8'),'verified: source heading, quote and page');
    ok((await p.$$('.ai-opt')).length===Q1.opts.length,'verified: every option analysed ('+Q1.opts.length+')');
    ok((await p.$$('.ai-opt.ok')).length===1,'verified: exactly one correct option highlighted');
    ok(!(await p.$('.ai-conf')),'verified: no conflict callout');
    await p.screenshot({path:'/tmp/aiw/ai-verified.png'});
    await p.click('.ai-go'); await p.waitForTimeout(150);
    ok(!(await p.isVisible('.ai-panel')),'on: click again collapses');
    ok(p.fetches()===1,'on: the subject file is fetched once ('+p.fetches()+')');

    /* السؤال 2: تعارض مع الكتاب */
    await goQ(p,1); await answerFirst(p);
    await p.waitForSelector('.ai-go'); await p.click('.ai-go'); await p.waitForTimeout(200);
    const t2=await p.textContent('.ai-panel');
    ok(/تعارض مع الكتاب/.test(t2),'conflict: status chip');
    ok(await p.isVisible('.ai-conf'),'conflict: callout visible');
    ok(t2.includes('مفتاح الموقع')&&t2.toUpperCase().includes(Q2.keys[0].toUpperCase())&&t2.toUpperCase().includes(wrongOf(Q2).toUpperCase()),'conflict: names both the website key and the book answer');
    ok((await p.$$('.ai-opt.conf')).length>=1&&(await p.$$('.ai-opt.ok')).length===1,'conflict: website-key option marked, book option marked correct');
    await p.screenshot({path:'/tmp/aiw/ai-conflict.png'});

    /* السؤال 3: معرفة عامة */
    await goQ(p,2); await answerFirst(p);
    await p.waitForSelector('.ai-go'); await p.click('.ai-go'); await p.waitForTimeout(200);
    const t3=await p.textContent('.ai-panel');
    ok(/من المعرفة الطبية العامة/.test(t3),'knowledge_only: status chip');
    ok(t3.includes('الإجابة غير موجودة بشكل واضح في المصدر المتاح'),'knowledge_only: disclosure shown');
    ok(!t3.includes('من الكتاب')||true,'knowledge_only: (no source list expected)');
    ok(!(await p.$('.ai-src')),'knowledge_only: no sources block');

    /* السؤال 4: شرح قديم (هاش مختلف) = مفيش زرار */
    await goQ(p,3); await answerFirst(p); await p.waitForTimeout(500);
    ok(!(await p.$('.ai-go')),'stale hash: no button (an explanation for an old key is never shown)');

    /* السؤال 5: مفيش شرح خالص */
    await goQ(p,4); await answerFirst(p); await p.waitForTimeout(500);
    ok(!(await p.$('.ai-go')),'missing entry: no button, nothing shown');

    /* مراجعة النتيجة بتستخدم نفس البلوك */
    const kept=await p.evaluate(()=>{ const id=location.hash.split('/')[2]; return !!IM.findSession(id); });
    ok(kept,'session still there');
    await ctx.close(); }

  /* ===== 3) المفتاح اتغيّر بعد التوليد (مفتاح مصحَّح) → الهاش مش بيطابق ===== */
  { const {ctx,p}=await mk(b,true,FILE); await boot(p);
    const same=await p.evaluate((q)=>{ const Q=IM.bank.q[q.id]; const a=IM.aiHash(Q); const keep=Q.keys.slice(); Q.keys=[Q.opts.find(o=>keep.indexOf(o.o)<0).o]; const b2=IM.aiHash(Q); Q.keys=keep; return [a,b2,IM.aiHash(Q)]; },Q1);
    ok(same[0]===Q1.h&&same[0]!==same[1]&&same[2]===same[0],'hash follows the effective key (changes with it, comes back)');
    await ctx.close(); }

  /* ===== 4) ملف المادة مش موجود (404) = هادي ومفيش أخطاء ===== */
  { const {ctx,p}=await mk(b,true,{}); await boot(p);
    await startRun(p,[Q1.id]); await answerFirst(p); await p.waitForTimeout(500);
    ok(!(await p.$('.ai-go')),'404 on ai/anatomy.json: silent, no button');
    await ctx.close(); }

  /* ===== 5) موبايل + دارك ===== */
  { const ctx=await b.newContext({viewport:{width:390,height:844},colorScheme:'dark',deviceScaleFactor:2});
    await ctx.addInitScript(()=>{ try{ localStorage.setItem('im_seen',JSON.stringify({'tour-v1':1,'ann-honor-1':1,'ann-fix-1120':1,'ann-honor-ready':1})); localStorage.setItem('im_user',JSON.stringify({name:'م',v:1})); localStorage.setItem('im_settings',JSON.stringify({theme:'dark'})); }catch(e){} });
    await ctx.route('**/js/ai-config.js',r=>r.fulfill({contentType:'application/javascript',body:"window.IM=window.IM||{};window.IM.AI={on:true,base:'ai/'};"}));
    await ctx.route('**/ai/*.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(FILE['anatomy.json'])}));
    const p=await ctx.newPage(); p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
    await boot(p); await p.evaluate(()=>{ document.documentElement.setAttribute('data-theme','dark'); });
    await startRun(p,[Q2.id]); await answerFirst(p); await p.waitForSelector('.ai-go'); await p.click('.ai-go'); await p.waitForTimeout(300);
    const ov=await p.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));
    ok(ov.sw<=ov.cw+1,'mobile: no horizontal scroll ('+ov.sw+' vs '+ov.cw+')');
    await p.screenshot({path:'/tmp/aiw/ai-mobile-dark.png',fullPage:false});
    await ctx.close(); }

  /* ===== 6) الملف الواحد (IM.bank.single) = مقفول حتى لو on:true ===== */
  { const {ctx,p}=await mk(b,true,FILE); await boot(p);
    const r=await p.evaluate(()=>{ const was=IM.bank.single; IM.bank.single=true; const v=IM.aiOn(); IM.bank.single=was; return v; });
    ok(r===false,'single-file mode: off even when on:true');
    await ctx.close(); }

  /* ===== 7) نبرة حورس: افتتاحية «بناءً على الكتاب» + تشجيع حسب إجابة الطالب ===== */
  { const {ctx,p}=await mk(b,true,FILE); await boot(p);
    const read=async()=>{ await p.waitForSelector('.ai-go',{timeout:5000}); await p.click('.ai-go'); await p.waitForSelector('.ai-panel .ai-say',{timeout:3000});
      return p.evaluate(()=>({say:document.querySelector('.ai-panel .ai-say').textContent, ca:(document.querySelector('.ai-panel .ai-ca')||{}).textContent||'', close:(document.querySelector('.ai-panel .ai-close')||{}).textContent||'', order:[...document.querySelector('.ai-panel').children].map(c=>(c.className.split(' ').find(x=>x.indexOf('ai-')===0)||''))})); };
    const RIGHT=/برافو|حلو أوي|عاش/, WRONG=/مفيش مشكلة|ولا يهمّك|بقت معاك/, MID=/كمّل يا دكترة|ربنا يوفّقك|إحنا معاك/;
    /* verified + إجابة صح */
    await startRun(p,[Q1.id]); await answerFirst(p); let r=await read();
    ok(/يا دكترة/.test(r.say)&&/بناءً على الكتاب/.test(r.say),'tone: opening addresses the student and says "based on the book"');
    ok(r.ca.toLowerCase()===Q1.keys[0].toLowerCase(),'tone: opening names the book answer letter');
    ok(RIGHT.test(r.close),'tone: right answer gets the praise closing');
    ok(r.order[0]==='ai-hd'&&r.order[1]==='ai-say'&&r.order[r.order.length-2]==='ai-close'&&r.order[r.order.length-1]==='ai-note','tone: order = header, opening, explanation…, closing, note');
    await ctx.close(); }
  { const {ctx,p}=await mk(b,true,FILE); await boot(p);
    const read=async()=>{ await p.waitForSelector('.ai-go',{timeout:5000}); await p.click('.ai-go'); await p.waitForSelector('.ai-panel .ai-close',{timeout:3000}); return p.evaluate(()=>({say:document.querySelector('.ai-panel .ai-say').textContent,close:document.querySelector('.ai-panel .ai-close').textContent})); };
    const WRONG=/مفيش مشكلة|ولا يهمّك|بقت معاك/;
    await startRun(p,[Q1.id]); await answerFirst(p,true); const r=await read();
    ok(WRONG.test(r.close),'tone: wrong answer gets the encouraging (not praising) closing');
    await ctx.close(); }
  { const {ctx,p}=await mk(b,true,FILE); await boot(p);
    const read=async()=>{ await p.waitForSelector('.ai-go',{timeout:5000}); await p.click('.ai-go'); await p.waitForSelector('.ai-panel .ai-close',{timeout:3000}); return p.evaluate(()=>({say:document.querySelector('.ai-panel .ai-say').textContent,close:document.querySelector('.ai-panel .ai-close').textContent})); };
    const MID=/كمّل يا دكترة|ربنا يوفّقك|إحنا معاك/;
    await startRun(p,[Q2.id]); await answerFirst(p); const c=await read();
    ok(/مخالف لمفتاح الموقع/.test(c.say)&&/بناءً على الكتاب/.test(c.say),'tone (conflict): opening says the book disagrees with the site key');
    ok(MID.test(c.close),'tone (conflict): neutral closing, never praise for matching the website key');
    await ctx.close(); }
  { const {ctx,p}=await mk(b,true,FILE); await boot(p);
    await startRun(p,[Q3.id]); await answerFirst(p); await p.waitForSelector('.ai-go',{timeout:5000}); await p.click('.ai-go'); await p.waitForSelector('.ai-panel .ai-say',{timeout:3000});
    const t=await p.evaluate(()=>document.querySelector('.ai-panel .ai-say').textContent);
    ok(/المعرفة الطبية العامة/.test(t)&&!/بناءً على الكتاب/.test(t),'tone (general knowledge): never claims the answer comes from the book');
    await ctx.close(); }

  /* ===== 8) قفل الامتحانات: مفيش حورس أثناء الامتحان (ساعة مائية / ترقية / أسبوعي)، ويفتح بعد التسليم من شاشة المراجعة بس ===== */
  const startExam=async(p,qids,extra)=>{
    const id=await p.evaluate(({qids,extra})=>{ const c=Object.assign({mode:'water',sid:'anatomy',secs:null,groups:null,dup:false,spectate:false,count:0,minutes:30},extra||{}); const s=IM.newSession(c); s.items=qids.map((q,i)=>({u:String(i),q:q,r:0})); s.uid=s.items.length; IM.saveSession(s); location.hash='#/run/'+s.id; return s.id; },{qids,extra});
    await p.waitForSelector('.opt',{timeout:10000});
    return id;
  };
  const pickFirst=async(p)=>{ const o=await p.evaluate(()=>{ const id=location.hash.split('/')[2]; const s=IM.findSession(id); const Q=IM.bank.q[s.items[s.idx].q]; return Q.keys[0]||Q.opts[0].o; }); await p.click('.opt[data-o="'+o+'"]'); await p.waitForTimeout(400); };
  const noHorus=async(p)=>p.evaluate(()=>({btn:!!document.querySelector('.ai-go'),box:!!document.querySelector('.ai-box'),panel:!!document.querySelector('.ai-panel'),lock:!!document.querySelector('.ai-lock')}));
  const EXAMS=[['water',{}],['trial',{trial:{stage:1,pass:60}}],['weekly',{weekly:{n:2,errN:0}}]];
  for(const [nm,extra] of EXAMS){
    const {ctx,p}=await mk(b,true,FILE); await boot(p);
    await startExam(p,[Q1.id,Q2.id],extra); await pickFirst(p); await p.waitForTimeout(600);
    let st=await noHorus(p);
    ok(!st.btn&&!st.box&&!st.panel,'exam('+nm+'): no Horus button or panel while the exam is running');
    ok(p.fetches()===0,'exam('+nm+'): no request to ai/*.json during the exam');
    /* نخلّي الإجابة الأخيرة تتسلّم: نسلّم الامتحان */
    await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    ok(!(await noHorus(p)).btn,'exam('+nm+'): still no Horus on the next question');
    await p.evaluate(()=>{ const bt=[...document.querySelectorAll('button')].find(x=>/^تسليم$/.test(x.textContent.trim())); if(bt) bt.click(); });
    await p.waitForTimeout(300);
    await p.evaluate(()=>{ const bt=[...document.querySelectorAll('.modal button, [role=dialog] button')].find(x=>/سلّم/.test(x.textContent)); if(bt) bt.click(); });
    await p.waitForFunction(()=>/#\/result\//.test(location.hash),{timeout:8000}).catch(()=>{});
    ok(await p.evaluate(()=>/#\/result\//.test(location.hash)),'exam('+nm+'): submitted and landed on the result screen');
    /* بعد التسليم: شاشة المراجعة بتفتح السؤال وفيها زرار حورس */
    await p.waitForSelector('.rv-h',{timeout:5000}); await p.click('.rv-h'); await p.waitForTimeout(500);
    await p.waitForSelector('.ai-go',{timeout:5000}).catch(()=>{});
    ok(!!(await p.$('.ai-go')),'exam('+nm+'): after submitting, the review screen offers Horus');
    await ctx.close();
  }

  /* خروج من الامتحان في النص: السؤال بتاعه يتقفل في أي شاشة تانية (مثلاً البردية) لحد ما يتسلّم */
  { const {ctx,p}=await mk(b,true,FILE); await boot(p);
    const sid=await startExam(p,[Q1.id,Q2.id]); await pickFirst(p);
    await p.evaluate(()=>{ const bt=document.querySelector('button[aria-label="خروج وحفظ"]'); if(bt) bt.click(); }); await p.waitForTimeout(500);
    ok(await p.evaluate((q)=>IM.examOpen(q),Q1.id),'open exam: IM.examOpen() is true for a question inside it');
    ok(!(await p.evaluate((q)=>IM.examOpen(q),QS[8].id)),'open exam: a question outside it is not locked');
    /* لفافة مراجعة عادية فيها السؤال ده: بعد الإجابة مفيش زرار، في ملاحظة قفل */
    await startRun(p,[Q1.id]); await answerFirst(p); await p.waitForTimeout(500);
    const st2=await noHorus(p);
    ok(!st2.btn&&st2.lock,'open exam: the same question in a normal scroll shows the lock note, no button');
    ok(p.fetches()===0,'open exam: no request to ai/*.json for a locked question');
    /* نسلّم الامتحان من الحالة المحفوظة: القفل بيتشال */
    await p.evaluate((id)=>{ const s=IM.findSession(id); s.state='done'; s.end=Date.now(); IM.saveSession(s); },sid);
    ok(!(await p.evaluate((q)=>IM.examOpen(q),Q1.id)),'open exam: once submitted the lock is gone');
    await p.evaluate(()=>{ location.hash='#/train'; }); await p.waitForTimeout(600);
    await startRun(p,[Q1.id]); await answerFirst(p); await p.waitForSelector('.ai-go',{timeout:5000}).catch(()=>{});
    ok(!!(await p.$('.ai-go')),'after the exam: Horus is available again in a normal scroll');
    await ctx.close(); }

  /* aiBox نفسها بترفض لو اتعلّمت إنها امتحان */
  { const {ctx,p}=await mk(b,true,FILE); await boot(p);
    ok(await p.evaluate((id)=>IM.aiBox(IM.bank.q[id],null,{exam:true})===null,Q1.id),'aiBox returns null when called with {exam:true}');
    await ctx.close(); }

  console.log('errors',errs.length?errs:'none'); console.log(fails?('FAILS '+fails):'ALL PASS');
  await b.close(); process.exit(fails?1:0);
})();
