// Derived from contour-art-validation: same contour/actual-triangle contract, expanded to the shared 17x17 world.
// A smooth, invertible world mapping bends long grid edges; CPU triangles, hit tests and water all share it.
export function project(x,z){const a=x*.7,b=z*.7;return{x:a+.22*Math.sin(b*.85)+.11*Math.sin(b*1.5+a*.4),z:b+.16*Math.sin(a*.9)};}
export function unproject(x,z){let a=x,b=z;for(let i=0;i<8;i++){a=x-.22*Math.sin(b*.85)-.11*Math.sin(b*1.5+a*.4);b=z-.16*Math.sin(a*.9);}return{x:a/.7,z:b/.7};}
export const top=h=>.42+(h-1)*.57;
export function distance(x,z,c){const r=.45,qx=Math.abs(x-c.x)-(.5-r),qz=Math.abs(z-c.z)-(.5-r);return Math.hypot(Math.max(qx,0),Math.max(qz,0))+Math.min(Math.max(qx,qz),0)-r;}
export function field(cells,method,level=2,blendWidth=.28){const active=cells.filter(c=>c.h>=level);return(x,z)=>{if(!active.length)return 10;if(method==='hard'){let m=Infinity;for(const c of active)m=Math.min(m,distance(x,z,c));return m;}let sum=0;for(const c of active){if(Math.abs(x-c.x)>3||Math.abs(z-c.z)>3)continue;sum+=Math.exp(-distance(x,z,c)/blendWidth);}return sum?-blendWidth*Math.log(sum):10;};}
export function metrics(cells,method,level=2){const f=field(cells,method,level),step=.05,min=-3,max=3,n=Math.round((max-min)/step)+1,land=new Uint8Array(n*n);for(let z=0;z<n;z++)for(let x=0;x<n;x++)land[z*n+x]=f(min+x*step,min+z*step)<=1e-8?1:0;let components=0;for(let i=0;i<land.length;i++)if(land[i]===1){components++;const q=[i];land[i]=2;for(let j=0;j<q.length;j++){const a=q[j];for(const b of[a-1,a+1,a-n,a+n])if(b>=0&&b<land.length&&Math.abs(b%n-a%n)<=1&&land[b]===1){land[b]=2;q.push(b);}}}return{components,centerDistance:f(.5,.5),originDistance:f(0,0),samples:land.length};}

