import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SIZE, SPACING, WATER, world, protectedCell, sampleHeight, TerrainHistory, countIslands } from './terrain.mjs';

const canvas=document.querySelector('canvas'), stage=document.querySelector('#stage');
const reaction=document.querySelector('#reaction'), history=new TerrainHistory();
document.body.dataset.revision=STUDY_REVISION;
let tool='raise', selected={x:9,z:8}, evening=false, sound=false, audio=null, visible=true;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let renderer;
try { renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false}); }
catch { document.querySelector('#loading').textContent='3Dをひらけませんでした。ブラウザの3D表示を確認して、再読み込みしてみてください。'; throw new Error('WebGL unavailable'); }
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.18;
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene(); scene.background=new THREE.Color('#a9d8eb'); scene.fog=new THREE.Fog('#a9d8eb',25,60);
const camera=new THREE.OrthographicCamera(-9,9,7, -7,0.1,100);
camera.position.set(11,12,15);
const controls=new OrbitControls(camera,canvas); controls.target.set(-0.2,0.15,0);
controls.enablePan=false; controls.enableDamping=false; controls.minZoom=.65; controls.maxZoom=2.3;
controls.minPolarAngle=.22; controls.maxPolarAngle=1.15; controls.update();
controls.mouseButtons.LEFT=THREE.MOUSE.ROTATE; controls.touches.ONE=THREE.TOUCH.ROTATE; controls.touches.TWO=THREE.TOUCH.DOLLY_ROTATE;
const sky=new THREE.HemisphereLight('#e9f5ff','#9380a4',2.4); scene.add(sky);
const sun=new THREE.DirectionalLight('#fff0db',3.2); sun.position.set(-7,14,8); sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024); Object.assign(sun.shadow.camera,{left:-9,right:9,top:9,bottom:-9,near:1,far:35});
sun.shadow.normalBias=.035; sun.shadow.bias=-.0002; scene.add(sun);
const fill=new THREE.DirectionalLight('#b3c9ff',.7); fill.position.set(8,5,-7); scene.add(fill);
const seaMaterial=new THREE.MeshStandardMaterial({color:'#72bdd8',roughness:.34,metalness:.08});
const sea=new THREE.Mesh(new THREE.PlaneGeometry(160,160),seaMaterial); sea.rotation.x=-Math.PI/2; sea.position.y=WATER; sea.receiveShadow=true; scene.add(sea);
const terrain=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.98}));
terrain.castShadow=true; terrain.receiveShadow=true; scene.add(terrain);
const nature=new THREE.Group(); scene.add(nature);
const materials={trunk:mat('#967365'),purple:mat('#a495d5'),lilac:mat('#c1aae8'),leaf:mat('#c6d6ac'),flower:mat('#e4a3c8'),stone:mat('#c8c5cd'),roof:mat('#d28c75'),wall:mat('#f4e6d0'),wood:mat('#9b766a'),window:mat('#e7be77'),duck:mat('#fff2ca'),beak:mat('#e9a65c'),eye:mat('#403e58')};
const geometries={ball:new THREE.IcosahedronGeometry(1,2), trunk:new THREE.CylinderGeometry(.06,.09,1,7),box:new THREE.BoxGeometry(1,1,1),cone:new THREE.ConeGeometry(.85,.65,4),ring:new THREE.RingGeometry(.33,.35,48)};
function mat(color) { return new THREE.MeshStandardMaterial({color,roughness:.9}); }
function mesh(parent,geo,material,position,scale=[1,1,1]) {const m=new THREE.Mesh(geo,material);m.position.set(...position);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
const home=new THREE.Group(); home.position.set(world(6),sampleHeight(history.state,world(6),world(7.3)),world(7.3));scene.add(home);
mesh(home,geometries.box,materials.wall,[0,.39,0],[.95,.78,.87]);
const roof=mesh(home,geometries.cone,materials.roof,[0,.95,0],[1.02,1,1]);roof.rotation.y=Math.PI/4;
mesh(home,geometries.box,materials.wood,[.2,.24,.445],[.22,.48,.035]);
mesh(home,geometries.box,materials.window,[-.23,.46,.448],[.22,.22,.04]);
for(let i=0;i<3;i++) mesh(home,geometries.box,materials.stone,[.2,.018,.7+i*.28],[.26,.036,.22]);
const lamp=new THREE.PointLight('#ffc97d',0,3);lamp.position.set(world(6),1.15,world(8));scene.add(lamp);
const cursor=new THREE.Mesh(new THREE.TorusGeometry(.28,.025,8,48),new THREE.MeshBasicMaterial({color:'#fff7d2',depthTest:false}));cursor.rotation.x=Math.PI/2;cursor.renderOrder=5;scene.add(cursor);
const bird=new THREE.Group(); scene.add(bird);bird.visible=false;
mesh(bird,geometries.ball,materials.duck,[0,.15,0],[.24,.16,.16]);
mesh(bird,geometries.ball,materials.duck,[.17,.29,0],[.13,.13,.12]);
mesh(bird,geometries.ball,materials.beak,[.29,.27,0],[.1,.035,.06]);
mesh(bird,geometries.ball,materials.eye,[.21,.32,.105],[.018,.018,.018]);
const rippleMaterial=new THREE.MeshBasicMaterial({color:'#d9f3fa',transparent:true,opacity:.7,side:THREE.DoubleSide});
const ripple=new THREE.Mesh(geometries.ring,rippleMaterial);ripple.rotation.x=-Math.PI/2;ripple.position.y=.015;bird.add(ripple);
const waveLines=new THREE.Group();scene.add(waveLines);
for(let i=0;i<17;i++) {const points=[];for(let j=0;j<=20;j++)points.push(new THREE.Vector3(-12+j*.16,WATER+.012,4+i*.36+Math.sin(j*.18+i)*.04));const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:'#b7e1ea',transparent:true,opacity:.34}));line.position.x=(i%5)*4.5;waveLines.add(line);}
function rebuildTerrain() {
  const n=(SIZE-1)*5, min=world(0), length=world(SIZE-1)-min;
  const positions=[], colors=[];
  const sand=new THREE.Color('#dec8ab'),grass=new THREE.Color('#b9ca8e'),cliff=new THREE.Color('#bca9a2'),top=new THREE.Color('#c2b4bb');
  function vertex(ix,iz) {const x=min+ix/n*length,z=min+iz/n*length; return [x,sampleHeight(history.state,x,z),z];}
  for(let z=0;z<n;z++) for(let x=0;x<n;x++) {
    const a=vertex(x,z),b=vertex(x+1,z),c=vertex(x,z+1),d=vertex(x+1,z+1);
    for(const tri of [[a,c,b],[b,c,d]]) {
      const y=(tri[0][1]+tri[1][1]+tri[2][1])/3;
      const spread=Math.max(...tri.map(v=>v[1]))-Math.min(...tri.map(v=>v[1]));
      const color=y<.27?sand.clone():spread>.08?cliff.clone():y>1.4?top.clone():grass.clone();
      color.multiplyScalar(.96+Math.sin(x*1.7+z*2.4)*.018);
      for(const v of tri) {positions.push(...v);colors.push(color.r,color.g,color.b);}
    }
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
  terrain.geometry.dispose();terrain.geometry=geo;
  nature.clear();
  for(const index of history.state.plants) {
    if(history.state.heights[index]===0)continue;
    const x=index%SIZE,z=Math.floor(index/SIZE), wx=world(x),wz=world(z),y=sampleHeight(history.state,wx,wz);
    const tree=new THREE.Group();tree.position.set(wx,y,wz);nature.add(tree);
    mesh(tree,geometries.trunk,materials.trunk,[0,.37,0],[1,.74,1]);
    const crown=index%3===0?materials.leaf:index%2?materials.purple:materials.lilac;
    const s=.51+(index%3)*.07;
    mesh(tree,geometries.ball,crown,[0,.94,0],[s,s*.9,s*.8]);
    mesh(tree,geometries.ball,crown,[-.24,.81,.08],[s*.65,s*.67,s*.68]);
    mesh(tree,geometries.ball,crown,[.22,.82,-.12],[s*.72,s*.72,s*.7]);
    if(index%2)for(let i=0;i<3;i++)mesh(tree,geometries.ball,materials.flower,[.18-i*.18,1.14-i*.08,.3],[.055,.045,.035]);
  }
  for(let z=2;z<SIZE-2;z++) for(let x=2;x<SIZE-2;x++) {
    if(history.state.heights[z*SIZE+x]===0||protectedCell(x,z)||(x*7+z*3)%11)continue;
    const wx=world(x)+.1,wz=world(z)-.12,y=sampleHeight(history.state,wx,wz);
    for(let i=0;i<3;i++)mesh(nature,geometries.ball,materials.flower,[wx+i*.09,y+.07,wz+i*.04],[.065,.07,.06]);
  }
  bird.visible=!!history.state.bird;
  if(history.state.bird)bird.position.set(world(history.state.bird.x),WATER+.015,world(history.state.bird.z));
  updateUI(); positionCursor(); draw(); animationState();
}
function positionCursor() {cursor.position.set(world(selected.x),Math.max(WATER,sampleHeight(history.state,world(selected.x),world(selected.z)))+.05,world(selected.z));}
const map=document.querySelector('#map'),cells=[];
for(let z=1;z<SIZE-1;z++) for(let x=1;x<SIZE-1;x++) {
  const button=document.createElement('button');button.dataset.x=x;button.dataset.z=z;
  button.addEventListener('click',()=>{selected={x,z};apply();});
  map.append(button);cells.push(button);
}
function updateUI() {
  document.querySelector('#undo').disabled=!history.past.length;document.querySelector('#redo').disabled=!history.future.length;
  const islands=countIslands(history.state);document.querySelector('#islands').textContent=islands===1?'ひとつの島':`${islands}つの島`;
  document.body.dataset.islands=islands;document.body.dataset.bird=String(!!history.state.bird);document.body.dataset.edits=history.past.length;
  for(const cell of cells) {
    const x=Number(cell.dataset.x),z=Number(cell.dataset.z),level=history.state.heights[z*SIZE+x];
    cell.dataset.height=level;cell.className=protectedCell(x,z)?'home':level===0?'sea':level>1?'hill':'land';
    cell.setAttribute('aria-label',`地点 ${x},${z}、${protectedCell(x,z)?'家の足場':level===0?'海':`高さ${level}の陸`}`);
    cell.setAttribute('aria-current',String(x===selected.x&&z===selected.z));
    cell.textContent=protectedCell(x,z)&&x===6&&z===7?'⌂':'';
  }
}
function say(text){reaction.textContent=text;}
function apply(){
  const result=history.edit(selected.x,selected.z,tool);say(result.message);
  if(result.changed) {rebuildTerrain();ping(tool==='lower'?290:tool==='plant'?620:430);}
  else {positionCursor();updateUI();draw();}
}
function undo(){if(history.undo()){say('ひとつ前の地形と景色に戻った。');rebuildTerrain();}}
function redo(){if(history.redo()){say('さっきの地形と景色を、もう一度。');rebuildTerrain();}}
function setTool(next){
  tool=next;document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===tool)));
  controls.enableRotate=tool==='view';controls.enableZoom=true;
  controls.touches.ONE=tool==='view'?THREE.TOUCH.ROTATE:null;
  canvas.style.cursor=tool==='view'?'grab':'crosshair';cursor.visible=tool!=='view';
  say(tool==='view'?'島をドラッグして、ちがう角度からながめよう。':tool==='lower'?'陸をタップ。低くすると、水が入り込む。':tool==='plant'?'陸をタップ。同じ地面に木が根をおろす。':'陸や海をタップ。同じ場所を重ねて、丘にしてみよう。');draw();
}
document.querySelectorAll('[data-tool]').forEach(button=>button.addEventListener('click',()=>setTool(button.dataset.tool)));
document.querySelector('#undo').addEventListener('click',undo);document.querySelector('#redo').addEventListener('click',redo);
document.querySelector('#reset').addEventListener('click',()=>{history.restart();say('はじめの島へ。戻すボタンで、さっきの景色にも戻れるよ。');rebuildTerrain();});
document.querySelector('#light').addEventListener('click',()=>{
  evening=!evening;const button=document.querySelector('#light');button.setAttribute('aria-pressed',String(evening));button.textContent=evening?'昼にする':'夕方にする';
  scene.background.set(evening?'#c2a7ce':'#a9d8eb');scene.fog.color.copy(scene.background);
  sky.intensity=evening?1.25:2.4;sun.intensity=evening?2:3.2;sun.color.set(evening?'#ffd1ab':'#fff0db');sun.position.set(evening?-12:-7,evening?6:14,8);
  seaMaterial.color.set(evening?'#938dc1':'#72bdd8');lamp.intensity=evening?3:0;materials.window.emissive.set(evening?'#ffb95c':'#000000');draw();
});
document.querySelector('#sound').addEventListener('click',async()=>{
  try {
    sound=!sound;
    if(sound){audio??=new AudioContext();await audio.resume();if(audio.state!=='running')throw new Error('Audio unavailable');}
    else if(audio)await audio.suspend();
  }catch{sound=false;say('今は音をひらけないので、音なしで遊べるよ。');}
  const b=document.querySelector('#sound');b.setAttribute('aria-pressed',String(sound));b.textContent=sound?'音を消す':'音をつける';if(sound)ping(520);
});
function ping(hz){if(!sound||!audio||audio.state!=='running'||document.hidden)return;const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.setValueAtTime(hz,audio.currentTime);o.frequency.exponentialRampToValueAtTime(hz*.75,audio.currentTime+.15);g.gain.setValueAtTime(0,audio.currentTime);g.gain.linearRampToValueAtTime(.035,audio.currentTime+.012);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.19);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+.21);}
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=null,pinching=false;
const activePointers=new Set();
canvas.addEventListener('pointerdown',event=>{activePointers.add(event.pointerId);if(activePointers.size>1){pinching=true;down=null;}else down={x:event.clientX,y:event.clientY,id:event.pointerId};});
canvas.addEventListener('pointerup',event=>{
  activePointers.delete(event.pointerId);
  if(pinching){if(!activePointers.size)pinching=false;down=null;return;}
  if(tool==='view'||!down||down.id!==event.pointerId||Math.hypot(event.clientX-down.x,event.clientY-down.y)>9){down=null;return;}
  down=null;const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
  const hit=raycaster.intersectObjects([terrain,sea])[0];if(!hit)return;
  const x=Math.round(hit.point.x/SPACING+(SIZE-1)/2),z=Math.round(hit.point.z/SPACING+(SIZE-1)/2);
  if(x<1||z<1||x>SIZE-2||z>SIZE-2){say('少し島の近くをタップしてみよう。');return;}
  selected={x,z};apply();
});
canvas.addEventListener('pointercancel',event=>{activePointers.delete(event.pointerId);if(!activePointers.size)pinching=false;down=null;});
canvas.addEventListener('keydown',event=>{
  const deltas={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  if(deltas[event.key]){event.preventDefault();selected.x=Math.max(1,Math.min(SIZE-2,selected.x+deltas[event.key][0]));selected.z=Math.max(1,Math.min(SIZE-2,selected.z+deltas[event.key][1]));positionCursor();updateUI();say(`選んだ場所：${selected.x},${selected.z}。Enterで${tool==='lower'?'掘る':tool==='plant'?'植える':'盛る'}。`);draw();}
  if(event.key==='Enter'||event.key===' '){event.preventDefault();apply();}
});
document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();if(event.shiftKey)redo();else undo();}});
function resize(){const w=stage.clientWidth,h=stage.clientHeight,aspect=w/h;const span=aspect<1?5.4:3.9;camera.left=-span*aspect;camera.right=span*aspect;camera.top=span;camera.bottom=-span;camera.updateProjectionMatrix();renderer.setSize(w,h,false);draw();}
function draw(){renderer.render(scene,camera);}
controls.addEventListener('change',draw);
new ResizeObserver(resize).observe(stage);
let frame=0;
function animate(time){frame=0;if(!visible||reduced.matches)return;if(bird.visible){bird.rotation.y=Math.sin(time*.00055)*.28;bird.position.y=WATER+.02+Math.sin(time*.002)*.012;ripple.scale.setScalar(1+Math.sin(time*.0018)*.09);}draw();frame=requestAnimationFrame(animate);}
function animationState(){if(frame)cancelAnimationFrame(frame);frame=0;if(!document.hidden&&!reduced.matches&&bird.visible)frame=requestAnimationFrame(animate);else draw();}
document.addEventListener('visibilitychange',()=>{visible=!document.hidden;if(document.hidden&&audio)audio.suspend();else if(sound&&audio)audio.resume().catch(()=>{});animationState();});
reduced.addEventListener('change',animationState);
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();say('3Dの表示が休んでいます。再読み込みで島をひらけます。');});
setTool('raise');rebuildTerrain();resize();document.querySelector('#loading').hidden=true;
document.body.dataset.ready='true';animationState();
