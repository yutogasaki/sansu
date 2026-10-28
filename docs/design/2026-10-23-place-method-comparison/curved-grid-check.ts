import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import manifest from '../2026-10-11-native-owned-island/kit-manifest.json';
import observedJSON from './evidence/18-terrace-input-state.json';
import recipeJSON from './evidence/terrace-F2-recipe.json';
import { newIsland } from '../../../src/domain/growingIsland/island';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import { editableIslandWorld, editableTerrainSegmentSupported } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { terrainOwnerSupported } from '../../../src/domain/growingIsland/terrainEditing';
import { landscapePoint, landscapeCell } from '../../../src/domain/growingIsland/landscape';
import { landBounds, HOUSE_CELLS } from '../../../src/domain/growingIsland/space';
import { sceneLayout, type SceneLayout } from '../../../src/components/island/growing/sceneLayout';
import { buildObjectLayer } from '../../../src/components/island/growing/objectLayer';
import { createWorldScene } from '../../../src/components/island/growing/worldScene';
import { worldFloorGeometry } from '../../../src/components/island/growing/worldFloorGeometry';
import { makeNativeGrowingKit } from '../../../src/components/island/growing/native/nativeGrowingKit';
import { IslandMaterials } from '../../../src/components/island/three/primitives';
import type { Command, GrowingState, Cell } from '../../../src/domain/growingIsland/types';
import { CURVED_GRID_REVISION } from './curved-grid';

declare const CURVED_GRID_MODE: 'F' | 'H';
const original = { ...newIsland('h-observed', 0), ...structuredClone(observedJSON) } as unknown as GrowingState;
let recipe = structuredClone(original), sequence = 0;
for (const command of recipeJSON.commands as Command[]) if (command.type !== 'place-used')
    recipe = applyIntent(recipe, { id: `h-recipe-${++sequence}`, command }, 1000 + sequence).state;