// Stable world-space value noise: edits do not reshuffle untouched scenery.
export const hash=(x,z)=>{const v=Math.sin(x*127.1+z*311.7)*43758.5453;return v-Math.floor(v);};
export function noise(x,z){const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);return (hash(ix,iz)*(1-u)+hash(ix+1,iz)*u)*(1-v)+(hash(ix,iz+1)*(1-u)+hash(ix+1,iz+1)*u)*v;}
export function build(cells,method,{detail=7,finish=true,organic=true}={}){
 const started=performance.now(),positions=[],colors=[],kinds=[],triangles=[],levelMetrics=[];
 const tone=(kind,x,z)=>{const palette=organic?{grass:[.49,.66,.25],lip:[.39,.54,.17],soil:[.58,.38,.24],soilDark:[.40,.25,.17],sand:[.84,.79,.58],foam:[.86,.95,.88],stone:[.67,.68,.62]}:{grass:[.43,.66,.18],lip:[.38,.56,.13],soil:[.39,.20,.10],soilDark:[.29,.14,.075],sand:[.78,.71,.42],foam:[.73,.88,.79],stone:[.60,.60,.53]};const c=palette[kind],v=finish?(organic?1+.27*(noise(x*1.8+5,z*1.8)-.5)+.018*(noise(x*8,z*8)-.5):1+.035*Math.sin(x*13+z*7)*Math.cos(z*11-x*3)):1;return c.map(a=>Math.pow(Math.min(1,a*v),2.2));};
 function tri(a,b,c,kind){const warp=p=>{const q=project(p[0],p[2]);return[q.x,p[1],q.z];};a=warp(a);b=warp(b);c=warp(c);positions.push(...a,...b,...c);for(const p of[a,b,c])colors.push(...tone(kind,p[0],p[2]));kinds.push(...Array(3).fill({grass:0,lip:1,soil:2,soilDark:3,sand:4,foam:5,stone:6}[kind]));triangles.push([a,b,c]);}
 function cap(a,b,c,kind){if((b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2])<0)[b,c]=[c,b];tri(a,b,c,kind);}
 const max=Math.max(0,...cells.map(c=>c.h)),extent=8.5,dim=Math.round(extent*2*detail),step=1/detail;
 for(let level=1;level<=max;level++){
  const active=cells.filter(c=>c.h>=level);if(!active.length)continue;const f=field(cells,method,level),y=top(level),bottom=level===1?-.15:top(level-1),segments=[];
  const uniformMaterial=active.every(c=>c.material===active[0].material);
  const materialAt=(x,z)=>uniformMaterial?active[0].material:active.reduce((a,c)=>distance(x,z,c)<distance(x,z,a)?c:a).material;
  const heightCache=new Map();
  const rawHeight=(x,z)=>y-(finish&&organic?.055*Math.exp(Math.min(0,f(x,z))/.11):0)+(finish?(organic?.045*(noise(x*1.3+7,z*1.3)-.5):.014*Math.sin(x*1.7+z*.3)*Math.cos(z*2))*Math.min(1,Math.max(0,-f(x,z)/.2)):0);
  const height=(p)=>{if(p.d===0)return y-(finish&&organic?.055:0);const key=p.x+','+p.z;if(!heightCache.has(key))heightCache.set(key,rawHeight(p.x,p.z));return heightCache.get(key);};
  const values=new Float64Array((dim+1)**2);for(let z=0;z<=dim;z++)for(let x=0;x<=dim;x++)values[z*(dim+1)+x]=f(-extent+x*step,-extent+z*step);
  for(let iz=0;iz<dim;iz++)for(let ix=0;ix<dim;ix++){
   const corners=[[ix,iz],[ix+1,iz],[ix+1,iz+1],[ix,iz+1]].map(([x,z])=>({x:-extent+x*step,z:-extent+z*step,d:values[z*(dim+1)+x]}));
   if(corners.every(p=>p.d>step))continue;
   const cx=-extent+(ix+.5)*step,cz=-extent+(iz+.5)*step;corners.push({x:cx,z:cz,d:f(cx,cz)});
   for(const ids of[[0,1,4],[1,2,4],[2,3,4],[3,0,4]]){
    const input=ids.map(i=>corners[i]),poly=[],cuts=[];
    for(let i=0;i<3;i++){const a=input[i],b=input[(i+1)%3],inside=a.d<=0;if(inside)poly.push(a);if(inside!==(b.d<=0)){const t=a.d/(a.d-b.d),p={x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,d:0};poly.push(p);cuts.push(p);}}
    const kind=materialAt(cx,cz)==='stone'?'stone':'grass';for(let j=1;j<poly.length-1;j++)cap(...[poly[0],poly[j],poly[j+1]].map(p=>[p.x,height(p),p.z]),kind);
    if(cuts.length===2&&Math.hypot(cuts[0].x-cuts[1].x,cuts[0].z-cuts[1].z)>1e-8)segments.push(cuts);
   }
  }
  function normal(p){const e=.001,dx=f(p.x+e,p.z)-f(p.x-e,p.z),dz=f(p.x,p.z+e)-f(p.x,p.z-e),length=Math.hypot(dx,dz)||1;return[dx/length,dz/length];}
  for(const [a,b]of segments){
   const stone=materialAt((a.x+b.x)/2,(a.z+b.z)/2)==='stone';
   const rings=finish&&organic?(level===1?[[0,y-.055,'grass'],[.04,y-.07,'grass'],[.055,y-.10,'lip'],[.04,y-.14,'soil'],[.10,.10,'soil'],[.23,.035,'sand'],[.42,-.045,'sand']]:[[0,y-.055,'grass'],[.04,y-.065,'grass'],[.065,y-.09,'grass'],[.055,y-.125,'lip'],[.005,y-.15,'soil'],[-.025,y-(y-bottom)*.47,'soil'],[.035,y-(y-bottom)*.78,'soil'],[.075,bottom-.015,'soilDark']]):finish?[[0,y,'grass'],[.022,y-.026,'grass'],[.025,y-.065,'lip'],[-.012,y-.085,'soil'],[.018,y-(y-bottom)*.42,'soil'],[.008,y-(y-bottom)*.7,'soil'],[-.018,bottom+.025,'soilDark'],[-.018,bottom,'soilDark']]:[[0,y,'grass'],[0,y-.06,'lip'],[0,bottom,'soil']];
   const na=normal(a),nb=normal(b),point=(p,n,r)=>{let yy=r[1];if(finish&&r[2]==='lip')yy+=organic?.025*(noise(p.x*7+3,p.z*7)-.5):.009*Math.sin(p.x*24+p.z*17);const wave=organic&&r[0]!==0?(r[2]==='sand'?.11:.018)*(noise(p.x*3,p.z*3)-.5):0;return[p.x+n[0]*(r[0]+wave),yy,p.z+n[1]*(r[0]+wave)];};
   function wall(p,q,u,kind){const ax=q[0]-p[0],ay=q[1]-p[1],az=q[2]-p[2],bx=u[0]-p[0],by=u[1]-p[1],bz=u[2]-p[2],nx=ay*bz-az*by,nz=ax*by-ay*bx;if(nx*(na[0]+nb[0])+nz*(na[1]+nb[1])<0)[q,u]=[u,q];tri(p,q,u,kind);}
   for(let j=0;j<rings.length-1;j++){const r=rings[j],s=rings[j+1],kind=stone?'stone':r[2];const p=point(a,na,r),q=point(b,nb,r),u=point(b,nb,s),v=point(a,na,s);wall(p,q,u,kind);wall(p,u,v,kind);}
   if(level===1&&finish&&!organic){const p=[a.x+na[0]*.075,.025,a.z+na[1]*.075],q=[b.x+nb[0]*.075,.025,b.z+nb[1]*.075],u=[b.x+nb[0]*.105,.025,b.z+nb[1]*.105],v=[a.x+na[0]*.105,.025,a.z+na[1]*.105];cap(p,q,u,'foam');cap(p,u,v,'foam');}
  }
  levelMetrics.push({level,segments:segments.length});
 }
 // The same triangles provide the visible surface and CPU support query.
 const buckets=new Map(),bucket=.25;
 triangles.forEach((t,i)=>{for(let z=Math.floor(Math.min(...t.map(p=>p[2]))/bucket);z<=Math.floor(Math.max(...t.map(p=>p[2]))/bucket);z++)for(let x=Math.floor(Math.min(...t.map(p=>p[0]))/bucket);x<=Math.floor(Math.max(...t.map(p=>p[0]))/bucket);x++){const key=x+','+z;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(i);}});
 const floor=(x,z)=>{let best=-Infinity;for(const i of buckets.get(Math.floor(x/bucket)+','+Math.floor(z/bucket))||[]){const[a,b,c]=triangles[i],den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<1e-12)continue;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den,w=1-u-v;if(Math.min(u,v,w)>=-1e-6)best=Math.max(best,u*a[1]+v*b[1]+w*c[1]);}return best;};
 return{positions,colors,kinds,triangles,floor,levelMetrics,buildMs:performance.now()-started};
}

