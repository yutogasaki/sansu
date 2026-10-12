from pathlib import Path
src=Path('/private/tmp/sansu-whole-massing-c-terrain/v2/candidate-probe.mjs').read_text()
src=src.replace("out='/private/tmp/sansu-whole-massing-c-terrain/v2'","out='/private/tmp/sansu-whole-massing-c-terrain/south-west'")
src=src.replace("const bounds={minX:6.5,maxX:9.5,minZ:-7.5,maxZ:-5.9}","const bounds={minX:6.05,maxX:9.05,minZ:-7.1,maxZ:-4.9}")
a=src.index('function carve(poly)');b=src.index('function append',a)
src=src[:a]+'''const rawBoundary=Array.from({length:48},(_,i)=>({cell:{x:7.55+1.5*Math.cos(i*Math.PI/24),z:-6+1.1*Math.sin(i*Math.PI/24)},point:{x:0,y:0,z:0}}));
function distanceHalf(poly,dist){const r=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],d=dist(p.cell),e=dist(q.cell);if(d>=-1e-12)r.push(p);if((d>=0)!=(e>=0))r.push(interp(p,q,d/(d-e)));}return area(r)>1e-12?r:[];}
// Clip the northwest corner outside the full existing (6,-7) grant footprint.
const boundary=distanceHalf(rawBoundary,c=>c.x+c.z+.04).map(v=>v.cell);
const sides=boundary.map((p,i)=>{const q=boundary[(i+1)%boundary.length];return c=>(q.x-p.x)*(c.z-p.z)-(q.z-p.z)*(c.x-p.x);});
function carve(poly){let inside=poly;const outside=[];for(const side of sides){const p=distanceHalf(inside,c=>-side(c));if(p.length)outside.push(p);inside=distanceHalf(inside,side);if(!inside.length)break;}return{inside,outside};}
function segmentDistance(c,p,q){const dx=q.x-p.x,dz=q.z-p.z,t=Math.max(0,Math.min(1,((c.x-p.x)*dx+(c.z-p.z)*dz)/(dx*dx+dz*dz)));return Math.hypot(c.x-p.x-t*dx,c.z-p.z-t*dz);}
function supportBlend(c){const outer=Math.min(...boundary.map((p,i)=>segmentDistance(c,p,boundary[(i+1)%boundary.length]))),inner=Math.hypot(Math.max(6.54-c.x,0,c.x-8.46),Math.max(-6.46-c.z,0,c.z+5.54));return inner<1e-10?1:outer/(inner+outer);}
const targetPlane=c=>1.60-.30*(c.z+6)+.03*(c.x-7.5);
''' +src[b:]
src=src.replace("const targetHeights=[{x:8,y:1.90},{x:9,y:1.84}];","const targetHeights=[{x:7,y:targetPlane({x:7,z:-6})},{x:8,y:targetPlane({x:8,z:-6})}];")
a=src.index('const sourceCenter=');b=src.index('\n source.floors',a)
src=src[:a]+"const sourceCenter=targetHeights.map(p=>upstream.floorAt({x:p.x,z:-6}).point.y);"+src[b:]
src=src.replace("[['x',7.54],['x',8],['x',8.46],['x',8.54],['x',9],['x',9.46],['z',-7.46],['z',-7],['z',-6.6],['z',-6.54],['z',-6.25]]","[['x',6.54],['x',7],['x',7.46],['x',7.54],['x',8],['x',8.46],['z',-6.46],['z',-6],['z',-5.54],['z',-5.25],['z',-5]]")
src=src.replace("(Math.abs(v.cell.x-8)<=.460000001&&Math.abs(v.cell.z+7)<=.460000001?Math.min(2.175,v.point.y+delta(v.cell)):v.point.y+delta(v.cell))","v.point.y+(targetPlane(v.cell)-v.point.y)*supportBlend(v.cell)")
src=src.replace("new Set(['8,-7','9,-7'])","new Set(['7,-6','8,-6'])")
src=src.replace("'cap-2.175-west-5.25'","'south-west-plane-curved-48',boundary")
a=src.index(' // Explicit walk-only');b=src.index('\n return{world:',a)
src=src[:a]+''' // Diagnostic walk-only samples follow the existing generator's support contract.
 const cells=new Map(support.sites.map(s=>[a.key(s.cell),s])),cDistrict=def.districts.find(d=>d.id===districtId),addedCells=[];
 for(let ix=24;ix<=37;ix++)for(let iz=-28;iz<=-19;iz++){const c={x:ix/4,z:iz/4};if(cells.has(a.key(c)))continue;const f=support.floorAt(c);if(!f||![-.12,0,.12].every(dx=>[-.12,0,.12].every(dz=>{const h=support.floorAt({x:c.x+dx,z:c.z+dz});return h&&Math.abs(h.point.y-f.point.y)<=.2;})))continue;const inC=sides.every(side=>side(c)>=-1e-9);const d=inC?cDistrict:source,localFloor=inC?floorId:JSON.parse(f.floorId)[1],site={id:`C-entry:${a.key(c)}`,cell:c,floorId:localFloor,placement:false};d.sites.push(site);addedCells.push(c);cells.set(a.key(c),{ref:{districtId:d.id,siteId:site.id},cell:c});}
 support=a.compileWorldDefinition(def);const allCells=new Map(support.sites.map(s=>[a.key(s.cell),s]));const edgeSet=new Set(def.edges.map(e=>[refkey(e.from),refkey(e.to)].sort().join('|'))),newEdges=[];const addEdge=(ca,cb,allows)=>{const sa=allCells.get(a.key(ca)),sb=allCells.get(a.key(cb));if(!sa||!sb)return;const k=[refkey(sa.ref),refkey(sb.ref)].sort().join('|');if(edgeSet.has(k))return;if(allows.includes('walk')&&!a.isWorldWalkEdgeSupported(support,ca,cb))return;const e={from:sa.ref,to:sb.ref,allows};def.edges.push(e);newEdges.push(e);edgeSet.add(k);};
 for(const site of support.sites){if(site.cell.x<5.75||site.cell.x>9.5||site.cell.z< -7.25||site.cell.z> -4.5)continue;for(const d of[{x:.25,z:0},{x:0,z:.25}])addEdge(site.cell,{x:site.cell.x+d.x,z:site.cell.z+d.z},['walk']);}
 addEdge({x:7,z:-6},{x:8,z:-6},['join','water']);
''' +src[b:]
src=src.replace('newFloor,sourceCenter};','newFloor,sourceCenter,boundary,addedCells,newEdges};')
src=src.replace('[[6,-7],[8,-7],[9,-7]]','[[6,-7],[7,-6],[8,-6]]')
src=src.replace('const c={x:p.x,z:-7}','const c={x:p.x,z:-6}')
src=src.replace('sourceCenters:current.sourceCenter,','sourceCenters:current.sourceCenter,boundary:current.boundary,addedCells:current.addedCells,newEdges:current.newEdges,')
# Retain geometry diagnostics separately from operational source.
Path('/private/tmp/sansu-whole-massing-c-terrain/south-west/candidate-probe.mjs').write_text(src)
