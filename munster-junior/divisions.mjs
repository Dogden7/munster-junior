export const DIVISIONS={
 '1':{name:'Junior League Division 1',label:'Junior Division 1',source:'https://munsterrugby.sportlomo.com/league/216469/',snapshot:'snapshot.json'},
 'south-junior-2':{name:'South - Junior 2 League',label:'South - Junior 2 League',source:'https://munsterrugby.sportlomo.com/league/219030/',snapshot:'snapshot-south-junior-2.json'}
};
export function getDivision(id='1'){
 if(!Object.hasOwn(DIVISIONS,id))throw new Error('Unknown division');
 return DIVISIONS[id];
}
