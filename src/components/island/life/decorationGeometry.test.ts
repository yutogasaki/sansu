import {describe,expect,it} from 'vitest';
import {Box3,Vector3} from 'three';
import {IslandMaterials,disposeGeometry} from '../three/primitives';
import {buildLifeItem} from './itemGeometry';
describe('decoration placement geometry',()=>{
    it('rotates the fence silhouette while retaining ground contact and one-cell bounds',()=>{
        const materials=new IslandMaterials(),sizes=[];
        for(const rotation of [0,1,2,3] as const){
            const g=buildLifeItem({id:'f',kind:'fence',rotation,growth:0,style:'original'},materials).root;
            const bounds=new Box3().setFromObject(g),size=bounds.getSize(new Vector3());sizes.push(size);
            expect(bounds.min.y).toBeCloseTo(0);expect(size.x).toBeLessThan(1);expect(size.z).toBeLessThan(1);
            disposeGeometry(g);
        }
        expect(sizes[0].x).toBeCloseTo(sizes[1].z);expect(sizes[0].z).toBeCloseTo(sizes[1].x);
        expect(sizes[0].x).toBeGreaterThan(sizes[0].z*3);materials.dispose();
    });
});
