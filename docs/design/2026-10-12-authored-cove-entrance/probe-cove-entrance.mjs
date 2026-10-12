// Bounded, read-only numerical design probe. Does not run a browser or change app code.
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const repo = '/Users/yutogasaki/Projects/sansu';
const output = '/Users/yutogasaki/Projects/sansu/docs/design/2026-10-12-authored-cove-entrance';
const require = createRequire(path.join(repo, 'package.json'));
const T = require('three'), { build } = require('esbuild');
const read = relative => fs.readFileSync(path.isAbsolute(relative) ? relative : path.join(repo, relative));
const sha = value => createHash('sha256').update(value).digest('hex');
const files = {
  source: 'docs/design/2026-10-12-authored-cove-entrance/cove-corner-v1.glb',
  originalHome: 'docs/design/2026-10-10-island-final-3d/whole-island.glb',
  authoredScript: 'docs/design/2026-10-12-authored-cove-entrance/build-cove-entrance-variant.py',
  probe: 'docs/design/2026-10-12-authored-cove-entrance/probe-cove-entrance.mjs',
  kit: 'docs/design/2026-10-11-native-owned-island/kit-manifest.json',
  world: 'prototypes/place-qa/native05-world.json.gz',
  state: 'prototypes/place-qa/authored-flower-reference-mature.json',
  envelope: 'docs/design/2026-10-12-authored-flower-edge/c5-shape/report.json',
  actual: 'docs/design/2026-10-12-authored-flower-edge/c5-shape/desktop-mature-whole-day.png',
  benchmark: 'docs/design/2026-10-10-island-final-3d/whole-island-render.png',
};
const bundled = await build({ stdin: { contents: `
export {compileWorldDefinition} from './src/domain/growingIsland/worldDefinition.ts';
export {sceneLayout} from './src/components/island/growing/sceneLayout.ts';
export {authoredFlowerWalkSet} from './src/components/island/growing/authoredFlowerObstructions.ts';
export {walkableCells,reachableFromHome,approachCells,key} from './src/domain/growingIsland/space.ts';
`, resolveDir: repo, loader: 'ts' }, absWorkingDir: repo, write: false, bundle: true, packages: 'external',
platform: 'node', format: 'cjs', metafile: true, logLevel: 'silent' });
const sources = [...new Set([...Object.values(files), ...Object.keys(bundled.metafile.inputs).filter(file => file !== '<stdin>')])];
const inputs = Object.fromEntries(sources.map(file => [file, sha(read(file))]));
const module = { exports: {} };
new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(require, module, module.exports);
const api = module.exports;
const fixture = JSON.parse(read(files.state)), state = fixture.state;
const world = api.compileWorldDefinition(JSON.parse(gunzipSync(read(files.world))));
const layout = api.sceneLayout(state, false, world);
const prior = JSON.parse(read(files.envelope)), metadata = prior.captures[0].metadata;
const walking = JSON.parse(metadata.authoredFlowerWalking), water = JSON.parse(metadata.authoredWater);
const envelope = walking.envelope;
const binarySource = read(files.source), jsonSize = binarySource.readUInt32LE(12);
const gltf = JSON.parse(binarySource.subarray(20, 20 + jsonSize)), binary = binarySource.subarray(28 + jsonSize);
const kit = JSON.parse(read(files.kit));
function extract(node, document = gltf, data = binary) {
  const result = [];
  const matrix = node.matrix ? new T.Matrix4().fromArray(node.matrix) : new T.Matrix4().compose(
    new T.Vector3().fromArray(node.translation ?? [0, 0, 0]), new T.Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]), new T.Vector3().fromArray(node.scale ?? [1, 1, 1]));
  for (const primitive of document.meshes[node.mesh].primitives) {
    const attribute = document.accessors[primitive.attributes.POSITION], view = document.bufferViews[attribute.bufferView], points = [];
    for (let i = 0; i < attribute.count; i++) {
      const at = (view.byteOffset ?? 0) + (attribute.byteOffset ?? 0) + i * (view.byteStride ?? 12);
      points.push(new T.Vector3(data.readFloatLE(at), data.readFloatLE(at + 4), data.readFloatLE(at + 8)).applyMatrix4(matrix));
    }
    const accessor = document.accessors[primitive.indices], indexView = document.bufferViews[accessor.bufferView], size = accessor.componentType === 5125 ? 4 : 2, indices = [];
    for (let i = 0; i < accessor.count; i++) {
      const at = (indexView.byteOffset ?? 0) + (accessor.byteOffset ?? 0) + i * size;
      indices.push(size === 4 ? data.readUInt32LE(at) : data.readUInt16LE(at));
    }
    result.push({ name: node.name, points, indices, color: document.materials?.[primitive.material]?.pbrMetallicRoughness?.baseColorFactor ?? [.7,.7,.7,1] });
  }
  return result;
}
const pieces = gltf.nodes.filter(node => node.mesh !== undefined && /^Harbor \/ /.test(node.name)).flatMap(node => extract(node));
const footings = pieces.filter(piece => /grown footing|runner jamb/.test(piece.name));
const roof = pieces.filter(piece => !piece.name.includes('grown footing'));
const originalBinary = read(files.originalHome), originalJsonSize = originalBinary.readUInt32LE(12);
const originalDocument = JSON.parse(originalBinary.subarray(20, 20 + originalJsonSize)), originalData = originalBinary.subarray(28 + originalJsonSize);
const homePieces = originalDocument.nodes.filter(node => node.mesh !== undefined && kit.parts['home-cap'].sourceNames.includes(node.name)).flatMap(node => extract(node, originalDocument, originalData));
const homePart = kit.parts['home-cap'], homeOrigin = new T.Vector3((homePart.min[0] + homePart.max[0]) / 2, homePart.min[1], (homePart.min[2] + homePart.max[2]) / 2);
const houses = state.plots.filter(owner => ['p6', 'p7'].includes(owner.id)).flatMap(owner => homePieces.map(piece => ({
  ownerId: owner.id, name: piece.name, indices: piece.indices, color: piece.color,
  points: piece.points.map(p => p.clone().sub(homeOrigin).multiply(new T.Vector3(.45, .5625, .45)).add(new T.Vector3(owner.cell.x, layout.point(owner.cell).y, owner.cell.z))),
})));
const houseTriangles = houses.flatMap(piece => Array.from({ length: piece.indices.length / 3 }, (_, i) => {
  const points = piece.indices.slice(i * 3, i * 3 + 3).map(id => piece.points[id]);
  return { ownerId: piece.ownerId, name: piece.name, points, box: new T.Box3().setFromPoints(points) };
}));
const bins = new Map(), binSize = .20;
function keys(box) {
  const out = [];
  for (let x = Math.floor(box.min.x / binSize); x <= Math.floor(box.max.x / binSize); x++)
    for (let y = Math.floor(box.min.y / binSize); y <= Math.floor(box.max.y / binSize); y++)
      for (let z = Math.floor(box.min.z / binSize); z <= Math.floor(box.max.z / binSize); z++) out.push(`${x},${y},${z}`);
  return out;
}
houseTriangles.forEach((triangle, i) => { for (const key of keys(triangle.box)) { const values = bins.get(key) ?? []; values.push(i); bins.set(key, values); } });
const intersectionRay = new T.Ray(), hitPoint = new T.Vector3(), delta = new T.Vector3();
function segmentHit(a, b, triangle) {
  delta.copy(b).sub(a); const length = delta.length(); if (length < 1e-10) return false;
  intersectionRay.set(a, delta.divideScalar(length)); const hit = intersectionRay.intersectTriangle(...triangle, false, hitPoint);
  return Boolean(hit && hit.distanceTo(a) <= length + 1e-7);
}
function intersects(a, b) { for (let i = 0; i < 3; i++) if (segmentHit(a[i], a[(i + 1) % 3], b) || segmentHit(b[i], b[(i + 1) % 3], a)) return true; return false; }
const sourcePivot = new T.Vector3(13.9, .89, 1.2), axis = new T.Vector3(0, 1, 0);
const root = new T.Group(), obstacleProbe = new T.Group();
// Explicit diagnostic adapter ONLY. Existing obstruction kernel would otherwise
// exclude shell triangles by its flower-specific ancestor-name filter.
obstacleProbe.name = 'authored-flower-owned-stock'; root.add(obstacleProbe);
for (const piece of pieces) {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(piece.points.flatMap(p => p.clone().sub(sourcePivot).toArray()), 3));
  geometry.setIndex(piece.indices); const mesh = new T.Mesh(geometry, new T.MeshBasicMaterial({ side: T.DoubleSide })); mesh.name = piece.name; obstacleProbe.add(mesh);
}
const baseOpen = api.walkableCells(state, world), baseReached = api.reachableFromHome(state, baseOpen, world);
const viewDirection = new T.Vector3(8.5, 10, 11).normalize(), ray = new T.Raycaster();

