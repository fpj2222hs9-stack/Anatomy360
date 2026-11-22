/* fix1120: مراجعة 20 نوفمبر — مفاتيح اتصحّحت، أسئلة اتشالت، قيد المراجعة، الإشعار مرة واحدة، صفحة التصحيحات، وحالة الطالب القديمة */
const { chromium } = require('playwright');
const SITE=process.env.SITE||'http://127.0.0.1:8770/index.html';
let fails=0; const ok=(c,m)=>{ console.log((c?'PASS ':'FAIL ')+m); if(!c) fails++; };
const errs=[];
const FIXED={ 'b05-006':'c','b05-009':'c','b05-046':'d','b05-084':'a,c','b07-031':'c','b14-014':'b','b10-046':'c','b10-077':'a','b12-075':'c','b04-046':'a','b08-024':'c','b09-055':'b','g2_hand-8':'c','g2_hand-31':'c','g3_fetmem-1':'a','g2_frontfore-8':'c' };
const OLD  ={ 'b05-006':'d','b05-009':'d','b05-046':'b','b05-084':'d','b07-031':'a','b14-014':'c','b10-046':'b','b10-077':'d','b12-075':'a','b04-046':'d','b08-024':'b','b09-055':'d','g2_hand-8':'b','g2_hand-31':'a','g3_fetmem-1':'c','g2_frontfore-8':'d' };
const RVW=['b05-084','b04-046','b08-024','b09-055','g2_frontfore-8'];
const GONE=['b01-076','b04-029','b05-039','b06-006','b10-005','b10-020','b10-065','b04-072','b11-027','g1_artic-21','g1_cvs-4','g2_cubital-7','g2_hand-13','g2_medulnar-78','g2_bpinj-3','g2_lymph-11','g3_fetmem-2','g3_fetmem-7','g2_axart-14','g2_medulnar-22'];
const BEFORE={ 'b05-036':['a','b'],'b08-033':['d',null],'b08-034':['b',null],'b08-035':['d',null],'b08-036':['d',null],'b08-037':['d',null],'g2_back-10':['b','a'],'g2_axilla-1':['c',''],'g2_axilla-2':['b',''],'g2_hand-12':['c',''],'g2_cutan-3':['c',''],'g3_w2-9':['c',''],'g2_back-5':['e',''],'g2_hand-19':['b',''],'c1z-267':['b',''],'g2_axart-1':['a',''],'g2_cubital-14':['d',''],'g2_medulnar-39':['d',''],'g2_medulnar-28':['b','']};

async function mk(b,o){
  o=o||{}; const ctx=await b.newContext({viewport:o.vp||{width:1100,height:900},colorScheme:o.dark?'dark':'light'});
  await ctx.addInitScript((o)=>{ try{
    if(sessionStorage.getItem('__fx_init')) return; sessionStorage.setItem('__fx_init','1');
    if(o.clear){ localStorage.clear(); }
    localStorage.setItem('im_seen',JSON.stringify(Object.assign({'tour-v1':1,'ann-honor-1':1},o.seen||{})));
    localStorage.setItem('im_user',JSON.stringify({name:'طالب',v:1,created:o.created||(Date.now()-864e5*30)}));
    Object.keys(o.ls||{}).forEach(k=>localStorage.setItem(k,JSON.stringify(o.ls[k])));
  }catch(e){} },o);
  if(o.noGone) await ctx.route('**/js/fixes.js',async r=>{ const res=await r.fetch(); let t=await res.text(); t=t.replace(/IM\.GONE=\{[\s\S]*?\n\};\n/,'IM.GONE={};\n'); r.fulfill({response:res,body:t}); });
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error'&&!/ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|Failed to load resource/.test(m.text())) errs.push('console: '+m.text()); });
  await p.goto(o.url||SITE); await p.waitForFunction(()=>window.IM&&IM.bank&&IM.bank.ready,{timeout:60000}); await p.waitForTimeout(o.wait==null?400:o.wait); return p;
}

