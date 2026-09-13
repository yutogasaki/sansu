import { expect, it, vi } from 'vitest';
import * as T from 'three';
import { buildEncounterVisual } from './encounterVisual';
import { buildLifeItem } from './itemGeometry';
import { disposeGeometry, IslandMaterials } from '../three/primitives';
import { visibleRelationObject } from './relationVisibility';

for (const kind of ['X1', 'X2'] as const) it(`${kind} travels to the actual bowl and returns without altering owned geometry`, () => {
    const materials = new IslandMaterials();
    const plant = buildLifeItem({ id: 'plant', kind: kind === 'X1' ? 'flower' : 'sapling', growth: 18, style: 'original' }, materials, true, true).root;
    const bowl = buildLifeItem({ id: 'bowl', kind: 'water-bowl', growth: 0, style: 'original' }, materials).root;
    plant.position.set(-2, .1, 3); bowl.position.set(1, .1, 3);
    plant.updateMatrixWorld(true); bowl.updateMatrixWorld(true);
    for (const object of [plant, bowl]) object.traverse(o => { if (o instanceof T.Mesh) { o.geometry.computeBoundingBox(); o.geometry.computeBoundingSphere(); } });
    const before = [plant.toJSON(), bowl.toJSON()], visual = buildEncounterVisual(kind, plant, bowl)!;
    try {
        expect(visual).toBeDefined();
        expect(visual.animate(0, false)).toBe('plant'); expect(visual.visitor.position).toEqual(visual.start);
        expect(visual.animate(1500, false)).toBe('outbound');
        expect(visual.visitor.position.x).toBeGreaterThan(visual.start.x);
        expect(visual.visitor.position.x).toBeLessThan(visual.water.x);
        expect(visual.animate(3500, false)).toBe('water'); expect(visual.visitor.position).toEqual(visual.water);
        const waterPose = visual.visitor.toJSON();
        expect(visual.animate(9500, false)).toBe('plant'); expect(visual.visitor.position).toEqual(visual.start);
        expect(visual.visitor.toJSON()).not.toEqual(waterPose);
        // Reduced motion preserves the same meaningful route and water pose.
        visual.animate(3500, true); expect(visual.visitor.position).toEqual(visual.water);
        if (kind === 'X2') {
            expect(visual.markings).toHaveLength(6);
            const scene = new T.Scene(); scene.add(plant, bowl, visual.root); visual.visitor.visible = true; visual.animate(9500, false);
            const camera = new T.OrthographicCamera(-4, 4, 4, -4, .1, 100), center = plant.position.clone().lerp(bowl.position, .5);
            const visible = (o: T.Object3D) => visibleRelationObject(o, scene, camera, () => true);
            expect([[4,8,9],[-4,8,7],[0,10,-7],[-8,9,-4],[8,9,-4]].some(([x,y,z]) => {
                camera.position.copy(center).add(new T.Vector3(x,y,z)); camera.lookAt(center); camera.updateMatrixWorld(true);
                return visible(visual.perch!) && visible(visual.features[0]) && visible(visual.features[visual.features.length-1]) && visual.markings.some(visible);
            })).toBe(true);
            plant.removeFromParent(); bowl.removeFromParent(); visual.root.removeFromParent();
        }
        expect([plant.toJSON(), bowl.toJSON()]).toEqual(before);
        const ownedDispose = vi.fn(); plant.traverse(o => { if (o instanceof T.Mesh) o.geometry.addEventListener('dispose', ownedDispose); });
        const scene = new T.Scene(); scene.add(visual.root); visual.dispose();
        expect(scene.children).toHaveLength(0); expect(ownedDispose).not.toHaveBeenCalled();
    } finally { disposeGeometry(plant); disposeGeometry(bowl); materials.dispose(); }
});

it('does not invent a plant contact when the actual plant has no surface', () => {
    expect(buildEncounterVisual('X2', new T.Group(), new T.Group())).toBeUndefined();
});

it('adds a branch only for the new mature presentation and keeps it inside the owned cell', () => {
    const materials = new IslandMaterials();
    try {
        for (const growth of [0, 6, 18]) for (const enabled of [false, true]) {
            const tree = buildLifeItem({ id: 'tree', kind: 'sapling', growth, style: 'original' }, materials, true, enabled).root;
            try {
                expect(Boolean(tree.getObjectByName('life-tree-perch'))).toBe(enabled && growth === 18);
                const bounds = new T.Box3().setFromObject(tree);
                expect(Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x), Math.abs(bounds.min.z), Math.abs(bounds.max.z))).toBeLessThan(.49);
            } finally { disposeGeometry(tree); }
        }
    } finally { materials.dispose(); }
});
