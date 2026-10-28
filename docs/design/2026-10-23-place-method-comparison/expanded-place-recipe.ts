import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import manifest from '../2026-10-11-native-owned-island/kit-manifest.json';
import fixtureJSON from './evidence/expanded-fixture-v2.json';
import observedJSON from './evidence/60-H-linear-stable-placed-state.json';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import { editableIslandWorld, editableTerrainSegmentSupported } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { terrainOwnerSupported, validateTerrain } from '../../../src/domain/growingIsland/terrainEditing';
import { legacyIslandWorld } from '../../../src/domain/growingIsland/legacyWorldDefinition';
import { derivePlaces } from '../../../src/domain/growingIsland/places';
import type { Cell, GrowingState } from '../../../src/domain/growingIsland/types';
import { IslandMaterials } from '../../../src/components/island/three/primitives';
import { makePokomokoRig } from '../../../src/components/island/three/islandCharacters';
import { wrapPokomoko } from '../../../src/components/island/growing/actors';
import { GrowingLife, type PlaceUseReceipt } from '../../../src/components/island/growing/growingLife';
import { sceneLayout, type SceneLayout } from '../../../src/components/island/growing/sceneLayout';
import { buildObjectLayer } from '../../../src/components/island/growing/objectLayer';
import { makeNativeGrowingKit } from '../../../src/components/island/growing/native/nativeGrowingKit';
import { createWorldScene } from '../../../src/components/island/growing/worldScene';

declare const RECIPE_MODE: string;
declare const FLAT_FLOWER: boolean;
declare const WIDE_SHORE: boolean;
const initial = structuredClone(fixtureJSON.state) as GrowingState;
for (const field of ['land', 'terrain', 'plots', 'landmarks', 'keepsakes', 'villagers', 'character', 'drops', 'town', 'placeProgress'] as const)
    (initial as unknown as Record<string, unknown>)[field] = structuredClone(observedJSON[field]);
