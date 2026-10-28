// A falsifiable reconstruction candidate, not Little Habitats source.
export const methods=['hard','blend'];
export const presets={single:[[0,0]],pair:[[0,0],[1,0]],ell:[[0,0],[1,0],[1,1]],square:[[0,0],[1,0],[0,1],[1,1]],diagonal:[[0,0],[1,1]],reverse:[[1,0],[0,1]],gap:[[-1,0],[1,0]],hole:[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]};
export const label={single:'単独',pair:'隣接',ell:'L字',square:'四角',diagonal:'対角',reverse:'逆向き対角',gap:'1区画の隙間',hole:'中央に穴'};
export const top=h=>.14+(h-1)*.55;
export function initial(name='single'){
 const cells=[];for(let z=-2;z<=2;z++)for(let x=-2;x<=2;x++)if(Math.abs(x)+Math.abs(z)<4)cells.push({x,z,h:1,material:'soil'});
 for(const [x,z]of presets[name]){const c=cells.find(c=>c.x===x&&c.z===z);if(c)c.h=2;else cells.push({x,z,h:2,material:'soil'});}
 return cells;
}
export function edit(cells,x,z,tool){const next=structuredClone(cells);let c=next.find(c=>c.x===x&&c.z===z);if(!c){c={x,z,h:0,material:'soil'};next.push(c);}if(tool==='lower')c.h=Math.max(0,c.h-1);else if(tool==='stone'&&c.material!=='stone'&&c.h>0)c.material='stone';else {c.h=Math.min(4,c.h+1);c.material=tool==='stone'?'stone':'soil';}return next;}
export function distance(x,z,c){const r=.28,qx=Math.abs(x-c.x)-(.5-r),qz=Math.abs(z-c.z)-(.5-r);return Math.hypot(Math.max(qx,0),Math.max(qz,0))+Math.min(Math.max(qx,qz),0)-r;}
export function field(cells,method,level=2,blendWidth=.25){const active=cells.filter(c=>c.h>=level);return(x,z)=>{if(!active.length)return 10;const ds=active.map(c=>distance(x,z,c)),m=Math.min(...ds);if(method==='hard')return m;const k=blendWidth;return m-k*Math.log(ds.reduce((s,d)=>s+Math.exp((m-d)/k),0));};}
export function metrics(cells,method,level=2){const f=field(cells,method,level),step=.05,min=-3,max=3,n=Math.round((max-min)/step)+1,land=new Uint8Array(n*n);for(let z=0;z<n;z++)for(let x=0;x<n;x++)land[z*n+x]=f(min+x*step,min+z*step)<=1e-8?1:0;let components=0;for(let i=0;i<land.length;i++)if(land[i]===1){components++;const q=[i];land[i]=2;for(let j=0;j<q.length;j++){const a=q[j];for(const b of[a-1,a+1,a-n,a+n])if(b>=0&&b<land.length&&Math.abs(b%n-a%n)<=1&&land[b]===1){land[b]=2;q.push(b);}}}return{components,centerDistance:f(.5,.5),originDistance:f(0,0),samples:land.length};}

