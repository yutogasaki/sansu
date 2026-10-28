// Angle weighting prevents uneven contour triangle lengths from making vertical stripes.
// Weld normals by position only: material colors keep their own vertices.
export function surfaceNormals(positions) {
 const sums=new Map(),keys=positions.map((_,i)=>i%3===0?positions.slice(i,i+3).map(v=>Math.round(v*1e5)).join(','):null);
 for(let i=0;i<positions.length;i+=9){
  const p=[0,3,6].map(j=>positions.slice(i+j,i+j+3));
  const a=p[1].map((v,j)=>v-p[0][j]),b=p[2].map((v,j)=>v-p[0][j]);
  const n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=Math.hypot(...n);
  if(length<1e-12)continue;
  for(let k=0;k<3;k++){
   const u=p[(k+1)%3].map((v,j)=>v-p[k][j]),v=p[(k+2)%3].map((v,j)=>v-p[k][j]);
   const angle=Math.acos(Math.max(-1,Math.min(1,u.reduce((s,x,j)=>s+x*v[j],0)/(Math.hypot(...u)*Math.hypot(...v)))));
   const key=keys[i+k*3],sum=sums.get(key)||[0,0,0];for(let j=0;j<3;j++)sum[j]+=n[j]/length*angle;sums.set(key,sum);
  }
 }
 const normals=[];for(let i=0;i<positions.length;i+=3){const s=sums.get(keys[i])||[0,1,0],length=Math.hypot(...s)||1;normals.push(...s.map(v=>v/length));}return normals;
}

// Color detail only. Geometry, silhouettes and the CPU floor are never displaced here.
export function finishMaterial(material){
 material.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float terrainKind; varying float vKind; varying vec3 vSurface;').replace('#include <begin_vertex>','#include <begin_vertex>\nvKind=terrainKind; vSurface=position;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
 varying float vKind; varying vec3 vSurface;
 float grainHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
 float grain(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(grainHash(i),grainHash(i+vec3(1,0,0)),f.x),mix(grainHash(i+vec3(0,1,0)),grainHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(grainHash(i+vec3(0,0,1)),grainHash(i+vec3(1,0,1)),f.x),mix(grainHash(i+vec3(0,1,1)),grainHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
 `).replace('#include <color_fragment>',`#include <color_fragment>
 float small=grain(vSurface*65.);
 float medium=grain(vSurface*18.);
 float visibleFine=1.-smoothstep(.025,.065,length(fwidth(vSurface)));
 float textureValue=1.+.09*(medium-.5)+visibleFine*.075*(small-.5);
 if(vKind>1.5 && vKind<3.5){
   float strata=grain(vec3(vSurface.x*3.,vSurface.y*25.+grain(vSurface*3.)*.7,vSurface.z*3.));
   textureValue=1.+.18*(strata-.5)+visibleFine*.16*(small-.5);
 }
 diffuseColor.rgb*=textureValue;
 `);
 };
 material.customProgramCacheKey=()=> 'lived-terrain-detail-1';
 return material;
}
