// 問題と画面だけキャッシュする。DBへの通信はキャッシュしない
const CACHE='yappanese-n5-v2';
const FILES=['./','./index.html','./questions.json','./config.js',
             './manifest.json','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys()
    .then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  // Supabaseへの通信は必ずネットワークを使う
  if(u.hostname.endsWith('.supabase.co')) return;
  if(e.request.method!=='GET') return;
  e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request)));
});
