import * as T from 'three';
import type { Cell } from '../../../src/domain/growingIsland/types';
import type { SceneLayout } from '../../../src/components/island/growing/sceneLayout';
import type { GardenGeometry } from '../../../src/components/island/three/garden/geometry';
export function connectionEnabled() {
    const q=new URLSearchParams(typeof location==='undefined'?'':location.search);
    return q.get('matureTrial')==='paired' && q.get('connectionTrial')==='joined' && !q.has('trialSave');
}
/** Keep the actual gallery in the tree neighbourhood, not a distant member home. */
export function connectedGalleryInput(footprint:Cell[], entrances:Cell[], trees:Cell[], anchor:Cell) {
    if(!connectionEnabled()||!trees.length)return {footprint,entrances,anchor};
    const center={x:trees.reduce((n,c)=>n+c.x,0)/trees.length,z:trees.reduce((n,c)=>n+c.z,0)/trees.length};
    const nearby=(c:Cell)=>trees.some(t=>Math.hypot(c.x-t.x,c.z-t.z)<=1.45);
    const candidates=entrances.filter(nearby), front=candidates.filter(c=>c.z>=center.z);
    return {footprint:footprint.filter(nearby),entrances:front.length?front:candidates,anchor:center};
}
/** Only a feathered material on measured ground; never a support surface. */
export function connectionPatch(g:GardenGeometry,layout:SceneLayout,cells:Cell[],color:string,radius:number,name:string) {
    const vertices:number[]=[],indices:number[]=[],uv:number[]=[];
    for(const cell of cells){
        const n=12;
        for(let z=0;z<n;z++)for(let x=0;x<n;x++){
            const quad=[[0,0],[1,0],[0,1],[1,1]].map(([dx,dz])=>({x:cell.x-radius+2*radius*(x+dx)/n,z:cell.z-radius+2*radius*(z+dz)/n}));
            if(quad.some(p=>!layout.world.floorAt(p)))continue;
            const start=vertices.length/3;
            for(const p of quad){const point=layout.point(p,.006);vertices.push(point.x,point.y,point.z);uv.push((p.x-cell.x)/radius,(p.z-cell.z)/radius);}
            indices.push(start,start+2,start+1,start+1,start+2,start+3);
        }
    }
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
    const material=new T.MeshStandardMaterial({color,roughness:1,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
    material.onBeforeCompile=shader=>{shader.vertexShader='varying vec2 seamUv;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nseamUv=uv;');shader.fragmentShader='varying vec2 seamUv;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat r=length(seamUv); float edge=.88+.045*sin(atan(seamUv.y,seamUv.x)*5.); diffuseColor.a *= .55*(1.-smoothstep(.45,edge,r));');};
    material.customProgramCacheKey=()=>`connection-patch-v1`;
    const mesh=g.mesh(geometry,material);mesh.name=name;mesh.castShadow=false;mesh.userData.visualOnly=true;mesh.userData.floorOffset=.006;
}
/** Ground-following bank strip on the boundary of the existing water surface. */
export function connectionBank(g:GardenGeometry,layout:SceneLayout,geometry:T.BufferGeometry){
    const position=geometry.getAttribute('position'),index=geometry.index;if(!index)return;
    const edges=new Map<string,{a:number;b:number;count:number}>();
    for(let i=0;i<index.count;i+=3)for(let j=0;j<3;j++){const a=index.getX(i+j),b=index.getX(i+(j+1)%3),key=a<b?`${a},${b}`:`${b},${a}`;const old=edges.get(key);if(old)old.count++;else edges.set(key,{a,b,count:1});}
    const vertices:number[]=[],indices:number[]=[];
    for(const {a,b,count} of edges.values()){
        if(count!==1)continue;
        const pa=new T.Vector3().fromBufferAttribute(position,a),pb=new T.Vector3().fromBufferAttribute(position,b),direction=pb.clone().sub(pa).setY(0).normalize(),normal=new T.Vector3(-direction.z,0,direction.x).multiplyScalar(.045);
        const corners=[pa.clone().sub(normal),pa.clone().add(normal),pb.clone().sub(normal),pb.clone().add(normal)].map(p=>layout.logicalAt(p));
        if(corners.some(p=>!layout.world.floorAt(p)))continue;
        const start=vertices.length/3;for(const p of corners){const at=layout.point(p,.037);vertices.push(at.x,at.y,at.z);}indices.push(start,start+2,start+1,start+1,start+2,start+3);
    }
    const bank=new T.BufferGeometry();bank.setAttribute('position',new T.Float32BufferAttribute(vertices,3));bank.setIndex(indices);bank.computeVertexNormals();
    const material=g.paint('#849c96',.98);material.side=T.DoubleSide;
    const mesh=g.mesh(bank,material);mesh.name='place-connected-shore-inlay';mesh.castShadow=false;mesh.userData.visualOnly=true;
}
