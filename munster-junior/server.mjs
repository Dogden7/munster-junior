import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {parse} from './data.mjs';
import {getDivision} from './divisions.mjs';
import {parseTeamsheet} from './teamsheets.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
export function createAppServer({fetchImpl=fetch,snapshotRoot=root}={}){
const caches=new Map(),requests=new Map();
async function load(division='1'){
 const competition=getDivision(division);
 let cache=caches.get(division);
 if(cache&&Date.now()-Date.parse(cache.checkedAt)<60000)return cache;
 if(requests.has(division))return requests.get(division);
 const inflight=(async()=>{try{
  const r=await fetchImpl(competition.source,{signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw new Error('Source HTTP '+r.status);
  cache=parse(await r.text(),division);
  caches.set(division,cache);
  await writeFile(snapshotRoot+competition.snapshot,JSON.stringify(cache));
  return cache;
 }catch(e){
  if(!cache)try{
   const saved=JSON.parse(await readFile(snapshotRoot+competition.snapshot,'utf8'));
   if(saved.source===competition.source&&(!saved.division||saved.division===division))cache=saved;
  }catch{}
  if(cache)return {...cache,stale:true,message:'Could not check SportLoMo. Showing the last saved data.'};
  throw e;
 }finally{requests.delete(division);}})();requests.set(division,inflight);return inflight;
}
const sheets=new Map(),sheetRequests=new Map();
async function loadSheet(id,division){
 const key=division+':'+id;
 const previous=sheets.get(key);
 if(previous&&Date.now()-Date.parse(previous.checkedAt)<60000)return previous;
 if(sheetRequests.has(key))return sheetRequests.get(key);
 const request=(async()=>{
  try{
   const league=await load(division);
   const match=league.matches.find(m=>m.fixtureId===id);
   if(!match)throw Error('Unknown fixture');
   const response=await fetchImpl('https://munsterrugby.sportlomo.com/wp-admin/admin-ajax.php',{method:'POST',body:new URLSearchParams({action:'fixtureInformation',id,hometeam:match.home,awayteam:match.away}),signal:AbortSignal.timeout(20000)});
   if(!response.ok)throw Error('Team sheet unavailable');
   const sheet={...parseTeamsheet(await response.text()),fixtureId:id,division,checkedAt:new Date().toISOString()};
   sheets.set(key,sheet);return sheet;
  }catch(error){if(previous)return {...previous,stale:true};throw error;}
  finally{sheetRequests.delete(key);}
 })();
 sheetRequests.set(key,request);return request;
}
return createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 const path=url.pathname;
 const division=url.searchParams.get('division')??'1';
 try{
  if(path==='/api/league'||path==='/api/teamsheet'){
   try{getDivision(division);}catch{res.writeHead(400);return res.end('Invalid division');}
  }
  if(path==='/api/teamsheet'){
   const id=url.searchParams.get('id');
   if(!/^\d{1,12}$/.test(id||'')){res.writeHead(400);return res.end('Invalid fixture');}
   const sheet=await loadSheet(id,division);res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify(sheet));
  }
  if(path==='/api/league'){const data=await load(division);res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify(data));}
  const files={'/icons/munster-share.png':'icons/munster-share.png','/':'index.html','/index.html':'index.html','/app.js':'app.js','/pwa.js':'pwa.js','/style.css':'style.css','/manifest.webmanifest':'manifest.webmanifest','/sw.js':'sw.js','/icons/icon-192.png':'icons/icon-192.png','/icons/icon-512.png':'icons/icon-512.png','/icons/icon-maskable-512.png':'icons/icon-maskable-512.png','/icons/apple-touch-icon.png':'icons/apple-touch-icon.png'};
  if(!files[path]){res.writeHead(404);return res.end('Not found');}
  const type=path.endsWith('.png')?'image/png':path.endsWith('.webmanifest')?'application/manifest+json':path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html';
  res.writeHead(200,{'Content-Type':type,'Cache-Control':path==='/sw.js'?'no-cache':'no-store'});res.end(await readFile(root+'public/'+files[path]));
 }catch(e){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'League data is temporarily unavailable. Please try again.'}));}
});
}
if(process.argv[1]===fileURLToPath(import.meta.url))createAppServer().listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Munster Junior app: http://localhost:'+(process.env.PORT||3000)));
