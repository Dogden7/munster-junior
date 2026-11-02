import {getDivision} from './divisions.mjs';
export const SOURCE=getDivision('1').source;
export function clean(s=''){return s.replace(/<[^>]*>/g,'').replace(/&(?:amp|#38);/g,'&').replace(/&(?:quot|#34);/g,'"').replace(/&#0?39;|&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).trim();}
export function parse(html,division='1'){
 const competition=getDivision(division);
 const matches=[];
 for(const m of html.matchAll(/<ul\b([^>]*class="[^"]*table-body (?:fixtures|results)[^"]*"[^>]*)>/g)){
  const a=Object.fromEntries([...m[1].matchAll(/data-([\w-]+)="([^"]*)"/g)].map(x=>[x[1],clean(x[2])]));
  if(a.compname!==competition.name)continue;
  const end=html.indexOf('</ul>',m.index+m[0].length);
  const fixtureId=/data-fid="(\d+)"/.exec(html.slice(m.index,end))?.[1]||null;
  matches.push({fixtureId,id:[a.date,a.hometeam,a.awayteam].join('|'),date:a.date,time:a.time,home:a.hometeam,away:a.awayteam,homeScore:a.homescore,awayScore:a.awayscore,venue:a.venue,comment:a.comment,type:m[1].includes('table-body results')?'results':'fixtures'});
 }
 const tableBlock=[...html.matchAll(/<h3>([^<]*)<\/h3>\s*<table[\s\S]*?<\/table>/g)].find(m=>clean(m[1])==='League Table '+competition.name)?.[0];
 const table=[];
 for(const row of (tableBlock||'').matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)){
  const a=Object.fromEntries([...row[1].matchAll(/<td\b[^>]*data-title="([^"]+)"[^>]*>([\s\S]*?)<\/td>/g)].map(x=>[x[1],clean(x[2])]));
  if(a.Team)table.push({position:table.length+1,team:a.Team,played:a.Pld,won:a.W,drawn:a.D,lost:a.L,bonus:a.BP??'—',points:a.Pts});
 }
 if(!matches.length||!table.length)throw new Error('SportLoMo page format changed or league data is unavailable');
 return {division,matches:[...new Map(matches.map(x=>[x.id,x])).values()],table,source:competition.source,season:'2026–2027',checkedAt:new Date().toISOString()};
}
