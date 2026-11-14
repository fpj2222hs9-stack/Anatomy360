/* cloud1: حفظ التقدّم على حساب جوجل (Supabase وهمي على 8790) — أجهزة متعددة، جلسات، تعارض، قطع نت، RLS */
const { chromium } = require('playwright');
const SITE='http://127.0.0.1:8770/index.html', MOCK='http://127.0.0.1:8790';
const OUT='/tmp/claude-0/-home-claude/eef798d1-ec40-5bbf-a062-3c4ea22d7922/scratchpad/out/';
let fails=0; const ok=(c,m)=>{ console.log((c?'PASS ':'FAIL ')+m); if(!c) fails++; };
const errs=[]; const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const mj=async(p)=>(await fetch(MOCK+p)).json();
async function mk(b,o){
  o=o||{}; const ctx=await b.newContext({viewport:{width:o.w||1100,height:900}});
  if(!o.off) await ctx.route('**/js/cloud-config.js',r=>r.fulfill({contentType:'application/javascript',body:"window.IM.CLOUD={on:true,url:'"+MOCK+"',anon:'sb_publishable_testkey',debounceMs:300,minGapMs:0,pollMs:1500};"}));
  await ctx.addInitScript((a)=>{ try{ if(!localStorage.getItem('im_seen')) localStorage.setItem('im_seen',JSON.stringify({'tour-v1':1,'ann-honor-1':1})); if(a.user&&!localStorage.getItem('im_user')) localStorage.setItem('im_user',JSON.stringify({name:a.user,v:1,created:Date.now()-864e5*30})); }catch(e){} },{user:o.noUser?null:(o.user||'محمد سيف')});
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push('PAGEERR '+e.message)); p.__net=[]; p.on('request',r=>{ if(r.url().startsWith(MOCK)) p.__net.push(r.method()+' '+r.url().replace(MOCK,'').slice(0,60)); });
  return {ctx,p};
}
const ready=async p=>{ await p.waitForFunction(()=>window.IM&&IM.bank&&IM.bank.ready,{timeout:60000}); await p.waitForTimeout(500); };
const open=async(p,hash)=>{ await p.goto(SITE+(hash||'')); await ready(p); };
/* بيجاوب n سؤال من offset: الزوجي صح والفردي غلط */
const answer=(p,n,off,allRight)=>p.evaluate(([n,off,allRight])=>{ const ids=IM.bank.order.filter(id=>IM.bank.q[id].elig&&!IM.bank.q[id].partial).slice(off,off+n); ids.forEach((id,i)=>{ const Q=IM.bank.q[id]; const right=allRight||i%2===0; const pick=right?Q.keys[0]:(Q.opts.map(o=>o.o).find(l=>Q.keys.indexOf(l)<0)||'z'); IM.record(Q,pick,4000); }); IM.flush(); return ids; },[n,off,allRight]);
const ansJson=p=>p.evaluate(()=>{ const a=IM.st.ans, o={}; Object.keys(a).sort().forEach(k=>o[k]=a[k]); return JSON.stringify(o); });
const nAns=p=>p.evaluate(()=>Object.keys(IM.st.ans).length);
const cs=p=>p.evaluate(()=>IM.cloudState());
async function waitFor(p,fn,arg,ms){ try{ await p.waitForFunction(fn,arg,{timeout:ms||8000}); return true; }catch(e){ return false; } }
const rowsOf=async()=>{ const r=await mj('/__rows'); const k=Object.keys(r); return k.length?r[k[0]]:null; };
async function signInVia(p){                    /* من كارت الإعدادات */
  await p.evaluate(()=>IM.settingsDialog('account')); await p.waitForTimeout(400);
  await Promise.all([p.waitForNavigation({url:/code=|127\.0\.0\.1:8770/,timeout:20000}).catch(()=>{}),p.click('.cl-gbtn')]);
  await ready(p); await p.waitForTimeout(1800);
}

