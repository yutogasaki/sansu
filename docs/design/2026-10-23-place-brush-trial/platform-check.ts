import assert from 'node:assert/strict';
import fixture from '../2026-10-23-place-method-comparison/evidence/expanded-place-recipe-flower-flat-wide-fixture.json';
import { replacePlace } from './model';
import type { PlaceShape } from './field';
import { editableIslandWorld } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { terrainOwnerSupported } from '../../../src/domain/growingIsland/terrainEditing';
import { applyIntent, canPlace } from '../../../src/domain/growingIsland/commands';
import { HOME_CELL, walkableCells, approachCells } from '../../../src/domain/growingIsland/space';
import type { GrowingState } from '../../../src/domain/growingIsland/types';

const original = structuredClone(fixture.state) as unknown as GrowingState;
const unchanged = JSON.stringify(original);
const reports = [];
for (const height of [.9, .5]) for (const radius of [1.6, 2]) for (const flowerCell of [{ x: 6, z: 5 }, { x: 5, z: 4 }]) {
    const shape: PlaceShape = { center: { x: 5, z: 5 }, radius, height, entrance: 1.2, flatRadius: 1.75 };
    try {
        let state = replacePlace(original, shape, { actors: [], occupiedPlaceTargets: [] });
        const world = editableIslandWorld(state)!;
        const sites = [shape.center, { x: 6, z: 5 }, { x: 5, z: 4 }, { x: 5, z: 6 }].map(cell => {
            const heights = [-.46, 0, .46].flatMap(x => [-.46, 0, .46].map(z => world.floorAt({ x: cell.x + x, z: cell.z + z })?.point.y));
            return { cell, supported: terrainOwnerSupported(state, cell), placeable: canPlace(state, cell, 'starter-flower', world), heights };
        });
        const moves = [];
        for (const [id, cell] of [['starter-bench', shape.center], ['starter-flower', flowerCell]] as const) {
            try {
                state = applyIntent(state, { id: `platform-${height}-${radius}-${id}`, command: { type: 'move', id, cell } }, state.nature.realAt).state;
                moves.push({ id, accepted: true });
            } catch (error) { moves.push({ id, accepted: false, error: String(error) }); }
        }
        const occupiedWorld = editableIslandWorld(state)!, open = walkableCells(state, occupiedWorld);
        const approaches = state.landmarks.filter(l => l.id === 'starter-bench' || l.id === 'starter-flower').map(owner => ({ id: owner.id, cell: owner.cell,
            routes: owner.cell ? approachCells(owner.cell, occupiedWorld).filter(cell => open.has(`${cell.x},${cell.z}`)).map(cell => ({ cell, route: occupiedWorld.route(HOME_CELL, cell, open) })).filter(r => r.route) : [] }));
        reports.push({ shape, flowerCell, sites, moves, approaches, bothMoved: moves.every(m => m.accepted) });
    } catch (error) { reports.push({ shape, flowerCell, error: String(error) }); }
}
assert.equal(JSON.stringify(original), unchanged);
assert.equal(reports.filter(r => 'bothMoved' in r && r.bothMoved).length, 4);
assert(reports.filter(r => r.bothMoved).every(r => r.approaches?.every(a => a.routes.length > 0)));
console.log(JSON.stringify({ at: new Date().toISOString(), diagnosticOnly: true, reports }, null, 2));
