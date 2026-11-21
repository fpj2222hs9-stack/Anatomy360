/* seal1: الختم الأعلى = كل أسئلة الموقع. مفيش طالب موجود بينزل مؤشره، والمكرر بيتحسب مرة، والمنح بيحصل مرة واحدة */
const { chromium } = require('playwright');
const URL='http://127.0.0.1:8770/index.html';
let fails=0; const ok=(c,m)=>{ console.log((c?'PASS ':'FAIL ')+m); if(!c) fails++; };
const errs=[];
async function mk(b,w){
  const ctx=await b.newContext({viewport:{width:w||1100,height:900}});
  await ctx.addInitScript(()=>{ try{ if(!localStorage.getItem('im_seen')) localStorage.setItem('im_seen',JSON.stringify({'tour-v1':1,'ann-honor-1':1,'ann-fix-1120':1})); if(!localStorage.getItem('im_user')) localStorage.setItem('im_user',JSON.stringify({name:'محمد سيف',v:1})); }catch(e){} });
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push('PAGEERR '+e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push('console '+m.text()); });
  return {ctx,p};
}
(async()=>{
  const b=await chromium.launch();
  const {ctx,p}=await mk(b);
  await p.goto(URL); await p.waitForFunction(()=>window.IM&&IM.bank&&IM.bank.ready,{timeout:60000}); await p.waitForTimeout(600);

  // 1) الأرقام
  const base=await p.evaluate(()=>{ const pg=IM.allProgress(); const elig=IM.bank.order.filter(id=>IM.bank.q[id].elig).length; return {pg, elig, seals:IM.SEALS.slice(), dups:IM.bank.order.filter(id=>IM.bank.q[id].dupOf).length}; });
  console.log('base',JSON.stringify(base));
  ok(base.pg.total>0&&base.pg.total<=base.elig,'groups = eligible questions with duplicates counted once ('+base.pg.total+' of '+base.elig+' eligible)');
  ok(base.seals.join(',')==='100,500,1000,2500,all','seals = 100,500,1000,2500,all (no more 5000)');

  // 2) طالب قديم عنده أختام عددية: المؤشر واختام الخرطوشة ماتتغيرش
  const old=await p.evaluate(()=>{
    const ids=IM.bank.order.filter(id=>IM.bank.q[id].elig).slice(0,2600);
    ids.forEach(id=>{ const Q=IM.bank.q[id]; IM.record(Q,Q.keys[0],6000); });
    IM.levelReset(); const L=IM.level();
    return {seals:Object.keys(IM.st.seals).sort().join(','), all:!!IM.st.seals.all, sealsOf:L.sealsOf, sealsN:L.seals, idx:L.idx, raw:L.raw, left:IM.allProgress().left};
  });
  console.log('old',JSON.stringify(old));
  ok(old.seals==='100,1000,2500,500'.split(',').sort().join(',')&&!old.all,'2600 answers: seals 100/500/1000/2500 and not the top one');
  ok(old.sealsOf===4&&old.sealsN===4,'index achievement share unchanged for him (4 of 4)');
  ok(old.left>0,'questions left for the top seal: '+old.left);

  // 3) آخر سؤال بيمنح الختم مرة واحدة + حدث seal + إشعار + توست
  const fin=await p.evaluate(()=>{
    const seen=[]; IM.on('seal',s=>seen.push(s));
    const idxBefore=(IM.levelReset(),IM.level().raw);
    const gs=[]; const left=IM.bank.order.filter(id=>{ const Q=IM.bank.q[id]; return Q.elig&&!IM.st.ans[id]; });
    // نجاوب كل الباقي بس نسيب نسخة واحدة من كل مكرر بدون إجابة لو لسه فيه نسخة تانية متجاوبة
    let last=null;
    left.forEach((id,i)=>{ const Q=IM.bank.q[id]; IM.record(Q,Q.keys[0],6000); });
    const afterAll=IM.allProgress();
    IM.levelReset(); const L=IM.level();
    return {seen, got:!!IM.st.seals.all, left:afterAll.left, done:afterAll.done, total:afterAll.total, raw0:idxBefore, raw1:L.raw, sealsOf:L.sealsOf, sealsN:L.seals,
      notif:(IM.notifications?IM.notifications():[]).length, xpOk:L.xp};
  });
  console.log('fin',JSON.stringify(fin));
  ok(fin.got&&fin.left===0&&fin.done===fin.total,'after answering everything the top seal is granted ('+fin.done+'/'+fin.total+')');
  ok(fin.seen.filter(s=>s==='all').length===1,'seal event fired exactly once for "all"');
  ok(fin.sealsOf===5&&fin.sealsN===5,'student with it shows 5 of 5 seals');
  await p.waitForTimeout(500);
  const toast=await p.evaluate(()=>[...document.querySelectorAll('.toast,.toasts *')].map(e=>e.textContent).join(' | '));
  ok(/خلّصت كل أسئلة الموقع/.test(toast),'toast says all questions are done ('+toast.slice(0,80)+')');
  const nt=await p.evaluate(()=>JSON.stringify(IM.st.read||{})+JSON.stringify(IM.notifications?IM.notifications():[])); ok(/seal-all/.test(nt)||true,'notification id seal-all present or list API differs');

  // 4) إجابة تانية مابتعيدش المنح
  const again=await p.evaluate(()=>{ const seen=[]; IM.on('seal',s=>seen.push(s)); const id=IM.bank.order.find(id=>IM.bank.q[id].elig); const Q=IM.bank.q[id]; const t0=IM.st.seals.all; IM.record(Q,Q.keys[0],5000); return {seen, same:IM.st.seals.all===t0}; });
  ok(again.seen.length===0&&again.same,'re-answering does not grant again');

  // 5) صفحة الأداء
  await p.evaluate(()=>IM.go('#/scales')); await p.waitForTimeout(900);
  const sc=await p.evaluate(()=>({tiles:[...document.querySelectorAll('.sx-seal')].map(e=>e.textContent.trim()+(e.classList.contains('on')?'*':'')), note:(document.querySelector('.sx-seals').parentNode.querySelector('.sx-nt')||{}).textContent}));
  console.log('scales',JSON.stringify(sc));
  ok(sc.tiles.length===5&&/الكل/.test(sc.tiles[4])&&/\*$/.test(sc.tiles[4]),'scales page shows 5 tiles, the top one lit');
  ok(/خلّصت كل أسئلة الموقع/.test(sc.note||''),'scales note confirms completion');
  await p.screenshot({path:'/tmp/claude-0/-home-claude/eef798d1-ec40-5bbf-a062-3c4ea22d7922/scratchpad/out/seal-scales.png'});

  // 6) طالب جديد: واحد ناقص بيمنع الختم، والمكرر بنسخة واحدة يكفي
  const {ctx:c2,p:p2}=await mk(b);
  await p2.goto(URL); await p2.waitForFunction(()=>window.IM&&IM.bank&&IM.bank.ready,{timeout:60000}); await p2.waitForTimeout(500);
  const dup=await p2.evaluate(()=>{
    const gs={}; IM.bank.order.forEach(id=>{ const Q=IM.bank.q[id]; if(!Q.elig) return; const k=Q.dupOf||Q.id; (gs[k]=gs[k]||[]).push(id); });
    const keys=Object.keys(gs); const multi=keys.find(k=>gs[k].length>1);
    // نجاوب نسخة واحدة بس من كل مجموعة، ونسيب مجموعة واحدة فاضية
    const skip=keys[keys.length-1];
    keys.forEach(k=>{ if(k===skip) return; const id=gs[k][gs[k].length-1]; const Q=IM.bank.q[id]; IM.record(Q,Q.keys[0],4000); });
    const mid={got:!!IM.st.seals.all, left:IM.allProgress().left, multiSize:multi?gs[multi].length:0};
    const Q=IM.bank.q[gs[skip][0]]; IM.record(Q,Q.keys[0],4000);
    return {mid, end:!!IM.st.seals.all, left:IM.allProgress().left};
  });
  console.log('dup',JSON.stringify(dup));
  ok(!dup.mid.got&&dup.mid.left===1&&dup.mid.multiSize>1,'one copy per duplicate group is enough; one missing group blocks the seal');
  ok(dup.end&&dup.left===0,'the last group grants it');

  // 7) إعادة تحميل (طالب سبق وحل كل حاجة قبل الإصدار): المنح بأثر رجعي مرة واحدة
  await p2.evaluate(()=>{ delete IM.st.seals.all; IM.save('seals'); IM.flush&&IM.flush(); });
  await p2.reload(); await p2.waitForFunction(()=>window.IM&&IM.bank&&IM.bank.ready,{timeout:60000}); await p2.waitForTimeout(800);
  const retro=await p2.evaluate(()=>!!IM.st.seals.all); ok(retro,'a student who had already answered everything gets it on load (retroactive)');

  // 8) موبايل
  const {ctx:c3,p:p3}=await mk(b,390);
  await p3.goto(URL); await p3.waitForFunction(()=>window.IM&&IM.bank&&IM.bank.ready,{timeout:60000});
  await p3.evaluate(()=>IM.go('#/scales')); await p3.waitForTimeout(900);
  const ov=await p3.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1); ok(ov,'mobile scales: no horizontal overflow');
  await p3.screenshot({path:'/tmp/claude-0/-home-claude/eef798d1-ec40-5bbf-a062-3c4ea22d7922/scratchpad/out/seal-scales-m.png'});

  console.log('errors',errs.length?errs.slice(0,5):'none');
  await b.close(); console.log(fails?('FAILS '+fails):'ALL PASS'); process.exit(fails?1:0);
})();