fs.writeFileSync('/private/tmp/sansu-authored-cove-entrance/actual-context.json', JSON.stringify({houses:houses.map(h=>({...h, points:h.points.map(p=>p.toArray())})),
 floors:world.floors.filter(f=>f.kind!=='water').map(f=>({id:f.id, vertices:f.vertices.map(v=>[v.point.x,v.point.y,v.point.z]), indices:f.indices})),
 localFloorSamples: Array.from({length:17},(_,xi)=>Array.from({length:17},(_,zi)=>{const at={x:6.5+xi*.25,z:-1.5+zi*.25};return {at,floor:world.floorAt(at)};})).flat()}));
function pathTo(open,target) { const seen=new Map([['2,1',undefined]]), queue=[{x:2,z:1}];
 for(let i=0;i<queue.length;i++) {const cell=queue[i];if(api.key(cell)===api.key(target))break;for(const next of world.neighbors(cell)){const k=api.key(next);if(!open.has(k)||seen.has(k))continue;seen.set(k,api.key(cell));queue.push(next);}}
 if(!seen.has(api.key(target)))return undefined;const out=[];for(let k=api.key(target);k!==undefined;k=seen.get(k)){const [x,z]=k.split(',').map(Number);out.push({x,z});}return out.reverse();
}
const candidates = [{ id: 'native05-authored-cove-corner-v1', x: 8, z: .50, y: .0475, scale: .45, degrees: 0 }];
const results = [];
for (const candidate of candidates) {
  const transform = p => p.clone().sub(sourcePivot).multiplyScalar(candidate.scale).applyAxisAngle(axis, candidate.degrees * Math.PI / 180).add(new T.Vector3(candidate.x, candidate.y, candidate.z));
  const bounds = new T.Box3().setFromPoints(roof.flatMap(piece => piece.points.map(transform)));
  const floorSupport = footings.map(piece => {
    const points = piece.points.map(transform), missing = points.filter(p => !world.floorAt(p));
    const lower = points.filter(p => p.y < .11).map(p => { const floor = world.floorAt(p); return floor ? p.y - floor.point.y : undefined; });
    const offsets = lower.filter(value => value !== undefined);
    return { name: piece.name, vertexCount: points.length, unsupportedVertices: missing.length, firstUnsupported: missing[0]?.toArray(),
      lowerBandWorldY: .11, lowerBandCount: lower.length, lowerBandFloorOffsets: [Math.min(...offsets), Math.max(...offsets)],
      lowerBandWithin25mm: offsets.filter(value => Math.abs(value) < .025).length };
  });
  const intersections = {};
  for (const piece of pieces) {
    const transformed = piece.points.map(transform);
    for (let i = 0; i < piece.indices.length; i += 3) {
      const points = piece.indices.slice(i, i + 3).map(id => transformed[id]), box = new T.Box3().setFromPoints(points);
      for (const id of new Set(keys(box).flatMap(key => bins.get(key) ?? []))) {
        const house = houseTriangles[id]; if (!box.intersectsBox(house.box) || !intersects(points, house.points)) continue;
        const key = `${house.ownerId}/${house.name}`; intersections[key] = (intersections[key] ?? 0) + 1; break;
      }
    }
  }
  obstacleProbe.position.set(candidate.x - layout.center, candidate.y, candidate.z - 2); obstacleProbe.rotation.y = candidate.degrees * Math.PI / 180; obstacleProbe.scale.setScalar(candidate.scale); root.updateMatrixWorld(true);
  const guard = api.authoredFlowerWalkSet(baseOpen, world, layout, root, envelope), reached = api.reachableFromHome(state, guard.walkable, world);
  const owners = state.plots.filter(owner => ['p6', 'p7', 'p9'].includes(owner.id)).map(owner => ({ id: owner.id,
    previous: api.approachCells(owner.cell, world).filter(cell => baseReached.has(api.key(cell))),
    after: api.approachCells(owner.cell, world).filter(cell => reached.has(api.key(cell))),
    usable: api.approachCells(owner.cell, world).filter(cell => reached.has(api.key(cell)) && guard.clearGroundPath(cell, owner.cell)),
  }));
  const visibility = houses.filter(piece => /cobalt entry$|arched entry frame$|broad scalloped cap roof$/.test(piece.name)).map(piece => {
    const points = piece.points.filter((_, i) => i % Math.ceil(piece.points.length / 45) === 0); let occluded = 0;
    for (const point of points) {
      ray.set(point.clone().add(new T.Vector3(-layout.center, 0, -2)).addScaledVector(viewDirection, .0001), viewDirection);
      if (ray.intersectObject(root, true).length) occluded++;
    }
    return { ownerId: piece.ownerId, name: piece.name, occluded, vertices: points.length };
  });
  results.push({ candidate, roofBounds: { min: bounds.min.toArray(), max: bounds.max.toArray() }, floorSupport,
    houseTriangleIntersections: intersections, navigation: { previous: baseOpen.size, after: guard.walkable.size,
      excluded: guard.proof.excludedRefs, shellTriangles: guard.proof.triangles, owners,
      front: [.75, 1, 1.25].map(z => ({ x: 8, z, clear: guard.walkable.has(api.key({ x: 8, z })), reached: reached.has(api.key({ x: 8, z })), toPlayClear: guard.clearGroundPath({ x: 8, z }, { x: 8, z: 0 }) })) },
    visibility, baselineRoutes: [{x:7,z:-.25},{x:8,z:.75}].map(target=>({target,route:pathTo(baseOpen,target)?.map(cell=>({...cell, clear:guard.walkable.has(api.key(cell)), floor:world.floorAt(cell)?.point.y}))})), localRefs: [...baseOpen].map(k => ({key:k, cell:k.split(',').map(Number)})).filter(r => r.cell[0]>=6.25 && r.cell[0]<=9.75 && r.cell[1]>=-1.75 && r.cell[1]<=1.75).map(r => ({...r, baseReached:baseReached.has(r.key), clear:guard.walkable.has(r.key), reached:reached.has(r.key)})),
    decision: owners.every(o=>o.usable.length) && !Object.keys(intersections).length ? 'LOCAL GEOMETRY PASS: current home approaches and play target reachable; source-only feasibility, not app/art acceptance' : 'HOLD: current owner or play target route/intersection constraint not yet satisfied' });
}
const finalInputs = Object.fromEntries(sources.map(file => [file, sha(read(file))]));
const result = { scope: 'Separate editable native05-authored-cove-corner-v1 source feasibility only; no browser, app edits, save or art acceptance',
  inputIdentity: { fixture: fixture.candidate, world: world.id, sourceSha: sha(binarySource), actorEnvelopeCapture: prior.captures[0].file,
    actorEnvelopeBuild: prior.captures[0].build, actorEnvelopeAppTarget: prior.captures[0].url,
    displayedWorldRevision: metadata.worldRevision, waterOwners: water.ownerIds, localScope: 'Base world only; c5 water composition cuts only northern l20–l24. l32 is individual-bodies and does not carve this P04 area.' },
  method: { sourcePivot: sourcePivot.toArray(), coordinates: 'authored world; renderer subtracts layout.center from x and 2 from z',
    actualOwnerScale: { homeCap: [.45, .5625, .45], actors: .45 },
    footSupport: 'Every original footing vertex sampled against current dry triangulation. Lower band is a proximity/contact probe, not full load-bearing or triangle-interior proof.',
    houseContact: 'Source triangle edge intersection against actual p6/p7 cap-home triangles; no unrelated proxy roof.',
    navigation: 'Existing exact source-triangle obstruction kernel + recorded real rig motion bands; in-memory flower-name wrapper explicitly includes shell+footings. Final code must generalize eligible obstruction roots.',
    visibility: 'Default-camera-direction rays from sampled actual home mesh vertices, treating translucent shell as geometric occluder; not rendered visual acceptance.' },
  sourceParts: pieces.map(piece => ({ name: piece.name, vertices: piece.points.length, triangles: piece.indices.length / 3 })),
  actorEnvelope: envelope, p9Floor: world.floorAt({ x: 8, z: 0 }), results, inputs, finalInputs,
  inputHashesUnchanged: JSON.stringify(inputs) === JSON.stringify(finalInputs),
  conclusion: results[0].decision };
fs.writeFileSync(path.join(output, 'feasibility-v1.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ inputHashesUnchanged: result.inputHashesUnchanged, results: results.map(r => ({ id: r.candidate.id,
  unsupportedFootVertices: r.floorSupport.reduce((n, f) => n + f.unsupportedVertices, 0), houseIntersections: Object.values(r.houseTriangleIntersections).reduce((a, b) => a + b, 0),
  shellTriangles: r.navigation.shellTriangles, excludedRefs: r.navigation.excluded, reachable: r.navigation.owners.map(o => [o.id, o.after.length]), decision: r.decision })) }, null, 2));
