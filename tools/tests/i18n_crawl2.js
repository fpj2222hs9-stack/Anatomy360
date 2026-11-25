/* i18n crawl 2: modes (sand/water/mistakes/mixed/weekly/promotion), result details, print, cards */
const { chromium } = require('playwright');
const SITE=process.env.SITE||'http://127.0.0.1:8770/index.html';
const D='/tmp/claude-0/-home-claude/eef798d1-ec40-5bbf-a062-3c4ea22d7922/scratchpad/';
const errs=[];
const leftover=p=>p.evaluate(()=>{ const out=[]; const AR=/[؀-ۿ]/; const tw=document.createTreeWalker(document.body,4); let n; while((n=tw.nextNode())){ const t=n.nodeValue; if(!AR.test(t)) continue; let e=n.parentNode, skip=false; while(e&&e.nodeType===1){ if(['SCRIPT','STYLE','NOSCRIPT','TEXTAREA'].includes(e.tagName)||e.hasAttribute('data-notr')){skip=true;break;} e=e.parentNode; } if(!skip) out.push(t.trim().slice(0,110)); } document.querySelectorAll('[title],[aria-label],[placeholder],[alt]').forEach(el=>{ ['title','aria-label','placeholder','alt'].forEach(a=>{ const v=el.getAttribute(a); if(v&&AR.test(v)&&!el.closest('[data-notr]')) out.push('@'+a+': '+v.slice(0,110)); }); }); return out; });
async function chk(p,label,shot){ await p.waitForTimeout(450); const lo=await leftover(p); console.log((lo.length?'LEFT  ':'CLEAN ')+label+(lo.length?' ('+lo.length+')':'')); lo.slice(0,12).forEach(x=>console.log('     '+x)); if(shot) await p.screenshot({path:D+'c2_'+shot+'.png'}); }
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1100,height:900}});
  await ctx.addInitScript(()=>{ try{ if(sessionStorage.getItem('__c')) return; sessionStorage.setItem('__c','1'); localStorage.setItem('im_seen',JSON.stringify({'tour-v1':1,'ann-honor-1':1,'ann-fix-1120':1})); localStorage.setItem('im_user',JSON.stringify({name:'Student',v:1,created:Date.now()-1e10})); localStorage.setItem('im_lang','en'); }catch(e){} });
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error'&&!/ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.goto(SITE); await p.waitForFunction(()=>window.IM&&IM.bank&&IM.bank.ready,{timeout:60000}); await p.waitForTimeout(1200);
  /* mode tiles */
  await p.evaluate(()=>{ location.hash='#/train'; }); await p.waitForTimeout(800);
  const n=await p.locator('button.mode').count(); console.log('modes',n);
  for(let i=0;i<n;i++){
    await p.evaluate(()=>{ location.hash='#/train'; }); await p.waitForTimeout(500);
    await p.locator('button.mode').nth(i).click(); await p.waitForTimeout(500);
    const nm=await p.evaluate(i=>document.querySelectorAll('button.mode')[i].textContent.trim().slice(0,30),i);
    await chk(p,'mode tile '+nm,'mode'+i);
    await p.evaluate(()=>{ const b=Array.from(document.querySelectorAll('.btn.primary')).pop(); if(b) b.click(); }); await p.waitForTimeout(1000);
    const h=await p.evaluate(()=>location.hash);
    if(/#\/run\//.test(h)){ await chk(p,'  session '+nm,'sess'+i); await p.evaluate(()=>{ const o=document.querySelector('.opt:not([disabled])'); if(o) o.click(); }); await p.waitForTimeout(400); await chk(p,'  answered '+nm); }
    else console.log('  (no session: '+h+')');
  }
  /* weekly + promotion + mixed */
  for(const [label,code] of [['weekly',()=>{ if(IM.weeklyCard){ const c=IM.weeklyCard(); if(c){ document.body.appendChild(c); } } }],['level modal',()=>{ if(IM.levelDialog) IM.levelDialog(); }]]){
    await p.evaluate(()=>{ location.hash='#/'; }); await p.waitForTimeout(500); await p.evaluate(code); await p.waitForTimeout(500); await chk(p,label);
  }
  await p.evaluate(()=>{ document.querySelectorAll('.ov').forEach(x=>x.remove()); location.hash='#/mixed'; }); await p.waitForTimeout(800);
  await p.evaluate(()=>{ const b=Array.from(document.querySelectorAll('.btn.primary')).pop(); if(b) b.click(); }); await p.waitForTimeout(1000); console.log('mixed hash',await p.evaluate(()=>location.hash)); await chk(p,'mixed session','mixed');
  /* print preview */
  await p.evaluate(()=>{ location.hash='#/train'; }); await p.waitForTimeout(600);
  await p.evaluate(()=>{ const b=Array.from(document.querySelectorAll('button,a')).find(x=>/print|pdf/i.test(x.textContent||'')); if(b) b.click(); }); await p.waitForTimeout(800); await chk(p,'print dialog','print');
  console.log(errs.length?('ERRORS: '+errs.slice(0,5).join(' | ')):'no console errors');
  await b.close();
})();
