import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import manifest from '../2026-10-11-native-owned-island/kit-manifest.json';
import parentJSON from './evidence/expanded-fixture.json';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import { terrainOwnerSupported, validateTerrain } from '../../../src/domain/growingIsland/terrainEditing';
import { editableIslandWorld } from '../../../src/domain/growingIsland/editableTerrainWorld';
import type { GrowingState, Command } from '../../../src/domain/growingIsland/types';
import { IslandMaterials } from '../../../src/components/island/three/primitives';
import { sceneLayout } from '../../../src/components/island/growing/sceneLayout';
import { buildObjectLayer } from '../../../src/components/island/growing/objectLayer';
import { makeNativeGrowingKit } from '../../../src/components/island/growing/native/nativeGrowingKit';
import { createWorldScene } from '../../../src/components/island/growing/worldScene';
declare const EXPANDED_V2_MODE: 'F' | 'H';
const previous = structuredClone(parentJSON.state) as GrowingState, before = structuredClone(previous);
const command: Command = { type: 'terrain-edit', cell: { x: 0, z: 1 }, delta: 1 };
assert.equal(previous.terrain!.heights['0,1'], -1);
const state = applyIntent(previous, { id: 'expanded-fixture-v2-p1-ground', command }, 2000).state;
assert.deepEqual(previous, before); validateTerrain(state);
assert.equal(state.terrain!.heights['0,1'] ?? 0, 0);
for (const key of new Set([...Object.keys(before.terrain!.heights), ...Object.keys(state.terrain!.heights)]))
    if (key !== '0,1') assert.equal(state.terrain!.heights[key], before.terrain!.heights[key]);
for (const field of ['plots', 'landmarks', 'villagers', 'keepsakes', 'land', 'drops', 'placeProgress'] as const) assert.deepEqual(state[field], before[field]);
const bytes = gunzipSync(readFileSync('docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz'));
const kit = makeNativeGrowingKit((await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '')).scene, manifest);
const m = new IslandMaterials('moon-garden'), layout = sceneLayout(state, true), world = editableIslandWorld(state)!;
const layer = buildObjectLayer(m, state, layout, undefined, undefined, [], kit);
function contact(root: T.Object3D) {
    root.updateWorldMatrix(true, true); let count = 0, absent = 0, min = Infinity, max = -Infinity;
    root.traverseVisible(object => {
        if (!(object instanceof T.Mesh) || object.userData.placementHitOnly) return;
        const positions = object.geometry.getAttribute('position');
        for (let i = 0; i < positions.count; i++) {
            const p = new T.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
            if (p.y < root.position.y - .12 || p.y > root.position.y + .08) continue;
            count++; const logical = world.logicalAt({ x: p.x + layout.center, z: p.z + 2 }), floor = logical && world.floorAt(logical);
            if (!floor) { absent++; continue; } min = Math.min(min, p.y - floor.point.y); max = Math.max(max, p.y - floor.point.y);
        }
    });
    return { samples: count, absent, minGap: Number.isFinite(min) ? min : null, maxGap: Number.isFinite(max) ? max : null };
}
const owners = [...state.plots, ...state.landmarks, ...state.keepsakes].flatMap(owner => !owner.cell ? [] : [{ id: owner.id,
    cell: owner.cell, supported: terrainOwnerSupported(state, owner.cell), physical: contact(layer.objects.get(owner.id)!) }]);
assert(owners.every(owner => owner.supported));
const p1 = owners.find(owner => owner.id === 'p1')!; assert.equal(p1.physical.absent, 0);
const scene = createWorldScene({} as T.WebGLRenderer); scene.layout(state);
const cottage = kit.cottage(); cottage.position.copy(scene.house.position); const nativeCottage = contact(cottage);
scene.dispose(); layer.dispose(); m.dispose(); kit.dispose();
console.log(JSON.stringify({ mode: EXPANDED_V2_MODE, state, command, owners, nativeCottage,
    cove0_4StillWet: !world.floorAt({ x: 0, z: 4 }), status: p1.physical.minGap! >= 0 ? 'PASS' : 'PHYSICAL_FOOTING_REMAINS',
    limitations: ['near-ground source/native mesh vertices; not continuous face collision proof', 'diagnostic budget inherited; no DB or earned-currency proof', 'actor snapshots absent; root has separate actual UI53 proof'] }));
