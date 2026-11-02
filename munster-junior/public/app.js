const $=s=>document.querySelector(s);
function saved(k,fallback){try{return JSON.parse(localStorage.getItem(k))??fallback;}catch{return fallback;}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}
const divisions=window.MJ_DIVISIONS;
let division=saved('mj-division','1');
if(!Object.hasOwn(divisions,division))division='1';
const storageKey=(name,id=division)=>'mj-'+name+'-division-'+id;
function savedData(id){
 const value=saved(storageKey('data',id),null)||(id==='1'?saved('mj-data',null):null);
 return value?.source===divisions[id].source?value:window.MJ_SNAPSHOTS?.[id]||null;
}
function savedClub(){return saved(storageKey('club'),division==='1'?saved('mj-club',''):'');}
let data=savedData(division),tab='results',club=savedClub(),busy=false,refreshVersion=0;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const short=s=>s.replace(/ RFC 1st XV$/,'');
function clubName(name){
 const logo=window.MJ_LOGOS?.[name]||window.MJ_LOGOS?.[name.replace(/ (?:2nd|3rd) XV$/,' 1st XV')];
 const initials=short(name).split(/\s+/).slice(0,2).map(w=>w[0]).join('');
 return '<span class="club-name">'+(logo?'<img class="club-crest" src="'+esc(logo)+'" alt="" width="36" height="36">':'<span class="club-initials" aria-hidden="true">'+esc(initials)+'</span>')+'<span>'+esc(short(name))+'</span></span>';
}
const clubOptions=table=>table.slice().sort((a,b)=>short(a.team).localeCompare(short(b.team),'en',{sensitivity:'base'})).map(r=>'<option value="'+esc(r.team)+'">'+esc(short(r.team))+'</option>').join('');
const score=s=>/^\d+/.exec(s)?.[0]||s||'—';
function scoreWithTries(raw){
 const points=score(raw);
 const tries=/\(\s*(\d+)/.exec(String(raw??''))?.[1];
 return esc(points)+(tries!==undefined?'<span class="try-count">('+esc(tries)+'T)</span>':'');
}
function resultScore(match){
 const home=score(match.homeScore),away=score(match.awayScore);
 const homeNumber=Number(home),awayNumber=Number(away);
 const comparable=/^\d+$/.test(home)&&/^\d+$/.test(away);
 const homeClass=comparable&&homeNumber!==awayNumber?(homeNumber>awayNumber?'score-win':'score-loss'):'score-draw';
 const awayClass=comparable&&homeNumber!==awayNumber?(awayNumber>homeNumber?'score-win':'score-loss'):'score-draw';
 return '<span class="'+homeClass+'">'+scoreWithTries(match.homeScore)+'</span> <span class="score-separator">–</span> <span class="'+awayClass+'">'+scoreWithTries(match.awayScore)+'</span>';
}
const openSheets=new Set();
let sheetData=saved(storageKey('teamsheets'),{});
const sheetBusy=new Set();
function sheetMarkup(match,sheet){
 const note=sheet.stale?'<p class="sheet-note">Live connection unavailable. Showing saved team sheet.</p>':'';
 const numbers=[...new Set([...sheet.home,...sheet.away].map(p=>p.number))].sort((a,b)=>a-b);
 const player=(players,number,team)=>{
  const entry=players.find(p=>p.number===number);
  return '<div class="sheet-player" aria-label="'+esc(short(team))+'"><b>'+esc(number)+'</b><span>'+esc(entry?.name||'—')+'</span></div>';
 };
 const missing=(!sheet.home.length||!sheet.away.length)?'<div class="sheet-row sheet-missing"><p>'+(!sheet.home.length?'Team sheet not yet published.':'')+'</p><p>'+(!sheet.away.length?'Team sheet not yet published.':'')+'</p></div>':'';
 let bench=false;
 return note+missing+'<div class="sheet-lineup">'+numbers.map(number=>{
  let divider='';if(number>15&&!bench){bench=true;divider='<h3 class="sheet-divider">Replacements</h3>';}
  return divider+'<div class="sheet-row">'+player(sheet.home,number,match.home)+player(sheet.away,number,match.away)+'</div>';
 }).join('')+'</div>';
}
async function fetchSheet(id){
 const selected=division,key=selected+':'+id;
 if(sheetBusy.has(key))return;sheetBusy.add(key);
 const match=data.matches.find(m=>m.fixtureId===id);
 try{
  const response=await fetch('/api/teamsheet?division='+selected+'&id='+encodeURIComponent(id),{signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw Error();
  const sheet=await response.json();
  if(!Array.isArray(sheet.home)||!Array.isArray(sheet.away))throw Error();
  if(division!==selected)return;
  sheetData[id]=sheet;if(!sheet.stale)save(storageKey('teamsheets'),sheetData);
  const panel=document.querySelector('[data-sheet="'+id+'"] .sheet-content');
  if(panel&&match)panel.innerHTML=sheetMarkup(match,sheet);
 }catch{
  if(division!==selected)return;
  const panel=document.querySelector('[data-sheet="'+id+'"] .sheet-content');
  if(panel)panel.innerHTML=sheetData[id]&&match?sheetMarkup(match,{...sheetData[id],stale:true}):'<p role="status">Unable to load team sheet. Close and reopen to retry.</p>';
 }finally{sheetBusy.delete(key);}
}
function render(){
 if(!data){$('#content').innerHTML='<p class="empty">Loading '+esc(divisions[division].label)+'…</p>';return;}
 if(tab==='table'){
  $('#content').innerHTML='<h2>The standings</h2><div class="table-wrap"><table><thead><tr>'+['#','Club','P','W','D','L','BP','Pts'].map(x=>'<th scope="col">'+x+'</th>').join('')+'</tr></thead><tbody>'+data.table.map(r=>'<tr class="'+(r.team===club?'favorite':'')+'"><td>'+esc(r.position)+'</td><td>'+clubName(r.team)+'</td>'+[r.played,r.won,r.drawn,r.lost,r.bonus,r.points].map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';return;
 }
 const items=data.matches.filter(m=>m.type===tab&&(!club||m.home===club||m.away===club)).sort((a,b)=>(Date.parse(a.date)-Date.parse(b.date))*(tab==='results'?-1:1));
 let date='';
 $('#content').innerHTML=items.length?items.map(m=>{let heading='';if(date!==m.date){date=m.date;heading='<h2>'+esc(date)+'</h2>';}
  return heading+'<article class="match"><div class="team">'+clubName(m.home)+'</div><div class="score">'+(tab==='results'?resultScore(m):esc(m.time||'TBC'))+'</div><div class="team away">'+clubName(m.away)+'</div><div class="meta">'+esc(m.venue||'Venue TBC')+(m.comment?' · '+esc(m.comment):'')+'</div>'+(tab==='results'&&m.fixtureId?'<details class="team-sheet" data-sheet="'+esc(m.fixtureId)+'"'+(openSheets.has(m.fixtureId)?' open':'')+'><summary>Team Sheet</summary><div class="sheet-content">'+(sheetData[m.fixtureId]?sheetMarkup(m,sheetData[m.fixtureId]):'<p role="status">Loading team sheet…</p>')+'</div></details>':'')+'</article>';
 }).join(''):'<p class="empty">No '+esc(tab)+' published for this selection.</p>';
}
$('#content').addEventListener('toggle',event=>{
 const details=event.target;
 if(!details.matches('details[data-sheet]'))return;
 const id=details.dataset.sheet;
 if(details.open){openSheets.add(id);fetchSheet(id);}else openSheets.delete(id);
},true);
async function refresh(){
 if(busy)return;busy=true;$('#refresh').disabled=true;$('#status').hidden=true;
 const selected=division,version=++refreshVersion;
 try{
  const r=await fetch('/api/league?division='+selected,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error();const next=await r.json();
  if(version!==refreshVersion)return;
  if(next.division!==selected||next.source!==divisions[selected].source||!Array.isArray(next.matches)||!Array.isArray(next.table)||!next.checkedAt)throw Error();
  if(!next.stale)save(storageKey('data'),next);data=next;
  updateClubPicker();
  $('#status').hidden=!next.stale;$('#status').textContent=next.stale?'Unable to check live results. Showing saved data.':'';render();for(const id of openSheets)fetchSheet(id);
 }catch{
  if(version!==refreshVersion)return;
  if(!data)data=savedData(selected);
  updateClubPicker();
  $('#status').hidden=false;$('#status').textContent=data?'Live connection unavailable. Showing saved results.':'Unable to load this league. Please try Refresh shortly.';render();
  if(!data)$('#content').innerHTML='<p class="empty">No saved data for this league. Reconnect and tap Refresh.</p>';
 }finally{if(version===refreshVersion){busy=false;$('#refresh').disabled=false;}}
}
$('#refresh').onclick=refresh;
$('#club').onchange=e=>{club=e.target.value;save(storageKey('club'),club);render();};
function updateClubPicker(){
 $('#club').innerHTML='<option value="">All clubs</option>'+clubOptions(data?.table||[]);
 $('#club').disabled=!data;
 if(data&&!data.table.some(r=>r.team===club))club='';
 $('#club').value=club;
}
function showDivision(){
 $('#division').value=division;
 $('.intro').textContent=divisions[division].label;
 document.title='Munster Junior Rugby • '+divisions[division].label;
 $('#source').href=divisions[division].source;
 updateClubPicker();render();
}
$('#division').onchange=e=>{
 division=e.target.value;save('mj-division',division);
 data=savedData(division);club=savedClub();sheetData=saved(storageKey('teamsheets'),{});openSheets.clear();
 busy=false;showDivision();refresh();
};
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;document.querySelectorAll('[data-tab]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
setInterval(()=>{if(!document.hidden)refresh();},300000);
showDivision();
refresh();
