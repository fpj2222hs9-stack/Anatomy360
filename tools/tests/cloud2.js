/* cloud2: الدخول الإجباري بجوجل + fail-open + وضع التجربة + مسح الحساب (Supabase وهمي على 8790) */
const { chromium } = require('playwright');
const SITE='http://127.0.0.1:8770/index.html', MOCK='http://127.0.0.1:8790', KEY='sb_publishable_testkey';
const OUT='/tmp/claude-0/-home-claude/eef798d1-ec40-5bbf-a062-3c4ea22d7922/scratchpad/out/';
let fails=0; const ok=(c,m)=>{ console.log((c?'PASS ':'FAIL ')+m); if(!c) fails++; };
const errs=[]; const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const mj=async(p)=>(await fetch(MOCK+p)).json();
const CFG=(o)=>JSON.stringify(Object.assign({on:true,required:true,url:MOCK,anon:KEY,debounceMs:300,minGapMs:0,pollMs:1500},o||{}));
async function mk(b,o){
  o=o||{}; const ctx=await b.newContext({viewport:{width:o.w||1100,height:900}});
  await ctx.route('**/js/cloud-config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.IM.CLOUD='+CFG(o.cfg)+';'}));
  await ctx.addInitScript((a)=>{ try{ if(!localStorage.getItem('im_seen')) localStorage.setItem('im_seen',JSON.stringify({'tour-v1':1,'ann-honor-1':1})); if(a.user&&!localStorage.getItem('im_user')) localStorage.setItem('im_user',JSON.stringify({name:a.user,v:1,created:Date.now()-864e5*30})); }catch(e){} },{user:o.noUser?null:(o.user||'محمد سيف')});
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push('PAGEERR '+e.message)); p.__net=[]; p.on('request',r=>{ const u=r.url(); if(u.startsWith(MOCK)||u.includes(':8799')) p.__net.push(r.method()+' '+u.replace(MOCK,'').slice(0,60)); });
  return {ctx,p};
}
const ready=async p=>{ await p.waitForFunction(()=>window.IM&&IM.bank&&IM.bank.ready,{timeout:60000}); await p.waitForTimeout(500); };
const open=async(p,q)=>{ await p.goto(SITE+(q||'')); await ready(p); };
const answer=(p,n,off,allRight)=>p.evaluate(([n,off,allRight])=>{ const ids=IM.bank.order.filter(id=>IM.bank.q[id].elig&&!IM.bank.q[id].partial).slice(off,off+n); ids.forEach((id,i)=>{ const Q=IM.bank.q[id]; const pick=Q.keys[0]; IM.record(Q,pick,4000); }); IM.flush(); return ids; },[n,off,allRight]);
const ansJson=p=>p.evaluate(()=>{ const a=IM.st.ans, o={}; Object.keys(a).sort().forEach(k=>o[k]=a[k]); return JSON.stringify(o); });
const nAns=p=>p.evaluate(()=>Object.keys(IM.st.ans).length);
const cs=p=>p.evaluate(()=>IM.cloudState());
async function waitFor(p,fn,arg,ms){ try{ await p.waitForFunction(fn,arg,{timeout:ms||8000}); return true; }catch(e){ return false; } }
const rowsOf=async()=>{ const r=await mj('/__rows'); const k=Object.keys(r); return k.length?r[k[0]]:null; };
const wallUp=p=>p.evaluate(()=>{ const g=document.getElementById('gate'); return !!g&&!g.hidden&&!!g.querySelector('.cl-wall'); });
const gateUp=p=>p.evaluate(()=>{ const g=document.getElementById('gate'); return !!g&&!g.hidden; });
async function clickWall(p){ await Promise.all([p.waitForNavigation({url:/code=|127\.0\.0\.1:8770/,timeout:20000}).catch(()=>{}),p.click('.cl-wall-btn')]); await ready(p); await p.waitForTimeout(2200); }

