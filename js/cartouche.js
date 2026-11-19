/* Imhotep · إمحتب — رسم الخراطيش الستة (SVG بالكود) + عرضها + تصديرها كصورة PNG.
   كل مرحلة ليها شكل ومادة وزخارف مختلفة، مش مجرد لون. */
(function(){
'use strict';
var IM=window.IM, h=IM.h;
var uid=0;

/* ألوان الاسم جوه الخرطوشة لكل مرحلة */
var THEME=[null,
  {ink:'#3B2A14',sub:'#7A5B2E',fill:'#F3E6C2'},
  {ink:'#12204A',sub:'#3C5088',fill:'#F2EAD2'},
  {ink:'#12204A',sub:'#6A5420',fill:'#F6EBCB'},
  {ink:'#3A2A06',sub:'#7A5A12',fill:'#FBF0CF'},
  {ink:'#F6DD8A',sub:'#C9D8F5',fill:'#0F2147'},
  {ink:'#FFEFB8',sub:'#F6DD8A',fill:'#0A1630'}];
IM.cartoTheme=function(n){ return THEME[n]||THEME[1]; };

function defs(u){
  var g=function(id,a,b,c){ return '<linearGradient id="'+u+id+'" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="'+a+'"/>'+(c?'<stop offset=".5" stop-color="'+b+'"/><stop offset="1" stop-color="'+c+'"/>':'<stop offset="1" stop-color="'+b+'"/>')+'</linearGradient>'; };
  return '<defs>'+g('c','#DDB278','#9A6A33')+g('l','#2F63C4','#12296B')+g('g','#FBE9A6','#E2B445','#A97716')+g('t','#6FE0D1','#1B9488')+
    '<radialGradient id="'+u+'r" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFE9A8" stop-opacity=".55"/><stop offset="1" stop-color="#FFE9A8" stop-opacity="0"/></radialGradient>'+
    '<radialGradient id="'+u+'v" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#274a8f" stop-opacity=".55"/><stop offset="1" stop-color="#0a1630" stop-opacity="0"/></radialGradient>'+
    '<linearGradient id="'+u+'s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'+
    '<clipPath id="'+u+'k"><rect x="52" y="80" width="296" height="120" rx="60"/></clipPath></defs>';
}
function rect(x,y,w,hh,r,extra){ return '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+hh+'" rx="'+r+'" '+extra+'/>'; }
function bar(fill,center){ return rect(364,100,10,80,5,'fill="'+fill+'"')+(center?rect(367,116,4,48,2,'fill="'+center+'"'):''); }

function frame(n,u){
  var s='';
  if(n===1){
    s+=rect(44,72,312,136,68,'fill="none" stroke="url(#'+u+'c)" stroke-width="8"')+rect(60,88,280,104,52,'fill="none" stroke="#7B5427" stroke-width="1.5" opacity=".55"')+bar('url(#'+u+'c)');
  }else if(n===2){
    s+=rect(44,72,312,136,68,'fill="none" stroke="url(#'+u+'l)" stroke-width="9"')+rect(59,87,282,106,53,'fill="none" stroke="url(#'+u+'g)" stroke-width="2"')+bar('url(#'+u+'l)','url(#'+u+'g)');
  }else if(n===3){
    s+=rect(38,66,324,148,74,'fill="none" stroke="url(#'+u+'g)" stroke-width="2.5"')+rect(44,72,312,136,68,'fill="none" stroke="url(#'+u+'l)" stroke-width="9"')+rect(59,87,282,106,53,'fill="none" stroke="url(#'+u+'g)" stroke-width="2.5"')+bar('url(#'+u+'g)','url(#'+u+'l)');
  }else if(n===4){
    s+=rect(44,72,312,136,68,'fill="none" stroke="url(#'+u+'g)" stroke-width="10"')+rect(60,88,280,104,52,'fill="none" stroke="url(#'+u+'l)" stroke-width="4"')+rect(66,94,268,92,46,'fill="none" stroke="url(#'+u+'g)" stroke-width="1.5"')+bar('url(#'+u+'g)','url(#'+u+'l)');
  }else{
    s+=rect(44,72,312,136,68,'fill="none" stroke="url(#'+u+'g)" stroke-width="10"')+rect(60,88,280,104,52,'fill="none" stroke="url(#'+u+'l)" stroke-width="4"')+
       rect(67,95,266,90,45,'fill="none" stroke="url(#'+u+'t)" stroke-width="5" stroke-dasharray="0 11" stroke-linecap="round"')+bar('url(#'+u+'g)','url(#'+u+'t)');
    if(n===6){
      s+=rect(36,64,328,152,76,'fill="none" stroke="url(#'+u+'g)" stroke-width="3"')+rect(29,57,342,166,83,'fill="none" stroke="url(#'+u+'g)" stroke-width="4" stroke-dasharray="0 13" stroke-linecap="round" opacity=".9"');
    }
  }
  return s;
}

/* زخارف أعلى الخرطوشة */
function lotus(u,fill,stroke,cy,sc){
  var petal='M0 -34C-10 -20 -10 -4 0 8C10 -4 10 -20 0 -34Z';
  return '<g transform="translate(200 '+cy+') scale('+sc+')"><g fill="url(#'+u+fill+')" stroke="url(#'+u+stroke+')" stroke-width="2" stroke-linejoin="round">'+
    '<path d="'+petal+'" transform="rotate(-48) scale(.82)"/><path d="'+petal+'" transform="rotate(48) scale(.82)"/><path d="'+petal+'"/></g>'+
    '<path d="M-26 8Q0 18 26 8" fill="none" stroke="url(#'+u+stroke+')" stroke-width="2.4" stroke-linecap="round"/></g>';
}
function uraeus(u,side){
  return '<g transform="scale('+side+' 1)"><path d="M27 20C27 8 33 4 31 -6" fill="none" stroke="url(#'+u+'g)" stroke-width="5" stroke-linecap="round"/>'+
    '<ellipse cx="31" cy="-8" rx="6" ry="9" fill="url(#'+u+'g)" stroke="#8A5E10" stroke-width="1.2"/><circle cx="31" cy="-19" r="4" fill="url(#'+u+'g)" stroke="#8A5E10" stroke-width="1.2"/></g>';
}
function emblem(n,u){
  if(n===1){
    return '<g transform="translate(200 48)"><rect x="-34" y="-12" width="68" height="24" rx="12" fill="#F6E7BE" stroke="#8A6A3A" stroke-width="2"/>'+
      '<circle cx="-22" cy="0" r="7" fill="none" stroke="#8A6A3A" stroke-width="2"/><path d="M-10 -5H26M-10 0H26M-10 5H18" stroke="#8A6A3A" stroke-width="1.6" stroke-linecap="round"/>'+
      '<path d="M24 -27L41 -7" stroke="#6B4A22" stroke-width="3" stroke-linecap="round"/><path d="M41 -7L35 -3L43 -4Z" fill="#6B4A22"/></g>';
  }
  if(n===2) return lotus(u,'l','g',56,1);
  if(n===3) return lotus(u,'g','l',54,1.08)+'<g fill="url(#'+u+'g)" stroke="#8A5E10" stroke-width="1"><path d="M146 52l6 -8l6 8l-6 8z"/><path d="M242 52l6 -8l6 8l-6 8z"/></g><g fill="url(#'+u+'l)"><circle cx="166" cy="52" r="3.5"/><circle cx="234" cy="52" r="3.5"/></g>';
  if(n===4){
    return '<g transform="translate(200 44)"><circle r="17" fill="url(#'+u+'g)" stroke="#8A5E10" stroke-width="1.5"/><circle r="9" fill="#FFF2B8" opacity=".75"/>'+uraeus(u,-1)+uraeus(u,1)+'</g>';
  }
  var wing='M14 -2C48 -16 92 -16 128 -4C104 -4 96 2 86 6C76 4 66 6 56 10C44 8 30 8 14 10Z', ft='M30 0C60 -6 90 -6 116 -2M32 4C62 -1 88 -1 106 2M36 8C58 4 76 4 90 6';
  var w='<path d="'+wing+'" fill="url(#'+u+'g)" stroke="#8A5E10" stroke-width="1.4" stroke-linejoin="round"/><path d="'+ft+'" fill="none" stroke="url(#'+u+'l)" stroke-width="2" stroke-linecap="round"/>';
  return '<g transform="translate(200 44)"><g>'+w+'</g><g transform="scale(-1 1)">'+w+'</g><circle r="14" fill="url(#'+u+'g)" stroke="#8A5E10" stroke-width="1.5"/><circle r="7" fill="#FFF2B8" opacity=".8"/></g>';
}
function pyramid(u){
  var s='<g stroke="#8A5E10" stroke-width=".8">', w=[72,58,44,30,16], i;
  for(i=0;i<w.length;i++) s+='<rect x="'+(200-w[i]/2)+'" y="'+(241-(i+1)*6)+'" width="'+w[i]+'" height="6" fill="url(#'+u+'g)"/>';
  return s+'</g><circle cx="200" cy="207" r="3" fill="url(#'+u+'t)"/>';
}
function eye(u,x,flip){
  return '<g transform="translate('+x+' 38) scale('+(flip?-0.95:0.95)+' 0.95)" fill="none" stroke="url(#'+u+'g)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'+
    '<path d="M-17 0C-8 -9 8 -9 17 0C8 8 -8 8 -17 0Z"/><circle r="4" fill="url(#'+u+'t)" stroke="none"/><path d="M-17 -6C-8 -15 8 -15 17 -6"/><path d="M-4 8C-4 15 -11 17 -13 12M4 8V17"/></g>';
}
function star(x,y,d,s){ return '<path class="ct-sp" style="animation-delay:'+d+'s" transform="translate('+x+' '+y+') scale('+s+')" d="M0 -7L1.6 -1.6L7 0L1.6 1.6L0 7L-1.6 1.6L-7 0L-1.6 -1.6Z" fill="url(#UID)"/>'; }
function rays(u){
  var s='<ellipse cx="200" cy="125" rx="196" ry="122" fill="url(#'+u+'r)"/><g stroke="url(#'+u+'g)" stroke-linecap="round" opacity=".55">', i, a, r1=112, r2;
  for(i=0;i<40;i++){ a=i*9*Math.PI/180; r2=(i%2)?150:196; s+='<line x1="'+(200+r1*Math.cos(a)).toFixed(1)+'" y1="'+(140+r1*0.55*Math.sin(a)).toFixed(1)+'" x2="'+(200+r2*Math.cos(a)).toFixed(1)+'" y2="'+(140+r2*0.55*Math.sin(a)).toFixed(1)+'" stroke-width="'+(i%2?1.6:2.6)+'"/>'; }
  return s+'</g>';
}

/* الخرطوشة كـSVG نص. o.px = عرض بالبكسل (للتصدير)، o.calm = من غير حركة */
IM.cartoArt=function(n,o){
  o=o||{}; n=Math.max(1,Math.min(6,n||1)); var u='ct'+(++uid)+'-', T=THEME[n];
  var calm=o.calm||document.documentElement.classList.contains('calm')||(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
  var s='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 250"'+(o.px?' width="'+o.px+'" height="'+Math.round(o.px*0.625)+'"':'')+' aria-hidden="true" focusable="false">'+defs(u);
  if(n===6) s+=rays(u);
  s+=rect(52,80,296,120,60,'fill="'+T.fill+'"');
  if(n>=5) s+=rect(52,80,296,120,60,'fill="url(#'+u+'v)"');
  s+=frame(n,u)+emblem(n,u);
  if(n>=5) s+=pyramid(u);
  if(n===6){
    s+=eye(u,112,false)+eye(u,288,true);
    s+=star(44,40,0,1.1)+star(356,40,.7,1.1)+star(26,150,1.3,.9)+star(374,150,.4,.9)+star(64,226,1.9,.8)+star(336,226,1.1,.8);
    if(!calm) s+='<g clip-path="url(#'+u+'k)"><rect x="-120" y="76" width="90" height="128" fill="url(#'+u+'s)" transform="skewX(-18)"><animate attributeName="x" from="-120" to="480" dur="5s" begin="1s" repeatCount="indefinite"/></rect></g>';
  }
  s=s.replace(/url\(#UID\)/g,'url(#'+u+'g)');
  return s+'</svg>';
};

/* عرض الخرطوشة (HTML): الرسم + الاسم فوقه بخط الموقع */
IM.cartoView=function(n,o){
  o=o||{}; n=Math.max(1,Math.min(6,n||1)); var T=THEME[n], name=o.name||'';
  var el=h('div.ct.ct-'+n+(o.locked?'.locked':'')+(o.small?'.sm':'')+(o.cls?'.'+o.cls:''),{role:o.label?'img':null,'aria-label':o.label||null});
  el.style.setProperty('--ct-ink',T.ink); el.style.setProperty('--ct-sub',T.sub);
  el.innerHTML=IM.cartoArt(n,o);
  var len=Array.from(name).length;
  el.appendChild(h('div.ct-t',{},h('div.ct-n.display'+(len>22?'.xl':(len>13?'.long':'')),{text:name}),o.sub?h('div.ct-s',{text:o.sub}):null));
  if(o.locked) el.appendChild(h('span.ct-lock',{},IM.icon('lock',o.small?14:22)));
  return el;
};

/* ---------- صورة للمشاركة (PNG 1080×1350) ---------- */
function loadImg(url){ return new Promise(function(res,rej){ var im=new Image(); im.onload=function(){ res(im); }; im.onerror=rej; im.src=url; }); }
function fit(ctx,txt,max,size,font){ var s=size; ctx.font=font(s); while(ctx.measureText(txt).width>max&&s>28){ s-=3; ctx.font=font(s); } return s; }
IM.cartoPNG=function(){
  var C=IM.st.carto, n=C.tier; if(!n) return Promise.reject(new Error('no tier'));
  var L=IM.level(), S=IM.STAGES[n-1], T=THEME[n], name=(IM.st.user&&IM.st.user.name)||'';
  var fonts=['"Reem Kufi"','"IBM Plex Sans Arabic"','"Marcellus"','"IBM Plex Mono"'];
  var ready=Promise.all(fonts.map(function(f){ return document.fonts&&document.fonts.load?document.fonts.load('600 40px '+f).catch(function(){}):null; }));
  var blob=new Blob([IM.cartoArt(n,{px:880,calm:true})],{type:'image/svg+xml;charset=utf-8'}), url=URL.createObjectURL(blob);
  return Promise.all([ready,loadImg(url)]).then(function(r){
    URL.revokeObjectURL(url);
    var img=r[1], W=1080, H=1350, cv=document.createElement('canvas'); cv.width=W; cv.height=H; var x=cv.getContext('2d');
    var DISP=function(s){ return '600 '+s+'px "Reem Kufi","IBM Plex Sans Arabic",system-ui,sans-serif'; };
    var BODY=function(s){ return '500 '+s+'px "IBM Plex Sans Arabic",system-ui,sans-serif'; };
    var LAT=function(s){ return '400 '+s+'px "Marcellus","Reem Kufi",Georgia,serif'; };
    var MONO=function(s){ return '500 '+s+'px "IBM Plex Mono",ui-monospace,Menlo,monospace'; };
    var g=x.createLinearGradient(0,0,0,H); g.addColorStop(0,'#0B1730'); g.addColorStop(1,'#13264A'); x.fillStyle=g; x.fillRect(0,0,W,H);
    var gl=x.createRadialGradient(W/2,470,40,W/2,470,620); gl.addColorStop(0,'rgba(246,221,138,.20)'); gl.addColorStop(1,'rgba(246,221,138,0)'); x.fillStyle=gl; x.fillRect(0,0,W,H);
    x.strokeStyle='rgba(226,180,69,.55)'; x.lineWidth=3; x.strokeRect(30,30,W-60,H-60); x.strokeStyle='rgba(226,180,69,.25)'; x.lineWidth=1.5; x.strokeRect(46,46,W-92,H-92);
    x.textAlign='center'; x.textBaseline='alphabetic';
    x.direction='ltr'; x.fillStyle='#E2B445'; x.font=LAT(30); if('letterSpacing' in x) x.letterSpacing='10px'; x.fillText('IMHOTEP',W/2,118); if('letterSpacing' in x) x.letterSpacing='0px';
    x.direction='rtl'; x.fillStyle='#F6EEDA'; x.font=DISP(64); x.fillText('إمحتب',W/2,196);
    var ax=(W-880)/2, ay=250; x.drawImage(img,ax,ay,880,550);
    /* name inside the cartouche */
    var cy=ay+550*(140/250); x.fillStyle=T.ink; x.direction='rtl'; var fs=fit(x,name,540,92,DISP); x.font=DISP(fs); x.fillText(name,W/2,cy+fs*0.12);
    x.fillStyle=T.sub; x.direction='ltr'; x.font=LAT(30); if('letterSpacing' in x) x.letterSpacing='6px'; x.fillText(IM.stageName(S),W/2,cy+fs*0.12+52); if('letterSpacing' in x) x.letterSpacing='0px';
    /* stage */
    x.direction='ltr'; x.fillStyle='#F6DD8A'; var f2=fit(x,IM.stageName(S),880,84,LAT); x.font=LAT(f2); x.fillText(IM.stageName(S),W/2,896);
    x.direction='rtl'; x.fillStyle='#F6EEDA'; x.font=DISP(50); x.fillText(IM.stageAr(S),W/2,962);
    /* stat boxes */
    var boxes=[['مؤشر إمحتب',L.idx+' / 100',false],['XP',String(L.xp.toLocaleString('en-US')),false],[(IM.boardSerial&&IM.boardSerial())?'الرقم':'الكود',(IM.boardSerial&&IM.boardSerial())||C.code||'—',true]], bw=300, gap=30, bx=(W-(bw*3+gap*2))/2, by=1020;
    boxes.forEach(function(b,i){
      var px=bx+i*(bw+gap); x.fillStyle='rgba(255,255,255,.06)'; x.strokeStyle='rgba(226,180,69,.45)'; x.lineWidth=2;
      x.beginPath(); if(x.roundRect) x.roundRect(px,by,bw,128,18); else x.rect(px,by,bw,128); x.fill(); x.stroke();
      x.direction='rtl'; x.fillStyle='#B8C4DE'; x.font=BODY(26); x.fillText(b[0],px+bw/2,by+42);
      x.direction='ltr'; x.fillStyle='#F6DD8A'; x.font=b[2]?MONO(36):DISP(56); x.fillText(b[1],px+bw/2,by+100);
    });
    /* achievements */
    x.direction='rtl'; x.fillStyle='#DCE4F5'; x.font=BODY(30);
    var sealTxt=L.sealsOf?(L.seals+' من '+L.sealsOf+' أختام'):'';
    x.fillText('ثبّت '+L.secured.toLocaleString('en-US')+' سؤال  ·  '+L.litAll+' يوم شروق'+(sealTxt?'  ·  '+sealTxt:''),W/2,1214);
    x.fillStyle='#8FA0C6'; x.font=BODY(24); x.fillText('من هنا بدأ الطب',W/2,1272);
    x.fillStyle='#6F82AD'; x.font=BODY(20); x.fillText('خرطوشة تحفيزية بتتحسب على الجهاز من التقدّم المسجّل. مش شهادة رسمية.',W/2,1306);
    return new Promise(function(res,rej){ cv.toBlob(function(b){ b?res(b):rej(new Error('blob')); },'image/png'); });
  });
};
IM.cartoSave=function(blob,share){
  var code=(IM.st.carto.code||'imhotep').replace(/[^A-Z0-9-]/gi,''), file;
  try{ file=new File([blob],'imhotep-cartouche-'+code+'.png',{type:'image/png'}); }catch(e){ file=null; }
  if(share&&file&&navigator.canShare&&navigator.canShare({files:[file]})&&navigator.share){
    return navigator.share({files:[file],title:'خرطوشتي في إمحتب',text:'خرطوشتي في إمحتب'}).catch(function(e){ if(e&&e.name==='AbortError') return; throw e; });
  }
  var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='imhotep-cartouche-'+code+'.png'; document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },1500); return Promise.resolve();
};
})();
