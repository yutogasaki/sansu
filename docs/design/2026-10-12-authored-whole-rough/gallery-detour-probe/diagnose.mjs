import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { gunzipSync } from 'node:zlib';

assert(process.argv.length === 4, 'Usage: node --expose-gc --max-old-space-size=4096 diagnose.mjs CANDIDATE NEW_OUTPUT');
const candidate = path.resolve(process.argv[2]), output = path.resolve(process.argv[3]);
assert(!fs.existsSync(output), 'Preserve the first raw attempt'); fs.mkdirSync(output, { recursive: true });
const own = path.dirname(new URL(import.meta.url).pathname), require = createRequire(path.join(candidate, 'package.json'));
const { build } = require('esbuild'), started = performance.now(), inputs = new Map();
const sha = value => createHash('sha256').update(value).digest('hex');
const read = file => { const p = path.resolve(candidate, file), b = fs.readFileSync(p); inputs.set(p, sha(b)); return b; };
const json = file => JSON.parse((file.endsWith('.gz') ? gunzipSync(read(file)) : read(file)).toString());
const route = [{ x: 5.25, z: -7.25 }, { x: 5.25, z: -7.5 }, { x: 5.5, z: -7.75 }, { x: 5.75, z: -8 }];
const edges = route.slice(0, -1).map((from, i) => ({ from, to: route[i + 1] }));
const report = { candidate, node: process.version, startedAt: new Date().toISOString(), scope: 'Diagnostic graph only: two walking-only sites and three edges. Original floors, placement rights, owners, source models and guard thresholds stay unchanged. One retained resident, ordinary target selection and life ticks; no position/route injection, no all-rig sweep, no production eligibility claim.',
    route, completed: false, status: 'RUNNING', phases: [], motion: [] };
