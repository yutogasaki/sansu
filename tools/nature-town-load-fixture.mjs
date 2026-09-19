import assert from 'node:assert/strict';

export function loadFixture(engine,population,chunks,id){
 const w=engine.newWorld(id);w.chunks=[];w.props=[];w.residents=[];w.hubMetrics=[];w.foodAccounting.initialized=0;
 for(let i=0;i<chunks;i++){
  const dx=(i%4)*16,dy=Math.floor(i/4)*16,c=engine.makeChunk([i%4,Math.floor(i/4)]);w.chunks.push(c);
  // Diagnostic repeated serviced neighborhoods; all-flat land and a local road loop.
  for(const cell of c.cells){cell.terrain='ground';cell.elevation=0;cell.moisture=.6;cell.path=cell.position[1]===dy+9||cell.position[0]===dx+10;}
  for(const [kind,x,y] of [['hub',8,8],['home',6,8],['home',4,8],['home',2,8],['home',6,6],['farm',10,8],['farm',10,6],['flowers',9,5],['tree',9,3]]){
   const p=engine.makeProp(`${i}:${kind}:${x}:${y}`,kind,[dx+x,dy+y]);if(kind==='home')p.hubId=`${i}:hub:8:8`;
   if('inventory'in p){p.inventory.food=kind==='hub'?8:4;w.foodAccounting.initialized+=p.inventory.food;}w.props.push(p);
  }
  w.hubMetrics.push({hubId:`${i}:hub:8:8`,historyStartedTick:0,history:[],eligibleStreak:0});
 }
 for(let i=0;i<population;i++){const chunk=i%chunks,slot=Math.floor(i/chunks),homes=w.props.filter(p=>p.kind==='home'&&p.id.startsWith(`${chunk}:`)),home=homes[Math.floor(slot/3)];assert.ok(home);w.residents.push(engine.makeResident(`load-resident:${i}`,i,home.id,home.hubId,home.entrance));}
 engine.assertWorld(w,id);return w;
}
