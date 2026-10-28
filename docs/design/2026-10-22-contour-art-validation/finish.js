import * as T from 'three';
import {field,hash,noise} from './terrain.mjs';

export function shoreTexture(cells){
 const n=384,span=16,data=new Uint8Array(n*n*4),f=field(cells,'blend',1);
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){
  const x=(i/n-.5)*span,z=(.5-j/n)*span,d=f(x,z),shallow=Math.exp(-Math.max(0,d)*1.7);
  const u=x*2.4+.22*Math.sin(z*1.4),v=z*2.4+.22*Math.sin(x*1.6),ix=Math.floor(u),iz=Math.floor(v);let first=10,second=10;
  for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const xx=ix+a,zz=iz+b,r=Math.hypot(u-xx-hash(xx,zz),v-zz-hash(xx+41,zz-9));if(r<first){second=first;first=r;}else if(r<second)second=r;}
  const caustic=Math.exp(-(second-first)*18)*(.015+.985*shallow)*(.35+.65*noise(x*2.3+8,z*2.3-3)),ripple=Math.exp(-Math.pow((d-.25-.015*Math.sin(x*6+z*5))/.055,2));
  const swell=2*(noise(x*1.4,z*1.4)-.5),base=[61,159,174],light=[171,218,193],k=(j*n+i)*4;
  for(let c=0;c<3;c++)data[k+c]=Math.min(255,base[c]+(light[c]-base[c])*shallow+caustic*32+ripple*18+swell);
  data[k+3]=255;
 }
 const texture=new T.DataTexture(data,n,n,T.RGBAFormat);texture.repeat.set(4,4);texture.offset.set(-1.5,-1.5);texture.colorSpace=T.SRGBColorSpace;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearFilter;texture.needsUpdate=true;return texture;
}
export function vegetation(mesh,cells){
 const group=new T.Group(),positions=[],colors=[],roots=[],f=field(cells,'blend',1);
 const c1=new T.Color('#739a38'),c2=new T.Color('#b9c86b');
 const nearest=(x,z)=>cells.filter(c=>c.h>0).reduce((a,c)=>Math.hypot(x-c.x,z-c.z)<Math.hypot(x-a.x,z-a.z)?c:a,cells.find(c=>c.h>0));
 for(let iz=-23;iz<=23;iz++)for(let ix=-23;ix<=23;ix++){
  const x=ix*.12+(hash(ix,iz)-.5)*.1,z=iz*.12+(hash(ix+91,iz)-.5)*.1,c=nearest(x,z);
  if(!c||c.material==='stone'||f(x,z)>-.12||hash(ix+7,iz+9)>.11||noise(x*1.8+6,z*1.8)<.35)continue;
  const y=mesh.floor(x,z);if(!Number.isFinite(y)||y<.06)continue;
  const samples=[[.04,0],[-.04,0],[0,.04],[0,-.04]].map(([dx,dz])=>mesh.floor(x+dx,z+dz));if(samples.some(h=>Math.abs(h-y)>.035))continue;
  roots.push({x,y,z});const height=.055+hash(ix-3,iz+5)*.12;
  for(let b=0;b<3;b++){const angle=hash(ix+b,iz-b)*Math.PI*2,dx=Math.cos(angle)*.019,dz=Math.sin(angle)*.019,leanX=Math.cos(angle+.8)*height*.35,leanZ=Math.sin(angle+.8)*height*.35;
   positions.push(x-dx,y-.004,z-dz,x+dx,y-.004,z+dz,x+leanX,y+height,z+leanZ);colors.push(...c1.toArray(),...c1.toArray(),...c2.toArray());}
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();const grass=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:1}));grass.receiveShadow=true;group.add(grass);
 const pebbleGeometry=new T.IcosahedronGeometry(1,1),pebbleMaterial=new T.MeshStandardMaterial({color:'#b9b9a0',roughness:1});
 for(let i=0;i<25;i++){const x=(hash(i,47)-.5)*5,z=(hash(i,93)-.5)*5,y=mesh.floor(x,z),c=nearest(x,z);if(!c||c.material==='stone'||!Number.isFinite(y)||y<.06||f(x,z)>-.15)continue;const rock=new T.Mesh(pebbleGeometry,pebbleMaterial);rock.position.set(x,y+.018,z);rock.scale.set(.035+hash(i,3)*.035,.025,.03+hash(i,6)*.03);rock.rotation.y=i;rock.castShadow=true;rock.receiveShadow=true;group.add(rock);}
 return {group,roots};
}
export function disposeGroup(group){const geometries=new Set(),materials=new Set();group.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
