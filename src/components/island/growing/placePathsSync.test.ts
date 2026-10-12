import { describe, expect, it, vi } from 'vitest';
import * as T from 'three';
import { newIsland } from '../../../domain/growingIsland/island';
import { HOME_CELL, key, walkableCells } from '../../../domain/growingIsland/space';
import type { Cell } from '../../../domain/growingIsland/types';
import { authoredAccessWorld } from '../../../domain/growingIsland/authoredWorldAccess.fixture';
import { makePokomokoRig } from '../three/islandCharacters';
import { IslandMaterials } from '../three/primitives';
import { wrapPokomoko } from './actors';
import { GrowingLife } from './growingLife';
import { buildObjectLayer, type ObjectLayer } from './objectLayer';
import { sceneLayout } from './sceneLayout';

const pathOf = (layer: ObjectLayer) => layer.root.getObjectByName('growing-reachable-paths') as T.Mesh<T.BufferGeometry, T.Material>;
const edgesOf = (layer: ObjectLayer) => pathOf(layer).userData.groundPathEdges as [Cell, Cell][];
const edgeKey = (edge: [Cell, Cell]) => edge.map(key).sort().join('|');
function fixture(authored = true) {
    const state = newIsland('path-life-parity', 0), { world } = authoredAccessWorld();
    state.landmarks = []; state.plots = [{ id: 'home', kind: 'home', cell: authored ? { x: 4, z: -2 } : { x: 4, z: 3 },
        stage: 2, plantedAt: 0, growth: 0, origin: 'seed', paid: 40 }];
    const m = new IslandMaterials('moon-garden'), layout = sceneLayout(state, false, authored ? world : undefined), layer = buildObjectLayer(m, state, layout);
    const rig = makePokomokoRig(m), life = new GrowingLife(m, wrapPokomoko(rig.hero, rig.heroBody, rig.heroFeet));
    return { state, world, m, layout, layer, life, dispose: () => { life.dispose(); layer.dispose(); m.dispose(); } };
}

