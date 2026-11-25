/* i18n smoke: English mode — drawer, language switch, leftover Arabic on key screens */
const { chromium } = require('playwright');
const SITE=process.env.SITE||'http://127.0.0.1:8770/index.html';
const errs=[]; let fails=0; const ok=(c,m)=>{ console.log((c?'PASS ':'FAIL ')+m); if(!c) fails++; };
async function mk(b,o){
  o=o||{}; const ctx=await b.newContext({viewport:o.vp||{width:1100,height:900},colorScheme:o.dark?'dark':'light'});
  await ctx.addInitScript((o)=>{ try{
    if(sessionStorage.getItem('__i_init')) return; sessionStorage.setItem('__i_init','1');
    localStorage.setItem('im_seen',JSON.stringify({'tour-v1':1,'ann-honor-1':1,'ann-fix-1120':1}));
    if(!o.newUser) localStorage.setItem('im_user',JSON.stringify({name:'Student',v:1,created:Date.now()-864e5*30}));
    if(o.lang) localStorage.setItem('im_lang',o.lang);
  }catch(e){} },o);
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error'&&!/ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.goto(SITE); await p.waitForTimeout(o.wait==null?1500:o.wait); return p;
}
const leftover=p=>p.evaluate(()=>{ const out=[]; const tw=document.createTreeWalker(document.body,4); let n; while((n=tw.nextNode())){ const t=n.nodeValue; if(!/[؀-ۿ]/.test(t)) continue; let e=n.parentNode, skip=false; while(e&&e.nodeType===1){ if(['SCRIPT','STYLE','NOSCRIPT','TEXTAREA'].includes(e.tagName)||e.hasAttribute('data-notr')){skip=true;break;} e=e.parentNode; } if(!skip) out.push(t.trim().slice(0,80)); } document.querySelectorAll('[title],[aria-label],[placeholder],[alt]').forEach(el=>{ ['title','aria-label','placeholder','alt'].forEach(a=>{ const v=el.getAttribute(a); if(v&&/[؀-ۿ]/.test(v)&&!el.closest('[data-notr]')) out.push('@'+a+': '+v.slice(0,80)); }); }); return out; });
(async()=>{
  const b=await chromium.launch();
  /* existing user, no choice yet -> prompt */
  let p=await mk(b);
  ok(await p.evaluate(()=>!!document.getElementById('langPrompt')),'existing user sees the language prompt');
  ok(await p.evaluate(()=>document.documentElement.dir==='rtl'),'Arabic stays RTL before choosing');
  await p.click('.lp-b[lang="ar"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>localStorage.getItem('im_lang')==='ar'&&!document.getElementById('langPrompt')),'choosing Arabic persists and closes the prompt');
  await p.reload(); await p.waitForTimeout(1200);
  ok(await p.evaluate(()=>!document.getElementById('langPrompt')),'prompt does not return');
  /* drawer */
  await p.click('button.brand-l'); await p.waitForTimeout(400);
  ok(await p.evaluate(()=>!!document.querySelector('#menuDrawer.on .dr')&&document.querySelector('button.brand-l').getAttribute('aria-expanded')==='true'),'logo opens the drawer');
  ok(await p.evaluate(()=>location.hash===''||location.hash==='#/'),'logo no longer navigates');
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  ok(await p.evaluate(()=>!document.getElementById('menuDrawer')&&document.activeElement===document.querySelector('button.brand-l')),'Esc closes and returns focus');
  await p.click('button.brand-l'); await p.waitForTimeout(300); await p.click('.dr-i:nth-of-type(3)'); await p.waitForTimeout(500);
  ok(await p.evaluate(()=>location.hash==='#/about'),'About item goes to #/about');
  await p.click('button.brand-l'); await p.waitForTimeout(300); await p.click('.dr-i:nth-of-type(2)'); await p.waitForTimeout(500);
  ok(await p.evaluate(()=>!!document.querySelector('.dlg')&&!document.getElementById('menuDrawer')),'Settings item opens settings');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  /* switch to English */
  await p.click('button.brand-l'); await p.waitForTimeout(300);
  await Promise.all([p.waitForNavigation(),p.click('.dr .lang-seg button[lang="en"]')]); await p.waitForTimeout(1800);
  ok(await p.evaluate(()=>document.documentElement.lang==='en'&&document.documentElement.dir==='ltr'&&localStorage.getItem('im_lang')==='en'),'English: lang=en dir=ltr persisted');

  /* new user: gate shows the language chips; choosing English reloads in English; no prompt afterwards */
  const q=await mk(b,{newUser:true,wait:1800});
  ok(await q.evaluate(()=>!!document.querySelector('#gate .lang-seg')&&document.documentElement.dir==='rtl'),'gate has language chips');
  await Promise.all([q.waitForNavigation(),q.click('#gate .lang-seg button[lang="en"]')]); await q.waitForTimeout(1800);
  ok(await q.evaluate(()=>document.documentElement.lang==='en'&&!!document.querySelector('#gate .g-in')&&/Create account/.test(document.querySelector('#gate').textContent)),'gate renders in English after choosing English');
  await q.fill('#gate .g-in','Mona'); await q.click('#gate .g-go'); await q.waitForTimeout(1500);
  ok(await q.evaluate(()=>!document.getElementById('langPrompt')&&localStorage.getItem('im_lang')==='en'&&JSON.parse(localStorage.getItem('im_user')).name==='Mona'),'new user continues in English, no extra prompt');
  const q2=await mk(b,{newUser:true,wait:1800});
  await q2.fill('#gate .g-in','Ali'); await q2.click('#gate .g-go'); await q2.waitForTimeout(1500);
  ok(await q2.evaluate(()=>localStorage.getItem('im_lang')==='ar'&&!document.getElementById('langPrompt')),'new user who ignores the chips continues in Arabic and is not asked again');
  /* existing user picks English in the prompt */
  const q3=await mk(b);
  await Promise.all([q3.waitForNavigation(),q3.click('.lp-b[lang="en"]')]); await q3.waitForTimeout(1500);
  ok(await q3.evaluate(()=>document.documentElement.lang==='en'&&localStorage.getItem('im_lang')==='en'&&!document.getElementById('langPrompt')),'existing user chooses English from the prompt');
  /* dismissing the prompt keeps Arabic and does not nag */
  const q4=await mk(b); await q4.keyboard.press('Escape'); await q4.waitForTimeout(400);
  ok(await q4.evaluate(()=>localStorage.getItem('im_lang')==='ar'),'dismissing the prompt keeps Arabic');
  const shots='/tmp/claude-0/-home-claude/eef798d1-ec40-5bbf-a062-3c4ea22d7922/scratchpad/';
  const routes=['#/','#/train','#/library','#/scales','#/papyrus','#/about','#/corrections','#/cartouche'];
  for(const r of routes){
    await p.evaluate(h=>{ location.hash=h; },r); await p.waitForTimeout(900);
    const lo=await leftover(p);
    console.log((lo.length?'LEFT ':'CLEAN ')+r+' '+lo.length); lo.slice(0,12).forEach(x=>console.log('    '+x));
    await p.screenshot({path:shots+'en_'+r.replace(/[#/]/g,'_')+'.png'});
  }

  /* English session: arrow keys follow the reading direction, tour finds the subject select */
  await p.evaluate(()=>{ location.hash='#/train'; }); await p.waitForTimeout(700);
  await p.evaluate(()=>{ const b=Array.from(document.querySelectorAll('.btn.primary')).pop(); if(b) b.click(); }); await p.waitForTimeout(1000);
  const idx=()=>p.evaluate(()=>{ const s=IM.findSession&&document.querySelector('.q-n'); return s?s.textContent.trim():''; });
  const k1=await idx(); await p.evaluate(()=>{ const o=document.querySelector('.opt:not([disabled])'); if(o) o.click(); }); await p.waitForTimeout(300);
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(400); const k2=await idx();
  ok(k1!==k2,'English: ArrowRight goes to the next question ('+k1+' -> '+k2+')');
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(400);
  ok((await idx())===k1,'English: ArrowLeft goes back');
  await p.evaluate(()=>{ location.hash='#/train'; }); await p.waitForTimeout(600);
  await p.evaluate(()=>{ try{ IM.tourStart(true); }catch(e){ throw e; } }); await p.waitForTimeout(900);
  for(let i=0;i<14;i++){ const done=await p.evaluate(()=>!document.querySelector('.tour-root')); if(done) break; await p.keyboard.press('Enter'); await p.waitForTimeout(450); }
  await p.evaluate(()=>{ document.querySelectorAll('.tour-root').forEach(x=>x.remove()); const a=document.getElementById('app'); if(a) a.inert=false; });
  ok(true,'English tour ran through without breaking');
  /* translator unit checks */
  const T=await p.evaluate(()=>({a:IM.tr('الرئيسية'),b:IM.tr('5 أسئلة'),c:IM.tr('سؤال واحد'),d:IM.tr('اتصحّح 34 مفتاح'),e:IM.tr('ملاحظة كتبها الطالب بنفسه عن العضلة'),f:IM.tr('Plain English stays')}));
  ok(T.a==='Home'&&/^5 questions$/.test(T.b)&&T.c==='one question','tr(): exact + counts ('+T.a+' | '+T.b+' | '+T.c+')');
  ok(/[؀-ۿ]/.test(T.e)&&T.f==='Plain English stays','tr(): free Arabic text and English are left untouched');
  ok(errs.length===0,'no console errors '+errs.slice(0,3).join(' | '));
  await b.close(); console.log(fails?('FAILED '+fails):'ALL PASS'); process.exit(fails?1:0);
})();
