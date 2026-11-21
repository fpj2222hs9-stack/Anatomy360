/* lb_names: أسماء اللوحة ما بتتكررش — من واجهة الموقع على محاكي Apps Script (8780) */
const { chromium } = require('playwright');
const SITE='http://127.0.0.1:8770/index.html', BOARD='http://127.0.0.1:8780/exec';
let fails=0; const ok=(c,m)=>{ console.log((c?'PASS ':'FAIL ')+m); if(!c) fails++; };
const errs=[];
async function mk(b,name,w){
  const ctx=await b.newContext({viewport:{width:w||1100,height:900}});
  await ctx.route('**/js/board-config.js',r=>r.fulfill({contentType:'application/javascript',body:"window.IM.BOARD_URL='"+BOARD+"';"}));
  await ctx.addInitScript((nm)=>{ try{ localStorage.setItem('im_seen',JSON.stringify({'tour-v1':1,'ann-honor-1':1,'ann-fix-1120':1})); localStorage.setItem('im_user',JSON.stringify({name:nm,v:1})); }catch(e){} },name);
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
  await p.goto(SITE); await p.waitForFunction(()=>window.IM&&IM.bank&&IM.bank.ready,{timeout:60000}); await p.waitForTimeout(500);
  await p.evaluate(()=>{ IM.bank.order.filter(id=>IM.bank.q[id].elig).slice(0,30).forEach(id=>{ const Q=IM.bank.q[id]; IM.record(Q,Q.keys[0],5000); }); });
  return {ctx,p};
}
(async()=>{
  const b=await chromium.launch();
  // A يشترك باسم
  const A=await mk(b,'محمد سيف');
  const ra=await A.p.evaluate(()=>IM.boardJoin('محمد سيف').then(r=>({ok:1,serial:r.serial}),e=>({ok:0,e:String(e.message)})));
  ok(ra.ok&&/^IMH-/.test(ra.serial),'A joins as «محمد سيف» ('+(ra.serial||ra.e)+')');

  // B: صفحة اللوحة، يكتب نفس الاسم بتشكيل ومسافات زيادة
  const B=await mk(b,'مُحَمَّد  سيف');
  await B.p.evaluate(()=>IM.go('#/honor')); await B.p.waitForTimeout(1200);
  const inp='.hb-join input.field-i', btn='.hb-join .btn.primary.lg';
  ok(await B.p.$(inp)!==null,'B sees the join card with the name field');
  const pre=await B.p.inputValue(inp); ok(pre.replace(/\s/g,'').length>3,'name field is pre-filled from the login name («'+pre+'»)');
  await B.p.click(btn); await B.p.waitForTimeout(1200);
  const m1=await B.p.evaluate(()=>{ const e=document.querySelector('.hb-join .g-msg'); return e&&!e.hidden?e.textContent:''; });
  ok(/متسجّل|متسجل/.test(m1)&&/تميّزك|تميزك/.test(m1),'B gets the "name already registered" message: «'+m1.slice(0,70)+'»');
  ok(!(await B.p.evaluate(()=>IM.boardJoined())),'B is not joined');
  ok(await B.p.isEnabled(btn),'the join button is enabled again so B can fix the name');
  const foc=await B.p.evaluate(()=>document.activeElement&&document.activeElement.matches('.hb-join input.field-i')); ok(foc,'focus returns to the name field');
  const rows0=await (await fetch('http://127.0.0.1:8780/__rows')).json(); ok(rows0.filter(r=>r[10]==='ok').length===1,'the sheet still has one student');

  // B يكتب اسم جديد
  await B.p.fill(inp,'محمد سيف الجندي'); await B.p.click(btn); await B.p.waitForTimeout(1500);
  ok(await B.p.evaluate(()=>IM.boardJoined()),'B joins with a different name');

  // B يحاول يغيّر اسمه لاسم A
  await B.p.evaluate(()=>IM.go('#/honor')); await B.p.waitForTimeout(1000);
  const rn=await B.p.$('button:has-text("غيّر الاسم")'); ok(!!rn,'B has the rename button');
  await rn.click(); await B.p.waitForTimeout(300);
  await B.p.fill('.hb-acts input.field-i','محمد-سيف'); await B.p.click('.hb-acts button:has-text("حفظ")'); await B.p.waitForTimeout(1200);
  const toast=await B.p.evaluate(()=>[...document.querySelectorAll('.toast,.toasts *')].map(e=>e.textContent).join(' '));
  ok(/متسجّل|متسجل/.test(toast),'rename to A\'s name shows the name-taken toast');
  const st=await B.p.evaluate(()=>({name:IM.boardState?IM.boardState().name:null, err:(JSON.parse(localStorage.getItem('im_board')||'{}')).err||0}));
  const html=await B.p.evaluate(()=>document.body.innerText);
  ok(!/آخر إرسال اترفض/.test(html),'the page does not claim the last send was rejected');
  ok(/محمد سيف الجندي/.test(html),'B still appears with the old name');
  // اسم حر
  await B.p.fill('.hb-acts input.field-i','سيف الجندي'); await B.p.evaluate(()=>fetch('http://127.0.0.1:8780/__advance?ms=30000')); await B.p.click('.hb-acts button:has-text("حفظ")'); await B.p.waitForTimeout(1500);
  const html2=await B.p.evaluate(()=>document.body.innerText); ok(/سيف الجندي/.test(html2)&&!/محمد سيف الجندي/.test(html2),'rename to a free name works');

  // C: نافذة الإعلان (الاسم الجاهز = اسم A)
  const C=await mk(b,'محمد   سيف');
  await C.p.evaluate(()=>IM.boardAnnounce()); await C.p.waitForTimeout(900);
  await C.p.click('.dlg-ann .btn.primary:has-text("فعّل الاشتراك")'); await C.p.waitForTimeout(1300);
  const m2=await C.p.evaluate(()=>{ const e=document.querySelector('.dlg-ann .g-msg'); return e&&!e.hidden?e.textContent:''; });
  ok(/متسجّل|متسجل/.test(m2),'announcement dialog shows the same message for a taken name');
  ok(await C.p.isEnabled('.dlg-ann .btn.primary:has-text("فعّل الاشتراك")'),'announcement join button re-enabled');
  await C.p.fill('.dlg-ann input.field-i','نور الدين'); await C.p.click('.dlg-ann .btn.primary:has-text("فعّل الاشتراك")'); await C.p.waitForTimeout(1500);
  ok(await C.p.evaluate(()=>IM.boardJoined()),'C joins after choosing a free name');

  // D: اسم من رموز بس
  const D=await mk(b,'x'); await D.p.evaluate(()=>IM.go('#/honor')); await D.p.waitForTimeout(1000);
  await D.p.fill('.hb-join input.field-i','🙂🙂'); await D.p.click('.hb-join .btn.primary.lg'); await D.p.waitForTimeout(1000);
  const m3=await D.p.evaluate(()=>{ const e=document.querySelector('.hb-join .g-msg'); return e&&!e.hidden?e.textContent:''; });
  ok(/حروف أو أرقام/.test(m3),'a name with no letters/digits gets its own message');
  // موبايل: الرسالة ما بتعملش overflow
  const M=await mk(b,'محمد سيف',390); await M.p.evaluate(()=>IM.go('#/honor')); await M.p.waitForTimeout(1000); await M.p.click('.hb-join .btn.primary.lg'); await M.p.waitForTimeout(1200);
  ok(await M.p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),'mobile: no horizontal overflow with the error shown');
  await M.p.screenshot({path:'/tmp/claude-0/-home-claude/eef798d1-ec40-5bbf-a062-3c4ea22d7922/scratchpad/out/lb-name-taken-m.png'});
  const fin=await (await fetch('http://127.0.0.1:8780/__rows')).json(); const names=fin.filter(r=>r[10]==='ok').map(r=>r[3]); ok(new Set(names.map(n=>n.replace(/\s/g,''))).size===names.length,'no duplicate names in the sheet: '+names.join(' | '));
  console.log('errors',errs.length?errs.slice(0,5):'none'); await b.close(); console.log(fails?('FAILS '+fails):'ALL PASS'); process.exit(fails?1:0);
})();
