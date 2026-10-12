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
  source: 'docs/design/2026-10-12-authored-cove-entrance/cove-corner-v3.glb',
  originalHome: 'docs/design/2026-10-10-island-final-3d/whole-island.glb',
  authoredScript: 'docs/design/2026-10-12-authored-cove-entrance/build-cove-entrance-variant.py',
  probe: 'docs/design/2026-10-12-authored-cove-entrance/probe-cove-shore-v4.mjs',
  sourceManifest: 'docs/design/2026-10-12-authored-cove-entrance/source-manifest.json',
  ground: 'docs/design/2026-10-12-authored-cove-entrance/ground-input.json',
  footprint: 'docs/design/2026-10-12-authored-cove-entrance/apron-footprint-v1.json',
  kit: 'docs/design/2026-10-11-native-owned-island/kit-manifest.json',
  world: 'prototypes/place-qa/native05-world.json.gz',
  state: 'prototypes/place-qa/authored-flower-reference-mature.json',
  envelope: 'docs/design/2026-10-12-authored-flower-edge/c5-shape/report.json',
  actual: 'docs/design/2026-10-12-authored-flower-edge/c5-shape/desktop-mature-whole-day.png',
  benchmark: 'docs/design/2026-10-10-island-final-3d/whole-island-render.png',
};
if (!process.argv.includes('--prepare')) files.fullWidthProof='docs/design/2026-10-12-authored-cove-entrance/full-width-support-v4.json';
const bundled = await build({ stdin: { contents: `
export {compileWorldDefinition} from './src/domain/growingIsland/worldDefinition.ts';
export {sceneLayout} from './src/components/island/growing/sceneLayout.ts';
export {authoredFlowerWalkSet} from './src/components/island/growing/authoredFlowerObstructions.ts';
export {walkableCells,reachableFromHome,approachCells,key} from './src/domain/growingIsland/space.ts';
export {triangulateWaterPolygon,subtractPolygon,polygonArea} from './src/domain/growingIsland/authoredWaterGeometry.ts';
`, resolveDir: repo, loader: 'ts' }, absWorkingDir: repo, write: false, bundle: true, packages: 'external',
platform: 'node', format: 'cjs', metafile: true, logLevel: 'silent' });
const sources = [...new Set([...Object.values(files), ...Object.keys(bundled.metafile.inputs).filter(file => file !== '<stdin>')])];
const inputs = Object.fromEntries(sources.map(file => [file, sha(read(file))]));
const module = { exports: {} };
new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(require, module, module.exports);
const api = module.exports;
const fixture = JSON.parse(read(files.state)), state = fixture.state;
const originalDefinition=JSON.parse(gunzipSync(read(files.world)));
const originalWorld=api.compileWorldDefinition(originalDefinition);
const patchId='native05-cove-corner-shared-apron-v1', floorY=-.00899999;
const footprint=JSON.parse(read(files.footprint));if(footprint.polygons.length!==1)throw Error('Expected one apron polygon');
let polygon=footprint.polygons[0];
const polygonTriangles=api.triangulateWaterPolygon(polygon);if(!polygonTriangles)throw Error('Apron triangulation failed');
// The domain triangulator removes collinear shoreline vertices. Use that exact
// retained boundary for the bank too, so the closed source has no T-junctions.
const retainedBoundary=new Set(polygonTriangles.flatMap(t=>t.map(api.key)));
polygon=polygon.filter(p=>retainedBoundary.has(api.key(p)));
const floorIndices=polygonTriangles.flatMap(tri=>tri.map(p=>polygon.findIndex(v=>v.x===p.x&&v.z===p.z)));
const patchFloors=[{id:'shared-apron',kind:'ground',color:'#a4cb87',vertices:polygon.map(cell=>({cell,point:{x:cell.x,y:floorY,z:cell.z}})),indices:floorIndices}];
const n=polygon.length,bankIndices=polygon.flatMap((_,i)=>[i,(i+1)%n,(i+1)%n+n,i,(i+1)%n+n,i+n]);
const patchSurfaces=[{id:'shared-apron-solid-bank',kind:'bank',vertices:[...polygon.map(({x,z})=>({x,y:floorY,z})),...polygon.map(({x,z})=>({x,y:-.32,z}))],indices:bankIndices,material:{color:'#e2d7c9',roughness:.78,metalness:0}}];
const routePoints=[[9.5,1],[9.65,1.25],[9.65,1.7],[9.3,1.7],[9,1.7],[8.5,1.7],[8,1.7],[7.5,1.7],[7,1.7],[6.55,1.7],[6.55,1.2],[6.55,.7],[6.55,.25],[6.55,-.25],[7,-.25]];
const newSites=[],siteAdditions=new Map(),refs=routePoints.map(([x,z],i)=>{const existing=originalWorld.sites.find(s=>s.cell.x===x&&s.cell.z===z);if(existing)return existing.ref;
const baseFloor=originalWorld.floorAt({x,z}),[districtId,floorId]=baseFloor?JSON.parse(baseFloor.floorId):[patchId,patchFloors[0].id];
const id='cove-apron-approach-'+i,site={id,cell:{x,z},floorId,placement:false};
if(districtId===patchId)newSites.push(site);else {const sites=siteAdditions.get(districtId)??[];sites.push(site);siteAdditions.set(districtId,sites);}return {districtId,siteId:id};});
const edges=refs.slice(1).map((to,i)=>({from:refs[i],to,allows:['walk']}));
const playEntry=originalWorld.sites.find(s=>s.cell.x===8&&s.cell.z===1);edges.push({from:refs[6],to:playEntry.ref,allows:['walk']});
const patchDistrict={id:patchId,templateId:patchId,logicalOrigin:{x:0,z:0},worldOrigin:{x:0,y:0,z:0},turn:0,floors:patchFloors,surfaces:patchSurfaces,sites:newSites,ports:[]};
const patch={candidate:'native05-authored-cove-shore-v4',sourceId:'native05-authored-cove-corner-v3',scope:'unintegrated visible shared floor and walk-only graph candidate; no placement grants',district:patchDistrict,siteAdditions:[...siteAdditions].map(([districtId,sites])=>({districtId,sites})),edges,routePoints};
fs.writeFileSync(path.join(output,'shared-apron-world-patch-v1.json'),JSON.stringify(patch,null,2)+'\n');
const definition={...originalDefinition,revision:patchId,districts:[...originalDefinition.districts.map(d=>siteAdditions.has(d.id)?{...d,sites:[...d.sites,...siteAdditions.get(d.id)]}:d),patchDistrict],edges:[...originalDefinition.edges,...edges]};
const world = api.compileWorldDefinition(definition);
if(originalWorld.sites.filter(s=>s.placement).length!==world.sites.filter(s=>s.placement).length)throw Error('Placement changed');

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
const supportProof=files.fullWidthProof?JSON.parse(read(files.fullWidthProof)):undefined;
function fullWidthSupport(from,to) {if(!supportProof)throw Error('Support proof missing');if(supportProof.patch_sha256!==sha(fs.readFileSync(path.join(output,'shared-apron-world-patch-v1.json'))))throw Error('Support proof patch differs');const r=supportProof.results.find(r=>r.from[0]===from.x&&r.from[1]===from.z&&r.to[0]===to.x&&r.to[1]===to.z);if(!r)throw Error('Support proof edge absent');return r;}
const viewDirection = new T.Vector3(8.5, 10, 11).normalize(), ray = new T.Raycaster();

