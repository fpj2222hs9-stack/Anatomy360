/* Findings of the independent review, as tests (Firebase mock on 8791, site on 8770):
   1) switching provider (rollout or rollback) marks the record of the provider we come back to as dirty, so the first sync MERGES and pushes from the device instead of replacing it
   2) a config problem on the token endpoint (API key restricted, referrer blocked) does NOT sign the student out; sync recovers by itself once it is fixed
   3) an account deleted on one device cannot be re-created by another device whose ID token is still valid */
const { chromium } = require('playwright');
const SITE='http://127.0.0.1:8770/index.html', MOCK='http://127.0.0.1:8791', KEY='test-api-key';
let fails=0; const ok=(c,m)=>{ console.log((c?'PASS ':'FAIL ')+m); if(!c) fails++; };
const errs=[];
const mj=async(p)=>(await fetch(MOCK+p)).json();
const FB={projectId:'imhotep-test',apiKey:KEY,clientId:'test-client.apps.googleusercontent.com',redirects:[],responseType:'id_token'};
async function mk(b,o){
  o=o||{}; const ctx=await b.newContext({viewport:{width:1100,height:900}});
  const cfg=Object.assign({on:true,required:false,provider:'firebase',debounceMs:300,minGapMs:0,pollMs:1500,fb:FB},o.cfg||{});
  await ctx.route('**/js/cloud-config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.IM.CLOUD='+JSON.stringify(cfg)+';'}));
  const CORS={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type,x-client-version,x-goog-api-client','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'};
  const st={tokenBad:false};
  await ctx.route(/^https:\/\/(identitytoolkit|securetoken|firestore)\.googleapis\.com\//,async route=>{
    const rq=route.request(), u=new URL(rq.url()); if(rq.method()==='OPTIONS') return route.fulfill({status:204,headers:CORS});
    if(st.tokenBad&&u.host==='securetoken.googleapis.com') return route.fulfill({status:403,headers:Object.assign({'content-type':'application/json'},CORS),body:JSON.stringify({error:{code:403,message:'Requests from referer <empty> are blocked.',status:'PERMISSION_DENIED'}})});
    const h={}; const a=rq.headers().authorization; if(a) h.authorization=a; const ct=rq.headers()['content-type']; if(ct) h['content-type']=ct;
    const r=await fetch(MOCK+'/g/'+u.host+u.pathname+u.search,{method:rq.method(),headers:h,body:rq.method()==='GET'?undefined:rq.postData()});
    route.fulfill({status:r.status,headers:Object.assign({'content-type':'application/json'},CORS),body:await r.text()});
  });
  await ctx.route('https://accounts.google.com/**',async route=>{ const u=new URL(route.request().url()); const j=await (await fetch(MOCK+'/__google?'+u.searchParams)).json(); route.fulfill({status:302,headers:{location:j.location}}); });
  await ctx.addInitScript((a)=>{ try{ localStorage.setItem('im_lang','ar'); if(!localStorage.getItem('im_seen')) localStorage.setItem('im_seen',JSON.stringify({'tour-v1':1,'ann-honor-1':1,'ann-fix-1120':1})); if(!localStorage.getItem('im_user')) localStorage.setItem('im_user',JSON.stringify({name:'محمد سيف',v:1,created:Date.now()-864e5*30}));
    if(a.seed&&!localStorage.getItem('__seeded')){ localStorage.setItem('__seeded','1'); Object.keys(a.seed).forEach(function(k){ localStorage.setItem(k,a.seed[k]); }); } }catch(e){} },{seed:o.seed||null});
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
  return {ctx,p,st};
}
const ready=async p=>{ await p.waitForFunction(()=>window.IM&&IM.bank&&IM.bank.ready,{timeout:60000}); await p.waitForTimeout(500); };
const answer=(p,n,off)=>p.evaluate(([n,off])=>{ const ids=IM.bank.order.filter(id=>IM.bank.q[id].elig&&!IM.bank.q[id].partial).slice(off,off+n); ids.forEach(id=>{ IM.record(IM.bank.q[id],IM.bank.q[id].keys[0],4000); }); IM.flush(); return ids; },[n,off]);
const cs=p=>p.evaluate(()=>IM.cloudState());
const ls=(p,k)=>p.evaluate(k=>{ try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; } },k);
const raw=(p,k)=>p.evaluate(k=>localStorage.getItem(k),k);
const rows=()=>mj('/__rows');
async function waitFor(p,fn,arg,ms){ try{ await p.waitForFunction(fn,arg,{timeout:ms||8000}); return true; }catch(e){ return false; } }
async function signIn(p){ await p.evaluate(()=>IM.cloudSignIn()); await ready(p); await p.waitForTimeout(2500); }

