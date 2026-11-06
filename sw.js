/* Imhotep · إمحتب — offline layer. Cache-first for the app and the question files, so the site works without internet after the first visit.
   Bump VERSION when you replace any file so devices fetch the new ones. */
var VERSION='imhotep-v7';
var CORE=['./','index.html','manifest.webmanifest',
  'css/design.css','css/app.css','css/screens.css','css/book.css','css/print.css','css/tour.css','css/pages.css','css/cartouche.css',
  'js/core.js','js/fixes.js','js/bank.js','js/state.js','js/ui.js','js/home.js','js/workshop.js','js/session.js','js/result.js','js/report.js','js/papyrus.js','js/scales.js','js/library.js','js/printing.js','js/mixed.js','js/about.js','js/notify.js','js/level.js','js/cartouche.js','js/cartouche-page.js','js/tour.js','js/app.js',
  'subjects/anatomy/anatomy.content.js','subjects/anatomy/data.js','subjects/histology/histology.content.js','subjects/biochemistry/biochemistry.content.js','subjects/biochemistry/data.js',
  'assets/fonts/33e8a56e54ce.woff','assets/fonts/b92ac6badd05.woff','assets/icons/icon.svg','assets/icons/icon-192.png','assets/icons/icon-512.png'];
self.addEventListener('install',function(e){
  e.waitUntil(caches.open(VERSION).then(function(c){ return c.addAll(CORE); }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(ks){ return Promise.all(ks.filter(function(k){ return k!==VERSION; }).map(function(k){ return caches.delete(k); })); }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener('fetch',function(e){
  var r=e.request; if(r.method!=='GET') return;
  var u=new URL(r.url);
  var sameOrigin=u.origin===self.location.origin;
  var fonts=/(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(u.hostname);
  if(!sameOrigin&&!fonts) return;                      /* reports and everything else go straight to the network */
  e.respondWith(caches.open(VERSION).then(function(c){
    return c.match(r,{ignoreSearch:true}).then(function(hit){
      var net=fetch(r).then(function(res){ if(res&&(res.ok||res.type==='opaque')) c.put(r,res.clone()); return res; }).catch(function(){ return hit; });
      return hit||net;                                  /* cache first; refresh quietly in the background */
    });
  }));
});