const save = () => fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const phase = name => { report.phase = name; report.phases.push({ name, elapsedMs: performance.now() - started, memory: process.memoryUsage() }); save(); console.log(name); assert(performance.now() - started < 170_000, 'Wall-clock safety stop'); assert(process.memoryUsage().heapUsed < 3.8 * 1024 ** 3, 'Heap safety stop'); };
const disposers = []; let oldRandom;
save();
try {
    const extension = `
export function diagnosticContacts(world, layout, root, envelope, edges) {
 const index = obstructionIndex(root), floors = floorIndex(world);
 return edges.map(edge => {
  const ground = pathGroundBox(edge.from, edge.to, layout, floors), hits = [];
  for (const [bandId, band] of envelope.bands.entries()) {
   const box = bandBox(ground, band);
   for (const item of query(index, box)) if (item.box.intersectsBox(box) && box.intersectsTriangle(item.triangle) && hits.length < 24) {
    const lineage = []; for (let node = item.node; node; node = node.parent) {
     lineage.push({name: node.name, role: node.userData.sourceGalleryNode ?? node.userData.forestDeliveryId, ownerId: node.userData.ownerId}); if (node === root) break;
    }
    hits.push({bandId, lineage, triangle: [item.triangle.a.toArray(), item.triangle.b.toArray(), item.triangle.c.toArray()]});
   }
  }
  return {...edge, hits};
 });
}`;
    fs.writeFileSync(path.join(output, 'instrumentation.txt'), extension);
    const compiled = await build({ stdin: { contents: fs.readFileSync(path.join(own, 'exports.ts.txt'), 'utf8'), resolveDir: candidate, loader: 'ts' },
        bundle: true, platform: 'node', format: 'esm', write: false, metafile: true, logLevel: 'silent', define: { 'import.meta.env.DEV': 'false' },
        plugins: [{ name: 'read-only-contact-labels', setup(builder) { builder.onLoad({ filter: /authoredFlowerObstructions\.ts$/ }, args => {
            const source = read(args.path).toString(); assert(source.includes('add(index, { triangle, box }, box);'));
            return { contents: source.replace('add(index, { triangle, box }, box);', 'add(index, { triangle, box, node }, box);') + extension, loader: 'ts' };
        }); } }] });
    for (const file of Object.keys(compiled.metafile.inputs)) if (file !== '<stdin>') read(file);
    report.bundleSha256 = sha(compiled.outputFiles[0].text);
    const d = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
    phase('compile-shared-world');
    const fixture = json('prototypes/place-qa/authored-shoulder-reference-mature.json'), state = fixture.state, stateBefore = JSON.stringify(state);
    const base = d.withNative05WaterCarvingScope(d.compileWorldDefinition(json('prototypes/place-qa/native05-world-source-shading.json.gz')));
    const options = { water: true, cove: true, shoulder: json('prototypes/place-qa/authored-shoulder-profile.json.gz') };
    const frame = d.authoredWorldFrame(state, base, options), before = frame.world;
    report.originalWorldRevision = before.definition.revision;
    phase('add-two-diagnostic-sites-and-three-edges');
    const ownerDistrict = before.definition.districts.find(district => district.id === 'native05-inlet-core');
    assert(ownerDistrict && ownerDistrict.turn === 0 && ownerDistrict.logicalOrigin.x === 0 && ownerDistrict.logicalOrigin.z === 0);
    const originalSites = new Map(before.sites.map(site => [d.key(site.cell), site]));
    const newSites = route.slice(1, -1).map(cell => {
        assert(!originalSites.has(d.key(cell))); const floor = before.floorAt(cell); assert(floor);
        const [districtId, floorId] = JSON.parse(floor.floorId); assert.equal(districtId, ownerDistrict.id);
        return { id: `diagnostic-detour:${d.key(cell)}`, cell, floorId, placement: false };
    });
    const refs = route.map(cell => originalSites.get(d.key(cell))?.ref ?? { districtId: ownerDistrict.id, siteId: newSites.find(site => d.key(site.cell) === d.key(cell)).id });
    const addedEdges = edges.map((_, i) => ({ from: refs[i], to: refs[i + 1], allows: ['walk'] }));
    const world = d.compileWorldDefinition({ ...before.definition, revision: `${before.definition.revision}:diagnostic-detour-two-sites`,
        districts: before.definition.districts.map(district => district === ownerDistrict ? { ...district, sites: [...district.sites, ...newSites] } : district),
        edges: [...before.definition.edges, ...addedEdges] });
    const geometry = world => sha(JSON.stringify(world.definition.districts.map(district => ({ id: district.id, floors: district.floors, surfaces: district.surfaces }))));
    report.geometryPreserved = geometry(world) === geometry(before); assert(report.geometryPreserved);
    report.placementRightsPreserved = JSON.stringify(world.sites.filter(site => site.placement)) === JSON.stringify(before.sites.filter(site => site.placement)); assert(report.placementRightsPreserved);
    const diagnosticSites = new Map(world.sites.map(site => [d.key(site.cell), site]));
    report.originalSitesPreserved = before.sites.every(site => JSON.stringify(diagnosticSites.get(d.key(site.cell))) === JSON.stringify(site)); assert(report.originalSitesPreserved);
    assert.equal(world.sites.length, before.sites.length + 2); assert.equal(world.definition.edges.length, before.definition.edges.length + 3);
    report.addedSites = newSites; report.addedEdges = addedEdges;
    report.edgeSupport = edges.map(edge => ({ ...edge, supported: world.isWalkEdgeSupported(edge.from, edge.to) })); assert(report.edgeSupport.every(edge => edge.supported));
    phase('load-original-models');
    async function load(manifest, filename, compressedSha, expandedSha) {
        const zipped = read(filename), bytes = gunzipSync(zipped); assert.equal(sha(zipped), compressedSha); assert.equal(sha(bytes), expandedSha);
        const scene = (await new d.GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '')).scene;
        scene.userData.sourceId = manifest.source?.id; scene.userData.sourceSha256 = expandedSha; return scene;
    }
    async function factory(file, make) { const manifest = json(file), value = make(await load(manifest, manifest.artifact.path.slice(1), manifest.artifact.sha256, manifest.artifact.expandedSha256 ?? manifest.source.sha256), manifest); disposers.push(() => value.dispose()); return value; }
    const manifest = json('docs/design/2026-10-11-native-owned-island/kit-manifest.json');
    const native = d.makeNativeGrowingKit(await load(manifest, 'docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz', manifest.gzipSha256, manifest.sha256), manifest); disposers.push(() => native.dispose());
    const cove = await factory('docs/design/2026-10-12-authored-cove-entrance/cove-delivery-manifest.json', d.makeNativeAuthoredCove);
    const shoulder = await factory('prototypes/place-qa/native-shoulder-manifest.json', d.makeNativeAuthoredShoulder);
    const flowers = d.makeNativeAuthoredFlower(json('prototypes/place-qa/native-flower-support.json.gz')); disposers.push(() => flowers.dispose());
    const forest = await factory('prototypes/place-qa/native-forest-stage4-manifest.json', d.makeNativeAuthoredForest);
    const gallery = await factory('prototypes/place-qa/native-gallery-v5-manifest.json', d.makeNativeAuthoredGallery);
    const layout = d.sceneLayout(state, false, world, frame.waterPlan, base, { options, covePlan: frame.covePlan, revision: world.definition.revision });
    const materials = new d.IslandMaterials('moon-garden'); disposers.push(() => materials.dispose());
    const layer = d.buildObjectLayer(materials, state, layout, undefined, undefined, [], native, flowers, cove, shoulder, { forest, gallery }); disposers.push(() => layer.dispose());
    const rig = d.makePokomokoRig(materials), life = new d.GrowingLife(materials, d.wrapPokomoko(rig.hero, rig.heroBody, rig.heroFeet)); disposers.push(() => life.dispose());
    phase('single-life-sync-all-original-obstacles');
    life.sync(state, layout, layer);
    const proof = life.walkingObstructionProof();
    report.guard = { envelope: proof.envelope, obstructionRootCount: proof.obstructionRootCount, triangles: proof.triangles,
        checkedEdges: proof.checkedEdges, blockedEdges: proof.blockedEdges, walkableCount: proof.walkableCount, reachableCount: proof.reachableCount };
    report.contacts = d.diagnosticContacts(world, layout, layer.root, proof.envelope, edges);
    report.routeNodes = route.map(cell => ({ cell, walkable: life.walkable.has(d.key(cell)), reachable: life.homePaths.has(d.key(cell)) })); save();
    assert(report.contacts.every(edge => edge.hits.length === 0), 'Candidate edges collide with an actual object-layer obstacle');
    assert(report.routeNodes.every(node => node.walkable && node.reachable), 'Candidate sites are removed by the actual actor guard or remain disconnected');
    const friend = 'authored-friend-0', walker = life.walkers.get(friend); assert(walker);
    for (const id of life.actorIds()) if (id !== friend) life.pick(id);
    life.tick(0, 0, false, false);
    const actor = walker.actor, actorIdentity = actor.root.uuid, start = { ...walker.at }, target = route.at(-1);
    const open = [...life.homePaths], targetIndex = open.indexOf(d.key(target)); assert(targetIndex >= 0);
    oldRandom = Math.random; const choices = [.99, (targetIndex + .5) / open.length]; Math.random = () => choices.length ? choices.shift() : .99;
    life.tick(2000, 0, false, false);
    report.actor = { id: friend, species: state.villagers.find(v => v.id === friend).species, start, target, visualScale: actor.visual.scale.toArray(), actorIdentity };
    report.actualRoute = [{ ...walker.at }, ...walker.path.map(cell => ({ ...cell }))];
    assert.equal(walker.mode, 'walk'); assert.deepEqual(walker.path.at(-1), target);
    const edgeKey = (a, b) => [d.key(a), d.key(b)].sort().join('|');
    const actualEdges = new Set(report.actualRoute.slice(1).map((cell, i) => edgeKey(report.actualRoute[i], cell)));
    assert(edges.every(edge => actualEdges.has(edgeKey(edge.from, edge.to))), 'Ordinary chosen route did not use the candidate detour');
    phase('continuous-one-actor-motion');
    let now = 2000, arrived = false, entered = false;
    const footMeshes = actor.feet.flatMap(foot => { const rows = []; foot.traverse(mesh => { if (mesh instanceof d.T.Mesh) rows.push(mesh); }); return rows; });
    const indices = new Map(footMeshes.map(mesh => [mesh, mesh.geometry.index ? [...new Set(mesh.geometry.index.array)] : Array.from({ length: mesh.geometry.getAttribute('position').count }, (_, i) => i)]));
    for (let step = 0; step < 2400; step++) {
        now += 25; life.tick(now, 25, false, false);
        assert.equal(walker.actor, actor); assert(actor.root.visible); assert(world.floorAt(walker.at), 'Actor center lost original support');
        assert.equal(life.walkingPoseProof().evacuations, 0, 'Actor pose guard evacuated during the ordinary route');
        assert.equal(life.walkingPoseProof().unplaced, 0, 'Actor could not settle');
        const local = walker.at.x >= 5.1 && walker.at.x <= 5.9 && walker.at.z <= -7.24 && walker.at.z >= -8.01;
        if (local) {
            entered = true; actor.root.updateWorldMatrix(true, true);
            const floor = world.floorAt(walker.at), rendered = layout.logicalAt(actor.root.position);
            const sample = { at: { ...walker.at }, now, floorY: floor.point.y, soleY: d.actorFootMinY(actor), rendered, feet: [], minFootClearance: Infinity, missingFootSupport: 0 };
            for (const [foot, mesh] of footMeshes.entries()) {
                const attr = mesh.geometry.getAttribute('position'); let lowest = Infinity, worst;
                for (const index of indices.get(mesh)) {
                    const p = new d.T.Vector3().fromBufferAttribute(attr, index).applyMatrix4(mesh.matrixWorld), cell = layout.logicalAt(p), support = world.floorAt(cell);
                    if (!support) { sample.missingFootSupport++; continue; }
                    const clearance = p.y - support.point.y; if (clearance < lowest) { lowest = clearance; worst = { vertex: index, point: p.toArray(), cell, floorY: support.point.y }; }
                }
                sample.feet.push({ foot, minClearance: lowest, worst }); sample.minFootClearance = Math.min(sample.minFootClearance, lowest);
            }
            report.motion.push(sample);
            assert(Math.abs(rendered.x - walker.at.x) < 1e-6 && Math.abs(rendered.z - walker.at.z) < 1e-6);
            assert.equal(sample.missingFootSupport, 0, 'Actual foot vertices extend beyond original support');
            assert(sample.minFootClearance >= -1e-5, 'Actual foot geometry penetrates the original terrain on the candidate detour');
        }
        if (Math.hypot(walker.at.x - target.x, walker.at.z - target.z) < 1e-7 && walker.path.length === 0) { arrived = true; break; }
        if (step % 100 === 0) { save(); assert(performance.now() - started < 170_000, 'Wall-clock safety stop'); }
    }
    assert(entered && arrived, 'Actor did not complete the candidate detour within the bounded motion');
    report.ownerStatePreserved = JSON.stringify(state) === stateBefore; assert(report.ownerStatePreserved);
    report.actorIdentityPreserved = walker.actor.root.uuid === actorIdentity; assert(report.actorIdentityPreserved);
    report.uses = life.takePlaceUses(); assert.equal(report.uses.length, 0);
    report.arrived = arrived; report.status = 'PASS'; report.completed = true;
} catch (error) {
    report.status = 'FAIL'; report.failure = { phase: report.phase, message: error.message, stack: error.stack }; process.exitCode = 1;
} finally {
    if (oldRandom) Math.random = oldRandom;
    for (const dispose of disposers.reverse()) { try { dispose(); } catch (error) { (report.cleanupErrors ??= []).push(error.message); } }
    report.elapsedMs = performance.now() - started; report.memory = process.memoryUsage(); report.inputs = Object.fromEntries(inputs);
    report.inputsUnchanged = [...inputs].every(([file, hash]) => sha(fs.readFileSync(file)) === hash);
    report.finishedAt = new Date().toISOString(); save(); console.log(JSON.stringify({ status: report.status, elapsedMs: report.elapsedMs, failure: report.failure?.message, inputsUnchanged: report.inputsUnchanged, motionSamples: report.motion.length }));
}
