import { expect, it } from 'vitest';
import * as T from 'three';
import { buildGardenCottage, lowerCottageRoof } from './cottage';

it('retains the footprint and doorway while lowering upper geometry before batching',()=>{
    const body=new T.Group();
    const wall=new T.Mesh(new T.BoxGeometry(1.9,1.6,1.65));wall.position.set(0,.85,0);body.add(wall);
    const roof=new T.Mesh(new T.BoxGeometry(2.54,.2,2.12));roof.position.set(-.1,2.5,0);roof.rotation.z=.15;body.add(roof);
    const points=()=>body.children.flatMap(o=>{if(!(o instanceof T.Mesh))return [];o.updateMatrix();const p=o.geometry.getAttribute('position');return Array.from({length:p.count},(_,i)=>new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrix));});
    const before=points();lowerCottageRoof(body);const after=points();expect(after.length).toBe(before.length);
    before.forEach((p,i)=>{expect(after[i].x).toBeCloseTo(p.x,5);expect(after[i].z).toBeCloseTo(p.z,5);if(p.y<=1.25)expect(after[i].y).toBeCloseTo(p.y,5);});
    expect(new T.Box3().setFromPoints(after).max.y).toBeLessThan(new T.Box3().setFromPoints(before).max.y-.4);
    for(const child of body.children)if(child instanceof T.Mesh)child.geometry.dispose();
    const cottage=buildGardenCottage();try{expect(cottage.root.userData.visualSource).toBe('living-fantasy-cottage-low-v3');expect(new T.Box3().setFromObject(cottage.root).max.y).toBeLessThan(2.3);}finally{cottage.dispose();}
});
