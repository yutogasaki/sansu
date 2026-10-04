import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { IslandMaterials } from '../three/primitives';
import { buildGrowingTree, treeForm } from './treeSilhouettes';

describe('stable tree silhouettes', () => {
    it('has three geometrically distinct forms with a grounded trunk, and stays inside one mature cell', () => {
        const m = new IslandMaterials('moon-garden');
        const ids = new Map<string,string>();
        for(let i=0;ids.size<3;i++)ids.set(treeForm('tree-'+i),'tree-'+i);
        const sizes = [...ids].map(([form,id])=>{
            const root=buildGrowingTree(m,id,18), box=new T.Box3().setFromObject(root), size=box.getSize(new T.Vector3());
            expect(root.userData.treeForm).toBe(form);
            expect(box.min.y).toBeLessThan(.06);
            expect(size.x).toBeLessThanOrEqual(1.04);expect(size.z).toBeLessThanOrEqual(1.04);
            root.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});
            return {form,ratio:size.y/size.x};
        });
        expect(sizes.find(s=>s.form==='spire')!.ratio).toBeGreaterThan(sizes.find(s=>s.form==='spread')!.ratio*1.8);
        expect(sizes.find(s=>s.form==='branch')!.ratio).toBeGreaterThan(sizes.find(s=>s.form==='spread')!.ratio*1.2);
        m.dispose();
    });
    it('keeps the saved tree identity over growth and rebuild, with no scene random draws', () => {
        const m=new IslandMaterials('moon-garden');
        const id='the-same-owned-tree', form=treeForm(id);
        for(const growth of [0,6,18,72]){
            const root=buildGrowingTree(m,id,growth);
            expect(root.userData.treeForm).toBe(form);
            root.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});
        }
        expect(treeForm(id)).toBe(form);m.dispose();
    });
});
