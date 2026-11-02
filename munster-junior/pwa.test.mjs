import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const manifest=JSON.parse(await readFile(new URL('public/manifest.webmanifest',import.meta.url),'utf8'));
assert.equal(manifest.display,'standalone');
for(const icon of manifest.icons){
 const png=await readFile(new URL('public/'+icon.src,import.meta.url));
 assert.equal(png.readUInt32BE(16),Number(icon.sizes.split('x')[0]));
 assert.equal(png.readUInt32BE(20),Number(icon.sizes.split('x')[1]));
}
const handlers={},store=new Map();
const key=r=>typeof r==='string'?r:r.url;
const cache={addAll:async()=>{},put:async(r,v)=>store.set(key(r),v.clone()),match:async r=>store.get(key(r))?.clone()};
let online=true;
const context=vm.createContext({URL,Response,Array,JSON,Error,
 self:{location:{href:'https://example.test/sw.js'},clients:{claim:async()=>{}},addEventListener:(name,fn)=>handlers[name]=fn},
 caches:{open:async()=>cache,keys:async()=>[],delete:async()=>{},match:async r=>cache.match(r)},
 fetch:async req=>{if(!online)throw Error('Offline');return Response.json({matches:[{id:'match'}],table:[{team:key(req).includes('south-junior-2')?'South Club':'Bandon'}],checkedAt:'2026-10-05T12:00:00Z'});}
});
vm.runInContext(await readFile(new URL('public/sw.js',import.meta.url),'utf8'),context);
const request={url:'https://example.test/api/league',method:'GET'};
async function run(req){let p;handlers.fetch({request:req,respondWith:v=>p=v});return p;}
let response=await run(request);assert.equal((await response.json()).matches.length,1);
online=false;response=await run(request);const offline=await response.json();
assert.equal(offline.stale,true);assert.equal(offline.checkedAt,'2026-10-05T12:00:00Z');assert.equal(offline.matches.length,1);
online=true;
const southRequest={...request,url:'https://example.test/api/league?division=south-junior-2'};
await run(southRequest);online=false;
assert.equal((await (await run(southRequest)).json()).table[0].team,'South Club');
assert.equal((await (await run(request)).json()).table[0].team,'Bandon');
store.clear();response=await run(request);assert.equal(response.status,503);
store.set('https://example.test/',new Response('<h1>Saved app</h1>'));
response=await run({url:'https://example.test/',method:'GET',mode:'navigate'});assert.match(await response.text(),/Saved app/);
console.log('PWA checks passed: icon dimensions, live data caching, labelled offline fallback, empty-cache errors and offline navigation.');
