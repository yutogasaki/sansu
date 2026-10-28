import * as THREE from 'three';
import { world, sampleHeight, WATER, SIZE } from './terrain.mjs';
import { plantKind, wetEdges, neighbours } from './experiments.mjs';

export function drawTree(parent,index,state,reactive,mesh,g,m) {
  const x=index%SIZE,z=Math.floor(index/SIZE),tree=new THREE.Group();
  tree.position.set(world(x),sampleHeight(state,world(x),world(z)),world(z));parent.add(tree);
  const kind=reactive?plantKind(state,x,z):'broad';
  if(kind==='high') {
    mesh(tree,g.trunk,m.trunk,[0,.6,0],[.9,1.2,.9]);
    for(let j=0;j<3;j++)mesh(tree,g.pine,j%2?m.pineLight:m.pine,[0,.76+j*.34,0],[.52-j*.11,.72-j*.07,.52-j*.11]);
    return;
  }
  mesh(tree,g.trunk,m.trunk,[0,.42,0],[1,.84,1]);
  if(kind==='water') {
    mesh(tree,g.ball,m.willow,[0,1.01,0],[.57,.38,.49]);
    for(let j=0;j<7;j++) {
      const a=j/7*Math.PI*2,dx=Math.cos(a)*.4,dz=Math.sin(a)*.35;
      mesh(tree,g.ball,j%2?m.willow:m.willowLight,[dx,.73,dz],[.14,.38,.11]);
      mesh(tree,g.ball,m.willowLight,[dx*.8,.98,dz*.8],[.23,.2,.21]);
    }
    const edge=wetEdges(state,x,z)[0];
    if(edge)for(let j=0;j<4;j++) {
      const dx=(edge[0]-x)*.24+(j-1.5)*.055,dz=(edge[1]-z)*.24;
      mesh(tree,g.trunk,m.reed,[dx,.16,dz],[.16,.32,.16]);
      mesh(tree,g.ball,m.reedTip,[dx,.32,dz],[.035,.07,.035]);
    }
  } else {
    const crown=index%2?m.purple:m.lilac;
    mesh(tree,g.ball,crown,[0,1.08,0],[.61,.5,.52]);
    mesh(tree,g.ball,crown,[-.32,.88,.05],[.39,.36,.35]);
    mesh(tree,g.ball,crown,[.29,.93,-.11],[.4,.4,.36]);
    if(index%3===0)for(let j=0;j<4;j++)mesh(tree,g.ball,m.flower,[.24-j*.12,1.22-j*.045,.36],[.055,.055,.035]);
  }
}

export function drawPlaces(parent,state,places,mesh,g,m) {
  for(const {x,z} of places.water) {
    const patch=new THREE.Group();patch.position.set(world(x),WATER+.023,world(z));parent.add(patch);
    for(let j=0;j<3;j++) {
      const dx=(j-1)*.14,dz=Math.sin(j*2)*.12;
      mesh(patch,g.ball,m.lily,[dx,0,dz],[.12,.018,.105]);
      if(j===1)for(let petal=0;petal<5;petal++)mesh(patch,g.ball,m.lilyFlower,[dx+Math.cos(petal*1.257)*.035,.035,dz+Math.sin(petal*1.257)*.035],[.035,.025,.035]);
    }
  }
  if(places.high) {
    const {x,z}=places.high,wx=world(x),wz=world(z),y=sampleHeight(state,wx,wz);
    mesh(parent,g.platform,m.stone,[wx,y+.025,wz],[.47,.05,.47]);
    for(let j=0;j<5;j++){const a=(j+1)/6*Math.PI*1.55+.25,px=wx+Math.cos(a)*.41,pz=wz+Math.sin(a)*.41;mesh(parent,g.box,m.stone,[px,Math.max(y,sampleHeight(state,px,pz))+.09,pz],[.15,.16,.17]);}
    const lower=neighbours(x,z).find(([a,b])=>state.heights[b*SIZE+a]>0&&state.heights[b*SIZE+a]<state.heights[z*SIZE+x]);
    if(lower)for(let j=1;j<=6;j++) {
      const t=j/7,px=wx+(world(lower[0])-wx)*t,pz=wz+(world(lower[1])-wz)*t;
      const step=mesh(parent,g.box,m.stone,[px,sampleHeight(state,px,pz)+.032,pz],[.34,.065,.14]);step.rotation.y=lower[0]!==x?Math.PI/2:0;
    }
  }
  if(places.forest) {
    const {x,z}=places.forest.clearing,wx=world(x),wz=world(z);
    const left=new THREE.Vector3(wx-.36,sampleHeight(state,wx-.36,wz)+.72,wz);
    const right=new THREE.Vector3(wx+.36,sampleHeight(state,wx+.36,wz)+.72,wz);
    const top=new THREE.Vector3(wx,Math.max(left.y,right.y)+.38,wz);
    const curve=new THREE.CatmullRomCurve3([left,top,right]);
    const geo=new THREE.TubeGeometry(curve,16,.043,5,false);geo.userData.studyOwned=true;
    mesh(parent,geo,m.trunk,[0,0,0]);
    for(const end of [left,right]) {
      const ground=sampleHeight(state,end.x,end.z),height=end.y-ground;
      mesh(parent,g.trunk,m.trunk,[end.x,ground+height/2,end.z],[.7,height,.7]);
    }
    for(let j=0;j<5;j++){const p=curve.getPoint(j/4);mesh(parent,g.ball,j%2?m.purple:m.lilac,[p.x,p.y+.12,p.z],[.2,.17,.19]);}
    for(let j=0;j<6;j++){const a=j/6*Math.PI*2,px=wx+Math.cos(a)*.22,pz=wz+Math.sin(a)*.22;mesh(parent,g.ball,m.stone,[px,sampleHeight(state,px,pz)+.035,pz],[.07,.035,.065]);}
  }
}
