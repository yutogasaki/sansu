import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as T from 'three';
import type { GuidanceEvidence, Plot, Villager } from '../../../domain/growingIsland';
import { IslandMaterials } from '../three/primitives';
import { GrowingGuideArt } from './GrowingGuideArt';
import { guideMemoryModel } from './guideMemoryModels';

const plot: Plot = { id: 'home-1', kind: 'home', cell: { x: 1, z: 0 }, plantedAt: 0, builtAt: 6, stage: 1, style: 'plain', growth: 0, origin: 'seed', paid: 4, roof: 3 };
const colors = (model: T.Group) => {
    const values = new Set<string>();
    model.traverse(object => { if (object instanceof T.Mesh && object.material instanceof T.MeshStandardMaterial) values.add(object.material.color.getHexString()); });
    return values;
};
describe('growing guide memory illustrations', () => {
    it('preserves the recorded blue tent after the current house is painted pink and grows', () => {
        const evidence: GuidanceEvidence = { source: 'open', snapshot: { flagColor: 0, target: structuredClone(plot) } };
        const current = { ...plot, roof: 1, stage: 3 as const };
        const m = new IslandMaterials();
        const remembered = guideMemoryModel(m, evidence)!;
        const present = guideMemoryModel(m, { ...evidence, snapshot: { ...evidence.snapshot, target: current } })!;
        expect(colors(remembered).has('5f9ec4')).toBe(true);
        expect(colors(remembered).has('d77a86')).toBe(false);
        expect(colors(present).has('d77a86')).toBe(true);
        expect(new T.Box3().setFromObject(remembered).max.y).not.toBe(new T.Box3().setFromObject(present).max.y);
        expect(evidence.snapshot.target).toEqual(plot);
        m.dispose();
    });
    it('uses the recorded flag colour', () => {
        const m = new IslandMaterials();
        const model = guideMemoryModel(m, { source: 'flag', targetId: 'flag', snapshot: { flagColor: 2 } })!;
        const flag = model.getObjectByName('growing-flag-cloth') as T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>;
        expect(flag.material.color.getHexString()).toBe('e0b454');
        m.dispose();
    });
    it('keeps the actual resident variant and clothes rather than inventing a rabbit', () => {
        const friend: Villager = { id: 'v1', species: 'otter', variant: { color: 3, accessory: 2, sparkle: false }, trait: 'mellow', home: 'home-1', arrivedAt: 1, outfit: { hat: 1 } };
        const m = new IslandMaterials();
        const model = guideMemoryModel(m, { source: 'disembark', snapshot: { flagColor: 0, target: friend } })!;
        expect(model.userData.memorySnapshot.target).toEqual(friend);
        expect(model.getObjectByName('growing-hat')).toBeDefined();
        expect(guideMemoryModel(m, { source: 'legacy', snapshot: { flagColor: 0 } })).toBeUndefined();
        m.dispose();
    });
    it('keeps all six invitation illustrations and saved land proportions distinct', () => {
        const pictures = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'].map(id => renderToStaticMarkup(createElement(GrowingGuideArt, { id: id as 'A1' })));
        expect(new Set(pictures.map(html => html.match(/data-guide-art="([^"]+)"/)![1])).size).toBe(6);
        const m = new IslandMaterials();
        expect(new Set(pictures.map(html => html.match(/src="([^"]+)"/)![1])).size).toBe(6);
        const evidence: GuidanceEvidence = { source: 'expand', snapshot: { flagColor: 0, land: { expanded: 'east', extra: [], capes: [] } } };
        const model = guideMemoryModel(m, evidence)!;
        const bounds = new T.Box3().setFromObject(model).getSize(new T.Vector3());
        expect(bounds.x / bounds.z).toBe(9 / 5);
        m.dispose();
    });
});