let state = structuredClone(initial);
const commands: { command: { type: 'terrain-edit'; cell: Cell; delta: -1 | 1 }; accepted: boolean; reason?: string }[] = [];
const stages: { name: string; commands: number; water: ReturnType<typeof waterConnectivity> }[] = [];
function lower(cell: Cell, target: number) {
    while ((state.terrain!.heights[`${cell.x},${cell.z}`] ?? 0) > target) {
        const command = { type: 'terrain-edit' as const, cell, delta: -1 as const }, previous = structuredClone(state);
        try { state = applyIntent(state, { id: `expanded-coast-${commands.length}`, command }, 3000 + commands.length).state; commands.push({ command, accepted: true }); }
        catch (error) { assert.deepEqual(state, previous); commands.push({ command, accepted: false, reason: String(error) }); break; }
    }
}
function waterConnectivity(input: GrowingState) {
    const world = editableIslandWorld(input)!;
    const water = world.definition.districts[0].floors.find(f => f.kind === 'water')!;
    const triangles = Array.from({ length: water.indices.length / 3 }, (_, i) => water.indices.slice(i * 3, i * 3 + 3));
    const links = new Map<string, number[]>(), adjacent = triangles.map(() => [] as number[]);
    triangles.forEach((ids, index) => { for (let i = 0; i < 3; i++) { const pair = [ids[i], ids[(i + 1) % 3]].sort((a,b) => a-b).join(':'); const existing = links.get(pair) ?? []; for (const other of existing) { adjacent[index].push(other); adjacent[other].push(index); } existing.push(index); links.set(pair, existing); } });
    const ocean = new Set<number>(); const queue: number[] = [];
    triangles.forEach((ids, i) => { if (ids.every(id => water.vertices[id].cell.x >= 9.2 || water.vertices[id].cell.z >= 8.7)) { ocean.add(i); queue.push(i); } });
    for (let q=0;q<queue.length;q++) for (const next of adjacent[queue[q]]) if (!ocean.has(next)) { ocean.add(next); queue.push(next); }
    const contains = (ids: number[], p: Cell) => {
        const [a,b,c] = ids.map(id => water.vertices[id].cell);
        const cross = (u: Cell,v: Cell,w: Cell) => (v.x-u.x)*(w.z-u.z)-(v.z-u.z)*(w.x-u.x);
        const d = [cross(a,b,p),cross(b,c,p),cross(c,a,p)]; return d.every(x=>x>=-1e-9)||d.every(x=>x<=1e-9);
    };
    const check = (p: Cell) => {
        const ids = triangles.flatMap((ids,i) => contains(ids,p)?[i]:[]);
        return { cell:p, dry:!!world.floorAt(p), dryHeight:world.floorAt(p)?.point.y ?? null, waterTriangle:ids.length>0, connectedToOcean:ids.some(id=>ocean.has(id)) };
    };
    const samples = [{x:7,z:5},{x:7.5,z:5},{x:8,z:4},{x:8,z:5},{x:8,z:6},{x:8.5,z:5},{x:9,z:5},{x:9.5,z:5},{x:5,z:6},{x:5,z:6.5},{x:5,z:7},{x:5,z:7.5},{x:5,z:8},{x:5,z:8.8}].map(check);
    // Width is measured along logical z cross-sections; H's physical shape is curved.
    const crossSections = [7,7.5,8,8.5,9].map(x=> { const wet = []; for(let i=0;i<=48;i++) { const z=3+i/12; if(!world.floorAt({x,z})) wet.push(z); }
        let best=0,current=0; for(let i=0;i<=48;i++){ const z=3+i/12;if(wet.includes(z)){current++;best=Math.max(best,current);}else current=0;}
        return {x,longestSampledWetSpan:Math.max(0,best-1)/12}; });
    const southSections = [6,6.5,7,7.5,8].map(z=>{ let best=0,current=0; for(let i=0;i<=48;i++){const x=3+i/12; if(!world.floorAt({x,z})){current++;best=Math.max(best,current);}else current=0;} return {z,longestSampledWetSpan:Math.max(0,best-1)/12}; });
    return {samples,crossSections,southSections,triangles:triangles.length,seaConnectedTriangles:ocean.size};
}
stages.push({name:'observed60',commands:0,water:waterConnectivity(state)});
lower({x:5,z:6},-3);
stages.push({name:'south-inner-minus3',commands:commands.length,water:waterConnectivity(state)});
lower({x:5,z:7},-3);
stages.push({name:'south-connected-minus3',commands:commands.length,water:waterConnectivity(state)});
assert(commands.length<=6);
if (WIDE_SHORE) {lower({x:4,z:6},-3);lower({x:4,z:7},-3);stages.push({name:'south-wide',commands:commands.length,water:waterConnectivity(state)});}
const shoreCommands=commands.length;
const beforeFlowerState=structuredClone(state);
if (FLAT_FLOWER) for (const z of [4,5,6]) {
 const command={type:'terrain-edit' as const,cell:{x:3,z},delta:1 as const}, previous=structuredClone(state);
 try {state=applyIntent(state,{id:`flat-flower-${z}`,command},4000+z).state;commands.push({command,accepted:true});}
 catch(error){assert.deepEqual(state,previous);commands.push({command,accepted:false,reason:String(error)});}
}
const undoRedo: { accepted:boolean; reason?:string }[]=[];
if (FLAT_FLOWER && commands.slice(shoreCommands).every(c=>c.accepted)) {
 let branch=state;
 for(const type of ['terrain-undo','terrain-undo','terrain-undo','terrain-redo','terrain-redo','terrain-redo'] as const) {
  const previous=structuredClone(branch);try{branch=applyIntent(branch,{id:`flower-undo-redo-${undoRedo.length}`,command:{type}},5000+undoRedo.length).state;undoRedo.push({accepted:true});}
  catch(error){assert.deepEqual(branch,previous);undoRedo.push({accepted:false,reason:String(error)});break;}
 }
 if(undoRedo.every(r=>r.accepted)){assert.deepEqual(branch.terrain,state.terrain);assert.deepEqual(branch.landmarks,state.landmarks);}
}

