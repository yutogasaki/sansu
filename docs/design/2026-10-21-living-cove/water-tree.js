import * as T from 'three';

// A single authored, open-branched tree replaces one existing tree. Its shape
// never depends on animation time, random sampling, or the experiment name.
export function makeWaterTree() {
  const root=new T.Group(),crown=new T.Group();root.add(crown);
  const bark=new T.MeshStandardMaterial({color:'#9b736e',roughness:.96});
  const woodLight=new T.MeshStandardMaterial({color:'#c29782',roughness:.96});
  const leaves=['#8d77ba','#ad94cd','#c3a4d7'].map(color=>new T.MeshStandardMaterial({color,roughness:.74,side:T.DoubleSide}));
  const vein=new T.MeshStandardMaterial({color:'#d7b7c7',roughness:.9});
  const twig=(parent,points,radius,material=bark)=>{
    const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
    const mesh=new T.Mesh(new T.TubeGeometry(curve,12,radius,7,false),material);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  };
  twig(root,[[0,0,0],[-.13,.3,-.02],[-.18,.8,-.08],[-.03,1.25,-.16],[.13,1.65,-.27]],.105);
  for(const end of [[-.3,.02,-.12],[.3,.02,-.12],[.10,.02,-.28]])twig(root,[[0,.25,0],[end[0]*.5,.09,end[2]*.5],end],.046,woodLight);
  const ends=[[-.94,1.72,-.28],[-.51,2.05,-.54],[.19,2.2,-.6],[.81,1.83,-.43],[.85,1.36,.06],[-.61,1.20,.22]];
  ends.forEach((end,j)=>{
    const start=[-.1,1.05+(j%3)*.16,-.1];
    twig(crown,[start,[(start[0]+end[0])*.5,end[1]-.09,end[2]*.6],end],.036-j*.002);
    for(let k=0;k<5;k++){
      const angle=(k/5)*Math.PI*2+j*.7,tip=[end[0]+Math.cos(angle)*.37,end[1]-.06-k*.018,end[2]+Math.sin(angle)*.25];
      const length=.36+(j%2)*.07;
      const shape=new T.Shape();shape.moveTo(0,0);shape.bezierCurveTo(.17,length*.2,.19,length*.68,0,length);shape.bezierCurveTo(-.19,length*.68,-.17,length*.2,0,0);
      const geo=new T.ShapeGeometry(shape,8);const pos=geo.attributes.position;
      for(let i=0;i<pos.count;i++){const y=pos.getY(i);pos.setZ(i,Math.sin(y/length*Math.PI)*.065);}geo.computeVertexNormals();
      const leaf=new T.Mesh(geo,leaves[(j+k)%3]);leaf.position.set(...tip);leaf.rotation.set(-1.0-k*.09,angle,.15*Math.sin(j));leaf.castShadow=true;leaf.receiveShadow=true;crown.add(leaf);
      const midrib=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(0,.025,.01),new T.Vector3(0,length*.5,.075),new T.Vector3(0,length*.94,.015)]),7,.006,3,false),vein);leaf.add(midrib);
    }
  });
  root.userData.crown=crown;
  return root;
}
