import { initialState, SIZE, TerrainHistory, protectedCell } from './terrain.mjs';
const index=(x,z)=>z*SIZE+x;
export const experimentNames={cove:'入り江',terrace:'段の庭',forest:'小島の森'};
const recipes={
  cove:{
    lower:[[8,7],[9,7],[10,7],[8,8],[9,8]],
    levels:[[11,9,1],[12,9,1],[12,10,1],[11,10,1],[12,11,1],[11,11,1],[10,11,1],[9,11,1],[9,4,1],[10,4,1],[10,5,1],[11,5,1],[9,5,1],[6,5,2],[7,5,2],[8,5,2],[8,6,2]],
    plants:[[10,5],[11,5],[11,10],[12,11]],
  },
  terrace:{
    lower:[],
    levels:[[8,6,3],[9,6,3],[10,6,2],[8,5,3],[9,5,2],[7,5,2],[9,7,3]],
    plants:[[8,6],[10,6],[8,9],[10,10]],
  },
  forest:{
    lower:[[8,9],[8,10],[8,11],[9,9],[10,9]],
    levels:[[10,10,1],[11,10,1],[12,10,2],[11,11,2],[12,11,2],[13,11,1],[11,12,1],[12,12,1],[13,12,1],[10,11,1],[13,10,1],[7,5,2],[8,5,2],[9,6,2],[10,6,2]],
    plants:[[11,10],[12,10],[11,11],[12,11]],
  },
};
export function recipeActions(id) {
  const recipe=recipes[id];if(!recipe)throw Error('Unknown experiment');
  const state=initialState(),actions=[];
  const add=(x,z,tool)=>{actions.push({x,z,tool});if(tool==='plant')state.plants.push(index(x,z));else state.heights[index(x,z)]+=tool==='raise'?1:-1;};
  for(const [x,z] of recipe.lower)while(state.heights[index(x,z)]>0)add(x,z,'lower');
  for(const [x,z,level] of recipe.levels)while(state.heights[index(x,z)]<level)add(x,z,'raise');
  for(const [x,z] of recipe.plants)add(x,z,'plant');
  return actions;
}
export function buildExperiment(id) {
  const h=new TerrainHistory();for(const {x,z,tool} of recipeActions(id)) {const result=h.edit(x,z,tool);if(!result.changed)throw Error(`${id}: invalid action ${x},${z} ${tool}`);}
  return h;
}
export function soilAmount(state) {return state.heights.reduce((a,b)=>a+b,0)-initialState().heights.reduce((a,b)=>a+b,0);}
export function neighbours(x,z) {return [[x-1,z],[x+1,z],[x,z-1],[x,z+1]].filter(([a,b])=>a>=0&&b>=0&&a<SIZE&&b<SIZE);}
export function wetEdges(state,x,z) {return neighbours(x,z).filter(([a,b])=>state.heights[index(a,b)]===0);}
export function plantKind(state,x,z) {return state.heights[index(x,z)]>=3?'high':wetEdges(state,x,z).length?'water':'broad';}
export function derivePlaces(state) {
  const innerWater=[];
  const labels=new Int16Array(SIZE*SIZE).fill(-1);let component=0;
  for(let z=0;z<SIZE;z++)for(let x=0;x<SIZE;x++)if(state.heights[index(x,z)]>0&&labels[index(x,z)]<0) {
    const stack=[[x,z]];labels[index(x,z)]=component;
    while(stack.length){const [a,b]=stack.pop();for(const [c,d] of neighbours(a,b))if(state.heights[index(c,d)]>0&&labels[index(c,d)]<0){labels[index(c,d)]=component;stack.push([c,d]);}}
    component++;
  }
  for(let z=1;z<SIZE-1;z++)for(let x=1;x<SIZE-1;x++)if(state.heights[index(x,z)]===0) {
    const dry=neighbours(x,z).filter(([a,b])=>state.heights[index(a,b)]>0);
    let surrounding=0;for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)if(state.heights[index(x+dx,z+dz)]>0)surrounding++;
    if(dry.length>=2&&surrounding>=5&&state.plants.some(i=>Math.hypot(i%SIZE-x,Math.floor(i/SIZE)-z)<2.3))innerWater.push({x,z});
  }
  let high=null;
  for(let z=2;z<SIZE-2;z++)for(let x=2;x<SIZE-2;x++)if(!protectedCell(x,z)&&!state.plants.includes(index(x,z))&&state.heights[index(x,z)]>=3) {
    const count=neighbours(x,z).filter(([a,b])=>state.heights[index(a,b)]>=3).length;
    const lower=neighbours(x,z).some(([a,b])=>state.heights[index(a,b)]>0&&state.heights[index(a,b)]<state.heights[index(x,z)]);
    if(count>=1&&lower&&(!high||count>high.count))high={x,z,count};
  }
  let forest=null;
  for(const i of state.plants) {
    const x=i%SIZE,z=Math.floor(i/SIZE);
    if(state.heights[i]===0||state.heights[i]>2||protectedCell(x,z))continue;
    const nearby=state.plants.filter(j=>state.heights[j]>0&&state.heights[j]<=2&&labels[j]===labels[i]&&Math.hypot(j%SIZE-x,Math.floor(j/SIZE)-z)<=1.65);
    if(nearby.length>=4&&(!forest||nearby.length>forest.count)) {
      const cx=nearby.reduce((sum,j)=>sum+j%SIZE,0)/nearby.length,cz=nearby.reduce((sum,j)=>sum+Math.floor(j/SIZE),0)/nearby.length,clearings=[];
      for(let b=2;b<SIZE-2;b++)for(let a=2;a<SIZE-2;a++)if(!protectedCell(a,b)&&!state.plants.includes(index(a,b))&&labels[index(a,b)]===labels[i]&&Math.hypot(a-cx,b-cz)<=2.25&&state.heights[index(a-1,b)]>0&&state.heights[index(a+1,b)]>0)clearings.push({x:a,z:b,score:b*.8+a*.6-Math.hypot(a-cx,b-cz)*.3});
      clearings.sort((a,b)=>b.score-a.score);
      if(clearings.length)forest={x:cx,z:cz,count:nearby.length,trees:nearby,clearing:{x:clearings[0].x,z:clearings[0].z}};
    }
  }
  return {water:innerWater,high,forest};
}