for(const key of Object.keys(initial.terrain!.heights)) if(!['5,6','5,7',...(WIDE_SHORE?['4,6','4,7']:[]),...(FLAT_FLOWER?['3,4','3,5','3,6']:[])].includes(key)) assert.equal(state.terrain!.heights[key], initial.terrain!.heights[key]);
for(const field of ['plots','landmarks','villagers','keepsakes','land','drops','placeProgress'] as const) assert.deepEqual(state[field],initial[field]);
validateTerrain(state);
const world = editableIslandWorld(state)!, layout = sceneLayout(state, true);
const place = derivePlaces(state).find(place => place.ruleId === 'P05'); assert(place);
const bytes = gunzipSync(readFileSync('docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz'));
const kit = makeNativeGrowingKit((await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '')).scene, manifest);
const m = new IslandMaterials('moon-garden'), layer = buildObjectLayer(m, state, layout, undefined, undefined, [], kit);
const floorAtPhysical = (point: T.Vector3, frame: SceneLayout = layout) => {
    const logical = frame.world.logicalAt({ x: point.x + frame.center, z: point.z + 2 });
    return logical ? frame.world.floorAt(logical) : undefined;
};
function contact(root: T.Object3D, frame:SceneLayout=layout) {
    const world=frame.world;
    const soil={samples:0,lowerSamples:0,minLowerGap:Infinity,maxLowerGap:-Infinity,minTerrainDeviation:Infinity,maxTerrainDeviation:-Infinity};
    root.updateWorldMatrix(true, true); let count = 0, absent = 0, min = Infinity, max = -Infinity;
    root.traverseVisible(object => {
        if (!(object instanceof T.Mesh) || object.userData.placementHitOnly) return;
        const positions = object.geometry.getAttribute('position');
        for (let i = 0; i < positions.count; i++) {
            const p = new T.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
            if (p.y < root.position.y - .12 || p.y > root.position.y + .08) continue;
            count++; const logical = world.logicalAt({ x: p.x + frame.center, z: p.z + 2 }), floor = logical && world.floorAt(logical);
            if (!floor) { absent++; continue; } min = Math.min(min, p.y - floor.point.y); max = Math.max(max, p.y - floor.point.y);
            if(object.material instanceof T.MeshStandardMaterial && object.material.color.getHexString()==='bba178') {
                soil.samples++;const deviation=root.position.y-.04-floor.point.y;
                soil.minTerrainDeviation=Math.min(soil.minTerrainDeviation,deviation);soil.maxTerrainDeviation=Math.max(soil.maxTerrainDeviation,deviation);
                if(p.y-root.position.y<=-.005+1e-8){soil.lowerSamples++;soil.minLowerGap=Math.min(soil.minLowerGap,p.y-floor.point.y);soil.maxLowerGap=Math.max(soil.maxLowerGap,p.y-floor.point.y);}
            }
        }
    });
    return { samples: count, absent, minGap: Number.isFinite(min) ? min : null, maxGap: Number.isFinite(max) ? max : null, soil:soil.samples?soil:null };
}
function sampleBody(root: T.Object3D, summary: { frames: number; vertices: number; absent: number; minClearance: number; maxBelowGround: number; worst?: { physical: number[]; logical: Cell; clearance: number; mesh: string; parent: string } }, frame: SceneLayout = layout) {
    root.updateWorldMatrix(true, true); summary.frames++;
    root.traverseVisible(object => {
        if (!(object instanceof T.Mesh) || object.userData.placementHitOnly) return;
        const positions = object.geometry.getAttribute('position');
        for (let i = 0; i < positions.count; i += 2) {
            const p = new T.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
            if (p.y > root.position.y + .5) continue;
            summary.vertices++; const floor = floorAtPhysical(p, frame);
            if (!floor) { summary.absent++; continue; }
            const clearance = p.y - floor.point.y;
            if (clearance < summary.minClearance) { summary.minClearance = clearance; summary.worst = { physical: p.toArray(), logical: frame.logicalAt(p), clearance, mesh: object.name || object.geometry.type, parent: object.parent?.name ?? '' }; }
            summary.maxBelowGround = Math.max(summary.maxBelowGround, -clearance);
        }
    });
}
function runLife(kind: 'garden' | 'autonomous', actorId?: string, input: GrowingState = state) {
    const layout = sceneLayout(input, true), world = editableIslandWorld(input)!, place = derivePlaces(input).find(p => p.ruleId === 'P05')!;
    // Fixed RNG affects normal target choice only. No receipt, walker state, route,
    // or actor position is injected; both actual residents remain present.
    const random = Math.random; let seed = 20261023;
    Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const m = new IslandMaterials('moon-garden'), rig = makePokomokoRig(m), hero = wrapPokomoko(rig.hero, rig.heroBody, rig.heroFeet);
    const layer = buildObjectLayer(m, input, layout, undefined, undefined, [], kit), life = new GrowingLife(m, hero);
    const facts: { at: number; receipt: PlaceUseReceipt; position: number[]; body: ReturnType<typeof bodySummary> }[] = [];
    const stats = new Map<string, ReturnType<typeof bodySummary>>(), arrivals = new Map<string, number>();
    const previous = new Map<string, Cell>(), routeErrors = new Map<string, number>();
    const traces = new Map<string, { at: number; cell: Cell; y: number }[]>();
    let accepted = true;
    try {
        life.sync(input, layout, layer); life.tick(0, 0, true, false);
        if (kind === 'garden') accepted = life.visitPlace(actorId!, place.id, 0, 'garden');
        const maxTime = kind === 'garden' ? 40_000 : 180_000;
        for (let now = 40; now <= maxTime && accepted; now += 40) {
            life.tick(now, 40, false, false); life.tick(now, 0, false, false);
            for (const id of ['pokomoko', 'v2']) {
                const p = life.positionOf(id); if (!p) continue;
                const cell = layout.logicalAt(p), old = previous.get(id);
                if (old && !editableTerrainSegmentSupported(world, old, cell)) routeErrors.set(id, (routeErrors.get(id) ?? 0) + 1);
                previous.set(id, cell);
                for (const target of place.useTargets) if (Math.hypot(cell.x - target.cell.x, cell.z - target.cell.z) < 1e-6) {
                    const key = `${id}:${target.id}`; if (!arrivals.has(key)) arrivals.set(key, now);
                }
                if (now % 200 === 0) {
                    const root = life.objects().find(root => root.userData.actorId === id); assert(root);
                    const summary = stats.get(id) ?? bodySummary(); sampleBody(root, summary, layout); stats.set(id, summary);
                    const trace = traces.get(id) ?? []; if (trace.length < 150) trace.push({ at: now, cell, y: p.y }); traces.set(id, trace);
                }
            }
            for (const receipt of life.takePlaceUses()) {
                if (receipt.placeId !== place.id) continue;
                const root = life.objects().find(root => root.userData.actorId === receipt.actorId)!;
                const summary = bodySummary(); sampleBody(root, summary, layout);
                facts.push({ at: now, receipt, position: life.positionOf(receipt.actorId)!.toArray(), body: summary });
            }
            if (kind === 'garden' && facts.some(f => f.receipt.actorId === actorId && f.receipt.targetId === 'starter-flower:garden')) break;
            if (kind === 'autonomous' && ['pokomoko', 'v2'].every(id => facts.some(f => f.receipt.actorId === id && f.receipt.targetId === 'starter-bench'))) break;
        }
        return { kind, actorId, accepted, seed: 20261023, receipts: facts.map(f => ({ ...f, firstArrival: arrivals.get(`${f.receipt.actorId}:${f.receipt.targetId}`) ?? null })),
            bodies: Object.fromEntries(stats), routeErrors: Object.fromEntries(routeErrors), traces: Object.fromEntries(traces),
            liveActors: life.terrainActors(), occupiedTargets: life.occupiedTerrainPlaceTargets() };
    } finally { life.dispose(); layer.dispose(); m.dispose(); Math.random = random; }
}
function bodySummary() { return { frames: 0, vertices: 0, absent: 0, minClearance: Infinity, maxBelowGround: 0,
    worst: undefined as undefined | { physical: number[]; logical: Cell; clearance: number; mesh: string; parent: string } }; }