(async()=>{
  const b=await chromium.launch();
  const EMAIL='student@example.com', rec=(u,rev,dirty)=>JSON.stringify({uid:u,acct:u,email:'s@x.com',name:'S',avatar:'',at:'a',rt:'r',exp:1,rev:rev,dirty:dirty||0,n:5,dev:'d1'});
  const SBCFG={provider:'supabase',url:'http://127.0.0.1:8790',anon:'sb_publishable_testkey'};

  /* ===== 1) provider switch ===== */
  console.log('--- provider switch');
  let X=await mk(b,{cfg:SBCFG,seed:{im_cloud:rec('u1',5),im_cloud_lp:'firebase'}}); await X.p.goto(SITE); await ready(X.p);
  ok((await cs(X.p)).provider==='supabase','provider supabase');
  ok((await cs(X.p)).swFrom==='firebase'&&(await ls(X.p,'im_cloud')).dirty===1,'came back to Supabase from Firebase: the Supabase record is marked dirty (merge + push from the device, never replace it)');
  ok(await raw(X.p,'im_cloud_lp')==='supabase','last provider is remembered'); await X.ctx.close();
  X=await mk(b,{cfg:SBCFG,seed:{im_cloud:rec('u1',5),im_cloud_lp:'supabase'}}); await X.p.goto(SITE); await ready(X.p);
  ok((await cs(X.p)).swFrom==='','same provider as last time: not treated as a switch'); await X.ctx.close();
  X=await mk(b,{cfg:SBCFG,seed:{im_cloud:rec('u1',5)}}); await X.p.goto(SITE); await ready(X.p);
  ok((await cs(X.p)).swFrom===''&&await raw(X.p,'im_cloud_lp')==='supabase','first run after the update (no marker yet): not a switch, marker written'); await X.ctx.close();
  X=await mk(b,{seed:{im_cloud_fb:rec('u2',3),im_cloud_lp:'supabase'}}); await X.p.goto(SITE); await ready(X.p);
  ok((await cs(X.p)).provider==='firebase'&&(await cs(X.p)).swFrom==='supabase'&&(await ls(X.p,'im_cloud_fb')).dirty===1,'flip forward again (sb -> fb -> sb -> fb): the Firebase record is dirty too'); await X.ctx.close();
  X=await mk(b,{cfg:{provider:'firebase',fb:{projectId:'',apiKey:'',clientId:''},url:'http://127.0.0.1:8790',anon:'sb_publishable_testkey'}}); await X.p.goto(SITE+'?fb=1'); await ready(X.p);
  ok((await cs(X.p)).provider==='supabase','?fb=1 with an incomplete fb{} config falls back to Supabase instead of switching sync off'); await X.ctx.close();

  /* ===== 2) config error on the token endpoint is not a sign-out ===== */
  console.log('--- token endpoint rejects with a config error');
  await mj('/__reset'); await mj('/__next?email='+EMAIL+'&name=Student%20One');
  X=await mk(b); await X.p.goto(SITE); await ready(X.p); await answer(X.p,6,0); await signIn(X.p);
  ok((await cs(X.p)).signedIn&&(await cs(X.p)).email===EMAIL,'signed in');
  X.st.tokenBad=true; await mj('/__expire?email='+EMAIL);                      // server expires the ID token; refresh now answers 403 "referrer blocked"
  await answer(X.p,3,6); await X.p.waitForTimeout(4000);
  let s=await cs(X.p); ok(s.signedIn&&!s.need,'still signed in (not asked to sign in again) while the key problem lasts');
  ok(!!(await ls(X.p,'im_cloud_fb')).rt,'the refresh token was NOT thrown away');
  X.st.tokenBad=false; await X.p.evaluate(()=>IM.cloudSync('test')); 
  ok(await waitFor(X.p,async()=>true,null,100)&&await (async()=>{ for(let i=0;i<20;i++){ const r=await rows(); const d=Object.values(r)[0]; if(d&&Object.keys(d.data.ans).length===9) return true; await X.p.waitForTimeout(500); } return false; })(),'after the problem is fixed sync catches up by itself (9 answers on the server)');
  await mj('/__revoke?email='+EMAIL); await mj('/__expire?email='+EMAIL); await X.p.evaluate(()=>IM.cloudSync('test')); await X.p.waitForTimeout(2500);
  s=await cs(X.p); ok(!s.signedIn&&s.need,'a truly dead session (TOKEN_EXPIRED) still signs out as before'); await X.ctx.close();

  /* ===== 3) deleted account cannot be re-created by another device ===== */
  console.log('--- deleted account vs. a second device');
  await mj('/__reset'); await mj('/__keeptokens?on=1'); await mj('/__next?email='+EMAIL+'&name=Student%20One');
  const A=await mk(b); await A.p.goto(SITE); await ready(A.p); await answer(A.p,5,0); await signIn(A.p);
  await mj('/__next?email='+EMAIL+'&name=Student%20One');
  const B=await mk(b); await B.p.goto(SITE); await ready(B.p); await signIn(B.p);
  const uid=Object.keys(await rows())[0]; ok(!!uid&&(await cs(B.p)).signedIn,'two devices signed in to the same account');
  const del=await A.p.evaluate(()=>IM.cloudDeleteAccount().then(()=>({ok:true}),e=>({ok:false,e:String(e&&e.message)})));          /* Spark: المسح من جهاز الطالب نفسه (دخوله حديث) */
  ok(del.ok&&Object.keys(await rows()).length===0,'device A deleted the account: server rows are gone');
  await answer(B.p,4,10); await B.p.waitForTimeout(4500);                          // device B still has a valid ID token and keeps working
  ok(Object.keys(await rows()).length===0,'device B did NOT bring the account back (the tombstone makes the rules refuse the create)');
  await A.ctx.close(); await B.ctx.close(); await mj('/__keeptokens?on=0');

  await b.close();
  console.log(errs.length?'PAGE ERRORS:\n'+errs.join('\n'):'no page errors');
  ok(errs.length===0,'no page errors');
  console.log(fails?('\n'+fails+' FAILED'):'\nALL PASS'); process.exit(fails?1:0);
})();
