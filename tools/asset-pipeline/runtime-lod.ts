// Isolated benchmark adapter: compressed assets and screen-size LOD.
const profile = new URLSearchParams(location.search).get('profile') || 'original';
const originalSetup = stress.setup;
const lodMeshes: THREE.Mesh[] = [];
stress.setup = async (count, mode, kinds) => {
 await originalSetup(count,mode,kinds);
 if(profile!=='lod')return;
 const far=await Promise.all(assets.map(async a=>{
  const model=await new GLTFLoader().loadAsync(`/assets/island-${a.id}-v1/runtime/far-geometry.glb`);
  let geometry:THREE.BufferGeometry|undefined;
  model.scene.traverse(o=>{if(o instanceof THREE.Mesh)geometry=o.geometry;});
  if(!geometry)throw new Error('Missing far geometry');return geometry;
 }));
 current.children.forEach((group,i)=>group.traverse(o=>{
  if(!(o instanceof THREE.Mesh))return;
  o.geometry.computeBoundingSphere();
  o.userData.nearGeometry=o.geometry;o.userData.farGeometry=far[i%3];o.userData.far=false;
  const farMesh=new THREE.Mesh(far[i%3],o.material);farMesh.position.copy(o.position);farMesh.quaternion.copy(o.quaternion);farMesh.scale.copy(o.scale);farMesh.castShadow=o.castShadow;farMesh.receiveShadow=o.receiveShadow;farMesh.visible=false;o.userData.farMesh=farMesh;
  lodMeshes.push(o);
 }));
 for(const o of lodMeshes)o.parent!.add(o.userData.farMesh);
 draw();
};
const baseDraw=draw;
const worldPosition=new THREE.Vector3(),worldScale=new THREE.Vector3();
draw=()=>{
 let changed=false;
 for(const o of lodMeshes){
  const g=o.userData.nearGeometry as THREE.BufferGeometry;
  o.getWorldPosition(worldPosition);o.getWorldScale(worldScale);
  const pixels=g.boundingSphere!.radius*2*Math.max(worldScale.x,worldScale.y,worldScale.z)*viewport.clientHeight/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.position.distanceTo(worldPosition));
  const far=o.userData.far ? pixels<32 : pixels<24;
  if(far!==o.userData.far){o.visible=!far;o.userData.farMesh.visible=far;o.userData.far=far;changed=true;}
 }
 if(changed)renderer.shadowMap.needsUpdate=true;
 baseDraw();
};
const previousSnapshot=stress.snapshot;
stress.snapshot=()=>{
 const snapshot=previousSnapshot();
 const textures=new Set<THREE.Texture>();scene.traverse(o=>{if(!(o instanceof THREE.Mesh))return;for(const m of Array.isArray(o.material)?o.material:[o.material])for(const v of Object.values(m))if(v instanceof THREE.Texture)textures.add(v);});
 let texturePayloadBytes=0;const formats:number[]=[];
 textures.forEach(t=>{if(t instanceof THREE.CompressedTexture){formats.push(t.format);for(const mip of t.mipmaps)texturePayloadBytes+=mip.data.byteLength;}else{const im=t.image;if(im?.width&&im?.height)texturePayloadBytes+=im.width*im.height*4*(t.generateMipmaps?4/3:1);}});
 return {...snapshot,texturePayloadBytes,compressedTextureCount:formats.length,formats,farCount:lodMeshes.filter(o=>o.userData.far).length,nearCount:lodMeshes.filter(o=>!o.userData.far).length};
};
Object.assign(window,{__runtimeLod:{profile,forceNear:()=>{for(const o of lodMeshes){o.visible=true;o.userData.farMesh.visible=false;}renderer.shadowMap.needsUpdate=true;baseDraw();},shadows:(enabled:boolean)=>{renderer.shadowMap.enabled=enabled;scene.traverse(o=>{if(o instanceof THREE.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])m.needsUpdate=true;});draw();},focus:(id:number)=>{
 const target=new THREE.Box3().setFromObject(current.children[id]).getCenter(new THREE.Vector3());controls.target.copy(target);camera.position.copy(target).add(new THREE.Vector3(2,1.5,3));controls.update();draw();
}}});