(async()=>{
  const b=await chromium.launch();

  /* ===== 1) طالب عنده تقدّم: البوابة الإجبارية ===== */
  await mj('/__reset'); await mj('/__next?email=student@example.com&name=Student%20One');
  const A=await mk(b); await A.p.goto(SITE);
  // نحط التقدّم قبل ما البوابة تظهر: ناخد من أول تحميل (البوابة بتظهر بعد تحميل الأسئلة) ثم نجاوب ونعيد التحميل
  await ready(A.p).catch(()=>{});
  await answer(A.p,40,0,true); const before=await ansJson(A.p);
  A.p.__net.length=0; await A.p.reload(); await ready(A.p).catch(()=>{}); await A.p.waitForTimeout(1500);
  ok(await wallUp(A.p),'existing student with progress on the device sees the sign-in wall');
  const wt=await A.p.evaluate(()=>document.querySelector('.cl-wall').innerText);
  ok(/40 إجابة/.test(wt)&&/هيترفع/.test(wt),'the wall says the 40 device answers will be uploaded automatically');
  ok(await A.p.evaluate(()=>[...document.querySelectorAll('.cl-wall button')].some(x=>/نزّل تقدّمك/.test(x.textContent))),'the wall offers a local download of the progress');
  ok(await A.p.evaluate(()=>[...document.querySelectorAll('.cl-wall a')].map(a=>a.getAttribute('href')).join()==='privacy.html,terms.html'),'the wall links the privacy policy and terms');
  ok(!(await A.p.$('#view *'))||await A.p.evaluate(()=>!document.querySelector('#view').children.length||document.getElementById('gate').getBoundingClientRect().width>0),'the app behind is not usable (gate overlay)');
  ok(A.p.__net.every(x=>/\/auth\/v1\/settings/.test(x)),'before signing in only the settings probe was requested ('+A.p.__net.join(' | ')+')');
  await A.p.screenshot({path:OUT+'cloud-wall.png'});
  await clickWall(A.p);
  ok(!(await gateUp(A.p)),'after Google the wall is gone and the app opened (no name gate: the name already exists)');
  ok((await ansJson(A.p))===before,'local answers are byte-identical after linking');
  const r1=await rowsOf(); ok(r1&&Object.keys(r1.data.ans).length===40&&JSON.stringify(Object.keys(r1.data.ans).sort())===JSON.stringify(Object.keys(JSON.parse(before)).sort()),'the 40 old answers were uploaded to the account automatically');
  await answer(A.p,3,40,true);
  ok(await waitFor(A.p,()=>true,null,100)&&await (async()=>{ for(let i=0;i<30;i++){ const r=await rowsOf(); if(r&&Object.keys(r.data.ans).length===43) return true; await sleep(300); } return false; })(),'3 new answers are saved to the account automatically');
  /* فتح الموقع من غير اتصال بـ Supabase: مسجّل قبل كده فمفيش بوابة */
  await A.ctx.route(MOCK+'/**',r=>r.abort()); await A.p.reload().catch(()=>{}); await ready(A.p).catch(()=>{}); await A.p.waitForTimeout(1200);
  ok(!(await wallUp(A.p))&&(await nAns(A.p))===43,'signed-in student opens the site offline with all progress (no wall)');
  await A.ctx.unroute(MOCK+'/**');

  /* ===== 2) مستخدم جديد خالص ===== */
  await mj('/__next?email=newbie@example.com&name=Newbie%20Name');
  const N=await mk(b,{noUser:true}); await N.p.goto(SITE); await ready(N.p).catch(()=>{}); await N.p.waitForTimeout(1200);
  ok(await wallUp(N.p),'a brand-new user sees the sign-in wall first (no local-only account path)');
  ok(!(await N.p.evaluate(()=>[...document.querySelectorAll('.cl-wall button')].some(x=>/نزّل تقدّمك/.test(x.textContent)))),'no download link when there is no progress');
  await clickWall(N.p);
  ok((await gateUp(N.p))&&!(await N.p.evaluate(()=>!!document.querySelector('#gate .cl-wall'))),'after Google a brand-new user gets the name step');
  ok((await N.p.evaluate(()=>document.querySelector('#gate .g-in').value))==='Newbie Name','the name field is prefilled from the Google name');
  await N.p.fill('#gate .g-in','نور الهدى'); await N.p.click('.g-go'); await N.p.waitForTimeout(900);
  ok(!(await gateUp(N.p)),'name step done, site opened');
  ok(await (async()=>{ for(let i=0;i<30;i++){ const rs=await mj('/__rows'); if(Object.values(rs).some(r=>r.data.user&&r.data.user.name==='نور الهدى')) return true; await sleep(300); } return false; })(),'the new account row carries the chosen name');

  /* ===== 3) جهاز جديد لحساب قديم ===== */
  await mj('/__next?email=student@example.com&name=Student%20One');
  const B=await mk(b,{noUser:true}); await B.p.goto(SITE); await ready(B.p).catch(()=>{}); await B.p.waitForTimeout(1200);
  ok(await wallUp(B.p),'new device: wall');
  await clickWall(B.p);
  ok(!(await gateUp(B.p))&&(await nAns(B.p))===43,'new device: after login it received all 43 answers and skipped the name step');
  ok((await ansJson(B.p))===(await ansJson(A.p)),'new device answers equal the first device');

  /* ===== 4) جوجل مش مفعّل في Supabase: ما نقفلش حد ===== */
  await mj('/__prov?google=0');
  const P=await mk(b); await P.p.goto(SITE); await ready(P.p).catch(()=>{}); await P.p.waitForTimeout(2000);
  ok(!(await gateUp(P.p)),'Google provider disabled: no wall, the site opens normally');
  await P.p.evaluate(()=>IM.settingsDialog('account')); await P.p.waitForTimeout(500);
  ok(await P.p.evaluate(()=>{ const c=document.querySelector('.cl-card'); return !c||c.hidden||c.getBoundingClientRect().height===0; }),'and no Google sign-in card is shown (nothing that would not work)');
  await mj('/__prov?google=1');

  /* ===== 5) مفيش اتصال بـ Supabase: ما نقفلش حد ===== */
  const Z=await mk(b,{cfg:{url:'http://127.0.0.1:8799'}}); await Z.p.goto(SITE); await ready(Z.p).catch(()=>{}); await Z.p.waitForTimeout(3500);
  ok(!(await gateUp(Z.p)),'Supabase unreachable: no wall, the site opens');
  const tz=await Z.p.evaluate(()=>[...document.querySelectorAll('.toast,.toasts *')].map(e=>e.textContent).join(' '));
  ok(/من غير تسجيل دخول/.test(tz),'and a toast asks to sign in when the connection is back');

  /* ===== 6) وضع التجربة ===== */
  const T=await mk(b,{cfg:{pilot:true}}); await T.p.goto(SITE); await ready(T.p).catch(()=>{}); await T.p.waitForTimeout(1200);
  ok(!(await T.p.evaluate(()=>IM.cloudOn()))&&!(await gateUp(T.p))&&T.p.__net.length===0,'pilot: for a normal visitor the feature is invisible and sends no requests');
  await T.p.goto(SITE+'?cloud=1'); await ready(T.p).catch(()=>{}); await T.p.waitForTimeout(1500);
  ok((await T.p.evaluate(()=>IM.cloudOn()))&&await wallUp(T.p),'pilot: ?cloud=1 turns it on for this browser (wall shown)');
  ok(!/cloud=/.test(T.p.url()),'and the parameter is removed from the URL');
  await T.p.goto(SITE); await ready(T.p).catch(()=>{}); await T.p.waitForTimeout(1200);
  ok(await T.p.evaluate(()=>IM.cloudOn()),'it stays on after reload');
  await T.p.goto(SITE+'?cloud=0'); await ready(T.p).catch(()=>{}); await T.p.waitForTimeout(1200);
  ok(!(await T.p.evaluate(()=>IM.cloudOn()))&&!(await gateUp(T.p)),'?cloud=0 turns it off again');

  /* ===== 7) مسح الحساب والبيانات من السيرفر ===== */
  const n43=await nAns(A.p);
  await A.p.evaluate(()=>IM.settingsDialog('account')); await A.p.waitForTimeout(500);
  ok(!!(await A.p.$('.cl-del')),'settings card has the delete-account button');
  await A.p.screenshot({path:OUT+'cloud-card-del.png'});
  await A.p.click('.cl-del'); ok(await A.p.evaluate(()=>document.querySelector('.cl-del').classList.contains('armed')),'first click only arms it (needs a second click)');
  const rowsBefore=Object.keys(await mj('/__rows')).length;
  /* the card is rebuilt on every sync event (every 1.5 s here), which drops the "armed" state, so confirm inside ONE page task (nothing can re-render in between) */
  await A.p.evaluate(()=>{ const b=document.querySelector('.cl-del'); if(!b.classList.contains('armed')) b.click(); b.click(); });
  await A.p.waitForFunction(()=>!document.querySelector('.cl-del'),null,{timeout:8000}).catch(()=>{}); await A.p.waitForTimeout(500);
  ok(Object.keys(await mj('/__rows')).length===rowsBefore-1,'second click deleted the account row on the server');
  const sd=await cs(A.p); ok(!sd.signedIn&&!sd.acct,'the device is signed out and unlinked');
  ok((await nAns(A.p))===n43,'local progress is untouched after deleting the server copy');
  await A.p.keyboard.press('Escape'); await A.p.reload(); await ready(A.p).catch(()=>{}); await A.p.waitForTimeout(1500);
  ok(await wallUp(A.p),'after deletion the wall asks to sign in again');
  await mj('/__next?email=student@example.com&name=Student%20One'); await clickWall(A.p);
  const r2=Object.values(await mj('/__rows')).find(r=>r.data.user&&r.data.user.name==='محمد سيف'); ok(r2&&Object.keys(r2.data.ans).length===43,'signing in again re-uploads the 43 local answers to a fresh account');

  /* ===== 8) موبايل ===== */
  const M=await mk(b,{w:390,noUser:true}); await M.p.goto(SITE); await ready(M.p).catch(()=>{}); await M.p.waitForTimeout(1200);
  ok((await wallUp(M.p))&&await M.p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),'mobile: wall shown, no horizontal overflow');
  await M.p.screenshot({path:OUT+'cloud-wall-m.png'});

  console.log('errors',errs.length?errs.slice(0,6):'none'); await b.close(); console.log(fails?('FAILS '+fails):'ALL PASS'); process.exit(fails?1:0);
})();
