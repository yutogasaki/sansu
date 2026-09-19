// Appended to the asset lab only in the isolated benchmark build.
const stress = {
 ready: false,
 setup: async (count: number, mode: string, kinds: number) => {
  if (![30,100,300].includes(count) || ![3,6,12].includes(kinds)) throw new Error('Unreviewed stress size');
  const templates = current.children.slice() as THREE.Group[];
  scene.remove(current);
  if (kinds > 3) for (let k=3;k<kinds;k++) {
   const a=assets[k%3];
   const template=(await new GLTFLoader().loadAsync(`/assets/island-${a.id}-v1/optimized/model-1024.glb?variant=${k}`)).scene;
   template.scale.setScalar(a.scale); templates.push(template);
  }
  templates.forEach(t=>{t.position.set(0,0,0);t.updateMatrixWorld(true);});
  const side=Math.ceil(Math.sqrt(count/3)), width=side*5;
  const land=new THREE.Mesh(new THREE.CylinderGeometry(width*.77,width*.8,.8,64),materials.get('#72ab50'));
  land.position.y=-.45;land.receiveShadow=true;scene.add(land);
  current=new THREE.Group();scene.add(current);
  const buckets=new Map<string,{template:THREE.Group; matrices:THREE.Matrix4[]}>();
  for(let i=0;i<count;i++) {
   const cell=Math.floor(i/3), col=cell%side,row=Math.floor(cell/side),k=i%kinds;
   const x=(col-(side-1)/2)*5+(i%3-1)*1.2,z=(row-(side-1)/2)*5+(i%3===1?1:0);
   const matrix=new THREE.Matrix4().compose(new THREE.Vector3(x,0,z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),i*.73),new THREE.Vector3(1,1,1));
   if(mode==='shared') {const t=templates[k].clone(true);t.position.set(x,0,z);t.rotation.y=i*.73;current.add(t);}
   else {const key=`${k}:${Math.floor(col/2)}:${Math.floor(row/2)}`;const b=buckets.get(key)??{template:templates[k],matrices:[]};b.matrices.push(matrix);buckets.set(key,b);}
  }
  for(const b of buckets.values()) b.template.traverse(o=>{if(!(o instanceof THREE.Mesh))return;
   const inst=new THREE.InstancedMesh(o.geometry,o.material,b.matrices.length);
   b.matrices.forEach((m,i)=>inst.setMatrixAt(i,m.clone().multiply(o.matrixWorld)));
   inst.instanceMatrix.needsUpdate=true;inst.computeBoundingSphere();inst.castShadow=true;inst.receiveShadow=true;current.add(inst);
  });
  sun.shadow.camera.left=-width;sun.shadow.camera.right=width;sun.shadow.camera.top=width;sun.shadow.camera.bottom=-width;sun.shadow.camera.updateProjectionMatrix();
  renderer.shadowMap.needsUpdate=true;
  controls.maxDistance=width*6;camera.far=width*8;camera.updateProjectionMatrix();
  stress.width=width;stress.ready=true;
  status.textContent=`${count}個 / ${kinds}種類相当 / ${mode}`;
  document.querySelector('#stats')!.innerHTML='<dt>負荷試験</dt><dd>計測値はreport.json</dd>';
  document.querySelector('footer')!.textContent='island-stress-v1 · synthetic benchmark · 本番未配信';
  stress.view('overview');
 },
 width:0,
 view:(view:string)=>{
  const w=stress.width;
  controls.target.set(0,.5,0);
  if(view==='overview')camera.position.set(w*.9,w*1.2,w*1.6);
  else {controls.target.set(-w*.25,.5,-w*.25);camera.position.copy(controls.target).add(new THREE.Vector3(6,7,10));}
  controls.update();draw();
 },
 snapshot:()=>{
  const geometry=new Set<THREE.BufferGeometry>(),textures=new Set<THREE.Texture>();let instances=0;
  scene.traverse(o=>{if(!(o instanceof THREE.Mesh))return;geometry.add(o.geometry);instances+=o instanceof THREE.InstancedMesh?o.count:1;
   for(const m of Array.isArray(o.material)?o.material:[o.material])for(const v of Object.values(m))if(v instanceof THREE.Texture)textures.add(v);
  });
  let geometryBytes=0,textureEstimateBytes=0;
  geometry.forEach(g=>{geometryBytes+=g.index?.array.byteLength??0;Object.values(g.attributes).forEach(a=>geometryBytes+=a.array.byteLength);});
  textures.forEach(t=>{const im=t.image;if(im?.width&&im?.height)textureEstimateBytes+=im.width*im.height*4*(t.generateMipmaps?4/3:1);});
  draw();return {geometryBytes,textureEstimateBytes,textures:textures.size,gpuTextures:renderer.info.memory.textures,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,instances};
 },
 measure:async(moving:boolean,shadowUpdate:boolean)=>{
  const frames:number[]=[],cpu:number[]=[];let last=0;
  const base=camera.position.clone(),target=controls.target.clone();
  for(let i=0;i<45;i++) {
   const time=await new Promise<number>(r=>requestAnimationFrame(r));
   if(i>10)frames.push(time-last);last=time;
   const start=performance.now();
   if(moving){camera.position.x=base.x+i*.08;controls.target.x=target.x+i*.08;camera.lookAt(controls.target);}
   if(shadowUpdate)renderer.shadowMap.needsUpdate=true;
   draw();if(i>10)cpu.push(performance.now()-start);
  }
  return {frames,cpu,...stress.snapshot()};
 }
};
Object.assign(window,{__stress:stress});
