import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { newIsland } from '../../../domain/growingIsland/island';
import { landCells } from '../../../domain/growingIsland/space';
import type { Side } from '../../../domain/growingIsland/types';
import { sceneLayout } from './sceneLayout';
import { buildPlaceGround } from './placeGround';
import { buildPlacePaths } from './placePaths';
import { buildBridge } from './bridgeGeometry';
import { curveGroundGeometry } from './curvedGeometry';
import { IslandMaterials } from '../three/primitives';

describe('curved floor, path and bridge share the saved coordinates', () => {
    for (const directions of [['east', 'west', 'east', 'west'], ['south', 'south', 'south', 'south'], ['east', 'east', 'south']] as Side[][]) {
        it(`fits all acquired floor triangles and retains old positions after ${directions.join('/')}`, () => {
            const state = newIsland('curved-floor', 0);
            state.land = { expanded: 'east', extra: ['west', 'south'], capes: ['east', 'west'], districts: directions };
            const before = structuredClone(state), layout = sceneLayout(state, true), ground = buildPlaceGround(layout);
            ground.root.updateMatrixWorld(true);
            for (const cell of landCells(state)) for (const [dx, dz] of [[0, 0], [.17, .31], [.83, .19]]) {
                if (cell.x === layout.bounds.maxX && dx > .5 || cell.z === layout.depth - 1 && dz > .5) continue;
                const p = layout.point({ x: cell.x + dx, z: cell.z + dz }, 0);
                const hit = new T.Raycaster(p.clone().add(new T.Vector3(0, 10, 0)), new T.Vector3(0, -1, 0)).intersectObject(ground.floor)[0];
                expect(hit, JSON.stringify(cell)).toBeDefined(); expect(hit.point.y).toBeCloseTo(p.y, 5);
                const logical = layout.logicalAt(p); expect(logical.x).toBeCloseTo(cell.x + dx, 7); expect(logical.z).toBeCloseTo(cell.z + dz, 7);
            }
            state.land.districts = [...directions, 'south', 'west'];
            const next = sceneLayout(state, true);
            for (const cell of landCells(before)) {
                const a = layout.point(cell), b = next.point(cell);
                expect(b.x + next.center).toBeCloseTo(a.x + layout.center, 9);
                expect(b.y).toBe(a.y); expect(b.z).toBe(a.z);
            }
            state.land = before.land; expect(state).toEqual(before); ground.dispose();
        });
    }
    it('keeps paved vertices on the actual curved floor and does not change the save', () => {
        const state = newIsland('curved-path', 0);
        state.land = { expanded: 'east', extra: ['south'], capes: ['east'], districts: ['east', 'south', 'south'] };
        state.plots.push({ id: 'home', kind: 'home', cell: { x: 12, z: 11 }, stage: 2, plantedAt: 0, growth: 0, origin: 'seed', paid: 40 });
        const saved = structuredClone(state), layout = sceneLayout(state, true), ground = buildPlaceGround(layout), path = buildPlacePaths(state, layout, []);
        ground.floor.updateMatrixWorld(true); const vertices = path.geometry.getAttribute('position'); expect(vertices.count).toBeGreaterThan(100);
        for (let i = 0; i < vertices.count; i++) {
            const p = new T.Vector3().fromBufferAttribute(vertices, i);
            const hit = new T.Raycaster(p.clone().add(new T.Vector3(0, 5, 0)), new T.Vector3(0, -1, 0)).intersectObject(ground.floor)[0];
            expect(hit).toBeDefined(); expect(p.y - hit.point.y).toBeCloseTo(.008, 5);
        }
        expect(state).toEqual(saved); path.geometry.dispose(); (path.material as T.Material).dispose(); ground.dispose();
    });
    it('curves the real bridge deck onto both offshore walking cells', () => {
        const state = newIsland('curved-bridge', 0);
        state.land = { expanded: 'east', extra: ['south'], capes: [], districts: ['south', 'south'] }; state.bridge = { x: 3, builtAt: 0 };
        const layout = sceneLayout(state, true), anchor = { x: 3, z: layout.depth - 1 }, m = new IslandMaterials('moon-garden');
        const bridge = buildBridge(m); curveGroundGeometry(bridge, layout, anchor); bridge.position.copy(layout.point(anchor)); bridge.updateMatrixWorld(true);
        for (let z = anchor.z + .6; z <= anchor.z + 2.5; z += .12) {
            const p = layout.point({ x: anchor.x, z }, 0);
            const hit = new T.Raycaster(p.clone().add(new T.Vector3(0, 3, 0)), new T.Vector3(0, -1, 0)).intersectObject(bridge, true)[0];
            expect(hit, String(z)).toBeDefined(); expect(hit.point.y - p.y).toBeCloseTo(.04, 2);
        }
        bridge.traverse(o => { if (o instanceof T.Mesh) o.geometry.dispose(); }); m.dispose();
    });
});
