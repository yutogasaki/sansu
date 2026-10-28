// Same visible foot mesh at rest and while walking; no reset to a flat nominal Y.
export function contactHeight(floor,actor,yaw,scale,foot,vertices){
 const c=Math.cos(yaw),s=Math.sin(yaw);let required=-Infinity;
 for(const p of vertices){const x=(foot.x+p.x)*scale,z=(foot.z+p.z)*scale,h=floor(actor.x+x*c+z*s,actor.z-x*s+z*c);if(Number.isFinite(h))required=Math.max(required,(h-actor.y)/scale-p.y);}
 return Number.isFinite(required)?required:.1;
}