export function build(cells,method,{detail=16,finish=true}={}){
 const started=performance.now(),positions=[],colors=[],triangles=[],levelMetrics=[];
 const tone=(kind,x,z)=>{const colors={grass:[.43,.66,.18],lip:[.38,.56,.13],soil:[.39,.20,.10],soilDark:[.29,.14,.075],sand:[.78,.71,.42],foam:[.73,.88,.79],stone:[.60,.60,.53]};const c=colors[kind],v=finish?1+.035*Math.sin(x*13+z*7)*Math.cos(z*11-x*3):1;return c.map(a=>Math.pow(Math.min(1,a*v),2.2));};
 function tri(a,b,c,kind){positions.push(...a,...b,...c);for(const p of[a,b,c])colors.push(...tone(kind,p[0],p[2]));triangles.push([a,b,c]);}
 function cap(a,b,c,kind){if((b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2])<0)[b,c]=[c,b];tri(a,b,c,kind);}
 const max=Math.max(0,...cells.map(c=>c.h)),extent=3.5,dim=Math.round(extent*2*detail),step=1/detail;
 for(let level=1;level<=max;level++){
  const active=cells.filter(c=>c.h>=level);if(!active.length)continue;const f=field(cells,method,level),y=top(level),bottom=level===1?-.15:top(level-1),segments=[];
  const materialAt=(x,z)=>active.reduce((a,c)=>distance(x,z,c)<distance(x,z,a)?c:a).material;
  const height=(x,z)=>y+(finish?.014*Math.sin(x*1.7+z*.3)*Math.cos(z*2)*Math.min(1,Math.max(0,-f(x,z)/.2)):0);
  const values=new Float64Array((dim+1)**2);for(let z=0;z<=dim;z++)for(let x=0;x<=dim;x++)values[z*(dim+1)+x]=f(-extent+x*step,-extent+z*step);
  for(let iz=0;iz<dim;iz++)for(let ix=0;ix<dim;ix++){
   const corners=[[ix,iz],[ix+1,iz],[ix+1,iz+1],[ix,iz+1]].map(([x,z])=>({x:-extent+x*step,z:-extent+z*step,d:values[z*(dim+1)+x]}));
   if(corners.every(p=>p.d>step))continue;
   const cx=-extent+(ix+.5)*step,cz=-extent+(iz+.5)*step;corners.push({x:cx,z:cz,d:f(cx,cz)});
   for(const ids of[[0,1,4],[1,2,4],[2,3,4],[3,0,4]]){
    const input=ids.map(i=>corners[i]),poly=[],cuts=[];
    for(let i=0;i<3;i++){const a=input[i],b=input[(i+1)%3],inside=a.d<=0;if(inside)poly.push(a);if(inside!==(b.d<=0)){const t=a.d/(a.d-b.d),p={x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,d:0};poly.push(p);cuts.push(p);}}
    const kind=materialAt(cx,cz)==='stone'?'stone':'grass';for(let j=1;j<poly.length-1;j++)cap(...[poly[0],poly[j],poly[j+1]].map(p=>[p.x,height(p.x,p.z),p.z]),kind);
    if(cuts.length===2&&Math.hypot(cuts[0].x-cuts[1].x,cuts[0].z-cuts[1].z)>1e-8)segments.push(cuts);
   }
  }
  function normal(p){const e=.001,dx=f(p.x+e,p.z)-f(p.x-e,p.z),dz=f(p.x,p.z+e)-f(p.x,p.z-e),length=Math.hypot(dx,dz)||1;return[dx/length,dz/length];}
  for(const [a,b]of segments){
   const stone=materialAt((a.x+b.x)/2,(a.z+b.z)/2)==='stone';
   const rings=finish?[[0,y,'grass'],[.022,y-.026,'grass'],[.025,y-.065,'lip'],[-.012,y-.085,'soil'],[.018,y-(y-bottom)*.42,'soil'],[.008,y-(y-bottom)*.7,'soil'],[-.018,bottom+.025,'soilDark'],[-.018,bottom,'soilDark']]:[[0,y,'grass'],[0,y-.06,'lip'],[0,bottom,'soil']];
   const na=normal(a),nb=normal(b),point=(p,n,r)=>{let yy=r[1];if(finish&&r[2]==='lip')yy+=.009*Math.sin(p.x*24+p.z*17);return[p.x+n[0]*r[0],yy,p.z+n[1]*r[0]];};
   function wall(p,q,u,kind){const ax=q[0]-p[0],ay=q[1]-p[1],az=q[2]-p[2],bx=u[0]-p[0],by=u[1]-p[1],bz=u[2]-p[2],nx=ay*bz-az*by,nz=ax*by-ay*bx;if(nx*(na[0]+nb[0])+nz*(na[1]+nb[1])<0)[q,u]=[u,q];tri(p,q,u,kind);}
   for(let j=0;j<rings.length-1;j++){const r=rings[j],s=rings[j+1],kind=stone?'stone':level===1&&j>2?'sand':r[2];const p=point(a,na,r),q=point(b,nb,r),u=point(b,nb,s),v=point(a,na,s);wall(p,q,u,kind);wall(p,u,v,kind);}
   if(level===1&&finish){const p=[a.x+na[0]*.075,.025,a.z+na[1]*.075],q=[b.x+nb[0]*.075,.025,b.z+nb[1]*.075],u=[b.x+nb[0]*.105,.025,b.z+nb[1]*.105],v=[a.x+na[0]*.105,.025,a.z+na[1]*.105];cap(p,q,u,'foam');cap(p,u,v,'foam');}
  }
  levelMetrics.push({level,segments:segments.length});
 }
 // The same triangles provide the visible surface and CPU support query.
 const buckets=new Map(),bucket=.25;
 triangles.forEach((t,i)=>{for(let z=Math.floor(Math.min(...t.map(p=>p[2]))/bucket);z<=Math.floor(Math.max(...t.map(p=>p[2]))/bucket);z++)for(let x=Math.floor(Math.min(...t.map(p=>p[0]))/bucket);x<=Math.floor(Math.max(...t.map(p=>p[0]))/bucket);x++){const key=x+','+z;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(i);}});
 const floor=(x,z)=>{let best=-Infinity;for(const i of buckets.get(Math.floor(x/bucket)+','+Math.floor(z/bucket))||[]){const[a,b,c]=triangles[i],den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<1e-12)continue;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den,w=1-u-v;if(Math.min(u,v,w)>=-1e-6)best=Math.max(best,u*a[1]+v*b[1]+w*c[1]);}return best;};
 return{positions,colors,triangles,floor,levelMetrics,buildMs:performance.now()-started};
}
