/* axilla1: مفاتيح الإبط المضافة من كتاب القسم + حماية المؤشر */
const { chromium } = require('playwright');
const SITE='http://127.0.0.1:8770/index.html';
let fails=0; const ok=(c,m)=>{ console.log((c?'PASS ':'FAIL ')+m); if(!c) fails++; };
const EXP={1:'c',2:'b',3:'b',4:'c',5:'b',6:'c',7:'c',8:'a',9:'c',10:'b',11:'c',12:'a',13:'b',14:'b',15:'c',16:'c'};
const errs=[];
async function mk(b,noAdd){
  const ctx=await b.newContext({viewport:{width:1100,height:900}});
  await ctx.addInitScript(()=>{ try{ localStorage.setItem('im_lang','ar'); localStorage.setItem('im_seen',JSON.stringify({'tour-v1':1,'ann-honor-1':1,'ann-fix-1120':1})); localStorage.setItem('im_user',JSON.stringify({name:'طالب',v:1,created:Date.now()-864e5*30})); }catch(e){} });
  if(noAdd) await ctx.route('**/js/fixes.js',async r=>{ const res=await r.fetch(); let t=await res.text(); t=t.replace(/IM\.ADDKEYS=\{[\s\S]*?\n\};\n/,'IM.ADDKEYS={};\n'); r.fulfill({response:res,body:t}); });
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto(SITE); await p.waitForFunction(()=>window.IM&&IM.bank&&IM.bank.ready,{timeout:60000}); await p.waitForTimeout(400); return p;
}
const fixture=(p)=>p.evaluate(()=>{ const ids=IM.bank.order.filter(id=>IM.bank.q[id].elig&&!IM.bank.q[id].partial&&!IM.bank.q[id].added).slice(0,700);
  ids.forEach((id,i)=>{ const Q=IM.bank.q[id]; const wrong=(Q.opts.map(o=>o.o).find(l=>Q.keys.indexOf(l)<0))||'z'; IM.record(Q,(i%10<7)?Q.keys[0]:wrong,5000); }); IM.flush(); const L=IM.level(); return {idx:L.idx,raw:L.raw,groups:L.groups,opened:L.opened}; });
(async()=>{
  const b=await chromium.launch();
  const p=await mk(b,false);
  const info=await p.evaluate((EXP)=>{ const r={}; Object.keys(EXP).forEach(n=>{ const Q=IM.bank.q['g2_axilla-'+n]; r[n]={keys:Q.keys.join(','),elig:Q.elig,added:!!Q.added,fx:Q.fx||'',st:IM.statusOf(Q)}; });
    const others=['g1_artic-21','g2_backarm-4','g2_cubital-9'].map(id=>({id,keys:IM.bank.q[id].keys.length,elig:IM.bank.q[id].elig}));
    const withKeys=IM.bank.order.filter(id=>IM.bank.q[id].added).length; return {r,others,withKeys}; },EXP);
  Object.keys(EXP).forEach(n=>{ const x=info.r[n]; ok(x.keys===EXP[n]&&x.elig&&x.added&&x.st!=='nokey','axilla-'+n+' key='+EXP[n]+', counted, status '+x.st); });
  ok(Object.values(info.r).every(x=>/كتاب القسم \(ISK 101 · ص/.test(x.fx)),'every added key shows its book source and page to the student');
  ok(info.withKeys===16,'exactly 16 questions got keys (got '+info.withKeys+')');
  ok(info.others.every(o=>o.keys===0&&!o.elig),'the 3 other keyless anatomy questions are untouched (still keyless)');
  const withAdd=await fixture(p);
  const q=await mk(b,true);
  const base=await fixture(q);
  ok(withAdd.idx===base.idx&&withAdd.raw===base.raw&&withAdd.groups===base.groups,'index is identical with/without the added keys for the same student (idx '+withAdd.idx+' raw '+withAdd.raw.toFixed(4)+' groups '+withAdd.groups+')');
  const g0=await p.evaluate(()=>IM.level().groups);
  await p.evaluate(()=>{ const Q=IM.bank.q['g2_axilla-3']; IM.record(Q,'b',4000); IM.flush(); });
  const g1=await p.evaluate(()=>({g:IM.level().groups,a:IM.st.ans['g2_axilla-3'].c}));
  ok(g1.g===g0+1&&g1.a===1,'answering an added question brings it into the index (groups '+g0+' -> '+g1.g+') and it is marked correct for key b');
  await p.evaluate(()=>{ const Q=IM.bank.q['g2_axilla-5']; IM.record(Q,'a',4000); IM.flush(); });
  ok(await p.evaluate(()=>IM.st.ans['g2_axilla-5'].c===0),'a wrong pick on an added question is marked wrong');
  console.log('errors',errs.length?errs.slice(0,3):'none'); await b.close(); console.log(fails?'FAILS '+fails:'ALL PASS'); process.exit(fails?1:0);
})();
