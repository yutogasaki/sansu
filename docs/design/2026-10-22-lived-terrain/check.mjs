import {surfaceNormals} from './surface.mjs';
import {contactHeight} from './contact.mjs';
import {SphereGeometry} from 'three';
import {project,unproject} from './terrain.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initial,makeMesh,changed,channel,route,floorSafe,supported,traverse,scripts,home,softenRoute} from './world.mjs';
const results=[],check=(name,fn)=>{fn();results.push({name,pass:true});};
const base=initial(),mesh=makeMesh(base),cutCells=changed(base,channel),cut=makeMesh(cutCells),target={x:-.4,z:3.4};
check('future path cut keeps both endpoint supports but removes the route',()=>{assert(floorSafe(mesh,home.x,home.z));assert(floorSafe(cut,home.x,home.z));assert(floorSafe(cut,target.x,target.z));assert(route(mesh,[],home,target));assert.equal(route(cut,[],home,target),null);});
check('route restores with the exact original cells',()=>{const restored=makeMesh(base);assert.deepEqual(restored.positions,mesh.positions);assert(route(restored,[],home,target));});
check('route reaches the requested point rather than a substitute nearby bank',()=>{const p=route(mesh,[],home,target);assert.deepEqual(p.at(-1),target);assert(p.every((v,i)=>!i||traverse(mesh,[],p[i-1],v)));});
check('full footprint rejects a dry centre with water beside the foot',()=>{const mock={floor:(x,z)=>Math.abs(x)<.1?.42:-Infinity};assert.equal(floorSafe(mock,0,0),false);});
check('real root set is mandatory and an unsupported point fails the owner',()=>{const o={spec:{id:'probe',x:0,z:0},roots:[{x:0,z:0},{x:0,z:5.6}]};assert.equal(supported(mesh,[o])[0].safe,false);o.roots=[{x:0,z:0},{x:.1,z:.1}];assert.equal(supported(mesh,[o])[0].safe,true);o.roots=[];assert.equal(supported(mesh,[o])[0].safe,false);});
check('vertical wall cannot be stepped over by a coarse graph edge',()=>{const mock={floor:x=>x<0?.42:1.0};assert.equal(traverse(mock,[],{x:-.25,z:0},{x:.25,z:0}),false);});
check('physical obstacles block the body even with dry support',()=>{const wall={spec:{x:0,z:0},roots:[{x:0,z:0}],bands:[{minX:-.4,maxX:.4,minZ:-5,maxZ:5}]};assert.equal(route(mesh,[wall],{x:-1,z:0},{x:1,z:0}),null);});
check('all three replay inputs produce finite nonempty triangle worlds without mutating the start',()=>{for(const script of Object.values(scripts)){let cells=initial();for(const command of script)cells=changed(cells,command);const m=makeMesh(cells);assert(m.positions.length>0);assert(m.positions.every(Number.isFinite));assert(floorSafe(m,home.x,home.z));}assert.deepEqual(initial(),base);});
check('a shore target connects from a nearby safe graph node rather than failing at a rounded index',()=>{const shoreline={floor:(x,z)=>Math.abs(x)<4&&z>-4&&z<3.92?.42:-Infinity};assert(floorSafe(shoreline,-.38,3.74));assert(!floorSafe(shoreline,-.36,3.78));assert(route(shoreline,[],home,{x:-.38,z:3.74}));});
check('deleting a cell leaves an actual water hole instead of soft-union phantom land',()=>{const hole=makeMesh(changed(base,{cells:[[0,0]],delta:-1}));assert(hole.floor(0,0)<.13);});
check('curved world mapping remains invertible throughout the editable area',()=>{for(let z=-7;z<=7;z+=.5)for(let x=-7;x<=7;x+=.5){const q=project(x,z),p=unproject(q.x,q.z);assert(Math.hypot(p.x-x,p.z-z)<1e-6);}});
check('standing at the requested destination never creates a tiny walking detour',()=>assert.deepEqual(route(mesh,[],home,home),[home]));
check('normal smoothing is independent of triangle area at a material seam',()=>{
 const p=[0,0,0,0,0,1,10,0,0,0,0,0,1,0,0,0,2,0],n=surfaceNormals(p);
 assert(Math.abs(n[1]-Math.SQRT1_2)<1e-10);assert(Math.abs(n[2]-Math.SQRT1_2)<1e-10);assert.deepEqual(n.slice(0,3),n.slice(9,12));
});
check('resting visible foot vertices touch sloped ground without penetrating it at any yaw',()=>{
 const a=new SphereGeometry(1,24,12).attributes.position,vertices=[];for(let i=0;i<a.count;i++)if(a.getY(i)<=0)vertices.push({x:a.getX(i)*.1,y:a.getY(i)*.1,z:a.getZ(i)*.14});
 const floor=(x,z)=>.4+x*.18-z*.12,actor={x:.3,y:floor(.3,.7),z:.7},scale=.45,foot={x:-.12,z:.09};
 for(let yaw=0;yaw<Math.PI*2;yaw+=.3){const h=contactHeight(floor,actor,yaw,scale,foot,vertices),errors=vertices.map(p=>{const x=(foot.x+p.x)*scale,z=(foot.z+p.z)*scale;return actor.y+(h+p.y)*scale-floor(actor.x+x*Math.cos(yaw)+z*Math.sin(yaw),actor.z-x*Math.sin(yaw)+z*Math.cos(yaw));});assert(Math.min(...errors)>-1e-10);assert(Math.min(...errors)<1e-10);}
});
check('rounded walking corners keep exact endpoints and never cut across forbidden ground',()=>{
 const path=[{x:-1,z:0},{x:0,z:0},{x:0,z:1}],flat={floor:()=>.42},curved=softenRoute(flat,[],path);assert(curved.length>path.length);assert.deepEqual(curved[0],path[0]);assert.deepEqual(curved.at(-1),path.at(-1));
 const narrow={floor:(x,z)=>Math.abs(z)<.19||Math.abs(x)<.19?.42:-Infinity},guarded=softenRoute(narrow,[],path);assert(guarded.every((p,i)=>!i||traverse(narrow,[],guarded[i-1],p)));
});
check('digging empty water does not create a fake edit or undo entry',()=>assert.deepEqual(changed(base,{cells:[[7,7]],delta:-1}),base));
const output={at:new Date().toISOString(),results,scope:'Targeted geometry/navigation diagnostics; actual owners and continuous UI are checked in the browser separately.'};fs.writeFileSync(new URL('logic-results.json',import.meta.url),JSON.stringify(output,null,2));console.log(JSON.stringify(output,null,2));