fs.writeFileSync('/private/tmp/sansu-authored-cove-entrance/actual-context.json', JSON.stringify({houses:houses.map(h=>({...h, points:h.points.map(p=>p.toArray())})),
 floors:world.floors.filter(f=>f.kind!=='water').map(f=>({id:f.id, vertices:f.vertices.map(v=>[v.point.x,v.point.y,v.point.z]), indices:f.indices})),
 localFloorSamples: Array.from({length:17},(_,xi)=>Array.from({length:17},(_,zi)=>{const at={x:6.5+xi*.25,z:-1.5+zi*.25};return {at,floor:world.floorAt(at)};})).flat()}));
if(process.argv.includes('--prepare')) {console.log('SANSU_COVE_PREPARED');process.exit(0);}
function pathTo(open,target) { const seen=new Map([['2,1',undefined]]), queue=[{x:2,z:1}];
 for(let i=0;i<queue.length;i++) {const cell=queue[i];if(api.key(cell)===api.key(target))break;for(const next of world.neighbors(cell)){const k=api.key(next);if(!open.has(k)||seen.has(k))continue;seen.set(k,api.key(cell));queue.push(next);}}
 if(!seen.has(api.key(target)))return undefined;const out=[];for(let k=api.key(target);k!==undefined;k=seen.get(k)){const [x,z]=k.split(',').map(Number);out.push({x,z});}return out.reverse();
}
const candidates = [{ id: 'native05-authored-cove-shore-v4', sourceId: 'native05-authored-cove-corner-v3', x: 8, z: .50, y: .0475, scale: .45, degrees: 0 }];
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
    visibility, candidateApron:{placementBefore:originalWorld.sites.filter(s=>s.placement).length, placementAfter:world.sites.filter(s=>s.placement).length, floors:patchFloors.length, newWalkOnlySites:newSites.length+[...siteAdditions.values()].reduce((n,sites)=>n+sites.length,0), explicitEdges:edges.length, route:routePoints.map(([x,z])=>({x,z,clear:guard.walkable.has(api.key({x,z})),reached:reached.has(api.key({x,z}))})), routeEdges:routePoints.slice(1).map(([x,z],i)=>({from:routePoints[i],to:[x,z],clear:guard.clearGroundPath({x:routePoints[i][0],z:routePoints[i][1]},{x,z})})), playEntryClear:guard.clearGroundPath({x:8,z:1.7},{x:8,z:1}), fullWidthSupport:[...routePoints.slice(1).map(([x,z],i)=>({from:routePoints[i],to:[x,z],...fullWidthSupport({x:routePoints[i][0],z:routePoints[i][1]},{x,z})})),{from:[8,1.7],to:[8,1],...fullWidthSupport({x:8,z:1.7},{x:8,z:1})}], patchSha256:sha(fs.readFileSync(path.join(output,'shared-apron-world-patch-v1.json')))}, baselineRoutes: [{x:7,z:-.25},{x:8,z:.75}].map(target=>({target,route:pathTo(baseOpen,target)?.map(cell=>({...cell, clear:guard.walkable.has(api.key(cell)), floor:world.floorAt(cell)?.point.y}))})), localRefs: [...baseOpen].map(k => ({key:k, cell:k.split(',').map(Number)})).filter(r => r.cell[0]>=6.25 && r.cell[0]<=9.75 && r.cell[1]>=-1.75 && r.cell[1]<=1.75).map(r => ({...r, baseReached:baseReached.has(r.key), clear:guard.walkable.has(r.key), reached:reached.has(r.key)})),
    decision: owners.every(o=>o.usable.length) && !Object.keys(intersections).length ? 'LOCAL GEOMETRY PASS: current home approaches and play target reachable; source-only feasibility, not app/art acceptance' : 'HOLD: current owner or play target route/intersection constraint not yet satisfied' });
}
const finalInputs = Object.fromEntries(sources.map(file => [file, sha(read(file))]));
const sourceManifest=JSON.parse(read(files.sourceManifest));
const socketGround=sourceManifest.ground_sockets.map(s=>({name:s.name,vertices:s.bottom_vertices_world.length,missing:s.bottom_vertices_world.filter(([x,y,z])=>!world.floorAt({x,z})).length,maxDepthError:Math.max(...s.bottom_vertices_world.map(([x,y,z])=>Math.abs((world.floorAt({x,z})?.point.y??Infinity)-y-s.buried_depth)))}));
const result = { socketGround, originalFloorsUnchanged:originalDefinition.districts.every((d,i)=>JSON.stringify(d.floors)===JSON.stringify(definition.districts[i].floors)), originalSitesUnchanged:originalDefinition.districts.every((d,i)=>JSON.stringify(d.sites)===JSON.stringify(definition.districts[i].sites.slice(0,d.sites.length))), originalEdgesUnchanged:JSON.stringify(originalDefinition.edges)===JSON.stringify(definition.edges.slice(0,originalDefinition.edges.length)),scope: 'Separate editable native05-authored-cove-shore-v4 with unchanged v3 shell source feasibility only; no browser, app edits, save or art acceptance',
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
fs.writeFileSync(path.join(output, 'feasibility-with-shore-v4.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ inputHashesUnchanged: result.inputHashesUnchanged, results: results.map(r => ({ id: r.candidate.id,
  unsupportedFootVertices: r.floorSupport.reduce((n, f) => n + f.unsupportedVertices, 0), houseIntersections: Object.values(r.houseTriangleIntersections).reduce((a, b) => a + b, 0),
  shellTriangles: r.navigation.shellTriangles, excludedRefs: r.navigation.excluded, reachable: r.navigation.owners.map(o => [o.id, o.after.length]), decision: r.decision })) }, null, 2));
