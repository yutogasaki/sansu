import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {makeNativeGrowingKit} from '../../../src/components/island/growing/native/nativeGrowingKit.ts';
import {decodeNativeGrowingKit} from '../../../src/components/island/growing/native/decodeNativeGrowingKit.ts';
import {makePokomokoRig} from '../../../src/components/island/three/islandCharacters.ts';
import {IslandMaterials} from '../../../src/components/island/three/primitives.ts';
import {SIZE,SPACING,WATER,world,protectedCell,sampleHeight,TerrainHistory,TREE_SPECS,EDITS,ownerSupports} from './terrain.mjs';
import {canStand,canTraverse,shoreRoute,homeRoute,setPhysicalClear} from './walk.mjs';

const body=document.body,canvas=document.querySelector('canvas'),stage=document.querySelector('#stage');
body.dataset.revision=STUDY_REVISION;
const say=text=>document.querySelector('#reaction').textContent=text;
const history=new TerrainHistory(),homePoint={x:world(6),z:world(9)};
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let selected={x:9,z:8},tool='lower',cameraMode='overview',route=null,walked=0,distance=0,frame=0,lastTime=0;
let renderer;
try{renderer=new T.WebGLRenderer({canvas,antialias:true});}catch(error){document.querySelector('#loading').textContent='3Dをひらけませんでした。再読み込みしてみてください。';throw error;}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
const scene=new T.Scene();scene.background=new T.Color('#afd5e5');
scene.add(new T.HemisphereLight('#edf6ff','#9b90a5',1.8));
const sun=new T.DirectionalLight('#fff0da',2.5);sun.position.set(-6,12,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.normalBias=.03;sun.shadow.bias=-.0002;Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:1,far:35});scene.add(sun);
const camera=new T.OrthographicCamera(-4.6,4.6,5,-5,.1,80);
const controls=new OrbitControls(camera,canvas);controls.enablePan=false;controls.enableRotate=false;controls.minZoom=.65;controls.maxZoom=2.5;controls.minPolarAngle=.3;controls.maxPolarAngle=1.2;
const sea=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshStandardMaterial({color:'#78bbd7',roughness:.28,metalness:.05}));sea.rotation.x=-Math.PI/2;sea.position.y=WATER;sea.receiveShadow=true;scene.add(sea);
const terrain=new T.Mesh(new T.BufferGeometry(),new T.MeshStandardMaterial({vertexColors:true,roughness:.95}));terrain.castShadow=true;terrain.receiveShadow=true;scene.add(terrain);
const shore=new T.LineSegments(new T.BufferGeometry(),new T.LineBasicMaterial({color:'#e1f1e9',transparent:true,opacity:.65}));scene.add(shore);
const routeLine=new T.Line(new T.BufferGeometry(),new T.LineDashedMaterial({color:'#fff6db',dashSize:.09,gapSize:.055}));scene.add(routeLine);
const cursor=new T.Mesh(new T.TorusGeometry(.23,.018,8,40),new T.MeshBasicMaterial({color:'#f5d58b'}));cursor.rotation.x=Math.PI/2;scene.add(cursor);
const footprint=[];const owners=[];let kit;
try{
 const manifest=await(await fetch('../2026-10-11-native-owned-island/kit-manifest.json')).json();
 const response=await fetch('../2026-10-11-native-owned-island/native05-owned-kit.glb.gz');if(!response.ok)throw Error('parts fetch failed');
 const bytes=await decodeNativeGrowingKit(await response.arrayBuffer(),manifest);
 const gltf=await new GLTFLoader().parseAsync(bytes,'');kit=makeNativeGrowingKit(gltf.scene,manifest);body.dataset.kitSha=manifest.gzipSha256;
}catch(error){document.querySelector('#loading').textContent='家と木をひらけませんでした。再読み込みしてみてください。';throw error;}
for(const spec of [{id:'home',part:'home',x:6,z:7.3,yaw:0},...TREE_SPECS]){
 const object=kit.instance(spec.part);object.scale.setScalar(.45);object.rotation.y=spec.yaw;object.position.set(world(spec.x),sampleHeight(history.state,world(spec.x),world(spec.z)),world(spec.z));object.userData.ownerId=spec.id;scene.add(object);object.updateMatrixWorld(true);
 // Triangle envelopes in height bands: conservative solid clearance, including raised ground.
 const bands=[],supportPoints=new Map(),step=.12;
 object.traverse(o=>{if(!o.isMesh)return;const pos=o.geometry.attributes.position,index=o.geometry.index;const vertex=i=>new T.Vector3().fromBufferAttribute(pos,index?index.getX(i):i).applyMatrix4(o.matrixWorld);const count=index?index.count:pos.count;
  for(let i=0;i<count;i+=3){const vs=[vertex(i),vertex(i+1),vertex(i+2)],ys=vs.map(p=>p.y-object.position.y),lo=Math.max(0,Math.floor(Math.min(...ys)/step)),hi=Math.floor(Math.max(...ys)/step);for(let b=lo;b<=hi;b++){bands[b]??={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};for(const p of vs){bands[b].minX=Math.min(bands[b].minX,p.x);bands[b].maxX=Math.max(bands[b].maxX,p.x);bands[b].minZ=Math.min(bands[b].minZ,p.z);bands[b].maxZ=Math.max(bands[b].maxZ,p.z);}}
   for(const p of vs)if(p.y-object.position.y<.09)supportPoints.set(`${Math.round(p.x*20)},${Math.round(p.z*20)}`,{x:p.x,z:p.z});
  }
 });
 footprint.push({id:spec.id,x:object.position.x,z:object.position.z,bands,step,supportPoints:[...supportPoints.values()]});owners.push({spec,object});
}
setPhysicalClear((state,x,z)=>{const y=sampleHeight(state,x,z);return !footprint.some(b=>{const base=sampleHeight(state,b.x,b.z);return b.bands.some((box,i)=>box&&(i+1)*b.step>=y-base+.02&&i*b.step<=y-base+.59&&x>box.minX-.18&&x<box.maxX+.18&&z>box.minZ-.18&&z<box.maxZ+.18);});});
const rig=makePokomokoRig(new IslandMaterials('moon-garden'));const actor=rig.hero;actor.scale.setScalar(.45);actor.position.set(homePoint.x,sampleHeight(history.state,homePoint.x,homePoint.z),homePoint.z);actor.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});scene.add(actor);
function supports(state){return ownerSupports(state)&&footprint.every(b=>{const y=sampleHeight(state,b.x,b.z);return b.supportPoints.every(p=>{const h=sampleHeight(state,p.x,p.z);return h>WATER+.12&&Math.abs(h-y)<.13;});});}
history.guard=state=>supports(state)&&canStand(state,actor.position.x,actor.position.z);
if(!history.guard(history.state))throw Error('Initial support invalid');
function draw(){renderer.render(scene,camera);}
function stop(){route=null;routeLine.visible=false;body.dataset.actorMode='idle';rig.heroBody.rotation.set(0,0,0);rig.heroFeet.forEach(f=>f.position.y=.1);if(frame)cancelAnimationFrame(frame);frame=0;}
function updateFacts(){Object.assign(body.dataset,{actorX:String(actor.position.x),actorZ:String(actor.position.z),actorY:String(actor.position.y),actorGround:String(sampleHeight(history.state,actor.position.x,actor.position.z)),actorSafe:String(canStand(history.state,actor.position.x,actor.position.z)),ownersSafe:String(supports(history.state)),edits:String(history.past.length),state:JSON.stringify(history.state.heights),selected:`${selected.x},${selected.z}`});}
const cells=[];for(let z=1;z<SIZE-1;z++)for(let x=1;x<SIZE-1;x++){const b=document.createElement('button');b.dataset.x=x;b.dataset.z=z;b.addEventListener('click',()=>{selected={x,z};edit();});document.querySelector('#map').append(b);cells.push(b);}
function updateUI(){
 document.querySelector('#undo').disabled=!history.past.length;document.querySelector('#redo').disabled=!history.future.length;
 for(const b of cells){const x=Number(b.dataset.x),z=Number(b.dataset.z),level=history.state.heights[z*SIZE+x],tree=history.state.plants.includes(z*SIZE+x);b.dataset.height=level;b.className=protectedCell(x,z)?'home':tree?'tree':level>0?'land':'';b.textContent=tree?'木':x===6&&z===7?'家':'';b.setAttribute('aria-label',`地点 ${x},${z}、${tree?'木':protectedCell(x,z)?'家の足場':level===0?'海':`高さ${level}の陸`}`);b.setAttribute('aria-current',String(x===selected.x&&z===selected.z));}
 cursor.position.set(world(selected.x),Math.max(WATER,sampleHeight(history.state,world(selected.x),world(selected.z)))+.055,world(selected.z));cursor.visible=tool!=='view';updateFacts();
 document.querySelector('#scene-state').textContent=history.past.length?`${history.past.length}回変えた岸 · 家1軒・木6本`:'はじめの岸 · 家1軒・木6本';
}
function rebuild(){
 const n=(SIZE-1)*16,length=world(SIZE-1)-world(0),geo=new T.PlaneGeometry(length,length,n,n);geo.rotateX(-Math.PI/2);const pos=geo.attributes.position;
 for(let i=0;i<pos.count;i++)pos.setY(i,sampleHeight(history.state,pos.getX(i),pos.getZ(i)));geo.computeVertexNormals();const colors=[],sand=new T.Color('#d9c5b5'),grass=new T.Color('#b8c6b2'),cliff=new T.Color('#aaa8b3');
 for(let i=0;i<pos.count;i++){const y=pos.getY(i),slope=T.MathUtils.smoothstep(geo.attributes.normal.getY(i),.55,.97),c=cliff.clone().lerp(grass,slope);c.lerp(sand,1-T.MathUtils.smoothstep(y,.12,.32));c.multiplyScalar(.99+.015*Math.sin(pos.getX(i)*19+pos.getZ(i)*23));colors.push(c.r,c.g,c.b);}geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));terrain.geometry.dispose();terrain.geometry=geo;
 const points=[],idx=geo.index.array;for(let i=0;i<idx.length;i+=3){const hits=[];for(let e=0;e<3;e++){const a=idx[i+e],b=idx[i+(e+1)%3],ya=pos.getY(a),yb=pos.getY(b);if((ya<WATER)!==(yb<WATER)){const t=(WATER-ya)/(yb-ya);hits.push(pos.getX(a)+(pos.getX(b)-pos.getX(a))*t,WATER+.012,pos.getZ(a)+(pos.getZ(b)-pos.getZ(a))*t);}}if(hits.length===6)points.push(...hits);}
 shore.geometry.dispose();shore.geometry=new T.BufferGeometry();shore.geometry.setAttribute('position',new T.Float32BufferAttribute(points,3));
 for(const{spec,object}of owners)object.position.y=sampleHeight(history.state,world(spec.x),world(spec.z));actor.position.y=sampleHeight(history.state,actor.position.x,actor.position.z);updateUI();draw();
}
function edit(){const result=history.edit(selected.x,selected.z,tool);body.dataset.lastChanged=String(result.changed);if(result.changed){stop();rebuild();}else{updateUI();draw();}say(result.message);}
for(const b of document.querySelectorAll('[data-edit]'))b.addEventListener('click',()=>{const e=EDITS.find(e=>e.id===b.dataset.edit);selected={x:e.x,z:e.z};setTool(e.tool);edit();});
function setTool(next){tool=next;controls.enableRotate=next==='view';controls.touches.ONE=next==='view'?T.TOUCH.ROTATE:null;document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===next)));updateUI();draw();}
document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
for(const direction of ['undo','redo'])document.querySelector('#'+direction).addEventListener('click',()=>{const ok=history[direction]();body.dataset.lastChanged=String(ok);if(ok){stop();rebuild();say(direction==='undo'?'ひとつ前の岸へ戻ったよ。':'さっきの岸に戻ったよ。');}else say('戻す先には、今の足場がないよ。家の前へ呼んでから戻そう。');});
document.querySelector('#reset').addEventListener('click',()=>{stop();history.state=new TerrainHistory().state;history.past=[];history.future=[];actor.position.x=homePoint.x;actor.position.z=homePoint.z;selected={x:9,z:8};rebuild();say('庭とぽこもこを、はじめの状態に戻したよ。');});
function sizeCamera(){const w=stage.clientWidth,h=stage.clientHeight,span=cameraMode==='overview'?8.7:4.8;camera.left=-span/2;camera.right=span/2;camera.top=span*h/w/2;camera.bottom=-camera.top;camera.updateProjectionMatrix();renderer.setSize(w,h,false);draw();}
function setCamera(mode){cameraMode=mode;const c=mode==='overview'?new T.Vector3(0,.8,0):new T.Vector3(-.5,.65,.45);controls.target.copy(c);camera.position.copy(c).add(new T.Vector3(3.5,10,14));camera.zoom=1;controls.update();sizeCamera();body.dataset.camera=mode;document.querySelectorAll('button[data-camera]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.camera===mode)));}
document.querySelectorAll('button[data-camera]').forEach(b=>b.addEventListener('click',()=>setCamera(b.dataset.camera)));controls.addEventListener('change',draw);new ResizeObserver(sizeCamera).observe(stage);
function arrive(){const r=route;route=null;actor.position.x=r.path.at(-1).x;actor.position.z=r.path.at(-1).z;actor.position.y=sampleHeight(history.state,actor.position.x,actor.position.z);actor.rotation.y=Math.atan2(r.look.x-actor.position.x,r.look.z-actor.position.z);rig.heroBody.rotation.set(reduced.matches?0:r.home?0:.12,0,0);rig.heroFeet.forEach(f=>f.position.y=.1);body.dataset.actorMode=r.home?'home':'observing';say(r.home?'家の前へ戻ったよ。':'今の岸から、水面を見ているよ。');updateFacts();draw();}
function tick(time){frame=0;if(document.hidden)return;const dt=Math.min(.05,(time-lastTime)/1000);lastTime=time;if(!route)return;const speed=Math.max(.22,Math.min(1.15,(distance-walked)*2));walked=Math.min(distance,walked+dt*speed);let remain=walked;
 for(let i=1;i<route.path.length;i++){const a=route.path[i-1],b=route.path[i],d=Math.hypot(a.x-b.x,a.z-b.z);if(remain>d){remain-=d;continue;}const t=d?remain/d:1;actor.position.x=a.x+(b.x-a.x)*t;actor.position.z=a.z+(b.z-a.z)*t;actor.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);break;}
 actor.position.y=sampleHeight(history.state,actor.position.x,actor.position.z);rig.heroBody.rotation.z=Math.sin(walked*24)*.025;rig.heroFeet.forEach((f,i)=>f.position.y=.1+Math.max(0,Math.sin(walked*24+i*Math.PI))*.04);updateFacts();draw();if(walked>=distance-.001)arrive();else frame=requestAnimationFrame(tick);
}
function call(home=false){stop();const start={x:actor.position.x,z:actor.position.z},r=home?homeRoute(history.state,start,homePoint):shoreRoute(history.state,start,selected);if(!r){body.dataset.actorMode='unreachable';say('ここへ歩ける道がまだないよ。岸をつなぐか、編集を戻してみよう。');return;}
 route={...r,home};distance=0;walked=0;for(let i=1;i<r.path.length;i++)distance+=Math.hypot(r.path[i].x-r.path[i-1].x,r.path[i].z-r.path[i-1].z);
 body.dataset.route=JSON.stringify(r);body.dataset.routeLength=String(distance);body.dataset.look=JSON.stringify(r.look);body.dataset.routeSafe=String(r.path.every(p=>canStand(history.state,p.x,p.z))&&r.path.slice(1).every((p,i)=>canTraverse(history.state,r.path[i],p)));
 routeLine.geometry.dispose();routeLine.geometry=new T.BufferGeometry().setFromPoints(r.path.map(p=>new T.Vector3(p.x,sampleHeight(history.state,p.x,p.z)+.035,p.z)));routeLine.computeLineDistances();routeLine.visible=true;
 if(reduced.matches||distance<.001)arrive();else{body.dataset.actorMode='walking';say('今の岸まで、乾いた道を歩くよ。');lastTime=performance.now();frame=requestAnimationFrame(tick);}
}
document.querySelector('#call-water').addEventListener('click',()=>call());document.querySelector('#call-home').addEventListener('click',()=>call(true));
const ray=new T.Raycaster(),pointer=new T.Vector2();let down=null;const pointers=new Set();let multi=false;
canvas.addEventListener('pointerdown',e=>{pointers.add(e.pointerId);if(pointers.size>1){multi=true;down=null;}else down={x:e.clientX,y:e.clientY,id:e.pointerId};});
canvas.addEventListener('pointerup',e=>{pointers.delete(e.pointerId);if(multi){if(!pointers.size)multi=false;down=null;return;}if(tool==='view'||!down||down.id!==e.pointerId||Math.hypot(e.clientX-down.x,e.clientY-down.y)>9){down=null;return;}down=null;const b=canvas.getBoundingClientRect();pointer.set((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects([terrain,sea])[0];if(!hit)return;selected={x:Math.round(hit.point.x/SPACING+(SIZE-1)/2),z:Math.round(hit.point.z/SPACING+(SIZE-1)/2)};edit();});
canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);if(!pointers.size)multi=false;down=null;});
canvas.addEventListener('keydown',e=>{const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(d){e.preventDefault();selected.x=Math.max(1,Math.min(SIZE-2,selected.x+d[0]));selected.z=Math.max(1,Math.min(SIZE-2,selected.z+d[1]));updateUI();draw();}else if(e.key==='Enter'){e.preventDefault();edit();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(frame)cancelAnimationFrame(frame);frame=0;}else if(route){lastTime=performance.now();frame=requestAnimationFrame(tick);}});
reduced.addEventListener('change',()=>{if(reduced.matches&&route){if(frame)cancelAnimationFrame(frame);frame=0;arrive();}});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();stop();body.dataset.ready='false';say('3Dの表示が休んでいます。再読み込みで、はじめの庭をひらけます。');});
// Read-only diagnostic; all mutations go through the visible UI.
window.coveAudit=()=>{scene.updateMatrixWorld(true);const floorRay=new T.Raycaster(new T.Vector3(actor.position.x,20,actor.position.z),new T.Vector3(0,-1,0));return {state:structuredClone(history.state),owners:owners.map(({spec,object})=>({...spec,uuid:object.uuid,position:object.position.toArray(),scale:object.scale.toArray()})),physicalBounds:footprint,actor:{position:actor.position.toArray(),safe:canStand(history.state,actor.position.x,actor.position.z),visibleFloorY:floorRay.intersectObject(terrain)[0]?.point.y},camera:{position:camera.position.toArray(),target:controls.target.toArray(),zoom:camera.zoom,left:camera.left,right:camera.right,top:camera.top,bottom:camera.bottom},shoreVertices:shore.geometry.attributes.position.count,route:body.dataset.route?JSON.parse(body.dataset.route):null};};
rebuild();setCamera('overview');setTool('lower');body.dataset.actorMode='idle';body.dataset.ready='true';document.querySelector('#loading').hidden=true;
