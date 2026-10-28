import {build} from './terrain.mjs';
import {fixture,world as toWorld} from '../2026-10-22-terrain-method-trial/terrain.mjs';
export const owners=fixture().owners.map(o=>({...o,x:toWorld(o.x),z:toWorld(o.z),scale:.45}));
export const home={x:owners[0].x,z:owners[0].z+1.05};
export const clone=v=>structuredClone(v);
export function initial(){const cells=[];for(let z=-7;z<=7;z++)for(let x=-7;x<=7;x++)if(Math.hypot(x/6.4,z/5.6)<1)cells.push({x,z,h:1,material:'soil'});return cells;}
export const scripts={
 flat:[],
 ell:[{name:'北の丘を盛る',cells:[[-3,-5],[-2,-5],[-1,-5],[0,-5]],delta:1},{name:'東の角を掘る',cells:[[3,3],[4,3],[5,3],[3,4],[4,4],[5,4],[3,5],[4,5]],delta:-1}],
 cove:[{name:'北の丘を盛る',cells:[[-3,-5],[-2,-5],[-1,-5],[0,-5]],delta:1},{name:'入り口を掘る',cells:[[0,4],[1,4],[2,4],[3,4],[0,5],[1,5],[2,5],[3,5]],delta:-1},{name:'湾を奥へ掘る',cells:[[0,2],[1,2],[2,2],[0,3],[1,3],[2,3]],delta:-1},{name:'木陰の水際を掘る',cells:[[1,0],[2,0],[1,1],[2,1]],delta:-1}]
};
export const channel={name:'手前の道を切る',cells:Array.from({length:15},(_,i)=>[i-7,4]),delta:-1};
export function changed(cells,command){const next=clone(cells);for(const[x,z]of command.cells){let c=next.find(v=>v.x===x&&v.z===z);if(!c&&command.delta<=0)continue;if(!c){c={x,z,h:0,material:'soil'};next.push(c);}c.h=Math.max(0,Math.min(3,c.h+command.delta));}return next;}
export const makeMesh=cells=>build(cells,'blend');
export function floorSafe(mesh,x,z,r=.17){const y=mesh.floor(x,z);if(!Number.isFinite(y)||y<.13)return false;for(let a=0;a<12;a++){const h=mesh.floor(x+r*Math.cos(a*Math.PI/6),z+r*Math.sin(a*Math.PI/6));if(!Number.isFinite(h)||h<.13||Math.abs(h-y)>.12)return false;}return true;}
export function supported(mesh,physical){return physical.map(o=>{const y=mesh.floor(o.spec.x,o.spec.z),heights=o.roots.map(p=>mesh.floor(p.x,p.z));return{id:o.spec.id,safe:Number.isFinite(y)&&y>.13&&heights.length>0&&heights.every(h=>Number.isFinite(h)&&h>.13&&Math.abs(h-y)<.13),rootCount:heights.length,maxDifference:Math.max(...heights.map(h=>Math.abs(h-y)))};});}
export function clearBody(mesh,physical,x,z){const y=mesh.floor(x,z);return physical.every(o=>{const base=mesh.floor(o.spec.x,o.spec.z);return o.bands.every((b,i)=>!b||base+(i+1)*.1<y+.03||base+i*.1>y+.85||x<b.minX-.17||x>b.maxX+.17||z<b.minZ-.17||z>b.maxZ+.17);});}
export const canStand=(mesh,physical,p)=>floorSafe(mesh,p.x,p.z)&&clearBody(mesh,physical,p.x,p.z);
export function traverse(mesh,physical,a,b){const n=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/.05));let last=mesh.floor(a.x,a.z);for(let i=0;i<=n;i++){const p={x:a.x+(b.x-a.x)*i/n,z:a.z+(b.z-a.z)*i/n},h=mesh.floor(p.x,p.z);if(!canStand(mesh,physical,p)||Math.abs(h-last)>.06)return false;last=h;}return true;}
export function route(mesh,physical,start,target){
 if(!canStand(mesh,physical,start)||!canStand(mesh,physical,target))return null;
 if(Math.hypot(start.x-target.x,start.z-target.z)<1e-7)return[clone(start)];
 const step=.18,size=65,min=-5.76,point=k=>({x:min+k%size*step,z:min+Math.floor(k/size)*step}),id=p=>Math.round((p.z-min)/step)*size+Math.round((p.x-min)/step),root=id(start);
 const open=[],cost=new Map(),parent=new Map(),closed=new Set(),cache=new Map();
 for(const d of[0,-1,1,-size,size,-size-1,-size+1,size-1,size+1]){const k=root+d;if(k<0||k>=size*size||Math.abs(k%size-root%size)>1||!traverse(mesh,physical,start,point(k)))continue;open.push(k);cost.set(k,Math.hypot(point(k).x-start.x,point(k).z-start.z));parent.set(k,null);}
 while(open.length){open.sort((a,b)=>cost.get(b)+Math.hypot(point(b).x-target.x,point(b).z-target.z)-cost.get(a)-Math.hypot(point(a).x-target.x,point(a).z-target.z));const k=open.pop();if(Math.hypot(point(k).x-target.x,point(k).z-target.z)<step*1.6&&traverse(mesh,physical,point(k),target)){let p=k,path=[target];while(p!==null){path.push(point(p));p=parent.get(p);}path.push(start);const full=path.reverse().filter((p,i,a)=>!i||Math.hypot(p.x-a[i-1].x,p.z-a[i-1].z)>1e-7),smooth=[full[0]];let at=0;while(at<full.length-1){let next=full.length-1;while(next>at+1&&!traverse(mesh,physical,full[at],full[next]))next--;smooth.push(full[next]);at=next;}return softenRoute(mesh,physical,smooth);}
 if(closed.has(k))continue;closed.add(k);for(const d of[-1,1,-size,size,-size-1,-size+1,size-1,size+1]){const next=k+d;if(next<0||next>=size*size||Math.abs(next%size-k%size)>1||closed.has(next))continue;const edge=k<next?k+':'+next:next+':'+k;if(!cache.has(edge))cache.set(edge,traverse(mesh,physical,point(k),point(next)));if(!cache.get(edge))continue;const c=cost.get(k)+Math.hypot(point(next).x-point(k).x,point(next).z-point(k).z);if(c>=(cost.get(next)??Infinity))continue;cost.set(next,c);parent.set(next,k);open.push(next);}}
 return null;
}
export function shore(mesh,physical,prefer={x:0,z:3.6}){let best=null,score=Infinity;for(let z=-4;z<=4;z+=.18)for(let x=-4.7;x<=4.7;x+=.18){const p={x,z};if(!canStand(mesh,physical,p))continue;let near=false;for(let a=0;a<8;a++)if(mesh.floor(x+.44*Math.cos(a*Math.PI/4),z+.44*Math.sin(a*Math.PI/4))<.08)near=true;if(!near)continue;const d=Math.hypot(x-prefer.x,z-prefer.z);if(d<score){best=p;score=d;}}return best;}

// Round only corners with verified clearance; narrow routes keep the safe original corner.
export function softenRoute(mesh,physical,path){
 if(path.length<3)return path;
 const result=[path[0]];
 for(let i=1;i<path.length-1;i++){
  const a=path[i-1],b=path[i],c=path[i+1],ab=Math.hypot(a.x-b.x,a.z-b.z),bc=Math.hypot(c.x-b.x,c.z-b.z),r=Math.min(.28,ab*.25,bc*.25);
  if(r<.015){result.push(b);continue;}
  const u={x:b.x+(a.x-b.x)*r/ab,z:b.z+(a.z-b.z)*r/ab},v={x:b.x+(c.x-b.x)*r/bc,z:b.z+(c.z-b.z)*r/bc};
  const arc=Array.from({length:7},(_,j)=>{const t=j/6;return{x:(1-t)**2*u.x+2*(1-t)*t*b.x+t*t*v.x,z:(1-t)**2*u.z+2*(1-t)*t*b.z+t*t*v.z};});
  const candidate=[result.at(-1),...arc,c];
  if(candidate.every((p,j)=>!j||traverse(mesh,physical,candidate[j-1],p)))result.push(...arc);else result.push(b);
 }
 result.push(path.at(-1));return result;
}
