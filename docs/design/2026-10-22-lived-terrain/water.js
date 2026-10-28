import * as T from 'three';
import {field,hash,noise,unproject} from './terrain.mjs';

let baked;
export function shoreTexture(cells){
 const n=256,span=16,data=new Uint8Array(n*n*4),raw=field(cells,'blend',1);
 if(!baked){baked=[];for(let j=0;j<n;j++)for(let i=0;i<n;i++){
  const x=(i/n-.5)*span,z=(.5-j/n)*span,logical=unproject(x,z);
  const u=x*2.4+.22*Math.sin(z*1.4),v=z*2.4+.22*Math.sin(x*1.6),ix=Math.floor(u),iz=Math.floor(v);let first=10,second=10;
  for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const xx=ix+a,zz=iz+b,r=Math.hypot(u-xx-hash(xx,zz),v-zz-hash(xx+41,zz-9));if(r<first){second=first;first=r;}else if(r<second)second=r;}
  baked.push({x,z,logical,first,second,noise:noise(x*2.3+8,z*2.3-3),swell:2*(noise(x*1.4,z*1.4)-.5)});
 }}
 for(let k=0;k<baked.length;k++){
  const {x,z,logical,first,second,noise:surfaceNoise,swell}=baked[k],d=raw(logical.x,logical.z)*.7,shallow=Math.exp(-Math.max(0,d)*1.7);
  const caustic=Math.exp(-(second-first)*18)*(.015+.985*shallow)*(.35+.65*surfaceNoise),ripple=Math.exp(-Math.pow((d-.25-.015*Math.sin(x*6+z*5))/.055,2));
  const base=[61,159,174],light=[171,218,193];
  for(let c=0;c<3;c++)data[k*4+c]=Math.min(255,base[c]+(light[c]-base[c])*shallow+caustic*32+ripple*18+swell);
  data[k*4+3]=255;
 }
 const texture=new T.DataTexture(data,n,n,T.RGBAFormat);texture.repeat.set(4,4);texture.offset.set(-1.5,-1.5);texture.colorSpace=T.SRGBColorSpace;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearFilter;texture.needsUpdate=true;return texture;
}
