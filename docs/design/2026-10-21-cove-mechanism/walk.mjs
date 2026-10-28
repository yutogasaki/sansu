import { SIZE, SPACING, WATER, sampleHeight, world } from './terrain.mjs';

export const WALK_STEP = SPACING / 4;
const N = (SIZE - 1) * 4 + 1;
const house = (x,z) => x > world(6)-.65 && x < world(6)+.65 && z > world(7.3)-.65 && z < world(7.3)+.73;
let physicalClear = () => true;
export function setPhysicalClear(test) { physicalClear = test; }
export function canStand(state,x,z) {
  if (!physicalClear(state,x,z)) return false;
  if (Math.abs(x)>5 || Math.abs(z)>5 || house(x,z)) return false;
  if(state.plants.some(i=>Math.hypot(x-world(i%SIZE),z-world(Math.floor(i/SIZE)))<.24))return false;
  const y=sampleHeight(state,x,z);
  // The actor's whole supporting footprint must remain dry, not just its centre.
  return [[0,0],[.18,0],[-.18,0],[0,.18],[0,-.18],[.13,.13],[-.13,.13],[.13,-.13],[-.13,-.13]].every(([a,b])=>{
    const h=sampleHeight(state,x+a,z+b);return h>WATER+.10 && Math.abs(h-y)<.13;
  });
}
export function canTraverse(state,a,b) {
  const steps=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/.045));
  let previous=sampleHeight(state,a.x,a.z);
  for(let j=0;j<=steps;j++){
    const t=j/steps,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,h=sampleHeight(state,x,z);
    if(!canStand(state,x,z)||Math.abs(h-previous)>.06)return false;previous=h;
  }
  return true;
}
const point=(x,z)=>({x:world(0)+x*WALK_STEP,z:world(0)+z*WALK_STEP});
const cell=p=>({x:Math.round((p.x-world(0))/WALK_STEP),z:Math.round((p.z-world(0))/WALK_STEP)});
export function reachable(state,start) {
  const c=cell(start),origin=point(c.x,c.z),id=(x,z)=>z*N+x;
  if(!canTraverse(state,start,origin))return {points:[],route:()=>null};
  const root=id(c.x,c.z),queue=[root],parent=new Map([[root,null]]);
  for(let n=0;n<queue.length;n++){
    const k=queue[n],x=k%N,z=Math.floor(k/N),a=point(x,z);
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,nz=z+dz,key=id(nx,nz);if(nx<1||nz<1||nx>=N-1||nz>=N-1||parent.has(key))continue;
      if(canTraverse(state,a,point(nx,nz))){parent.set(key,k);queue.push(key);}
    }
  }
  return {points:queue.map(k=>({...point(k%N,Math.floor(k/N)),key:k})),route:key=>{
    if(!parent.has(key))return null;const path=[];while(key!==null){path.push(point(key%N,Math.floor(key/N)));key=parent.get(key);}return [start,...path.reverse()];
  }};
}
export function shoreRoute(state,start,selected) {
  const graph=reachable(state,start),target={x:world(selected.x),z:world(selected.z)},candidates=[];
  for(const p of graph.points){
    for(let j=0;j<8;j++){
      const a=j*Math.PI/4,look={x:p.x+Math.cos(a)*.55,z:p.z+Math.sin(a)*.55};
      if(sampleHeight(state,look.x,look.z)>WATER-.06 || Math.hypot(look.x-target.x,look.z-target.z)>1.5)continue;
      candidates.push({p,look,score:Math.hypot(p.x-target.x,p.z-target.z)+Math.hypot(p.x-start.x,p.z-start.z)*.08});
    }
  }
  candidates.sort((a,b)=>a.score-b.score);const best=candidates[0];
  return best?{path:graph.route(best.p.key),look:best.look}:null;
}
export function homeRoute(state,start,home) {
  const graph=reachable(state,start);const best=graph.points.sort((a,b)=>Math.hypot(a.x-home.x,a.z-home.z)-Math.hypot(b.x-home.x,b.z-home.z))[0];
  return best&&Math.hypot(best.x-home.x,best.z-home.z)<.22?{path:graph.route(best.key),look:{x:world(6),z:world(7.3)}}:null;
}
