import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createAppServer} from './server.mjs';
import {DIVISIONS} from './divisions.mjs';
import {parse} from './data.mjs';

function page(division,id){
 const name=DIVISIONS[division].name,team=division==='1'?'First Club':'South Club';
 return '<h3>League Table '+name+'</h3><table><tr><td data-title="Team">'+team+'</td><td data-title="Pts">8</td></tr></table>'+
 '<ul class="table-body results" data-compname="'+name+'" data-date="30 Oct 2026" data-hometeam="'+team+'" data-awayteam="Visitors" data-homescore="26 (4 3)" data-awayscore="21 (3 3)"><li data-fid="'+id+'"></li></ul>';
}
test('each league parses only its own table, results and fixture IDs',()=>{
 const html=page('1','123')+page('south-junior-2','456');
 for(const [division,id,team] of [['1','123','First Club'],['south-junior-2','456','South Club']]){
  const data=parse(html,division);
  assert.equal(data.table.length,1);assert.equal(data.table[0].team,team);
  assert.equal(data.matches.length,1);assert.equal(data.matches[0].fixtureId,id);
  assert.equal(data.matches[0].homeScore,'26 (4 3)');assert.equal(data.source,DIVISIONS[division].source);
 }
 assert.throws(()=>parse(html,'2'));
});
test('API caches and saved fallback stay separate; team sheets use the selected league',async t=>{
 const directory=await mkdtemp(tmpdir()+'/munster-leagues-'),snapshotRoot=directory+'/';
 let offline=false;
 const calls=[];
 const fetchImpl=async(url,options)=>{
  if(offline)throw Error('Offline');
  calls.push(url);
  if(options?.method==='POST'){
   assert.equal(options.body.get('id'),'456');assert.equal(options.body.get('hometeam'),'South Club');
   return new Response('<div class="team_sheets_data"><ul class="hometeam_ul"><li><b>1</b>South Player</li></ul><ul class="awyteam_ul"><li><b>2</b>Away Player</li></ul></div>');
  }
  return new Response(url===DIVISIONS['1'].source?page('1','123'):page('south-junior-2','456'));
 };
 const servers=[];
 t.after(async()=>{for(const server of servers){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await rm(directory,{recursive:true,force:true});});
 async function start(){const server=createAppServer({fetchImpl,snapshotRoot});servers.push(server);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return 'http://127.0.0.1:'+server.address().port;}
 const base=await start();
 const [first,south]=await Promise.all(['1','south-junior-2'].map(async division=>(await fetch(base+'/api/league?division='+division)).json()));
 assert.equal(first.table[0].team,'First Club');assert.equal(south.table[0].team,'South Club');
 await fetch(base+'/api/league?division=1');assert.equal(calls.length,2);
 assert.equal((await fetch(base+'/api/league?division=2')).status,400);
 const sheet=await (await fetch(base+'/api/teamsheet?division=south-junior-2&id=456')).json();
 assert.equal(sheet.home[0].name,'South Player');assert.equal(sheet.division,'south-junior-2');
 assert.equal((await fetch(base+'/api/teamsheet?division=1&id=456')).status,503);
 offline=true;
 const fallback=await start();
 for(const division of ['1','south-junior-2']){
  const result=await (await fetch(fallback+'/api/league?division='+division)).json();
  assert.equal(result.stale,true);assert.equal(result.division,division);
 }
 // A misplaced saved file must never show another competition's results.
 await writeFile(snapshotRoot+DIVISIONS['south-junior-2'].snapshot,await readFile(snapshotRoot+DIVISIONS['1'].snapshot));
 const invalidFallback=await start();
 assert.equal((await fetch(invalidFallback+'/api/league?division=south-junior-2')).status,503);
});