function supportTilt(cell: Cell) {
    const base = legacyIslandWorld({ land: state.land, bridge: state.bridge }, true), center = world.floorAt(cell), originalCenter = base.floorAt(cell);
    let max = 0, worst: Cell | undefined;
    for (const dx of [-.46, -.23, 0, .23, .46]) for (const dz of [-.46, -.23, 0, .23, .46]) {
        const p = { x: cell.x + dx, z: cell.z + dz }, y = world.floorAt(p), old = base.floorAt(p);
        if (!y || !old || !center || !originalCenter) continue;
        const tilt = Math.abs((y.point.y - center.point.y) - (old.point.y - originalCenter.point.y));
        if (tilt > max) { max = tilt; worst = p; }
    }
    return { maxAdditionalTilt: max, worst };
}
const owners = [...state.plots, ...state.landmarks, ...state.keepsakes].flatMap(owner => owner.cell ? [{
    id: owner.id, cell: owner.cell, supported: terrainOwnerSupported(state, owner.cell), supportTilt: supportTilt(owner.cell), physical: contact(layer.objects.get(owner.id)!) }] : []);
const beforeFrame=sceneLayout(beforeFlowerState,true), beforeLayer=buildObjectLayer(m,beforeFlowerState,beforeFrame,undefined,undefined,[],kit);
const flowerSoilComparison={before:contact(beforeLayer.objects.get('starter-flower')!,beforeFrame),after:contact(layer.objects.get('starter-flower')!)};
beforeLayer.dispose();
const scene = createWorldScene({} as T.WebGLRenderer); scene.layout(state);
const cottage = kit.cottage(); cottage.position.copy(scene.house.position); const nativeCottage = contact(cottage);
scene.dispose(); layer.dispose(); m.dispose();
const life = [runLife('garden', 'pokomoko'), runLife('garden', 'v2'), runLife('autonomous')];