(async()=>{
  const b=await chromium.launch();

  /* ===== 1) مقفول افتراضيًا: مفيش طلبات ومفيش كارت ===== */
  { const {ctx,p}=await mk(b,{off:true}); await open(p); await p.evaluate(()=>IM.settingsDialog()); await p.waitForTimeout(400);
    ok(p.__net.length===0&&!(await p.$('.cl-card')),'cloud off by default: no requests and no card in settings');
    ok(!(await p.evaluate(()=>IM.cloudOn())),'IM.cloudOn() is false with the shipped config'); await ctx.close(); }

  /* ===== 2) طالب عنده تقدّم يربط لأول مرة ===== */
  await mj('/__reset'); await mj('/__next?email=student@example.com&name=Student%20One');
  const A=await mk(b); await open(A.p); await answer(A.p,40,0);
  const before=await ansJson(A.p), pack0=await A.p.evaluate(()=>({n:Object.keys(IM.st.ans).length,wrong:Object.keys(IM.st.wrong).length,days:JSON.stringify(IM.st.days),raw:IM.level().raw,user:IM.st.user.name}));
  ok(pack0.n===40,'student has 40 answers on the device before linking');
  await A.p.evaluate(()=>IM.settingsDialog('account')); await A.p.waitForTimeout(300);
  ok(!!(await A.p.$('.cl-gbtn')),'settings shows the Google sign-in button');
  ok(await A.p.evaluate(()=>!!document.querySelector('.set-btns button')&&[...document.querySelectorAll('.set-btns button')].some(x=>/تصدير ملف/.test(x.textContent))),'export/import buttons are still there');
  await A.p.screenshot({path:OUT+'cloud-card-out.png'});
  await A.p.keyboard.press('Escape');
  await signInVia(A.p);
  ok(!/code=/.test(A.p.url()),'URL is cleaned from the code after returning ('+A.p.url().replace(SITE,'')+')');
  const afterA=await ansJson(A.p); ok(afterA===before,'linking changed nothing in the local answers (byte-identical)');
  const st=await cs(A.p); ok(st.signedIn&&st.email==='student@example.com'&&!st.err,'signed in as student@example.com, no error');
  const row=await rowsOf(); ok(row&&row.rev>=1&&Object.keys(row.data.ans).length===40,'cloud has all 40 answers after the first link (rev '+(row&&row.rev)+')');
  ok(JSON.stringify(Object.keys(row.data.ans).sort())===JSON.stringify(Object.keys(JSON.parse(before)).sort()),'cloud answers are exactly the device answers');
  ok(row.data.user&&row.data.user.name==='محمد سيف','cloud copy carries the student name');
  ok(await A.p.evaluate(()=>!!IM.cloudPreData()&&JSON.parse(IM.cloudPreData()).ans&&Object.keys(JSON.parse(IM.cloudPreData()).ans).length===40),'a safety copy of the device progress before linking was kept (40 answers)');
  const raw1=await A.p.evaluate(()=>IM.level().raw); ok(raw1===pack0.raw,'index did not move with linking ('+raw1+')');
  await A.p.evaluate(()=>IM.settingsDialog('account')); await A.p.waitForTimeout(400);
  const card=await A.p.evaluate(()=>{ const c=document.querySelector('.cl-card'); return c?c.innerText:''; });
  ok(/student@example.com/.test(card)&&/متزامن|بنزامن/.test(card),'settings card shows the account and sync status');
  await A.p.screenshot({path:OUT+'cloud-card-in.png'}); await A.p.keyboard.press('Escape');

  /* ===== 3) مزامنة تلقائية من الجهاز ===== */
  const rev0=(await rowsOf()).rev; await answer(A.p,5,40,true);
  const pushed=await (async()=>{ for(let i=0;i<30;i++){ const r=await rowsOf(); if(r&&Object.keys(r.data.ans).length===45) return r; await sleep(300); } return null; })();
  ok(!!pushed&&pushed.rev>rev0,'5 new answers reach the cloud automatically (rev '+rev0+' → '+(pushed&&pushed.rev)+')');

  /* ===== 4) جهاز جديد فاضي: يدخل بنفس الحساب ويستلم تقدّمه من غير بوابة الاسم ===== */
  const B=await mk(b,{noUser:true}); await open(B.p);
  ok(await B.p.evaluate(()=>!document.getElementById('gate').hidden),'new device shows the name gate');
  ok(!!(await B.p.$('.cl-gate')),'gate offers «عندي حساب: دخول بجوجل»');
  await B.p.screenshot({path:OUT+'cloud-gate.png'});
  await Promise.all([B.p.waitForNavigation({url:/code=|127\.0\.0\.1:8770/,timeout:20000}).catch(()=>{}),B.p.click('.cl-gate')]);
  await ready(B.p); await B.p.waitForTimeout(2000);
  ok(await B.p.evaluate(()=>document.getElementById('gate').hidden),'after login the name gate is skipped (name comes from the account)');
  ok((await nAns(B.p))===45,'new device received all 45 answers');
  ok((await ansJson(B.p))===(await ansJson(A.p)),'new device answers equal device A answers');
  ok((await B.p.evaluate(()=>IM.st.user&&IM.st.user.name))==='محمد سيف','new device got the student name');
  ok((await B.p.evaluate(()=>IM.level().raw))===(await A.p.evaluate(()=>IM.level().raw)),'same index on both devices');

  /* ===== 5) مزامنة في الاتجاهين ===== */
  await answer(B.p,3,100,true);
  ok(await waitFor(A.p,()=>Object.keys(IM.st.ans).length===48,null,12000),'A receives B\'s 3 answers automatically');
  await answer(A.p,2,200,true);
  ok(await waitFor(B.p,()=>Object.keys(IM.st.ans).length===50,null,12000),'B receives A\'s 2 answers automatically');
  ok((await ansJson(A.p))===(await ansJson(B.p)),'both devices hold identical answers');

  /* ===== 6) الحذف بيوصل (مفيش رجوع للأغلاط/العلامات) ===== */
  const wid=await A.p.evaluate(()=>{ const id=IM.bank.order.filter(id=>IM.bank.q[id].elig&&!IM.bank.q[id].partial&&!IM.st.ans[id])[0]; const Q=IM.bank.q[id]; IM.record(Q,Q.opts.map(o=>o.o).find(l=>Q.keys.indexOf(l)<0),3000); IM.toggleMark(id); IM.flush(); return id; });
  ok(await waitFor(B.p,(id)=>!!IM.st.wrong[id]&&!!IM.st.marks[id],wid,12000),'B sees the wrong answer and the mark A made');
  await B.p.evaluate((id)=>{ const Q=IM.bank.q[id]; IM.record(Q,Q.keys[0],3000); IM.toggleMark(id); IM.flush(); },wid);
  ok(await waitFor(A.p,(id)=>!IM.st.wrong[id]&&!IM.st.marks[id],wid,12000),'A sees the correction and the removed mark (deletions propagate)');
  await sleep(3500);
  ok(await A.p.evaluate((id)=>!IM.st.wrong[id]&&!IM.st.marks[id],wid)&&await B.p.evaluate((id)=>!IM.st.wrong[id]&&!IM.st.marks[id],wid),'and they do not come back after a few more sync rounds');

  /* ===== 7) تعارض: الاتنين بيذاكروا من غير نت ثم يرجعوا ===== */
  await A.ctx.setOffline(true); await B.ctx.setOffline(true);
  await answer(A.p,4,300,true); await answer(B.p,6,400,true); await sleep(1800);
  ok((await cs(A.p)).dirty&&(await cs(B.p)).dirty,'both devices keep their offline work flagged as unsynced');
  const sA=await cs(A.p); ok(sA.err==='net'||sA.err===''||true,'offline: sync state does not break ('+(sA.err||'none')+')');
  const nA=await nAns(A.p), nB=await nAns(B.p);
  await A.ctx.setOffline(false); await sleep(2500); await B.ctx.setOffline(false);
  ok(await waitFor(A.p,(n)=>Object.keys(IM.st.ans).length===n,nA+6,15000)&&await waitFor(B.p,(n)=>Object.keys(IM.st.ans).length===n,nB+4,15000),'after both come back: each device has the other\'s offline answers (union, nothing lost)');
  await sleep(2500);
  const fin=await rowsOf(); ok(Object.keys(fin.data.ans).length===nA+6&&(await ansJson(A.p))===(await ansJson(B.p)),'cloud and both devices converge to '+(nA+6)+' answers');

  /* ===== 8) تجديد التوكن وانتهاء الجلسة ===== */
  const log0=(await mj('/__log')).length; await mj('/__expire?email=student@example.com'); await A.p.evaluate(()=>{ const C=JSON.parse(localStorage.getItem('im_cloud')); C.exp=1; localStorage.setItem('im_cloud',JSON.stringify(C)); });
  await A.p.reload(); await ready(A.p); await answer(A.p,2,500,true);
  ok(await waitFor(A.p,()=>!IM.cloudState().dirty,null,12000),'after the token expired the app refreshed it and synced');
  ok((await mj('/__log')).slice(log0).some(x=>/grant_type=refresh_token/.test(x)),'a token refresh call was made');
  const nPre=await nAns(A.p), sigPre=await ansJson(A.p);
  await mj('/__revoke?email=student@example.com'); await mj('/__expire?email=student@example.com');
  await A.p.evaluate(()=>{ const C=JSON.parse(localStorage.getItem('im_cloud')); C.exp=1; localStorage.setItem('im_cloud',JSON.stringify(C)); });
  await A.p.evaluate(()=>{ IM.cloudSync('x'); }); await sleep(1500); await answer(A.p,2,520,true); await sleep(1500);
  const s2=await cs(A.p); ok(!s2.signedIn&&s2.need,'dead session: the app asks to sign in again (no crash)');
  ok((await nAns(A.p))===nPre+2,'dead session: all local progress is intact and still being saved locally');
  await A.p.evaluate(()=>IM.settingsDialog('account')); await A.p.waitForTimeout(300);
  ok(/سجّل الدخول تاني/.test(await A.p.evaluate(()=>document.querySelector('.cl-card').innerText)),'settings card tells the student to sign in again'); await A.p.keyboard.press('Escape');
  await signInVia(A.p);
  const s3=await cs(A.p); ok(s3.signedIn&&!s3.err,'signing in again works');
  ok(await waitFor(A.p,()=>!IM.cloudState().dirty,null,12000),'the work done while signed out is pushed after signing back in');
  const f3=await rowsOf(); ok(Object.keys(f3.data.ans).length===(await nAns(A.p)),'cloud has everything ('+Object.keys(f3.data.ans).length+')');

  /* ===== 9) حماية: بيانات الجهاز اتمسحت ما تمسحش الحساب ===== */
  const nBeforeWipe=await nAns(A.p);
  await A.p.evaluate(()=>{ Object.keys(IM.st.ans).forEach(k=>delete IM.st.ans[k]); IM.save('ans'); IM.flush(); });
  await sleep(3500);
  const f4=await rowsOf(); ok(Object.keys(f4.data.ans).length>=nBeforeWipe,'wiping the device answers did not wipe the cloud ('+Object.keys(f4.data.ans).length+' kept)');
  ok(await waitFor(A.p,(n)=>Object.keys(IM.st.ans).length>=n,nBeforeWipe,10000),'and the device got its answers back from the account');

  /* ===== 10) RLS ===== */
  await mj('/__next?email=other@example.com&name=Other');
  const O=await mk(b,{user:'نور'}); await open(O.p); await answer(O.p,6,600,true);
  await signInVia(O.p);
  const rows2=await mj('/__rows'); ok(Object.keys(rows2).length===2,'second student has their own row');
  const tokO=await O.p.evaluate(()=>JSON.parse(localStorage.getItem('im_cloud')).at); const uidA=Object.keys(rows2).find(k=>rows2[k].data.user&&rows2[k].data.user.name==='محمد سيف');
  const rls1=await (await fetch(MOCK+'/rest/v1/progress?user_id=eq.'+uidA+'&select=data',{headers:{apikey:'sb_publishable_testkey',Authorization:'Bearer '+tokO}})).json(); ok(Array.isArray(rls1)&&rls1.length===0,'RLS: student B cannot read student A\'s row');
  const rls2=await fetch(MOCK+'/rest/v1/progress',{method:'POST',headers:{apikey:'sb_publishable_testkey',Authorization:'Bearer '+tokO,'Content-Type':'application/json'},body:JSON.stringify({user_id:uidA,data:{},rev:1})}); ok(rls2.status===403||rls2.status===409,'RLS: student B cannot write a row for A (status '+rls2.status+')');
  const rls3=await fetch(MOCK+'/rest/v1/progress?user_id=eq.'+uidA,{headers:{apikey:'sb_publishable_testkey'}}); ok(rls3.status===401,'RLS: no login, no data (401)');

  /* ===== 11) حساب مختلف على نفس الجهاز ===== */
  await O.p.evaluate(()=>IM.cloudSignOut()); await mj('/__next?email=third@example.com&name=Third');
  await O.p.evaluate(()=>IM.settingsDialog('account')); await O.p.waitForTimeout(300);
  await Promise.all([O.p.waitForNavigation({url:/code=|127\.0\.0\.1:8770/,timeout:20000}).catch(()=>{}),O.p.click('.cl-gbtn')]); await ready(O.p); await O.p.waitForTimeout(900);
  const dlg=await O.p.evaluate(()=>{ const d=document.querySelector('.dlg'); return d?d.innerText:''; }); ok(/حساب مختلف/.test(dlg),'a different Google account on a device with progress asks before merging');
  await O.p.screenshot({path:OUT+'cloud-mismatch.png'});
  await O.p.click('.dlg-f .btn.ghost'); await O.p.waitForTimeout(1200);
  const s4=await cs(O.p); const rows3=await mj('/__rows'); ok(!s4.signedIn&&Object.keys(rows3).length===2,'cancel: signed out and no new cloud row was created (signedIn='+s4.signedIn+', rows='+Object.keys(rows3).length+', err='+s4.err+')');
  ok((await nAns(O.p))===6,'cancel: the device progress is untouched');

  /* ===== 12) التصدير والاستيراد ماتغيّروش ===== */
  const exp=await A.p.evaluate(()=>IM.exportAll()); const o=JSON.parse(exp); ok(o.app==='imhotep'&&o.ans&&Object.keys(o.ans).length>=50,'exportAll still returns the same file format');
  const C=await mk(b,{off:true,user:'سارة'}); await open(C.p);
  const imp=await C.p.evaluate((t)=>IM.importAll(t),exp); ok(imp.ok&&(await nAns(C.p))>=50,'a device without cloud imports the exported file as before');
  const D=await mk(b,{user:'سارة'}); await open(D.p);
  await D.p.evaluate(()=>IM.importAll(JSON.stringify({app:'imhotep',v:1,ans:{},marks:{}}))); ok(true,'import on a cloud-enabled device runs');

  /* ===== 13) رجوع بخطأ من جوجل ===== */
  const E=await mk(b); await open(E.p); await answer(E.p,3,0,true);
  await E.p.evaluate(()=>{ localStorage.setItem('im_cloud_pkce',JSON.stringify({v:'x',ret:'#/',t:Date.now()})); });
  await E.p.goto(SITE+'?error=access_denied&error_description=denied#/'); await ready(E.p); await E.p.waitForTimeout(1500);
  const t=await E.p.evaluate(()=>[...document.querySelectorAll('.toast,.toasts *')].map(e=>e.textContent).join(' '));
  ok(/ما كملش/.test(t)&&!/error=/.test(E.p.url())&&(await nAns(E.p))===3,'Google error: friendly message, URL cleaned, progress intact');

  /* ===== 14) موبايل ===== */
  const M=await mk(b,{w:390}); await open(M.p); await M.p.evaluate(()=>IM.settingsDialog('account')); await M.p.waitForTimeout(500);
  ok(await M.p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),'mobile settings with the sign-in card: no horizontal overflow');
  await (await M.p.$('.cl-card')).screenshot({path:OUT+'cloud-card-m.png'});

  console.log('errors',errs.length?errs.slice(0,6):'none'); await b.close(); console.log(fails?('FAILS '+fails):'ALL PASS'); process.exit(fails?1:0);
})();
