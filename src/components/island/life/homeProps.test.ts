import {describe,expect,it} from 'vitest';
import {Box3} from 'three';
import {IslandMaterials,disposeGeometry} from '../three/primitives';
import {isHouse} from '../../../domain/islandLife/space';
import {buildHomeProps} from './homeProps';
describe('home prop footprint',()=>{
    it('keeps every decoration inside reserved house cells rather than a resident or furniture cell',()=>{
        const materials=new IslandMaterials(),root=buildHomeProps(materials);
        root.position.set(2.5,0,.5);root.scale.setScalar(.8);root.updateMatrixWorld(true);
        expect(root.children).toHaveLength(4);
        for(const prop of root.children){
            const bounds=new Box3().setFromObject(prop);
            for(const x of [bounds.min.x,bounds.max.x])for(const z of [bounds.min.z,bounds.max.z]){
                expect(isHouse({x:Math.round(x),z:Math.round(z)}),prop.name).toBe(true);
            }
            expect(bounds.min.y).toBeCloseTo(0);
        }
        disposeGeometry(root);materials.dispose();
    });
});