(async()=>{
  const b=await chromium.launch();

  /* ---------- 1) الداتا: مفاتيح، حذف، مراجعة ---------- */
  const p=await mk(b);
  const info=await p.evaluate(({FIXED,GONE,BEFORE})=>{
    const q=id=>IM.bank.q[id], r={fixed:{},gone:{},before:{}};
    Object.keys(FIXED).forEach(id=>{ const Q=q(id); r.fixed[id]={keys:Q.keys.join(','),bk:Q.bk,fix:Q.fix,review:Q.review,elig:Q.elig,fx:Q.fx.length,st:IM.statusOf(Q)}; });
    GONE.forEach(id=>{ const Q=q(id); r.gone[id]=Q?{gone:!!Q.gone,elig:Q.elig,inOrder:IM.bank.order.indexOf(id)>-1,inSec:IM.bank.subs[Q.sid].secs[Q.sec].qids.indexOf(id)>-1,why:!!Q.goneWhy}:null; });
    Object.keys(BEFORE).forEach(id=>{ const Q=q(id); r.before[id]={keys:Q.keys.join(','),bk:Q.bk||''}; });
    r.h12={review:q('g2_hand-12').review,why:!!q('g2_hand-12').rvwhy,elig:q('g2_hand-12').elig,fix:q('g2_hand-12').fix};
    r.counts={bio:IM.bank.subs.biochemistry.qids.length,ana:IM.bank.subs.anatomy.qids.length,his:IM.bank.subs.histology.qids.length,total:IM.bank.order.length};
    r.canc=IM.bank.order.filter(id=>q(id).canc).length;
    return r; },{FIXED,GONE,BEFORE});
  Object.keys(FIXED).forEach(id=>{ const x=info.fixed[id]; ok(x.keys===FIXED[id]&&x.bk===OLD[id]&&x.fix&&x.elig&&x.fx>20,id+': key '+OLD[id]+' -> '+FIXED[id]+', counted, reason shown'); });
  RVW.forEach(id=>ok(info.fixed[id].review===true,id+' corrected but still marked under review'));
  Object.keys(FIXED).filter(id=>RVW.indexOf(id)<0).forEach(id=>ok(info.fixed[id].review===false,id+' corrected and NOT under review'));
  GONE.forEach(id=>{ const x=info.gone[id]; ok(x&&x.gone&&!x.elig&&!x.inOrder&&!x.inSec&&x.why,id+' removed (kept only in memory, in no list)'); });
  ok(info.counts.bio===998-9&&info.counts.ana===844-11,'biochemistry 998 -> '+info.counts.bio+' (-9), anatomy 844 -> '+info.counts.ana+' (-11)');
  ok(info.counts.his===1119,'histology untouched ('+info.counts.his+')');
  ok(info.canc===0,'no cancelled question is left in the site ('+info.canc+')');
  Object.keys(BEFORE).forEach(id=>{ const x=info.before[id],e=BEFORE[id]; ok(x.keys===e[0]&&(e[1]===null||x.bk===e[1]),id+' (already reviewed/added earlier) untouched: key '+x.keys+(x.bk?' printed '+x.bk:'')); });
  ok(info.h12.review&&info.h12.why&&info.h12.elig&&!info.h12.fix,'g2_hand-12 keeps its printed key c and is marked under review with the reason');

  /* ---------- 2) الملاحظات تحت السؤال ---------- */
  const notes=await p.evaluate(()=>{ const t=id=>IM.noteFor(IM.bank.q[id],null).map(e=>e.textContent).join(' | '); return {a:t('b05-084'),b:t('g2_hand-12'),c:t('b05-006'),d:t('g1_cvs-4'),e:t('b10-046')}; });
  ok(/قيد المراجعة مع الدكتور/.test(notes.a)&&/المفتاح المصحّح/.test(notes.a)&&!/مفتاح الملزمة/.test(notes.a),'corrected+under-review note says the corrected key is what counts');
  ok(/قيد المراجعة\. المحسوب لك هو مفتاح الملزمة/.test(notes.b)&&/mid-palmar/.test(notes.b),'review-only note keeps the printed key and shows the reason');
  ok(/اتصحّح مفتاح السؤال/.test(notes.c)&&!/قيد المراجعة/.test(notes.c),'plain correction has no review note');
  ok(/اتشال من الموقع/.test(notes.d),'a removed question explains that it was removed');
  ok(!/قيد المراجعة/.test(notes.e),'b10-046 (was under review in the data, corrected now) no longer says under review');

  /* ---------- 3) طالب قديم: إجابات بالمفتاح القديم + مفضّلة + أغلاط + لفافة محفوظة فيها سؤال اتشال ---------- */
  const mkAns=(id,f,ok)=>({n:1,c:ok?1:0,f:f,fo:ok?1:0,l:f,lo:ok?1:0,ms:4000,ts:Date.now()-864e5});
  const sessP=await mk(b,{noGone:true});
  const sess=await sessP.evaluate(()=>{ const s=IM.newSession({mode:'train',sid:'anatomy',secs:null,groups:null,dup:false,spectate:false,count:6,minutes:0}); const bad='g1_cvs-4'; s.items[0].q=bad; s.items[1].q='g2_hand-13'; return s; });
  const itemsQ=sess.items.map(i=>i.q);
  ok(itemsQ[0]==='g1_cvs-4'&&itemsQ[1]==='g2_hand-13','fixture: a saved scroll that contains two questions removed later');
  const old=await mk(b,{ls:{
    im_ans:{'b05-006':mkAns('b05-006','d',1),'b10-077':mkAns('b10-077','d',1),'b05-009':mkAns('b05-009','c',0),'g1_cvs-4':mkAns('g1_cvs-4','c',1),'b11-027':mkAns('b11-027','b',1),'g2_hand-8':mkAns('g2_hand-8','c',0),'g3_fetmem-1':mkAns('g3_fetmem-1','c',1)},
    im_wrong:{'b05-009':Date.now(),'g2_hand-8':Date.now(),'g1_cvs-4':Date.now()},
    im_marks:{'g1_cvs-4':1,'b04-072':1,'b05-046':1},
    im_sess:{[sess.id]:Object.assign(sess,{state:'run',idx:0})},im_last:sess.id},wait:900});
  const st=await old.evaluate(()=>{ const A=IM.st.ans, W=IM.st.wrong; const lv=IM.level();
    return {a6:A['b05-006'].lo,a77:A['b10-077'].lo,a9:A['b05-009'].lo,h8:A['g2_hand-8'].lo,w9:!!W['b05-009'],w8:!!W['g2_hand-8'],wg:IM.wrongIds().indexOf('g1_cvs-4')>-1,mk:IM.markedIds(),
      pend:IM.pendingNotices().map(c=>c.q.id).sort(),idx:lv.idx,wrongAll:IM.wrongIds().length}; });
  ok(st.a6===0&&st.a77===0,'student who picked the OLD key (b05-006 d, b10-077 d) is re-scored once on the new key (now wrong)');
  ok(st.a9===1&&!st.w9&&st.h8===1&&!st.w8,'student who picked the NEW key earlier (b05-009 c, g2_hand-8 c) is now right and leaves the wrong pan');
  ok(!st.wg,'a removed question never sits in the wrong pan');
  ok(JSON.stringify(st.mk)==='["b05-046"]','bookmarks on removed questions are hidden ('+JSON.stringify(st.mk)+')');
  ok(JSON.stringify(st.pend)==='["b05-006","b10-077","g3_fetmem-1"]','the "answered with the old key" list is exactly the three questions ('+JSON.stringify(st.pend)+')');
  ok(typeof st.idx==='number'&&st.idx>=0,'the index still computes with answers on removed questions (idx '+st.idx+')');
  /* افتح اللفافة المحفوظة اللي فيها سؤال اتشال */
  await old.evaluate(id=>{ location.hash='#/run/'+id; },sess.id); await old.waitForTimeout(900);
  const run=await old.evaluate(()=>({h:location.hash,qb:!!document.querySelector('.qb'),txt:(document.querySelector('.qb')||{textContent:''}).textContent.slice(0,80)}));
  ok(/#\/run\//.test(run.h)&&run.qb,'a saved scroll with a removed question still opens ('+run.txt.trim().slice(0,40)+'…)');

  /* ---------- 4) الإشعار: مرة واحدة، بزرار لصفحة التصحيحات ---------- */
  const a=await mk(b,{created:Date.parse('2026-11-10'),wait:200,ls:{im_ans:{'b05-006':mkAns('b05-006','d',1)}}});
  await a.waitForSelector('.dlg-ann',{timeout:9000});
  const dlg=await a.evaluate(()=>{ const d=document.querySelector('.dlg-ann'); return {t:d.textContent.replace(/\s+/g,' '),btn:[...d.querySelectorAll('.dlg-f .btn')].map(x=>x.textContent.trim()),seen:!!IM.st.seen['ann-fix-1120'],toast:[...document.querySelectorAll('.toast')].some(t=>/اتصحّح مفتاح/.test(t.textContent))}; });
  ok(/16 سؤال اتصحّح مفتاحه/.test(dlg.t)&&/20 سؤال اتشال/.test(dlg.t)&&/6 أسئلة قيد المراجعة/.test(dlg.t),'announcement shows the real numbers (16 corrected · 6 under review · 20 removed)');
  ok(/12 كيمياء حيوية و4 تشريح/.test(dlg.t),'announcement splits corrected keys by subject (12 biochemistry + 4 anatomy)');
  ok(/1 منهم جاوبتهم قبل كده بالمفتاح القديم/.test(dlg.t),'announcement tells this student how many she answered with the old key');
  ok(dlg.btn[0]==='شوف الأسئلة المصححة'&&dlg.seen,'it has the "see corrected questions" button and is marked seen when shown');
  ok(!dlg.toast,'no duplicate "corrected key" toast next to the announcement');
  await a.click('.dlg-ann .btn.primary'); await a.waitForTimeout(500);
  ok(await a.evaluate(()=>location.hash==='#/corrections'&&!document.querySelector('.dlg-ann')),'the button closes the dialog and opens the corrections page');
  await a.reload(); await a.waitForFunction(()=>window.IM&&IM.bank&&IM.bank.ready); await a.waitForTimeout(3500);
  ok(await a.evaluate(()=>!document.querySelector('.dlg-ann')),'after a reload it does not show again (once only)');

  const nw=await mk(b,{created:Date.parse('2026-11-25'),wait:200}); await nw.waitForTimeout(3500);
  ok(await nw.evaluate(()=>!document.querySelector('.dlg-ann')&&!!IM.st.seen['ann-fix-1120']),'a student who joined after the release never saw the old keys, so no announcement');
  const nt=await mk(b,{created:Date.parse('2026-11-10'),seen:{'tour-v1':0},wait:200}); await nt.evaluate(()=>{ delete IM.st.seen['tour-v1']; }); await nt.waitForTimeout(3000);
  ok(await nt.evaluate(()=>!document.querySelector('.dlg-ann')),'while the first-time tour is not finished the announcement waits');
  await a.click('.bellbtn'); await a.waitForSelector('.nc .nc-l .nc-i',{timeout:4000});
  const bell=await a.evaluate(()=>{ const its=[...[...document.querySelectorAll('.nc .nc-l')].pop().querySelectorAll('.nc-i')].filter(li=>!/اتغيّر حساب المؤشر/.test(li.textContent)).slice(0,2); return its.map(li=>{ const l=li.querySelector('.nc-a'); return {t:li.textContent.replace(/\s+/g,' '),href:l&&l.getAttribute('href'),lab:l&&l.textContent.trim()}; }); });
  const top=await a.evaluate(()=>{ const li=[...document.querySelectorAll('.nc .nc-l')].pop().querySelector('.nc-i'); return li.textContent.replace(/\s+/g,' '); });
  ok(/اتغيّر حساب المؤشر/.test(top),'the newest bell entry (22 Nov) is the index/weekly change, then the corrections batches');
  ok(/تصحيحات جديدة للأسئلة/.test(bell[0].t)&&/سؤالين/.test(bell[0].t)&&bell[0].href==='#/corrections'&&/شوف الأسئلة المصححة/.test(bell[0].lab),'the bell lists the 21 Nov batch FIRST (2 corrected, 2 removed) with the "see corrected questions" link');
  ok(/تصحيحات ومراجعة جديدة/.test(bell[1].t)&&/14 سؤال/.test(bell[1].t)&&/18 سؤال/.test(bell[1].t)&&bell[1].href==='#/corrections','and the 20 Nov batch right after it with its own numbers (14 / 18)');
  await a.keyboard.press('Escape'); await a.waitForTimeout(250);

  /* ---------- 5) صفحة التصحيحات ---------- */
  await a.evaluate(()=>{ location.hash='#/corrections'; }); await a.waitForTimeout(600);
  const pg=await a.evaluate(()=>{ const items=[...document.querySelectorAll('.pp-i:not(.static)')], st=[...document.querySelectorAll('.pp-i.static')];
    return {items:items.length,stat:st.length,secs:[...document.querySelectorAll('.pp-sec')].map(x=>x.textContent.replace(/\s+/g,' ')),chips:[...document.querySelectorAll('.chips .tog')].map(x=>x.textContent.replace(/\s+/g,' ')),rv:document.querySelectorAll('.pp-h .chip.doubt').length,
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,whys:st.every(x=>x.querySelector('.pp-why').textContent.length>10)}; });
  ok(pg.items===IM_ALL(pg),'corrections page lists every corrected key (histology 11 + earlier 6 + 14 new = '+pg.items+')');
  ok(pg.stat===21&&pg.secs.length===2,'below the list: 1 under review + 20 removed, each with its reason ('+pg.stat+')');
  ok(pg.rv===5,'the 5 corrected-but-under-review questions carry a "قيد المراجعة" chip ('+pg.rv+')');
  ok(pg.chips.length===3&&/المراجعة الأخيرة\s*16/.test(pg.chips[2]),'filter chips: all / answered with old key / last review (16)');
  ok(!pg.overflow,'no horizontal scroll on the corrections page');
  const gn=await a.evaluate(()=>{ const cards=[...document.querySelectorAll('.pp-i.static')].filter(c=>c.querySelector('.pp-opts'));
    const by=t=>cards.find(c=>c.textContent.includes(t)), o=c=>c?{n:c.querySelectorAll('.pp-opts li').length,key:[...c.querySelectorAll('.pp-opts li.key')].map(l=>l.querySelector('b').textContent),line:(c.querySelector('.pp-key')||{}).textContent||'',why:(c.querySelector('.pp-why')||{}).textContent||''}:null;
    return {total:cards.length,allWhy:cards.every(c=>/^سبب الإزالة: /.test((c.querySelector('.pp-why')||{}).textContent||'')&&c.querySelector('.pp-key')),
      keyedOk:cards.every(c=>{ const l=(c.querySelector('.pp-key')||{}).textContent||''; const m=l.match(/: ([A-H](?: \+ [A-H])*)$/); const marked=[...c.querySelectorAll('.pp-opts li.key b')].map(b=>b.textContent).join(' + '); return m?m[1]===marked:(/ملغي/.test(l)&&!marked); }),
      thoracic:o(by('superior thoracic artery')),ulnar:o(by('Regarding ulnar nerve injury')),overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth}; });
  ok(gn.total===20&&gn.allWhy,'all 20 removed questions show their choices, the printed key line and a "سبب الإزالة" reason ('+gn.total+')');
  ok(gn.keyedOk,'the printed key line always matches the highlighted choice(s) (or says the question was cancelled)');
  ok(gn.thoracic&&gn.thoracic.n===4&&gn.thoracic.key.join()==='D'&&/ISK 101/.test(gn.thoracic.why),'g2_axart-14: 4 choices, printed key D highlighted, reason cites the department book');
  ok(gn.ulnar&&gn.ulnar.n===4&&gn.ulnar.key.join()==='A'&&/مقطوع/.test(gn.ulnar.why),'g2_medulnar-22: 4 choices, printed key A highlighted, reason explains the cut option');
  ok(!gn.overflow,'no horizontal scroll with the choices listed');
  await a.click('.chips .tog:nth-child(3)'); await a.waitForTimeout(300);
  ok(await a.evaluate(()=>document.querySelectorAll('.pp-i:not(.static)').length===16),'"last review" filter shows exactly the 16 new corrections');
  await a.click('.chips .tog:nth-child(2)'); await a.waitForTimeout(300);
  const hit=await a.evaluate(()=>({n:document.querySelectorAll('.pp-i:not(.static)').length,extra:document.querySelectorAll('.pp-sec').length}));
  ok(hit.n===1&&hit.extra===0,'"answered with old key" filter shows only that question and hides the lists below');

  /* موبايل + داكن */
  const mob=await mk(b,{vp:{width:390,height:844},dark:true,created:Date.parse('2026-11-10'),wait:200}); await mob.waitForSelector('.dlg-ann',{timeout:9000});
  const mo=await mob.evaluate(()=>{ const d=document.querySelector('.dlg-ann').getBoundingClientRect(); return {w:d.width,h:d.height,over:document.documentElement.scrollWidth>document.documentElement.clientWidth,vh:innerHeight}; });
  ok(mo.w<=390&&!mo.over,'announcement fits a 390px phone (no horizontal scroll)');
  if(process.env.SHOTS){ await mob.screenshot({path:process.env.SHOTS+'/fix-ann-mobile-dark.png'}); await mob.click('.dlg-ann .btn.primary'); await mob.waitForTimeout(700); await mob.screenshot({path:process.env.SHOTS+'/fix-page-mobile-dark.png',fullPage:true});
    const d=await mk(b,{created:Date.parse('2026-11-10'),wait:200,vp:{width:1280,height:900}}); await d.waitForSelector('.dlg-ann'); await d.screenshot({path:process.env.SHOTS+'/fix-ann-desktop.png'}); await d.click('.dlg-ann .btn.primary'); await d.waitForTimeout(700); await d.screenshot({path:process.env.SHOTS+'/fix-page-desktop.png',fullPage:true}); }

  console.log('errors',errs.length?errs.slice(0,4):'none'); ok(errs.length===0,'no page or console errors');
  await b.close(); console.log(fails?'FAILS '+fails:'ALL PASS'); process.exit(fails?1:0);
})();
function IM_ALL(pg){ return pg.items; }
