import {ShapeUtils,Vector2} from 'three';
export const N=17,S=.7,WATER=.08;
export const world=i=>(i-8)*S,at=(x,z)=>z*N+x;
export const methods=[{id:'a-soft',name:'A1 なだらかな地面',type:'field',power:1},{id:'a-shoulder',name:'A2 肩を立てた地面',type:'field',power:2.7},{id:'a-spline',name:'A3 広くつなぐ丘',type:'field',power:1,spline:true},{id:'b-crisp',name:'B1 段の部品・明瞭',type:'parts',bevel:.07},{id:'b-soft',name:'B2 段の部品・丸い縁',type:'parts',bevel:.16},{id:'b-curved',name:'B3 輪郭を丸めた段部品',type:'parts',bevel:.14,curved:true},{id:'b-decider',name:'B4 対角の接続も分ける',type:'parts',bevel:.14,curved:true,decider:true}];
export const fixtureNames={cove:'入り江',tree:'木を別の位置へ',house:'家を岸の近くへ',neck:'細い陸の接続',diagonal:'対角の陸と水',steps:'二方向の段差'};
export const elevation=h=>h===0?-.48:.42+(h-1)*.57;
export function fixture(name='cove'){
 const heights=Array.from({length:N*N},(_,i)=>{const x=world(i%N),z=world(Math.floor(i/N));let h=Math.hypot(x/4.6,z/4)<1&&!(z>.25&&Math.abs(x-1)<.85+z*.13)?1:0;if(h&&z<-2.65&&x<1.1)h=2;if(h&&z<-3.1&&x<.7)h=3;return h;});
 const owners=[{id:'home',part:'home',x:5.8,z:8,yaw:0},{id:'t1',part:'willow',x:4,z:6,yaw:0},{id:'t2',part:'birch',x:6,z:5,yaw:0},{id:'t3',part:'spire',x:9,z:5,yaw:0},{id:'t4',part:'willow',x:7,z:6,yaw:Math.PI},{id:'t5',part:'birch',x:4,z:10,yaw:0},{id:'t6',part:'spire',x:12,z:9,yaw:0}];
 if(name==='tree'){owners[5].x=6;owners[5].z=11;}
 if(name==='house'){owners[0].x=6;owners[0].z=9;}
 if(name==='neck')for(let z=9;z<=13;z++)for(let x=10;x<=14;x++)heights[at(x,z)]=x===12?1:0;
 if(name==='diagonal')for(let z=10;z<=13;z++)for(let x=10;x<=13;x++)heights[at(x,z)]=((x+z)%2===0)?1:0;
 if(name==='steps')for(let z=9;z<=12;z++)for(let x=10;x<=13;x++)heights[at(x,z)]=1+(x>=12?1:0)+(z>=11?1:0);
 return {name,heights,owners};
}
const smooth=x=>x*x*(3-2*x);
function profile(t,p){const a=t**p,b=(1-t)**p;return smooth(a/(a+b));}
export function build(state,method){
 const start=performance.now(),positions=[],colors=[],triangles=[],families={flat:0,edge:0,convex:0,concave:0,saddle:0};
 function triangle(a,b,c,kind=0){const cross=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);if(Math.abs(cross)>1e-12&&cross<0)[b,c]=[c,b];positions.push(...a,...b,...c);const col=kind===1?[.50,.41,.38]:kind===2?[.68,.61,.48]:[.47,.59,.38];for(const p of[a,b,c]){const variation=.98+.02*Math.sin(p[0]*11+p[2]*7);colors.push(...col.map(v=>v*variation));}triangles.push([a,b,c]);}
 if(method.type==='field'){
  const div=8,dim=(N-1)*div;function point(ix,iz){const px=ix/div,pz=iz/div,x=Math.min(N-2,Math.floor(px)),z=Math.min(N-2,Math.floor(pz)),u=profile(px-x,method.power),v=profile(pz-z,method.power);const h=(dx,dz)=>elevation(state.heights[at(x+dx,z+dz)]);if(method.spline){const weights=t=>[(1-t)**3/6,(3*t*t*t-6*t*t+4)/6,(-3*t*t*t+3*t*t+3*t+1)/6,t*t*t/6],wx=weights(px-x),wz=weights(pz-z);let value=0;for(let j=0;j<4;j++)for(let i=0;i<4;i++)value+=elevation(state.heights[at(Math.max(0,Math.min(N-1,x+i-1)),Math.max(0,Math.min(N-1,z+j-1)))])*wx[i]*wz[j];return[world(px),value,world(pz)];}return[world(px),h(0,0)*(1-u)*(1-v)+h(1,0)*u*(1-v)+h(0,1)*(1-u)*v+h(1,1)*u*v,world(pz)];}
  for(let z=0;z<dim;z++)for(let x=0;x<dim;x++){const a=point(x,z),b=point(x+1,z),c=point(x+1,z+1),d=point(x,z+1);for(const t of[[a,b,c],[a,c,d]]){const height=Math.min(...t.map(p=>p[1])),delta=Math.max(...t.map(p=>p[1]))-height;triangle(...t,delta>.09?1:height<.23?2:0);}}
 }else{
  // Reusable contour patches share exact edge samples. Each level is a cap and an authored bevel/body/foot cross-section.
  for(let level=1;level<=4;level++){
   let segments=[];const top=elevation(level),bottom=elevation(level-1),threshold=level-.5;
   for(let z=0;z<N-1;z++)for(let x=0;x<N-1;x++){
    const corners=[[x,z],[x+1,z],[x+1,z+1],[x,z+1]].map(([a,b])=>({x:world(a),z:world(b),h:state.heights[at(a,b)]}));
    const mask=corners.map(p=>p.h>=threshold),count=mask.filter(Boolean).length;
    if(count===4)families.flat++;else if(count===1)families.convex++;else if(count===3)families.concave++;else if(count===2)families[mask[0]===mask[2]?'saddle':'edge']++;
    // Fixed diagonal is deliberate: diagonal-only contacts are tested, not silently filled.
    let splits=[[0,1,2],[0,2,3]];if(method.decider&&count===2&&mask[0]===mask[2]){let h=corners.reduce((s,p)=>s+p.h,0)/4;if(Math.abs(h-threshold)<1e-8)h-=.001;corners.push({x:world(x+.5),z:world(z+.5),h});splits=[[0,1,4],[1,2,4],[2,3,4],[3,0,4]];}
    for(const ids of splits){
     const input=ids.map(i=>corners[i]),poly=[],cuts=[];
     for(let i=0;i<3;i++){const a=input[i],b=input[(i+1)%3],inside=a.h>=threshold;if(inside)poly.push(a);if(inside!==(b.h>=threshold)){const t=(threshold-a.h)/(b.h-a.h),p={x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,h:threshold};poly.push(p);cuts.push(p);}}
     if(!method.curved)for(let i=1;i<poly.length-1;i++)triangle(...[poly[0],poly[i],poly[i+1]].map(p=>[p.x,top,p.z]));
     if(cuts.length===2){const centre=input.reduce((s,p)=>p.h>=threshold?{x:s.x+p.x,z:s.z+p.z,n:s.n+1}:s,{x:0,z:0,n:0});segments.push({a:cuts[0],b:cuts[1],inside:{x:centre.x/centre.n,z:centre.z/centre.n}});}
    }
   }
   if(method.curved&&segments.length){
    const pointKey=p=>`${Math.round(p.x*1e6)},${Math.round(p.z*1e6)}`,adj=new Map(),points=new Map();
    for(const s of segments){const a=pointKey(s.a),b=pointKey(s.b);points.set(a,s.a);points.set(b,s.b);if(!adj.has(a))adj.set(a,[]);if(!adj.has(b))adj.set(b,[]);adj.get(a).push(b);adj.get(b).push(a);}
    const used=new Set(),loops=[];
    for(const start of adj.keys()){if(used.has(start))continue;let prev=null,k=start,loop=[];for(let i=0;i<=adj.size;i++){if(used.has(k))break;used.add(k);loop.push(points.get(k));const next=adj.get(k).find(n=>n!==prev);prev=k;k=next;if(k===start)break;}if(loop.length<3||k!==start)throw Error('Open contour in curved module');
     for(let iteration=0;iteration<2;iteration++){const next=[];for(let i=0;i<loop.length;i++){const a=loop[i],b=loop[(i+1)%loop.length];next.push({x:.75*a.x+.25*b.x,z:.75*a.z+.25*b.z},{x:.25*a.x+.75*b.x,z:.25*a.z+.75*b.z});}loop=next;}loops.push(loop);
    }
    const area=loop=>loop.reduce((s,p,i)=>{const q=loop[(i+1)%loop.length];return s+p.x*q.z-q.x*p.z;},0)/2;
    const contains=(loop,p)=>{let inside=false;for(let i=0,j=loop.length-1;i<loop.length;j=i++){const a=loop[i],b=loop[j];if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)inside=!inside;}return inside;};
    const depths=loops.map((l,i)=>loops.filter((o,j)=>i!==j&&contains(o,l[0])).length);
    for(let i=0;i<loops.length;i++){if(depths[i]%2)continue;const holes=loops.filter((l,j)=>depths[j]===depths[i]+1&&contains(loops[i],l[0])),all=[...loops[i],...holes.flat()],faces=ShapeUtils.triangulateShape(loops[i].map(p=>new Vector2(p.x,p.z)),holes.map(h=>h.map(p=>new Vector2(p.x,p.z))));for(const face of faces)triangle(...face.map(j=>[all[j].x,top,all[j].z]));}
    segments=[];loops.forEach((loop,j)=>{const sign=Math.sign(area(loop))*(depths[j]%2?-1:1);for(let i=0;i<loop.length;i++){const a=loop[i],b=loop[(i+1)%loop.length],dx=b.x-a.x,dz=b.z-a.z;segments.push({a,b,inside:{x:(a.x+b.x)/2-dz*sign,z:(a.z+b.z)/2+dx*sign}});}});
   }
   const normalMap=new Map(),key=p=>`${Math.round(p.x*1e6)},${Math.round(p.z*1e6)}`;
   for(const s of segments){const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,len=Math.hypot(dx,dz);let nx=dz/len,nz=-dx/len;if(nx*(s.inside.x-s.a.x)+nz*(s.inside.z-s.a.z)>0){nx=-nx;nz=-nz;}for(const p of[s.a,s.b]){const k=key(p),n=normalMap.get(k)||[0,0];n[0]+=nx;n[1]+=nz;normalMap.set(k,n);}}
   const rings=[[0,top],[method.bevel*.55,top-.045],[method.bevel,top-.14],[method.bevel*.8,bottom+.12],[0,bottom]];
   function ring(p,r){const n=normalMap.get(key(p)),len=Math.hypot(...n)||1;return[p.x+n[0]/len*r[0],r[1],p.z+n[1]/len*r[0]];}
   for(const s of segments)for(let j=0;j<rings.length-1;j++){const a=ring(s.a,rings[j]),b=ring(s.b,rings[j]),c=ring(s.b,rings[j+1]),d=ring(s.a,rings[j+1]);triangle(a,b,c,j===0?0:level===1&&j>1?2:1);triangle(a,c,d,j===0?0:level===1&&j>1?2:1);}
  }
 }
 // Same resolved triangles supply visible ground and support. Spatial buckets avoid scene-wide ray work.
 const buckets=new Map(),bucket=.35;
 for(let i=0;i<triangles.length;i++){const t=triangles[i],xs=t.map(p=>p[0]),zs=t.map(p=>p[2]);for(let z=Math.floor(Math.min(...zs)/bucket);z<=Math.floor(Math.max(...zs)/bucket);z++)for(let x=Math.floor(Math.min(...xs)/bucket);x<=Math.floor(Math.max(...xs)/bucket);x++){const key=`${x},${z}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(i);}}
 const floor=(x,z)=>{let best=-Infinity;for(const i of buckets.get(`${Math.floor(x/bucket)},${Math.floor(z/bucket)}`)||[]){const[a,b,c]=triangles[i],den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<1e-10)continue;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den,w=1-u-v;if(Math.min(u,v,w)>=-1e-7)best=Math.max(best,u*a[1]+v*b[1]+w*c[1]);}return best;};
 return {positions,colors,triangles,floor,families,buildMs:performance.now()-start};
}
export function support(mesh,x,z,r=.17){const h=mesh.floor(x,z);return Number.isFinite(h)&&h>WATER+.1&&[[r,0],[-r,0],[0,r],[0,-r],[r*.7,r*.7],[-r*.7,r*.7],[r*.7,-r*.7],[-r*.7,-r*.7]].every(([a,b])=>{const y=mesh.floor(x+a,z+b);return Number.isFinite(y)&&y>WATER+.1&&Math.abs(y-h)<.13;});}
export function route(mesh,state,start,target,extraClear=()=>true){
 const step=.175,size=65,point=k=>({x:world(0)+(k%size)*step,z:world(0)+Math.floor(k/size)*step}),id=p=>Math.round((p.z-world(0))/step)*size+Math.round((p.x-world(0))/step);
 const clear=p=>extraClear(p.x,p.z)&&support(mesh,p.x,p.z)&&state.owners.every(o=>{const dx=Math.abs(p.x-world(o.x)),dz=Math.abs(p.z-world(o.z));return o.part==='home'?dx>.7||dz>.7:Math.hypot(dx,dz)>.38;});
 const traverse=(a,b)=>{for(let i=0;i<=5;i++){const p={x:a.x+(b.x-a.x)*i/5,z:a.z+(b.z-a.z)*i/5};if(!clear(p))return false;}return Math.abs(mesh.floor(a.x,a.z)-mesh.floor(b.x,b.z))<.14;};
 const root=id(start),origin=point(root);if(!traverse(start,origin))return null;const queue=[root],parents=new Map([[root,null]]);let best=null,dist=Infinity;
 for(let j=0;j<queue.length;j++){const k=queue[j],p=point(k),d=Math.hypot(p.x-target.x,p.z-target.z);if(d<dist){dist=d;best=k;}for(const next of[k-1,k+1,k-size,k+size]){if(next<0||next>=size*size||parents.has(next)||Math.abs(next%size-k%size)>1||!traverse(p,point(next)))continue;parents.set(next,k);queue.push(next);}}
 if(dist>.55)return null;const path=[];while(best!==null){path.push(point(best));best=parents.get(best);}return[start,...path.reverse()];
}
