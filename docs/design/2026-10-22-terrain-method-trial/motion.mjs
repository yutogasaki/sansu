// RAF timestamps may precede the performance.now() recorded when a route starts.
// Duplicate first route nodes are valid and must not divide by zero.
export function advance(a,b,elapsed,speed=.9){
 const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz),step=Math.max(0,Math.min(.05,elapsed))*speed;
 if(d<=Math.max(step,.000001))return{x:b.x,z:b.z,arrived:true};
 return{x:a.x+dx/d*step,z:a.z+dz/d*step,arrived:false};
}