const currentUI = { ...newIsland('h-current-ui', 0), ...JSON.parse(readFileSync('docs/design/2026-10-23-place-method-comparison/evidence/33-F2-used-state.json', 'utf8')) } as GrowingState;
const zero = newIsland('h-zero', 0); zero.terrain = { version: 1, heights: {}, undo: [], redo: [] };
const expanded = structuredClone(zero); expanded.land.expanded = 'east'; expanded.land.extra = ['west', 'south'];
const bytes = gunzipSync(readFileSync('docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz'));
const kit = makeNativeGrowingKit((await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '')).scene, manifest);
const ray = new T.Raycaster();
function footing(root: T.Object3D, layout: SceneLayout) {
    root.updateMatrixWorld(true); const points: T.Vector3[] = [];
    root.traverse(object => {
        if (!(object instanceof T.Mesh) || !object.visible || object.userData.placementHitOnly) return;
        const vertices = object.geometry.getAttribute('position');
        for (let i = 0; i < vertices.count; i++) {
            const point = new T.Vector3().fromBufferAttribute(vertices, i).applyMatrix4(object.matrixWorld);
            // Actual near-ground mesh vertices, not a logical support radius.
            if (point.y >= root.position.y - .12 && point.y <= root.position.y + .08) points.push(point);
        }
    });
    let dry = 0, absent = 0, minGap = Infinity, maxGap = -Infinity;
    for (const point of points) {
        const physical = { x: point.x + layout.center, z: point.z + 2 }, logical = layout.world.logicalAt(physical);
        const floor = logical && layout.world.floorAt(logical);
        if (!floor) { absent++; continue; } dry++;
        minGap = Math.min(minGap, point.y - floor.point.y); maxGap = Math.max(maxGap, point.y - floor.point.y);
    }
    return { vertices: points.length, dry, absent, minGap: Number.isFinite(minGap) ? minGap : null, maxGap: Number.isFinite(maxGap) ? maxGap : null };
}
const runs = [];
try {
    for (const [name, state] of [['zero', zero], ['observed-input', original], ['normal-F2-recipe', recipe], ['current-UI-33', currentUI], ['expanded', expanded]] as const) {
        const world = editableIslandWorld(state)!, layout = sceneLayout(state, true), bounds = landBounds(state);
        const geometry = worldFloorGeometry(world), material = new T.MeshBasicMaterial({ side: T.DoubleSide }), mesh = new T.Mesh(geometry, material);
        mesh.updateMatrixWorld(true); let maxHitError = 0, maxPointerError = 0, probes = 0, maxAnalyticProjectionError = 0;
        const samples = [];
        for (let iz = -2; iz <= bounds.depth * 4; iz++) for (let ix = bounds.minX * 4 - 2; ix <= bounds.maxX * 4 + 2; ix++) {
            const cell = { x: ix / 4 + .013, z: iz / 4 + .017 }, floor = world.floorAt(cell);
            samples.push({ cell, y: floor?.point.y ?? null }); if (!floor) continue;
            const at = layout.point(cell, 0), inverse = layout.logicalAt(at), analytic = landscapePoint(cell);
            maxAnalyticProjectionError = Math.max(maxAnalyticProjectionError, Math.hypot(analytic.x - floor.point.x, analytic.z - floor.point.z));
            maxPointerError = Math.max(maxPointerError, Math.hypot(inverse.x - cell.x, inverse.z - cell.z));
            ray.set(new T.Vector3(floor.point.x, 10, floor.point.z), new T.Vector3(0, -1, 0)); const hit = ray.intersectObject(mesh)[0];
            assert(hit); maxHitError = Math.max(maxHitError, Math.abs(hit.point.y - floor.point.y)); probes++;
            assert(Math.abs(at.x + layout.center - floor.point.x) < 1e-8 && Math.abs(at.z + 2 - floor.point.z) < 1e-8);
        }
        assert(maxHitError < .002 && maxPointerError < 1e-7);
        let minTriangleRatio = Infinity, triangles = 0;
        for (const floor of world.floors.filter(f => f.kind === 'ground')) for (let i = 0; i < floor.indices.length; i += 3) {
            const [a, b, c] = floor.indices.slice(i, i + 3).map(index => floor.vertices[index]);
            const cross = (a: Cell, b: Cell, c: Cell) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
            const logicalArea = cross(a.cell, b.cell, c.cell), physicalArea = cross(a.point, b.point, c.point);
            assert(logicalArea * physicalArea > 0); minTriangleRatio = Math.min(minTriangleRatio, physicalArea / logicalArea); triangles++;
        }
        const m = new IslandMaterials('moon-garden'), layer = buildObjectLayer(m, state, layout, undefined, undefined, [], kit);
        layer.root.updateMatrixWorld(true); const owners = [];
        for (const owner of [...state.plots, ...state.landmarks, ...state.keepsakes]) if (owner.cell) {
            const root = layer.objects.get(owner.id); assert(root);
            assert(root.position.distanceTo(layout.point(owner.cell)) < 1e-8);
            owners.push({ id: owner.id, cell: owner.cell, legal: terrainOwnerSupported(state, owner.cell), contact: footing(root, layout) });
        }
        // Use the actual source-transformed fixed-house placement path. This
        // renderer-free scene exercises CPU geometry; no WebGL image is claimed.
        const scene = createWorldScene({} as T.WebGLRenderer), sceneLayoutResult = scene.layout(state);
        const houseExpected = CURVED_GRID_MODE === 'H' ? sceneLayoutResult.point({ x: 2.5, z: .5 }, .035) : new T.Vector3(2.5 - layout.center, .035, -1.5);
        assert(scene.house.position.distanceTo(houseExpected) < 1e-8);
        const cottage = kit.cottage(); cottage.position.copy(scene.house.position);
        const houseContact = footing(cottage, layout);
        let pinError = 0;
        for (const pin of [...HOUSE_CELLS, { x: bounds.maxX - 1, z: bounds.depth - 1 }]) for (const dx of [-.46, 0, .46]) for (const dz of [-.46, 0, .46]) {
            const cell = { x: pin.x + dx, z: pin.z + dz }, p = layout.point(cell, 0), logical = layout.logicalAt(p);
            pinError = Math.max(pinError, Math.hypot(logical.x - cell.x, logical.z - cell.z));
        }
        const pier = layer.root.getObjectByName('growing-pier')!; assert(pier.position.distanceTo(layout.pierRoot) < 1e-8);
        const pierJoin = [-.31, -.155, 0, .155, .31].map(dx => {
            const p = { x: layout.pierRoot.x + dx + layout.center, z: layout.pierRoot.z - .135 + 2 }, cell = world.logicalAt(p), floor = cell && world.floorAt(cell);
            return { dx, dry: Boolean(floor), floorY: floor?.point.y ?? null, logical: cell ?? null };
        });
        let walkEdges = 0;
        for (const site of world.walkSites) for (const neighbor of world.neighbors(site.cell, 'walk')) { assert(editableTerrainSegmentSupported(world, site.cell, neighbor)); walkEdges++; }
        const inverse = landscapeCell(landscapePoint({ x: -5.123, z: 8.234 })); assert(Math.hypot(inverse.x + 5.123, inverse.z - 8.234) < 1e-7);
        runs.push({ name, owners, houseContact, housePosition: scene.house.position.toArray(), pierJoin, pinError, samples, placementCells: world.sites.filter(s => s.placement).map(s => s.cell),
            maxHitError, maxPointerError, maxAnalyticProjectionError, probes, minTriangleRatio, triangles, walkEdges });
        scene.dispose(); layer.dispose(); m.dispose(); geometry.dispose(); material.dispose();
    }
} finally { kit.dispose(); }
console.log(JSON.stringify({ mode: CURVED_GRID_MODE, revision: CURVED_GRID_REVISION, at: new Date().toISOString(), runs,
    limits: ['CPU geometry and real native mesh footing only; no WebGL image', 'near-ground model vertices are a contact diagnostic, not proof of every continuous face', 'pier join uses real first-plank edge samples; seaward pier is intentionally over water'] }));