describe('paths follow committed life access', () => {
    it('removes physically rejected edges, preserves committed paths through previews/receipts, and restores after obstruction removal/reset', () => {
        const f = fixture(), original = edgesOf(f.layer).map(edgeKey), originalPath = pathOf(f.layer);
        const originalGeometryDispose = vi.spyOn(originalPath.geometry, 'dispose'), originalMaterialDispose = vi.spyOn(originalPath.material, 'dispose');
        const edge = edgesOf(f.layer).find(([a]) => Math.hypot(a.x - HOME_CELL.x, a.z - HOME_CELL.z) > 2)!;
        const obstacle = new T.Mesh(new T.BoxGeometry(.03, .8, .03), new T.MeshBasicMaterial());
        obstacle.name = 'authored-cove-shell'; obstacle.userData.ownMaterial = true;
        obstacle.position.copy(f.layout.point({ x: (edge[0].x + edge[1].x) / 2, z: (edge[0].z + edge[1].z) / 2 }, .3));
        f.layer.root.add(obstacle);
        try {
            f.life.sync(f.state, f.layout, f.layer);
            const proof = f.life.walkingObstructionProof()!, rejected = new Set(proof.excludedCells.map(key));
            expect(rejected.size).toBeGreaterThan(0); expect(proof.blockedEdges + proof.blockedPoints).toBeGreaterThan(0);
            const guarded = edgesOf(f.layer).map(edgeKey), guardedPath = pathOf(f.layer);
            expect(guarded.length).toBeGreaterThan(0); expect(guarded).not.toEqual(original);
            expect(edgesOf(f.layer).flat().some(at => rejected.has(key(at)))).toBe(false);
            expect(originalGeometryDispose).toHaveBeenCalledTimes(1); expect(originalMaterialDispose).toHaveBeenCalledTimes(1);
            expect(originalPath.parent).toBeNull();
            f.layer.updatePreview({ kind: 'home', seed: true, cell: { x: -1, z: -2 }, ownerId: 'home', valid: true, style: 'plain', allowed: [] });
            expect(pathOf(f.layer)).toBe(guardedPath); expect(edgesOf(f.layer).map(edgeKey)).toEqual(guarded);
            f.layer.updatePreview();
            const receipt = { ...f.state, applied: [...f.state.applied, 'receipt'] };
            f.life.adoptState(receipt); expect(pathOf(f.layer)).toBe(guardedPath);
            f.life.sync(receipt, f.layout, f.layer); expect(edgesOf(f.layer).map(edgeKey)).toEqual(guarded);
            obstacle.removeFromParent(); obstacle.geometry.dispose(); obstacle.material.dispose();
            f.life.sync(receipt, f.layout, f.layer);
            expect(f.life.walkingObstructionProof()).toBeUndefined(); expect(edgesOf(f.layer).map(edgeKey)).toEqual(original);
            expect(f.layer.root.getObjectsByProperty('name', 'growing-reachable-paths')).toHaveLength(1);
        } finally { f.dispose(); }
    });

    it('binds each update to the current layer state/layout and disposes replacements once', () => {
        const f = fixture(), base = pathOf(f.layer), disposeBase = vi.spyOn(base.geometry, 'dispose');
        const access = { walkable: new Set<string>(), ownerApproaches: new Map<string, Cell[]>() };
        try {
            f.layer.updatePaths({ ...access, state: f.state, layout: sceneLayout(f.state, false, f.world) });
            expect(pathOf(f.layer)).toBe(base);
            const removed = { ...f.state, plots: [] };
            f.layer.updatePaths({ ...access, state: removed, layout: f.layout }); expect(pathOf(f.layer)).toBe(base);
            f.layer.updatePaths({ ...access, state: f.state, layout: f.layout });
            const empty = pathOf(f.layer), disposeEmpty = vi.spyOn(empty.geometry, 'dispose'), materialEmpty = vi.spyOn(empty.material, 'dispose');
            expect(empty).not.toBe(base); expect(edgesOf(f.layer)).toEqual([]); expect(disposeBase).toHaveBeenCalledTimes(1);
            f.layer.dispose(); f.layer.dispose();
            f.layer.updatePaths({ ...access, state: f.state, layout: f.layout });
            expect(disposeBase).toHaveBeenCalledTimes(1); expect(disposeEmpty).toHaveBeenCalledTimes(1); expect(materialEmpty).toHaveBeenCalledTimes(1);
            expect(f.layer.root.getObjectByName('growing-reachable-paths')).toBe(empty);
        } finally { f.dispose(); }
    });

    it('uses the edited/removal layer inputs and never updates legacy path resources', () => {
        const f = fixture(), original = edgesOf(f.layer).map(edgeKey);
        try {
            for (const plots of [[{ ...f.state.plots[0], cell: { x: -1, z: 3 } }], []]) {
                const state = { ...f.state, plots }, layout = sceneLayout(state, false, f.world), layer = buildObjectLayer(f.m, state, layout);
                try {
                    f.life.sync(state, layout, layer);
                    expect(edgesOf(layer).map(edgeKey)).not.toEqual(original);
                    if (!plots.length) expect(edgesOf(layer)).toEqual([]);
                    expect(edgesOf(layer).flat().every(at => walkableCells(state, f.world).has(key(at)))).toBe(true);
                } finally { layer.dispose(); }
            }
        } finally { f.dispose(); }
        const legacy = fixture(false), before = pathOf(legacy.layer), release = vi.spyOn(before.geometry, 'dispose');
        try {
            legacy.life.sync(legacy.state, legacy.layout, legacy.layer);
            legacy.layer.updatePaths({ state: legacy.state, layout: legacy.layout, walkable: new Set(), ownerApproaches: new Map() });
            expect(pathOf(legacy.layer)).toBe(before); expect(release).not.toHaveBeenCalled();
        } finally { legacy.dispose(); }
    });
});
