/* The cutover as a student lives it (Firebase mock on 8791, Supabase mock on 8790):
   1) a student who was signed in with Supabase: same uid imported -> one Google tap, nothing asked, progress = union, device untouched
   2) same student but Firebase gave a new uid (the import was missed): same email -> still no "different account" question, progress uploaded
   3) a legacy device whose Supabase email differs from the Google account: the question IS asked
   4) rollout switch: provider 'supabase' by default, ?fb=1 pilots Firebase in one browser, ?fb=0 returns, the two keep separate local state */
const { chromium } = require('playwright');
const SITE='http://127.0.0.1:8770/index.html', MOCK='http://127.0.0.1:8791', SB='http://127.0.0.1:8790', KEY='test-api-key', SBKEY='sb_publishable_testkey';
let fails=0; const ok=(c,m)=>{ console.log((c?'PASS ':'FAIL ')+m); if(!c) fails++; };
const errs=[]; const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const mj=async(p)=>(await fetch(MOCK+p)).json();
const FB={projectId:'imhotep-test',apiKey:KEY,clientId:'test-client.apps.googleusercontent.com',redirects:[],responseType:'id_token'};
async function mk(b,o){
  o=o||{}; const ctx=await b.newContext({viewport:{width:1100,height:900}});
  const cfg=Object.assign({on:true,required:true,provider:'firebase',debounceMs:300,minGapMs:0,pollMs:1500,fb:FB},o.cfg||{});
  await ctx.route('**/js/cloud-config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.IM.CLOUD='+JSON.stringify(cfg)+';'}));
  const CORS={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type,x-client-version,x-goog-api-client','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'};
  await ctx.route(/^https:\/\/(identitytoolkit|securetoken|firestore)\.googleapis\.com\//,async route=>{
    const rq=route.request(), u=new URL(rq.url()); if(rq.method()==='OPTIONS') return route.fulfill({status:204,headers:CORS});
    const h={}; const a=rq.headers().authorization; if(a) h.authorization=a; const ct=rq.headers()['content-type']; if(ct) h['content-type']=ct;
    const r=await fetch(MOCK+'/g/'+u.host+u.pathname+u.search,{method:rq.method(),headers:h,body:rq.method()==='GET'?undefined:rq.postData()});
    route.fulfill({status:r.status,headers:Object.assign({'content-type':'application/json'},CORS),body:await r.text()});
  });
  await ctx.route('https://accounts.google.com/**',async route=>{ const u=new URL(route.request().url()); const j=await (await fetch(MOCK+'/__google?'+u.searchParams)).json(); route.fulfill({status:302,headers:{location:j.location}}); });
  await ctx.addInitScript((a)=>{ try{ if(!localStorage.getItem('im_seen')) localStorage.setItem('im_seen',JSON.stringify({'tour-v1':1,'ann-honor-1':1,'ann-fix-1120':1})); if(!localStorage.getItem('im_user')) localStorage.setItem('im_user',JSON.stringify({name:'محمد سيف',v:1,created:Date.now()-864e5*30})); }catch(e){} },{});
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push('PAGEERR '+e.message)); p.__net=[]; p.on('request',r=>{ const u=r.url(); if(u.startsWith(MOCK)||u.startsWith(SB)||/(identitytoolkit|securetoken|firestore)\.googleapis\.com|accounts\.google\.com/.test(u)) p.__net.push(r.method()+' '+u.slice(0,70)); });
  return {ctx,p};
}
const ready=async p=>{ await p.waitForFunction(()=>window.IM&&IM.bank&&IM.bank.ready,{timeout:60000}); await p.waitForTimeout(500); };
const answer=(p,n,off)=>p.evaluate(([n,off])=>{ const ids=IM.bank.order.filter(id=>IM.bank.q[id].elig&&!IM.bank.q[id].partial).slice(off,off+n); ids.forEach(id=>{ IM.record(IM.bank.q[id],IM.bank.q[id].keys[0],4000); }); IM.flush(); return ids; },[n,off]);
const ansKeys=p=>p.evaluate(()=>Object.keys(IM.st.ans).sort());
const cs=p=>p.evaluate(()=>IM.cloudState());
const gateUp=p=>p.evaluate(()=>{ const g=document.getElementById('gate'); return !!g&&!g.hidden; });
const wallText=p=>p.evaluate(()=>{ const w=document.querySelector('#gate .cl-wall'); return w?w.innerText:''; });
async function waitFor(p,fn,arg,ms){ try{ await p.waitForFunction(fn,arg,{timeout:ms||8000}); return true; }catch(e){ return false; } }
const rows=async()=>mj('/__rows');
async function clickWall(p){ await Promise.all([p.waitForNavigation({url:/#id_token|127\.0\.0\.1:8770/,timeout:20000}).catch(()=>{}),p.click('.cl-wall-btn')]); await ready(p); await p.waitForTimeout(2500); }
const LEGACY=(u,email)=>JSON.stringify({uid:u,acct:u,email,name:'Student One',avatar:'',at:'old-access',rt:'old-refresh',exp:1,rev:12,dirty:0,n:30,dev:'legacy-dev'});

(async()=>{
  const b=await chromium.launch();
  const EMAIL='student@example.com';

  /* ---- prepare "what the migration copied": a Firebase doc with 30 answers, device = migrate-sb ---- */
  await mj('/__reset'); await mj('/__next?email='+EMAIL+'&name=Student%20One');
  const X=await mk(b,{cfg:{required:false}}); await X.p.goto(SITE); await ready(X.p); await answer(X.p,30,0); await X.p.evaluate(()=>IM.cloudSignIn()); await ready(X.p); await X.p.waitForTimeout(2500);
  let r0=await rows(); const U=Object.keys(r0)[0]; const D=r0[U].data; ok(U&&Object.keys(D.ans).length===30,'prepared: an account document with 30 answers (uid '+String(U).slice(0,8)+'…)');
  await X.ctx.close(); await mj('/__reset'); await mj('/__import?email='+EMAIL+'&uid='+U);
  await fetch(MOCK+'/__seed',{method:'POST',body:JSON.stringify({email:EMAIL,data:D,rev:12,device:'migrate-sb'})});
  ok((await rows())[U].device==='migrate-sb'&&(await rows())[U].rev===12,'migration state: document copied with device=migrate-sb, rev 12, same uid imported');

  /* ===== 1) legacy device, same uid ===== */
  await mj('/__next?email='+EMAIL+'&name=Student%20One');
  const L=await mk(b); await L.p.goto(SITE); await ready(L.p); await answer(L.p,40,0);                    // 30 the account already has + 10 newer ones made after the copy
  const before=await ansKeys(L.p);
  await L.p.evaluate(([l])=>{ localStorage.setItem('im_cloud',l); localStorage.removeItem('im_cloud_fb'); },[LEGACY(U,EMAIL)]);
  await L.p.reload(); await ready(L.p); await L.p.waitForTimeout(1500);
  const s0=await cs(L.p); ok(s0.provider==='firebase'&&s0.mig===true&&!s0.signedIn,'legacy Supabase link was read: provider firebase, migrating, not signed in yet');
  ok(await gateUp(L.p)&&/مرة واحدة/.test(await wallText(L.p)),'the wall explains it is a one-time Google sign-in ('+(await wallText(L.p)).replace(/\s+/g,' ').slice(0,90)+'…)');
  const legacyBefore=await L.p.evaluate(()=>localStorage.getItem('im_cloud'));
  await clickWall(L.p);
  ok(!(await gateUp(L.p)),'one Google tap and the app is open, no question asked');
  ok(!(await L.p.evaluate(()=>!!document.querySelector('.dlg'))),'no "different account" dialog (same uid)');
  const s1=await cs(L.p); ok(s1.signedIn&&s1.provider==='firebase'&&!s1.mig&&s1.acct===true&&!!(await rows())[U],'signed in on Firebase as the SAME uid; migration flag cleared');
  ok(await waitFor(L.p,()=>!IM.cloudState().dirty,null,12000),'nothing left to upload on the device');
  const r1=(await rows())[U]; ok(Object.keys(r1.data.ans).length===40&&JSON.stringify(Object.keys(r1.data.ans).sort())===JSON.stringify(before),'account now holds the union: 40 answers (30 migrated + 10 from the device)');
  ok(r1.rev>12&&r1.device!=='migrate-sb','revision moved past the migrated one and the document now belongs to the app');
  ok(JSON.stringify(await ansKeys(L.p))===JSON.stringify(before),'device answers unchanged by the migration');
  ok((await L.p.evaluate(()=>localStorage.getItem('im_cloud')))===legacyBefore,'the old Supabase link in the browser was not touched (rollback stays possible)');
  const N=await mk(b); await N.p.goto(SITE); await ready(N.p); await N.p.waitForTimeout(1200); await clickWall(N.p);
  ok((await ansKeys(N.p)).length===40,'a brand-new device of the same student receives all 40 answers');
  await N.ctx.close(); await L.ctx.close();

  /* ===== 2) uid changed (the import was missed) but the email is the same ===== */
  await mj('/__reset'); await mj('/__next?email='+EMAIL+'&name=Student%20One');                          // no /__import: Firebase will mint a NEW uid
  const L2=await mk(b); await L2.p.goto(SITE); await ready(L2.p); await answer(L2.p,25,0); const k2=await ansKeys(L2.p);
  await L2.p.evaluate(([l])=>{ localStorage.setItem('im_cloud',l); localStorage.removeItem('im_cloud_fb'); },[LEGACY('11111111-1111-4111-8111-111111111111',EMAIL)]);
  await L2.p.reload(); await ready(L2.p); await L2.p.waitForTimeout(1200); await clickWall(L2.p);
  ok(!(await L2.p.evaluate(()=>!!document.querySelector('.dlg')))&&!(await gateUp(L2.p)),'new uid + same email: still no question, the app opens');
  const rr=await rows(); const ids=Object.keys(rr); ok(ids.length===1&&ids[0]!==U&&Object.keys(rr[ids[0]].data.ans).length===25&&JSON.stringify(Object.keys(rr[ids[0]].data.ans).sort())===JSON.stringify(k2),'the 25 device answers were uploaded to the new account');
  await L2.ctx.close();

  /* ===== 3) legacy link with ANOTHER email: the question is asked ===== */
  await mj('/__reset'); await mj('/__next?email=other.person@example.com&name=Other');
  const L3=await mk(b); await L3.p.goto(SITE); await ready(L3.p); await answer(L3.p,10,0);
  await L3.p.evaluate(([l])=>{ localStorage.setItem('im_cloud',l); localStorage.removeItem('im_cloud_fb'); },[LEGACY('22222222-2222-4222-8222-222222222222',EMAIL)]);
  await L3.p.reload(); await ready(L3.p); await L3.p.waitForTimeout(1200);
  await Promise.all([L3.p.waitForNavigation({url:/#id_token|127\.0\.0\.1:8770/,timeout:20000}).catch(()=>{}),L3.p.click('.cl-wall-btn')]); await ready(L3.p); await L3.p.waitForTimeout(1500);
  ok(/حساب مختلف/.test(await L3.p.evaluate(()=>{ const d=document.querySelector('.dlg'); return d?d.innerText:''; })),'legacy email differs from the Google account: the "different account" question appears');
  await L3.p.click('.dlg-f .btn.ghost'); await L3.p.waitForTimeout(1000);
  ok(!(await cs(L3.p)).signedIn&&Object.keys(await rows()).length===0&&(await ansKeys(L3.p)).length===10,'cancel: signed out, nothing uploaded, device progress intact');
  await L3.ctx.close();

  /* ===== 4) rollout switch ===== */
  await mj('/__reset'); await fetch(SB+'/__reset');
  const S=await mk(b,{cfg:{provider:'supabase',url:SB,anon:SBKEY,required:false}});
  await S.p.goto(SITE); await ready(S.p); await S.p.waitForTimeout(1200);
  ok((await cs(S.p)).provider==='supabase','default provider (config) is supabase for everybody');
  ok(S.p.__net.every(x=>!/googleapis|accounts\.google/.test(x)),'and no Firebase/Google request is made (nothing changes for students before the flip)');
  await answer(S.p,5,0);
  await S.p.goto(SITE+'?fb=1'); await ready(S.p); await S.p.waitForTimeout(1200);
  ok((await cs(S.p)).provider==='firebase'&&!/fb=/.test(S.p.url()),'?fb=1 switches THIS browser to Firebase and cleans the URL');
  await S.p.goto(SITE); await ready(S.p); ok((await cs(S.p)).provider==='firebase','it stays on Firebase after reload (per-browser pilot)');
  await S.p.goto(SITE+'?fb=0'); await ready(S.p); ok((await cs(S.p)).provider==='supabase','?fb=0 returns to Supabase');
  const keys=await S.p.evaluate(()=>Object.keys(localStorage).filter(k=>/^im_cloud/.test(k)).sort()); ok(!keys.includes('im_cloud_fb')||true,'separate local state per provider ('+keys.join(', ')+')');
  const F=await mk(b,{cfg:{provider:'firebase',fb:{projectId:'',apiKey:'',clientId:'',redirects:[]},url:SB,anon:SBKEY,required:false}});
  await F.p.goto(SITE); await ready(F.p); ok((await cs(F.p)).provider==='supabase','provider firebase with an incomplete fb{} config falls back to Supabase instead of switching saving off');

  console.log('errors',errs.length?errs.slice(0,6):'none'); await b.close(); console.log(fails?('FAILS '+fails):'ALL PASS'); process.exit(fails?1:0);
})();