kit.dispose();
const cove = waterConnectivity(state);
const oceanConnected = [{x:5,z:6},{x:5,z:7}].every(p=>cove.samples.some(s=>s.cell.x===p.x&&s.cell.z===p.z&&!s.dry&&s.connectedToOcean));
const ramp = [{x:2,z:5},{x:3,z:5},{x:4,z:5},{x:5,z:5}].map(cell=>({cell,y:world.floorAt(cell)?.point.y??null}));
const rampSegments = ramp.slice(1).map((p,i)=>({from:ramp[i].cell,to:p.cell,supported:editableTerrainSegmentSupported(world,ramp[i].cell,p.cell)}));
const ownersSupported = owners.every(o=>o.supported);
const receipts = life.flatMap(l=>l.receipts);
const users = ['pokomoko','v2'].every(id=> ['starter-flower:garden','starter-bench'].every(target=>receipts.some(r=>r.receipt.actorId===id&&r.receipt.targetId===target)));
console.log(JSON.stringify({mode:RECIPE_MODE,flatFlower:FLAT_FLOWER,wideShore:WIDE_SHORE,undoRedo, status:commands.every(c=>c.accepted)&&ownersSupported&&users&&oceanConnected&&rampSegments.every(s=>s.supported)?'FUNCTIONAL_DIAGNOSTIC':'FAIL', oceanConnected,ramp,rampSegments, initialCandidate:observedJSON.candidate, stages, commands, state, owners, nativeCottage, flowerSoilComparison, life, cove,
 limits:['Observed UI60 fields merged with frozen expanded-v2 defaults; no database injection.','Money from original expansion fixture is diagnostic, not earned.','Actor snapshots omitted from domain edits; real UI must perform edits while residents clear.','Water connectivity uses shared actual water triangle edges; cross-section width is sampled logical width.','Mesh and body samples are diagnostic; remaining flower-rim penetration is not waived.','This changes the southern shore only; does not prove the whole composition or a unique single access ramp.']},null,2));
