/* i18n crawl: English mode, drive the main flows and report any Arabic text left on screen */
const { chromium } = require('playwright');
const SITE=process.env.SITE||'http://127.0.0.1:8770/index.html';
const D='/tmp/claude-0/-home-claude/eef798d1-ec40-5bbf-a062-3c4ea22d7922/scratchpad/';
const errs=[]; const left={};
const leftover=p=>p.evaluate(()=>{ const out=[]; const AR=/[؀-ۿ]/; const tw=document.createTreeWalker(document.body,4); let n; while((n=tw.nextNode())){ const t=n.nodeValue; if(!AR.test(t)) continue; let e=n.parentNode, skip=false; while(e&&e.nodeType===1){ if(['SCRIPT','STYLE','NOSCRIPT','TEXTAREA'].includes(e.tagName)||e.hasAttribute('data-notr')){skip=true;break;} e=e.parentNode; } if(!skip) out.push(t.trim().slice(0,110)); } document.querySelectorAll('[title],[aria-label],[placeholder],[alt]').forEach(el=>{ ['title','aria-label','placeholder','alt'].forEach(a=>{ const v=el.getAttribute(a); if(v&&AR.test(v)&&!el.closest('[data-notr]')) out.push('@'+a+': '+v.slice(0,110)); }); }); if(AR.test(document.title)) out.push('@title: '+document.title); return out; });
async function chk(p,label,shot){ await p.waitForTimeout(500); const lo=await leftover(p); console.log((lo.length?'LEFT  ':'CLEAN ')+label+(lo.length?' ('+lo.length+')':'')); lo.slice(0,15).forEach(x=>console.log('     '+x)); if(shot) await p.screenshot({path:D+'c_'+shot+'.png'}); }
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1100,height:900}});
  await ctx.addInitScript(()=>{ try{ if(sessionStorage.getItem('__c')) return; sessionStorage.setItem('__c','1'); localStorage.setItem('im_seen',JSON.stringify({'tour-v1':1,'ann-honor-1':1,'ann-fix-1120':1})); localStorage.setItem('im_user',JSON.stringify({name:'Student',v:1,created:Date.now()-1e10})); localStorage.setItem('im_lang','en'); }catch(e){} });
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error'&&!/ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.goto(SITE); await p.waitForFunction(()=>window.IM&&IM.bank&&IM.bank.ready,{timeout:60000}); await p.waitForTimeout(1500);
  await chk(p,'home');
  /* workshop + session */
  await p.evaluate(()=>{ location.hash='#/train'; }); await p.waitForTimeout(800); await chk(p,'train','train');
  const start=p.locator('.btn.primary').filter({hasText:/Start|scroll/i}).first();
  console.log('start btn count',await p.locator('.btn.primary').count());
  await p.evaluate(()=>{ const b=Array.from(document.querySelectorAll('.btn.primary')).pop(); if(b) b.click(); }); await p.waitForTimeout(1200);
  console.log('hash after start:',await p.evaluate(()=>location.hash));
  await chk(p,'session q1','run1');
  for(let i=0;i<80;i++){
    if(!/#\/run\//.test(await p.evaluate(()=>location.hash))) break;
    await p.evaluate(()=>{ const o=document.querySelector('.opt:not([disabled])'); if(o) o.click(); }); await p.waitForTimeout(250);
    if(i===0){ await chk(p,'session answered','run2');
      /* feedback extras: dispute key, notes, explain */
      const lab=await p.evaluate(()=>Array.from(document.querySelectorAll('.q-tools button,.q-act button,.fb button,button')).map(b=>(b.textContent||'').trim().slice(0,40)).filter(Boolean).slice(0,40));
      console.log('buttons:',JSON.stringify(lab));
      await p.evaluate(()=>{ const b=Array.from(document.querySelectorAll('button')).find(x=>/dispute/i.test(x.textContent||'')); if(b) b.click(); }); await p.waitForTimeout(700); await chk(p,'dispute dialog','dispute'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      await p.evaluate(()=>{ const b=Array.from(document.querySelectorAll('button')).find(x=>/note/i.test(x.textContent||'')); if(b) b.click(); }); await p.waitForTimeout(500); await chk(p,'note','note');
    }
    await p.keyboard.press('Enter'); await p.waitForTimeout(250);
    await p.evaluate(()=>{ const m=document.querySelector('.ov'); if(m&&!document.querySelector('.ov .rpt-ta')) { const x=m.querySelector('.dlg-x'); } });
  }
  console.log('hash:',await p.evaluate(()=>location.hash));
  await p.waitForTimeout(800); await chk(p,'result page','result');
  await p.evaluate(()=>{ const b=Array.from(document.querySelectorAll('button,a')).find(x=>/mistake|review|answer/i.test(x.textContent||'')); if(b) b.click(); }); await p.waitForTimeout(700); await chk(p,'result after click','result2');
  /* other pages */
  for(const [h,l] of [['#/mixed','mixed'],['#/library','library'],['#/library/anatomy','library book'],['#/library/biochemistry','biochem book'],['#/honor','honor'],['#/audit','audit'],['#/scales','scales'],['#/papyrus','papyrus'],['#/cartouche','cartouche'],['#/corrections','corrections'],['#/about','about']]){
    await p.evaluate(h=>{ location.hash=h; },h); await p.waitForTimeout(900); await chk(p,l,l.replace(/\W/g,'_'));
  }
  /* dialogs */
  await p.evaluate(()=>{ location.hash='#/'; }); await p.waitForTimeout(600);
  await p.evaluate(()=>IM.settingsDialog()); await p.waitForTimeout(500); await chk(p,'settings','settings'); await p.keyboard.press('Escape');
  await p.evaluate(()=>{ const b=document.querySelector('.iconbtn[aria-label*="otif"],.bell,.bellbtn'); if(b) b.click(); }); await p.waitForTimeout(600); await chk(p,'notifications','notif'); await p.keyboard.press('Escape');
  for(const fn of ['boardAnnounce','fixAnnounce','tourStart']){ await p.evaluate(fn=>{ try{ if(fn==='tourStart') IM.tourStart(true); else IM[fn](); }catch(e){ console.log('x',e.message); } },fn); await p.waitForTimeout(900); await chk(p,fn,fn); await p.keyboard.press('Escape'); await p.waitForTimeout(300); await p.evaluate(()=>{ try{ IM.tourStop&&IM.tourStop(); }catch(e){} document.querySelectorAll('.ov,.tour-root').forEach(x=>x.remove()); const a=document.getElementById('app'); if(a) a.inert=false; document.body.classList.remove('lock'); }); }
  await p.evaluate(()=>{ const b=document.querySelector('.hc-fab'); if(b) b.click(); }); await p.waitForTimeout(800); await chk(p,'horus chat','horus');
  console.log(errs.length?('ERRORS: '+errs.slice(0,5).join(' | ')):'no console errors');
  await b.close();
})();
