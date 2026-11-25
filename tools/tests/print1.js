/* print1: the PDF booklet is fully English, structured, B/W-safe and cleans up after itself.
   Needs the test servers (8770). Real PDFs are rendered with Chromium's page.pdf(); pdftotext/pdftoppm (poppler) are used when present. */
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs=require('fs');
const URL=process.env.URL||'http://127.0.0.1:8770/index.html';
let fails=0; const ok=(c,m)=>{ console.log((c?'PASS ':'FAIL ')+m); if(!c) fails++; };
const AR=/[؀-ۿ]/;
function has(cmd){ try{ execFileSync('which',[cmd],{stdio:'ignore'}); return true; }catch(e){ return false; } }
async function mk(b,lang){
  const ctx=await b.newContext({viewport:{width:1100,height:900},acceptDownloads:true});
  await ctx.addInitScript((lang)=>{ try{ localStorage.setItem('im_lang',lang); localStorage.setItem('im_seen',JSON.stringify({'tour-v1':1,'ann-honor-1':1,'ann-fix-1120':1})); localStorage.setItem('im_user',JSON.stringify({name:'محمد سيف',v:1})); }catch(e){} },lang);
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
  await p.goto(URL); await p.waitForFunction(()=>window.IM&&IM.bank&&IM.bank.ready,{timeout:60000}); await p.waitForTimeout(700);
  return {ctx,p,errs};
}
(async()=>{
  const b=await chromium.launch();

  /* 1) the whole bank, every answer mode, notes on: not one Arabic character, no undefined/NaN */
  let {ctx,p,errs}=await mk(b,'ar');
  const whole=await p.evaluate(()=>{
    const out={};
    const ids=IM.bank.order.slice();
    ['end','inline','none'].forEach(mode=>{
      const d=IM.printDoc({sid:'all',title:'',ids,answers:mode,notes:true,name:''});
      const t=d.textContent;
      out[mode]={ar:/[؀-ۿ]/.test(t), bad:/undefined|NaN|\[object|null/.test(t), q:d.querySelectorAll('.pd-q').length, cells:d.querySelectorAll('.pd-kt tr.a td:not(.pd-pad)').length,
        cards:d.querySelectorAll('.pd-nc').length, ticks:d.querySelectorAll('.pd-opt.ok').length, secs:d.querySelectorAll('.pd-sec').length, idxRows:d.querySelectorAll('.pd-idx tbody tr:not(.pd-part):not(.pd-subj)').length, cover:!!d.querySelector('.pd-cover'), lang:d.getAttribute('lang'), notr:d.hasAttribute('data-notr')};
    });
    out.n=ids.length; return out;
  });
  console.log(JSON.stringify(whole));
  for(const m of ['end','inline','none']){ const w=whole[m];
    ok(!w.ar,'['+m+'] whole bank ('+whole.n+' questions): no Arabic character anywhere in the booklet');
    ok(!w.bad,'['+m+'] no undefined / NaN / null leaked into the text');
    ok(w.q===whole.n,'['+m+'] one block per question ('+w.q+')');
    ok(w.secs===w.idxRows,'['+m+'] contents rows = section headers ('+w.secs+')');
    ok(w.cover&&w.lang==='en'&&w.notr,'['+m+'] cover present, lang=en, i18n-protected'); }
  ok(whole.end.cells===whole.n,'answer key has one answer cell per question ('+whole.end.cells+')');
  ok(whole.inline.cells===0&&whole.inline.ticks>=whole.n-5,'inline mode: no key table, correct options ticked ('+whole.inline.ticks+')');
  ok(whole.none.cells===0&&whole.none.cards===0&&whole.none.ticks===0,'exam-paper mode: no answers, no notes, nothing ticked');
  ok(whole.end.cards>=30&&whole.end.cards===whole.inline.cards,'key notes: one card per flagged question ('+whole.end.cards+')');

  /* 2) dialog -> print flow in the Arabic site (Arabic student name must NOT land on an English cover) */
  const flow=async(pg,lang)=>{
    await pg.evaluate(()=>{ window.__printed=null; window.print=function(){ window.__printed={printing:document.body.classList.contains('printing'),pd:!!document.querySelector('#printRoot .pd'),title:document.title,text:(document.querySelector('#printRoot .pd')||{textContent:''}).textContent}; setTimeout(function(){ window.dispatchEvent(new Event('afterprint')); },30); }; });
    await pg.evaluate(()=>IM.printDialog({sid:'anatomy',count:12,secs:null,groups:null}));
    await pg.waitForSelector('.ov input.field-i');
    const f=await pg.evaluate(()=>{ const ins=[...document.querySelectorAll('.ov input.field-i')]; return {title:ins[0].value,name:ins[1].value,dirs:[ins[0].dir,ins[1].dir],labels:[...document.querySelectorAll('.ov .label')].map(x=>x.textContent)}; });
    ok(f.title==='Anatomy · Questions','['+lang+'] default title is English ("'+f.title+'")');
    ok(f.name==='','['+lang+'] an Arabic student name is not pre-filled on the English cover');
    ok(f.dirs[0]==='ltr','['+lang+'] title/name fields are left-to-right');
    if(lang==='en') ok(f.labels.some(x=>/File title \(in English\)/.test(x))&&f.labels.some(x=>/Student name on the cover/.test(x)),'[en] dialog labels are translated ('+f.labels.join(' | ')+')');
    await pg.fill('.ov input.field-i >> nth=0','Anatomy: Week 1 / Quiz?');
    await pg.fill('.ov input.field-i >> nth=1','Mohamed Saif');
    await pg.click('.ov .btn.primary');
    await pg.waitForFunction(()=>window.__printed,{timeout:8000});
    const r=await pg.evaluate(()=>window.__printed);
    ok(r.printing&&r.pd,'['+lang+'] print starts with the booklet mounted and body.printing set');
    ok(r.title==='Anatomy Week 1 Quiz','['+lang+'] file name proposed to the browser is clean ("'+r.title+'")');
    ok(!AR.test(r.text)&&/Prepared for/.test(r.text)&&/Mohamed Saif/.test(r.text),'['+lang+'] English booklet with the typed name');
    await pg.waitForTimeout(200);
    const after=await pg.evaluate(()=>({printing:document.body.classList.contains('printing'),root:document.getElementById('printRoot').children.length,title:document.title,ov:!!document.querySelector('.ov')}));
    ok(!after.printing&&after.root===0,'['+lang+'] after printing: print mode off and print root emptied');
    ok(after.title!=='Anatomy Week 1 Quiz','['+lang+'] page title restored ("'+after.title+'")');
    ok(!after.ov,'['+lang+'] dialog closed');
  };
  await flow(p,'ar');
  await ctx.close();
  const en=await mk(b,'en'); await flow(en.p,'en'); errs.push(...en.errs); await en.ctx.close();

  /* 3) a real PDF: page furniture, no Arabic, nothing coloured except the logo */
  ({ctx,p}=await mk(b,'ar'));
  await p.evaluate(()=>{ const ids=IM.bank.subs.anatomy.qids.slice(0,25).concat(IM.bank.order.filter(id=>IM.bank.q[id].fix).slice(0,3)); const d=IM.printDoc({sid:'anatomy',title:'Anatomy · Questions',ids,answers:'end',notes:true,name:'Mohamed Saif'}); let r=document.getElementById('printRoot'); if(!r){ r=document.createElement('div'); r.id='printRoot'; document.body.appendChild(r); } r.innerHTML=''; r.appendChild(d); document.body.classList.add('printing'); });
  await p.emulateMedia({media:'print'});
  const pdf='/tmp/print1.pdf'; await p.pdf({path:pdf,format:'A4',printBackground:true,preferCSSPageSize:true});
  ok(fs.statSync(pdf).size>20000,'PDF rendered ('+fs.statSync(pdf).size+' bytes)');
  if(has('pdftotext')&&has('pdftoppm')){
    const pages=execFileSync('pdfinfo',[pdf]).toString().match(/Pages:\s+(\d+)/)[1]|0;
    const txt=n=>execFileSync('pdftotext',['-f',String(n),'-l',String(n),'-layout',pdf,'-']).toString();
    ok(pages>=5,'PDF pages: '+pages);
    ok(!/Page\s*1\b/.test(txt(1))&&!/ANATOMY\s+·\s+QUESTIONS/i.test(txt(1).replace(/Anatomy · Questions/,'')),'cover has no running header / page number');
    ok(/Page 2/.test(txt(2))&&/Made By Dr\.Saif Youssry/.test(txt(2)),'page 2 has the footer credit and page number');
    ok(/25 November 2026|\d{1,2} \w+ 20\d\d/i.test(txt(2)),'running header carries an English date (reads left-to-right)');
    let all=''; for(let i=1;i<=pages;i++) all+=txt(i);
    ok(!AR.test(all),'no Arabic text in the rendered PDF');
    ok(/ANSWER KEY/i.test(all)&&/NOTES ON KEYS/i.test(all)&&/Approved key/i.test(all),'answer key and notes sections are present');
    /* grayscale safety: after the cover, every pixel is neutral (R≈G≈B), so nothing depends on colour */
    let worst=0;
    for(let i=2;i<=pages;i++){
      const ppm=execFileSync('pdftoppm',['-r','30','-f',String(i),'-l',String(i),pdf],{maxBuffer:1<<26});
      let o=0,nl=0; while(nl<3){ if(ppm[o++]===10) nl++; }
      for(let k=o;k+2<ppm.length;k+=3){ const d=Math.max(ppm[k],ppm[k+1],ppm[k+2])-Math.min(ppm[k],ppm[k+1],ppm[k+2]); if(d>worst) worst=d; }
    }
    ok(worst<=12,'pages after the cover are neutral gray (max channel spread '+worst+') — photocopies identically in black & white');
  } else console.log('SKIP poppler not installed: PDF text / grayscale checks');
  await ctx.close();

  errs.forEach(e=>console.log('ERR',e)); ok(errs.length===0,'no page errors');
  await b.close();
  console.log(fails?('FAILED '+fails):'ALL PASS'); process.exit(fails?1:0);
})();
