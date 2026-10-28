import * as T from 'three';
import type { Cell, GrowingState } from '../../../src/domain/growingIsland/types';
import type { DerivedPlace } from '../../../src/domain/growingIsland/placeTypes';
import type { SceneLayout } from '../../../src/components/island/growing/sceneLayout';
import { GardenGeometry } from '../../../src/components/island/three/garden/geometry';
import { connectedWaterChannels } from '../../../src/domain/islandLife/waterChannels';
import { waterLayout } from '../../../src/domain/growingIsland/environment';
import { key } from '../../../src/domain/growingIsland/space';

export function waterMethod(): 'generated'|'kit'|'master' {
 const q=new URLSearchParams(typeof location==='undefined'?'':location.search);
 const mode=q.get('waterMethod');
 if(!mode)return 'generated';
 if(!['generated','kit','master'].includes(mode)||q.get('matureTrial')!=='paired'||q.has('trialSave'))throw Error('水庭の方式比較は成熟メモリ試作専用です。');
 return mode as 'generated'|'kit'|'master';
}
// Authored pond outline, clockwise in logical X/Z. Not random radial fields.
export const POND_PROFILE:readonly [number,number][]=[[-.43,-.12],[-.36,-.34],[-.12,-.43],[.14,-.40],[.39,-.24],[.46,.02],[.36,.29],[.12,.42],[-.14,.40],[-.40,.23]];
export const WATER_MODULE_REVISION='hand-shaped-water-kit-v1';
type Owner={id:string;cell:Cell;kind:'water-bowl'|'water-channel'};
export function waterModulePlan(state:GrowingState,place:DerivedPlace,layout:SceneLayout){
 const ids=new Set([...place.mainIds,...place.waterRefs]);
 const supplied=connectedWaterChannels(waterLayout(state,layout.world));
 const owners=state.landmarks.filter((p):p is typeof p&Owner=>Boolean(p.cell)&&ids.has(p.id)&&(p.kind==='water-bowl'||p.kind==='water-channel'&&supplied.has(key(p.cell!))));
 const modules=owners.map(owner=>({owner,ports:owners.filter(other=>other.id!==owner.id&&Math.abs(other.cell.x-owner.cell.x)+Math.abs(other.cell.z-owner.cell.z)===1).map(other=>({id:other.id,x:other.cell.x-owner.cell.x,z:other.cell.z-owner.cell.z}))}));
 return {modules,revision:WATER_MODULE_REVISION+':'+modules.map(m=>`${m.owner.id}@${key(m.owner.cell)}>${m.ports.map(p=>p.id).sort().join(',')}`).join('|')};
}
/** Assembles hand-shaped modules on actual floor. It cannot grant land or targets. */
export function buildWaterModules(g:GardenGeometry,state:GrowingState,layout:SceneLayout,place:DerivedPlace){
 if(waterMethod()==='generated'||!['grown','lived'].includes(place.stage))return false;
 const plan=waterModulePlan(state,place,layout),root=new T.Group();root.name='water-module-kit';root.userData.moduleRevision=plan.revision;g.root.add(root);
 const water=new T.MeshPhysicalMaterial({color:'#65bccd',roughness:.2,metalness:.02,clearcoat:.8,side:T.DoubleSide});
 const sand=g.paint('#b2b1a1',.97),bank=g.paint('#8f9d92',1),deep=g.paint('#4896b3',.6);
 let rejectedFaces=0,faces=0;
 function patch(points:Cell[],height:number,material:T.Material,parent:T.Group,name:string){
  const vertices:number[]=[],indices:number[]=[];
  // Every fan triangle is independently supported, including its centroid.
  for(let i=1;i<points.length-1;i++){
   const tri=[points[0],points[i],points[i+1]],center={x:tri.reduce((n,p)=>n+p.x,0)/3,z:tri.reduce((n,p)=>n+p.z,0)/3};
   if([...tri,center].some(p=>!layout.world.floorAt(p))){rejectedFaces++;continue;}
   const start=vertices.length/3;for(const p of tri){const at=layout.point(p,height);vertices.push(at.x,at.y,at.z);}indices.push(start,start+2,start+1);faces++;
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();
  const mesh=g.mesh(geo,material,[0,0,0],parent);mesh.name=name;mesh.castShadow=false;mesh.userData.visualOnly=true;mesh.userData.floorOffset=height;
 }
 for(const {owner,ports} of plan.modules){
  const group=new T.Group();group.name=`water-module-${owner.kind}`;group.userData.ownerId=owner.id;group.userData.objectId=owner.id;group.userData.ports=ports;root.add(group);
  const at=(x:number,z:number):Cell=>({x:owner.cell.x+x,z:owner.cell.z+z});
  if(owner.kind==='water-bowl'){
   // A low shore, a shallow shelf, and a smaller deep centre; all share one outline.
   for(const [scale,height,material,name] of [[1.08,.012,bank,'bank'],[1,.024,sand,'shore'],[.86,.032,water,'water'],[.55,.034,deep,'depth']] as const){
    const curve=new T.SplineCurve(POND_PROFILE.map(([x,z])=>new T.Vector2(x*scale,z*scale)).concat([new T.Vector2(POND_PROFILE[0][0]*scale,POND_PROFILE[0][1]*scale)]));
    const perimeter=curve.getPoints(64).map(p=>at(p.x,p.y));patch([owner.cell,...perimeter],height,material,group,`module-pond-${name}`);
   }
   // Designed stone group stays inside the occupied bowl cell, away from ports.
   for(const [x,z,s] of [[-.29,-.22,.075],[-.18,-.32,.055],[-.34,-.08,.04]]){
    if(ports.some(p=>p.x*x+p.z*z>.16))continue;
    const p=layout.point(at(x,z),.045);g.pebble('#adb2ab',[p.x,p.y,p.z],[s,s*.45,s*.75],group).name='module-bank-stone';
   }
  }else{
   // Centre tile plus port strips form straight, elbow, tee and end modules.
   patch([at(-.17,-.17),at(.17,-.17),at(.17,.17),at(-.17,.17)],.022,sand,group,'module-channel-shore');
   patch([at(-.115,-.115),at(.115,-.115),at(.115,.115),at(-.115,.115)],.033,water,group,'module-channel-water');
  }
  for(const port of ports){
   const dx=port.x,dz=port.z,nx=-dz,nz=dx;
   for(const [width,height,material,name] of [[.17,.022,sand,'shore'],[.115,.033,water,'water']] as const){
    patch([at(-nx*width,-nz*width),at(dx*.5-nx*width,dz*.5-nz*width),at(dx*.5+nx*width,dz*.5+nz*width),at(nx*width,nz*width)],height,material,group,`module-port-${name}`);
   }
  }
  // Supplied channels keep their genuine walkable crossing visually dry.
  if(owner.kind==='water-channel')for(const d of [-.2,0,.2]){
   const horizontal=ports.some(p=>p.x!==0),x=horizontal?0:d,z=horizontal?d:0;
   const c=at(x,z);patch([{x:c.x-.075,z:c.z-.065},{x:c.x+.075,z:c.z-.065},{x:c.x+.075,z:c.z+.065},{x:c.x-.075,z:c.z+.065}],.041,sand,group,'module-stepping-inlay');
  }
  group.traverse(o=>{o.userData.ownerId=owner.id;o.userData.objectId=owner.id;});
 }
 root.userData.acceptedFaces=faces;root.userData.rejectedFaces=rejectedFaces;
 return true;
}
