const CACHE='munster-junior-v16';
const BASE=new URL('./',self.location.href);
const SHELL=['./','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png','./icons/apple-touch-icon.png'].map(p=>new URL(p,BASE).href);
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('munster-junior-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})());});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==BASE.origin)return;
 if(url.pathname===new URL('api/league',BASE).pathname){
  event.respondWith((async()=>{
   const cache=await caches.open(CACHE);
   try{
    const response=await fetch(event.request);
    if(!response.ok)throw Error('Source unavailable');
    const data=await response.clone().json();
    if(!Array.isArray(data.matches)||!Array.isArray(data.table))throw Error('Invalid league data');
    if(!data.stale)await cache.put(event.request,response.clone());
    return response;
   }catch{
    const saved=await cache.match(event.request);
    if(!saved)return new Response(JSON.stringify({error:'Offline. No cached league update available.'}),{status:503,headers:{'Content-Type':'application/json'}});
    const data=await saved.json();
    return new Response(JSON.stringify({...data,stale:true,message:'Offline. Showing the last saved update.'}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
   }
  })());return;
 }
 if(event.request.mode==='navigate'&&url.pathname.startsWith(BASE.pathname)){
  event.respondWith((async()=>{try{const response=await fetch(event.request);if(!response.ok)throw Error();const cache=await caches.open(CACHE);await cache.put(BASE.href,response.clone());return response;}catch{return await caches.match(BASE.href)||new Response('Offline. Reconnect to load the app.',{status:503});}})());return;
 }
 if(SHELL.includes(url.href))event.respondWith(caches.match(event.request).then(saved=>saved||fetch(event.request)));
});
