// src/domain/growingIsland/authoredWaterGeometry.ts
var polygonArea = (polygon) => polygon.reduce((sum, point, i) => {
  const next = polygon[(i + 1) % polygon.length];
  return sum + point.x * next.z - next.x * point.z;
}, 0) / 2;
var polygonHasArea = (polygon) => polygon.length >= 3 && Math.abs(polygonArea(polygon)) > 1e-12;
var cross = (a, b, point) => (b.x - a.x) * (point.z - a.z) - (b.z - a.z) * (point.x - a.x);
var polygonBounds = (polygon) => ({
  minX: Math.min(...polygon.map((p) => p.x)),
  maxX: Math.max(...polygon.map((p) => p.x)),
  minZ: Math.min(...polygon.map((p) => p.z)),
  maxZ: Math.max(...polygon.map((p) => p.z))
});
function clipPolygon(polygon, distance) {
  const result = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length], da = distance(a), db = distance(b);
    if (da >= 0) result.push(a);
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db);
      result.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
    }
  }
  return result;
}
function intersectPolygons(polygon, convex) {
  let result = [...polygon];
  const orientation = Math.sign(polygonArea(convex));
  for (let i = 0; i < convex.length && polygonHasArea(result); i++) {
    const a = convex[i], b = convex[(i + 1) % convex.length];
    result = clipPolygon(result, (p) => orientation * cross(a, b, p));
  }
  return result;
}
function subtractPolygon(polygon, convex) {
  const result = [], orientation = Math.sign(polygonArea(convex));
  let inside = [...polygon];
  for (let i = 0; i < convex.length && polygonHasArea(inside); i++) {
    const a = convex[i], b = convex[(i + 1) % convex.length], distance = (p) => orientation * cross(a, b, p);
    const outside = clipPolygon(inside, (p) => -distance(p));
    if (polygonHasArea(outside)) result.push(outside);
    inside = clipPolygon(inside, distance);
  }
  return result;
}
function triangulateWaterPolygon(input) {
  if (input.length < 3 || input.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.z))) return;
  let points = input.filter((p, i) => Math.hypot(p.x - input[(i + input.length - 1) % input.length].x, p.z - input[(i + input.length - 1) % input.length].z) > 1e-10);
  for (let i = points.length - 1; i >= 0 && points.length >= 3; i--) {
    if (Math.abs(cross(points[(i + points.length - 1) % points.length], points[(i + 1) % points.length], points[i])) <= 1e-12) points.splice(i, 1);
  }
  if (!polygonHasArea(points)) return;
  const onSegment = (a, b, p) => Math.abs(cross(a, b, p)) <= 1e-12 && p.x >= Math.min(a.x, b.x) - 1e-12 && p.x <= Math.max(a.x, b.x) + 1e-12 && p.z >= Math.min(a.z, b.z) - 1e-12 && p.z <= Math.max(a.z, b.z) + 1e-12;
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    if (j === i + 1 || i === 0 && j === points.length - 1) continue;
    const a = points[i], b = points[(i + 1) % points.length], c = points[j], d = points[(j + 1) % points.length];
    if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0 || onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b)) return;
  }
  const result = [], orientation = Math.sign(polygonArea(points));
  points = [...points];
  while (points.length > 3) {
    const ear = points.findIndex((b, i) => {
      const a = points[(i + points.length - 1) % points.length], c = points[(i + 1) % points.length];
      return orientation * cross(a, b, c) > 1e-12 && !points.some((p, j) => j !== i && j !== (i + points.length - 1) % points.length && j !== (i + 1) % points.length && orientation * cross(a, b, p) >= -1e-12 && orientation * cross(b, c, p) >= -1e-12 && orientation * cross(c, a, p) >= -1e-12);
    });
    if (ear < 0) return;
    result.push([points[(ear + points.length - 1) % points.length], points[ear], points[(ear + 1) % points.length]]);
    points.splice(ear, 1);
  }
  result.push(points);
  return result;
}
function mapTrianglePoint(point, from, to) {
  const [a, b, c] = from, determinant = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
  const u = ((b.z - c.z) * (point.x - c.x) + (c.x - b.x) * (point.z - c.z)) / determinant;
  const v = ((c.z - a.z) * (point.x - c.x) + (a.x - c.x) * (point.z - c.z)) / determinant;
  return { x: to[0].x * u + to[1].x * v + to[2].x * (1 - u - v), z: to[0].z * u + to[1].z * v + to[2].z * (1 - u - v) };
}
var protectionRectangle = (cell, half) => [
  { x: cell.x - half, z: cell.z - half },
  { x: cell.x + half, z: cell.z - half },
  { x: cell.x + half, z: cell.z + half },
  { x: cell.x - half, z: cell.z + half }
];

// src/domain/growingIsland/authoredWorldAccess.ts
var AUTHORED_OWNER_HALF_EXTENT = 0.46;
var AUTHORED_WALK_HALF_WIDTH = 0.12;
var clearance = AUTHORED_OWNER_HALF_EXTENT + AUTHORED_WALK_HALF_WIDTH;
var cellKey = (cell) => `${cell.x},${cell.z}`;
var shoreIndexes = /* @__PURE__ */ new WeakMap();
var walkKeys = /* @__PURE__ */ new WeakMap();
var SHORE_DISTANCE = 0.65;
var MAX_SHORE_ANSWERS = 16384;
function shoreIndex(floors) {
  const existing = shoreIndexes.get(floors);
  if (existing) return existing;
  const index = { buckets: /* @__PURE__ */ new Map(), waterBuckets: /* @__PURE__ */ new Map(), waterFloors: /* @__PURE__ */ new Map(), footAnswers: /* @__PURE__ */ new Map(), waterDistances: /* @__PURE__ */ new Map() };
  let order = 0;
  for (const floor of floors) {
    if (floor.kind === "water") index.waterFloors.set(floor.id, polygonBounds(floor.vertices.map((vertex) => vertex.point)));
    for (let i = 0; i < floor.indices.length; i += 3) {
      const points = floor.indices.slice(i, i + 3).map((id) => floor.vertices[id].point), box = polygonBounds(points);
      const triangle = { floorId: floor.id, water: floor.kind === "water", points, box, order: order++ };
      for (let z = Math.floor(box.minZ); z <= Math.floor(box.maxZ); z++) for (let x = Math.floor(box.minX); x <= Math.floor(box.maxX); x++) {
        const id = cellKey({ x, z }), list = index.buckets.get(id) ?? [];
        list.push(triangle);
        index.buckets.set(id, list);
        if (triangle.water) {
          const water = index.waterBuckets.get(id) ?? [];
          water.push(triangle);
          index.waterBuckets.set(id, water);
        }
      }
    }
  }
  shoreIndexes.set(floors, index);
  return index;
}
function shoreTriangles(buckets, point, radius) {
  const triangles = /* @__PURE__ */ new Set();
  for (let z = Math.floor(point.z - radius); z <= Math.floor(point.z + radius); z++) for (let x = Math.floor(point.x - radius); x <= Math.floor(point.x + radius); x++)
    for (const triangle of buckets.get(cellKey({ x, z })) ?? []) if (triangle.box.minX <= point.x + radius && triangle.box.maxX >= point.x - radius && triangle.box.minZ <= point.z + radius && triangle.box.maxZ >= point.z - radius) triangles.add(triangle);
  return [...triangles];
}
function waterDistance(point, triangle) {
  const crosses = triangle.points.map((a, i) => {
    const b = triangle.points[(i + 1) % triangle.points.length];
    return (b.x - a.x) * (point.z - a.z) - (b.z - a.z) * (point.x - a.x);
  });
  if (crosses.every((value) => value >= -1e-12) || crosses.every((value) => value <= 1e-12)) return 0;
  return Math.min(...triangle.points.map((a, i) => {
    const b = triangle.points[(i + 1) % triangle.points.length], dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(point.x - a.x - dx * t, point.z - a.z - dz * t);
  }));
}
function shoreHeight(triangle, point) {
  return mapTrianglePoint(point, triangle.points, triangle.points.map((p) => ({ x: p.y, z: 0 }))).x;
}
function hasWalkRef(world, cell) {
  if (!Object.isFrozen(world.walkSites)) return world.walkSites.some((site) => cellKey(site.cell) === cellKey(cell));
  let keys = walkKeys.get(world.walkSites);
  if (!keys) {
    keys = new Set(world.walkSites.map((site) => cellKey(site.cell)));
    walkKeys.set(world.walkSites, keys);
  }
  return keys.has(cellKey(cell));
}
function distancesAt(index, point) {
  const id = cellKey(point), existing = index.waterDistances.get(id);
  if (existing) return existing;
  const distances = /* @__PURE__ */ new Map();
  for (const triangle of shoreTriangles(index.waterBuckets, point, SHORE_DISTANCE)) {
    const distance = waterDistance(point, triangle), previous = distances.get(triangle.floorId) ?? Infinity;
    distances.set(triangle.floorId, Math.min(previous, distance));
  }
  if (index.waterDistances.size >= MAX_SHORE_ANSWERS) index.waterDistances.clear();
  index.waterDistances.set(id, distances);
  return distances;
}
function subtractShoreCover(polygon, cover, orientation) {
  for (let i = 0; i < cover.length; i++) {
    const a = cover[i], b = cover[(i + 1) % cover.length];
    let inside = true, outside = true;
    for (const p of polygon) {
      const distance = orientation * ((b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x));
      inside &&= distance > 0;
      outside &&= distance < 0;
      if (!inside && !outside) break;
    }
    if (inside) continue;
    if (outside) return [polygon];
    return subtractPolygon(polygon, cover);
  }
  return [];
}
function footSupported(index, point) {
  const id = `${point.x},${point.y},${point.z}`, existing = index.footAnswers.get(id);
  if (existing !== void 0) return existing;
  const square = protectionRectangle(point, AUTHORED_WALK_HALF_WIDTH);
  const triangles = shoreTriangles(index.buckets, point, AUTHORED_WALK_HALF_WIDTH);
  const minX = Math.floor(point.x - SHORE_DISTANCE), minZ = Math.floor(point.z - SHORE_DISTANCE);
  triangles.sort((a, b) => Math.max(minZ, Math.floor(a.box.minZ)) - Math.max(minZ, Math.floor(b.box.minZ)) || Math.max(minX, Math.floor(a.box.minX)) - Math.max(minX, Math.floor(b.box.minX)) || a.order - b.order);
  const overlaps2 = [];
  let answer = true;
  for (const triangle of triangles) {
    const overlap = intersectPolygons(square, triangle.points);
    if (!polygonHasArea(overlap)) continue;
    if (triangle.water || polygonHasArea(clipPolygon(overlap, (p) => shoreHeight(triangle, p) - point.y - 0.25 - 1e-7))) {
      answer = false;
      break;
    }
    overlaps2.push({ triangle, overlap });
  }
  if (answer) {
    let uncovered = [square];
    for (const { triangle, overlap } of overlaps2) {
      let cover = clipPolygon(overlap, (p) => shoreHeight(triangle, p) - point.y + 0.25 + 1e-7);
      cover = clipPolygon(cover, (p) => point.y + 0.25 + 1e-7 - shoreHeight(triangle, p));
      if (polygonHasArea(cover)) {
        const orientation = Math.sign(polygonArea(cover));
        uncovered = uncovered.flatMap((piece) => subtractShoreCover(piece, cover, orientation));
      }
      if (!uncovered.length) break;
    }
    answer = !uncovered.length;
  }
  if (index.footAnswers.size >= MAX_SHORE_ANSWERS) index.footAnswers.clear();
  index.footAnswers.set(id, answer);
  return answer;
}
function isAuthoredShoreEntrySupported(world, cell, waterFloorIds) {
  if (!hasWalkRef(world, cell)) return false;
  const support = world.floorAt(cell), original = world.anchorFloorAt(cell);
  if (!support || !original || Math.hypot(support.point.x - original.point.x, support.point.z - original.point.z) > 1e-5 || Math.abs(support.point.y - original.point.y) > 0.28) return false;
  const index = shoreIndex(world.floors);
  if (!waterFloorIds.length || waterFloorIds.some((id) => !index.waterFloors.has(id))) return false;
  const distances = distancesAt(index, support.point);
  const distance = Math.min(...waterFloorIds.map((id) => distances.get(id) ?? Infinity));
  return distance > AUTHORED_WALK_HALF_WIDTH * Math.SQRT2 && distance <= SHORE_DISTANCE && footSupported(index, support.point);
}

// src/domain/growingIsland/worldDefinition.ts
var EPSILON = 1e-7;
var stable = (value) => Math.round(value * 1e9) / 1e9 || 0;
var cellKey2 = (cell) => `${cell.x},${cell.z}`;
var refKey = (ref2) => JSON.stringify([ref2.districtId, ref2.siteId]);
var floorKey = (districtId, floorId) => JSON.stringify([districtId, floorId]);
var turn = (x, z, count) => count === 1 ? { x: -z, z: x } : count === 2 ? { x: -x, z: -z } : count === 3 ? { x: z, z: -x } : { x, z };
function requireWorld(valid, message) {
  if (!valid) throw new Error(`Invalid island world: ${message}`);
}
function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
var FINE_DIVISIONS = 16;
var FINE_THRESHOLD = 64;
var fineCell = (value) => Math.max(0, Math.min(FINE_DIVISIONS - 1, Math.floor(value * FINE_DIVISIONS)));
function barycentric(at, a, b, c) {
  const determinant = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
  if (Math.abs(determinant) <= 1e-12) return void 0;
  const u = ((b.z - c.z) * (at.x - c.x) + (c.x - b.x) * (at.z - c.z)) / determinant;
  const v = ((c.z - a.z) * (at.x - c.x) + (a.x - c.x) * (at.z - c.z)) / determinant;
  const w = 1 - u - v;
  return u >= -EPSILON && v >= -EPSILON && w >= -EPSILON ? [u, v, w] : void 0;
}
var interpolate = (points, weights) => ({
  x: stable(points.reduce((value, point, i) => value + point.x * weights[i], 0)),
  y: stable(points.reduce((value, point, i) => value + point.y * weights[i], 0)),
  z: stable(points.reduce((value, point, i) => value + point.z * weights[i], 0))
});
function walkEdgeError(from, to, floorAt) {
  if (!from?.support || !to?.support) return "walk edge endpoint has no actual dry floor";
  const dx = to.cell.x - from.cell.x, dz = to.cell.z - from.cell.z, length = Math.hypot(dx, dz);
  if (!(length > 0 && length <= 256)) return "walk edge length";
  const steps = Math.max(8, Math.ceil(length * 8));
  const physicalStep = Math.hypot(to.support.point.x - from.support.point.x, to.support.point.z - from.support.point.z) / steps * 2 + 0.15;
  let previous;
  for (let i = 0; i <= steps; i++) {
    for (const side of [-0.12, 0, 0.12]) {
      const cell = { x: from.cell.x + dx * i / steps - dz / length * side, z: from.cell.z + dz * i / steps + dx / length * side };
      const floor = floorAt(cell);
      if (!floor) return "walk edge crosses missing floor or water";
      if (side !== 0) continue;
      if (previous) {
        if (Math.abs(floor.point.y - previous.y) > 0.25) return "walk edge has an unsupported vertical step";
        if (Math.hypot(floor.point.x - previous.x, floor.point.z - previous.z) > physicalStep) return "walk edge crosses separated physical floors";
      }
      const endpoint = i === 0 ? from.support : i === steps ? to.support : void 0;
      if (endpoint && Math.hypot(floor.point.x - endpoint.point.x, floor.point.y - endpoint.point.y, floor.point.z - endpoint.point.z) >= 0.025)
        return "walk endpoint differs from its site floor";
      previous = floor.point;
    }
  }
}
function compileWorldDefinition(input) {
  requireWorld(input.version === 1 && typeof input.id === "string" && input.id.length > 0, "unknown version or missing ID");
  requireWorld(input.revision === void 0 || typeof input.revision === "string" && input.revision.length > 0, "geometry revision");
  requireWorld(Array.isArray(input.districts) && Array.isArray(input.edges), "districts or edges");
  if (input.source) requireWorld(input.source.artifact && /^[a-f0-9]{64}$/.test(input.source.sha256), "source identity");
  const definition = structuredClone(input);
  const triangles = [], anchorTriangles = [], originalTriangles = [];
  const floors = [], anchorFloors = [], sites = [], surfaces = [];
  const districtIds = /* @__PURE__ */ new Set(), allFloors = /* @__PURE__ */ new Set(), allAnchorFloors = /* @__PURE__ */ new Set(), allSurfaces = /* @__PURE__ */ new Set();
  const refs = /* @__PURE__ */ new Map(), cells = /* @__PURE__ */ new Map();
  const finite = (point) => Number.isFinite(point.x) && Number.isFinite(point.z) && (!("y" in point) || Number.isFinite(point.y));
  const unit = (value) => Number.isFinite(value) && value >= 0 && value <= 1;
  const logicalPoint = (district, cell) => {
    const p = turn(cell.x, cell.z, district.turn);
    return { x: p.x + district.logicalOrigin.x, z: p.z + district.logicalOrigin.z };
  };
  const worldPoint = (district, point) => {
    const p = turn(point.x, point.z, district.turn);
    return { x: p.x + district.worldOrigin.x, y: point.y + district.worldOrigin.y, z: p.z + district.worldOrigin.z };
  };
  for (const district of definition.districts) {
    requireWorld(district.id && !districtIds.has(district.id), "duplicate district");
    districtIds.add(district.id);
    requireWorld(finite(district.logicalOrigin) && Number.isInteger(district.logicalOrigin.x) && Number.isInteger(district.logicalOrigin.z) && finite(district.worldOrigin) && Number.isFinite(district.worldOrigin.y) && [0, 1, 2, 3].includes(district.turn), "district origin or turn");
    requireWorld(district.waterCarvingScopes === void 0 || Array.isArray(district.waterCarvingScopes), "water carving scopes");
    const scopeIds = /* @__PURE__ */ new Set(), originals = district.anchorFloors?.length ? district.anchorFloors : district.floors;
    for (const scope of district.waterCarvingScopes ?? []) {
      requireWorld(typeof scope.id === "string" && scope.id.length && !scopeIds.has(scope.id), "duplicate or missing water carving scope");
      scopeIds.add(scope.id);
      requireWorld(Array.isArray(scope.floorIds) && scope.floorIds.length && new Set(scope.floorIds).size === scope.floorIds.length && scope.floorIds.every((id) => originals.some((floor) => floor.id === id && floor.kind === "ground")), "water carving original ground");
      requireWorld(Array.isArray(scope.envelope) && triangulateWaterPolygon(scope.envelope), "water carving envelope");
      const orientation = Math.sign(polygonArea(scope.envelope));
      requireWorld(scope.envelope.every((a, i) => {
        const b = scope.envelope[(i + 1) % scope.envelope.length], c = scope.envelope[(i + 2) % scope.envelope.length];
        return orientation * ((b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x)) >= -1e-12;
      }), "water carving envelope must be convex");
    }
    const compileFloor = (floor, anchor) => {
      const id = floorKey(district.id, floor.id);
      const ids = anchor ? allAnchorFloors : allFloors;
      requireWorld(floor.id && !ids.has(id), "duplicate floor");
      ids.add(id);
      requireWorld(["ground", "deck", "water"].includes(floor.kind) && floor.indices.length > 0 && floor.indices.length % 3 === 0, "floor kind or indices");
      requireWorld(/^#[a-fA-F0-9]{6}$/.test(floor.color), "floor color");
      if (floor.material !== void 0) requireWorld(floor.material && unit(floor.material.roughness) && unit(floor.material.metalness) && typeof floor.material.doubleSided === "boolean", "floor material");
      const vertices = floor.vertices.map((vertex) => {
        requireWorld(finite(vertex.cell) && finite(vertex.point) && Number.isFinite(vertex.point.y), "non-finite floor vertex");
        const normal = vertex.normal;
        if (normal !== void 0) requireWorld(normal && finite(normal) && Number.isFinite(normal.y) && Math.hypot(normal.x, normal.y, normal.z) > 1e-12, "floor normal");
        const rotated = normal ? turn(normal.x, normal.z, district.turn) : void 0;
        return {
          cell: logicalPoint(district, vertex.cell),
          point: worldPoint(district, vertex.point),
          ...normal && rotated ? { normal: { x: rotated.x, y: normal.y, z: rotated.z } } : {}
        };
      });
      for (const index of floor.indices) requireWorld(Number.isInteger(index) && index >= 0 && index < vertices.length, "floor index out of range");
      for (let i = 0; i < floor.indices.length; i += 3) {
        const v = floor.indices.slice(i, i + 3).map((index) => vertices[index]);
        const area = (points2) => Math.abs((points2[1].x - points2[0].x) * (points2[2].z - points2[0].z) - (points2[2].x - points2[0].x) * (points2[1].z - points2[0].z));
        requireWorld(area(v.map((vertex) => vertex.cell)) > 1e-12 && area(v.map((vertex) => vertex.point)) > 1e-12, "collapsed floor triangle");
        const triangle = {
          floorId: id,
          kind: floor.kind,
          cells: v.map((vertex) => vertex.cell),
          points: v.map((vertex) => vertex.point)
        };
        (anchor ? anchorTriangles : triangles).push(triangle);
        if (anchor || !district.anchorFloors?.length) originalTriangles.push(triangle);
      }
      (anchor ? anchorFloors : floors).push({
        id,
        kind: floor.kind,
        color: floor.color,
        vertices,
        indices: [...floor.indices],
        ...floor.material ? { material: { ...floor.material } } : {}
      });
    };
    for (const floor of district.floors) compileFloor(floor, false);
    for (const floor of district.anchorFloors ?? []) compileFloor(floor, true);
    for (const surface of district.surfaces ?? []) {
      const id = floorKey(district.id, surface.id);
      requireWorld(surface.id && !allSurfaces.has(id), "duplicate surface");
      allSurfaces.add(id);
      requireWorld(["bank", "flow"].includes(surface.kind) && Array.isArray(surface.vertices) && Array.isArray(surface.indices) && surface.indices.length > 0 && surface.indices.length % 3 === 0, "surface kind or indices");
      const material = surface.material;
      requireWorld(material && /^#[a-fA-F0-9]{6}$/.test(material.color) && unit(material.roughness) && unit(material.metalness) && (material.opacity === void 0 || unit(material.opacity)), "surface material");
      const vertices = surface.vertices.map((point) => {
        requireWorld(finite(point) && Number.isFinite(point.y), "non-finite surface vertex");
        return worldPoint(district, point);
      });
      for (const index of surface.indices) requireWorld(Number.isInteger(index) && index >= 0 && index < vertices.length, "surface index out of range");
      for (let i = 0; i < surface.indices.length; i += 3) {
        const [a, b, c] = surface.indices.slice(i, i + 3).map((index) => vertices[index]);
        const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }, v = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
        requireWorld(Math.hypot(u.y * v.z - u.z * v.y, u.z * v.x - u.x * v.z, u.x * v.y - u.y * v.x) > 1e-12, "collapsed surface triangle");
      }
      surfaces.push({ id, kind: surface.kind, vertices, indices: [...surface.indices], material: { ...material } });
    }
  }
  const bins = (triangleList, physical) => {
    const buckets = /* @__PURE__ */ new Map();
    const bounds3 = triangleList.map((triangle) => {
      const points2 = physical ? triangle.points : triangle.cells;
      const minX = Math.min(...points2.map((p) => p.x)), maxX = Math.max(...points2.map((p) => p.x));
      const minZ = Math.min(...points2.map((p) => p.z)), maxZ = Math.max(...points2.map((p) => p.z));
      const pad = (min, max) => EPSILON * (1 + 2 * (max - min)) + Number.EPSILON * Math.max(1, Math.abs(min), Math.abs(max)) * 8;
      const area = Math.abs((points2[1].x - points2[0].x) * (points2[2].z - points2[0].z) - (points2[2].x - points2[0].x) * (points2[1].z - points2[0].z));
      const broad = area <= Math.max(maxX - minX, maxZ - minZ) ** 2 * 1e-8;
      return { minX, maxX, minZ, maxZ, padX: pad(minX, maxX), padZ: pad(minZ, maxZ), broad };
    });
    bounds3.forEach((box, index) => {
      const x0 = Math.floor(box.minX), x1 = Math.floor(box.maxX);
      const z0 = Math.floor(box.minZ), z1 = Math.floor(box.maxZ);
      requireWorld((x1 - x0 + 1) * (z1 - z0 + 1) <= 1e5, "floor triangle spans an excessive search area");
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        const id = cellKey2({ x, z }), bucket = buckets.get(id) ?? { indices: [] };
        bucket.indices.push(index);
        buckets.set(id, bucket);
      }
    });
    for (const [id, bucket] of buckets) {
      if (bucket.indices.length <= FINE_THRESHOLD) continue;
      const [x, z] = id.split(",").map(Number);
      const ranges = bucket.indices.map((index) => {
        const box = bounds3[index];
        return {
          index,
          x0: box.broad ? 0 : fineCell(box.minX - box.padX - x),
          x1: box.broad ? FINE_DIVISIONS - 1 : fineCell(box.maxX + box.padX - x),
          z0: box.broad ? 0 : fineCell(box.minZ - box.padZ - z),
          z1: box.broad ? FINE_DIVISIONS - 1 : fineCell(box.maxZ + box.padZ - z)
        };
      });
      if (ranges.reduce((count, box) => count + (box.x1 - box.x0 + 1) * (box.z1 - box.z0 + 1), 0) >= bucket.indices.length * FINE_DIVISIONS ** 2 / 4) continue;
      const fine = /* @__PURE__ */ new Map();
      for (const { index, x0, x1, z0, z1 } of ranges) {
        for (let fz = z0; fz <= z1; fz++) for (let fx = x0; fx <= x1; fx++) {
          const cell = fz * FINE_DIVISIONS + fx, list = fine.get(cell) ?? [];
          list.push(index);
          fine.set(cell, list);
        }
      }
      bucket.fine = fine;
    }
    return buckets;
  };
  const createSampler = (triangleList, physicalQueries) => {
    const logicalBins = bins(triangleList, false);
    const sharedCoordinates = physicalQueries && triangleList.every((triangle) => triangle.cells.every((cell, i) => cell.x === triangle.points[i].x && cell.z === triangle.points[i].z));
    const physicalBins = physicalQueries && !sharedCoordinates ? bins(triangleList, true) : logicalBins;
    return (at, physical, floorId, y, raw = false) => {
      if (!finite(at)) return void 0;
      let best;
      const water = [];
      const buckets = physical ? physicalBins : logicalBins;
      const candidates = /* @__PURE__ */ new Set();
      const seenBuckets = /* @__PURE__ */ new Set();
      for (const dx of [0, -EPSILON, EPSILON]) for (const dz of [0, -EPSILON, EPSILON]) {
        const x = Math.floor(at.x + dx), z = Math.floor(at.z + dz), id = cellKey2({ x, z });
        if (seenBuckets.has(id)) continue;
        seenBuckets.add(id);
        const bucket = buckets.get(id);
        if (!bucket) continue;
        const list = bucket.fine ? bucket.fine.get(fineCell(at.z - z) * FINE_DIVISIONS + fineCell(at.x - x)) : bucket.indices;
        for (const index of list ?? []) candidates.add(index);
      }
      for (const index of candidates) {
        const triangle = triangleList[index];
        if (floorId && triangle.floorId !== floorId && (raw || triangle.kind !== "water")) continue;
        const weights = barycentric(at, ...physical ? triangle.points : triangle.cells);
        if (!weights) continue;
        const point = interpolate(triangle.points, weights);
        if (triangle.kind === "water" && !raw) {
          water.push(point);
          continue;
        }
        const cell = { x: stable(triangle.cells.reduce((value, p, i) => value + p.x * weights[i], 0)), z: stable(triangle.cells.reduce((value, p, i) => value + p.z * weights[i], 0)) };
        if (!best || (y === void 0 ? point.y > best.point.y + EPSILON : Math.abs(point.y - y) < Math.abs(best.point.y - y) - EPSILON))
          best = { cell, point, floorId: triangle.floorId, triangle: index };
      }
      if (!raw && best && water.some((point) => Math.hypot(point.x - best.point.x, point.z - best.point.z) < 1e-5 && point.y > best.point.y + EPSILON)) return void 0;
      return best;
    };
  };
  const sample = createSampler(triangles, true), sampleAnchor = createSampler(anchorTriangles, false);
  const sampleOriginal = originalTriangles.length === anchorTriangles.length ? sampleAnchor : !anchorTriangles.length ? sample : createSampler(originalTriangles, false);
  for (const district of definition.districts) {
    for (const site of district.sites) {
      const ref2 = { districtId: district.id, siteId: site.id }, id = refKey(ref2), cell = logicalPoint(district, site.cell), floorId = floorKey(district.id, site.floorId);
      requireWorld(site.id && !refs.has(id) && !cells.has(cellKey2(cell)), "duplicate site ID or logical cell");
      requireWorld(typeof site.placement === "boolean" && finite(site.cell) && (!site.placement || Number.isInteger(site.cell.x) && Number.isInteger(site.cell.z)), "site cell or placement right");
      const anchored = site.anchorPoint !== void 0;
      requireWorld((anchored ? allAnchorFloors : allFloors).has(floorId), "site refers to an unknown floor");
      const anchor = anchored ? sampleAnchor(cell, false, floorId, void 0, true) : sample(cell, false, floorId);
      requireWorld(anchor, anchored ? "site anchor has no original floor" : "site has no actual dry floor");
      if (anchored) {
        requireWorld(finite(site.anchorPoint) && Number.isFinite(site.anchorPoint.y), "non-finite site anchor");
        const point = worldPoint(district, site.anchorPoint);
        requireWorld(Math.hypot(point.x - anchor.point.x, point.y - anchor.point.y, point.z - anchor.point.z) <= 1e-6, "site anchor differs from its original floor");
      }
      const support = sample(cell, false);
      const compiled = { ref: ref2, cell, point: anchor.point, floorId, placement: site.placement, ...support ? { support } : {} };
      refs.set(id, compiled);
      cells.set(cellKey2(cell), compiled);
      sites.push(compiled);
    }
    const ports = /* @__PURE__ */ new Set();
    for (const port of district.ports) {
      requireWorld(port.id && !ports.has(port.id) && refs.has(refKey({ districtId: district.id, siteId: port.siteId })), "port ID or site");
      ports.add(port.id);
    }
  }
  const graphs = Object.fromEntries(["walk", "join", "water"].map((kind) => [kind, /* @__PURE__ */ new Map()]));
  const edgeIds = /* @__PURE__ */ new Set();
  for (const edge of definition.edges) {
    const a = refKey(edge.from), b = refKey(edge.to), edgeId = JSON.stringify([a, b].sort());
    requireWorld(a !== b && refs.has(a) && refs.has(b) && !edgeIds.has(edgeId), "duplicate edge or unknown endpoint");
    edgeIds.add(edgeId);
    requireWorld(edge.allows.length > 0 && new Set(edge.allows).size === edge.allows.length && edge.allows.every((kind) => ["walk", "join", "water"].includes(kind)), "edge passage rights");
    if (edge.allows.includes("walk")) {
      const error = walkEdgeError(refs.get(a), refs.get(b), (cell) => sample(cell, false));
      requireWorld(!error, error);
    }
    for (const kind of edge.allows) {
      const graph = graphs[kind];
      for (const [from, to] of [[a, b], [b, a]]) {
        const next = graph.get(from) ?? /* @__PURE__ */ new Set();
        next.add(to);
        graph.set(from, next);
      }
    }
  }
  const neighbors = (cell, passage = "walk") => {
    const site = cells.get(cellKey2(cell));
    if (!site) return [];
    return [...graphs[passage].get(refKey(site.ref)) ?? []].map((id) => ({ ...refs.get(id).cell }));
  };
  const owns = (cell) => cells.get(cellKey2(cell))?.placement === true;
  const floorKinds = new Map(floors.map((floor) => [floor.id, floor.kind]));
  const walkSites = sites.filter((site) => site.support), shoreApproaches = /* @__PURE__ */ new Map();
  const shoreGeometry = { floors, walkSites, floorAt: (cell) => sample(cell, false), anchorFloorAt: (cell) => sampleOriginal(cell, false) };
  for (const district of definition.districts) {
    requireWorld(district.shoreAccess === void 0 || Array.isArray(district.shoreAccess), "shore access");
    for (const access of district.shoreAccess ?? []) {
      const owner = refs.get(refKey({ districtId: district.id, siteId: access.ownerSiteId }));
      requireWorld(owner?.placement && !shoreApproaches.has(cellKey2(owner.cell)), "shore owner");
      requireWorld(Array.isArray(access.waterFloorIds) && access.waterFloorIds.length && new Set(access.waterFloorIds).size === access.waterFloorIds.length, "shore water floors");
      const waterIds = access.waterFloorIds.map((id) => floorKey(district.id, id));
      requireWorld(waterIds.every((id) => floorKinds.get(id) === "water") && waterIds.some((id) => {
        const water = sample(owner.cell, false, id, void 0, true);
        return water && Math.hypot(water.point.x - owner.point.x, water.point.z - owner.point.z) < 1e-5;
      }), "shore water does not cover its original owner");
      requireWorld(Array.isArray(access.entrySiteIds) && new Set(access.entrySiteIds).size === access.entrySiteIds.length, "shore entries");
      const entries = access.entrySiteIds.map((id) => refs.get(refKey({ districtId: district.id, siteId: id })));
      requireWorld(entries.every((entry) => entry && isAuthoredShoreEntrySupported(shoreGeometry, entry.cell, waterIds)), "shore entry has no actual bank support");
      shoreApproaches.set(cellKey2(owner.cell), entries.map((entry) => ({ ...entry.cell })));
    }
  }
  const siteAt = (point) => {
    const floor = sample(point, true, void 0, point.y);
    if (!floor || Math.abs(floor.point.y - point.y) > 0.025) return void 0;
    const site = cells.get(cellKey2({ x: Math.round(floor.cell.x), z: Math.round(floor.cell.z) }));
    return site?.placement && site.support && JSON.parse(floor.floorId)[0] === site.ref.districtId && floorKinds.get(floor.floorId) === floorKinds.get(site.support.floorId) ? site : void 0;
  };
  const route = (from, to, open, passage = "walk") => {
    if (!cells.has(cellKey2(from)) || !cells.has(cellKey2(to)) || !open.has(cellKey2(from)) || !open.has(cellKey2(to))) return void 0;
    if (passage === "walk" && (!cells.get(cellKey2(from))?.support || !cells.get(cellKey2(to))?.support)) return void 0;
    const queue = [from], previous = /* @__PURE__ */ new Map([[cellKey2(from), void 0]]);
    for (let i = 0; i < queue.length; i++) {
      const cell = queue[i];
      if (cellKey2(cell) === cellKey2(to)) {
        const result = [];
        let at = cell;
        while (at) {
          result.unshift({ ...at });
          at = previous.get(cellKey2(at));
        }
        return result;
      }
      for (const next of neighbors(cell, passage)) if (open.has(cellKey2(next)) && !previous.has(cellKey2(next))) {
        previous.set(cellKey2(next), cell);
        queue.push(next);
      }
    }
  };
  const points = floors.filter((floor) => floor.kind !== "water").flatMap((floor) => floor.vertices.map((v) => v.point));
  requireWorld(points.length > 0, "world has no dry floor");
  const bounds2 = points.reduce((box, point) => ({
    min: { x: Math.min(box.min.x, point.x), y: Math.min(box.min.y, point.y), z: Math.min(box.min.z, point.z) },
    max: { x: Math.max(box.max.x, point.x), y: Math.max(box.max.y, point.y), z: Math.max(box.max.z, point.z) }
  }), { min: { ...points[0] }, max: { ...points[0] } });
  const isWalkEdgeSupported = (from, to) => !walkEdgeError(cells.get(cellKey2(from)), cells.get(cellKey2(to)), (cell) => sample(cell, false));
  return Object.freeze({
    id: definition.id,
    revision: definition.revision,
    definition: freeze(definition),
    floors: freeze(floors),
    anchorFloors: freeze(anchorFloors),
    surfaces: freeze(surfaces),
    sites: freeze(sites),
    walkSites: freeze(walkSites),
    bounds: freeze(bounds2),
    owns,
    neighbors,
    route,
    siteAt,
    isWalkEdgeSupported,
    shoreApproachCells: (cell) => shoreApproaches.get(cellKey2(cell))?.map((entry) => ({ ...entry })),
    anchorAt: (cell) => {
      const point = cells.get(cellKey2(cell))?.point;
      return point ? { ...point } : void 0;
    },
    anchorFloorAt: (cell) => sampleOriginal(cell, false),
    sampleFloorAt: (cell, floorId) => allFloors.has(floorId) ? sample(cell, false, floorId, void 0, true) : void 0,
    floorAt: (cell, floorId) => sample(cell, false, floorId),
    logicalAt: (point) => sample(point, true, void 0, point.y)?.cell
  });
}

// src/domain/growingIsland/authoredDistrictWorld.ts
var fail = (message) => {
  throw Error(`Authored districts: ${message}`);
};
var rotate = ({ x, z }, turn2) => turn2 === 1 ? { x: -z, z: x } : turn2 === 2 ? { x: -x, z: -z } : turn2 === 3 ? { x: z, z: -x } : { x, z };
var direction = (facing) => rotate({ x: 1, z: 0 }, facing);
var key = (districtId, portId) => JSON.stringify([districtId, portId]);
var ref = (districtId, siteId) => ({ districtId, siteId });
var near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 1e-7;
function fingerprint(value) {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}
function checkCatalog(base, catalog) {
  if (catalog.version !== 1 || !catalog.candidate || base.definition.source?.sha256 !== catalog.source.sha256)
    fail("catalog source differs");
  const ids = /* @__PURE__ */ new Set();
  for (const template of catalog.templates) {
    if (!template.id || ids.has(template.id)) fail("duplicate template");
    ids.add(template.id);
    const district = template.district;
    if (district.id !== template.id || district.turn !== 0 || district.logicalOrigin.x || district.logicalOrigin.z || Object.values(district.worldOrigin).some((n) => n !== 0)) fail("template must use a local unturned frame");
    const ports2 = /* @__PURE__ */ new Set();
    for (const port of template.ports) {
      if (!port.id || ports2.has(port.id) || ![0, 1, 2, 3].includes(port.facing) || !district.sites.some((site) => site.id === port.siteId)) fail("invalid template port");
      ports2.add(port.id);
    }
    if (!ports2.size) fail("template has no port");
    if (template.edges.some((edge) => edge.from.districtId !== template.id || edge.to.districtId !== template.id))
      fail("template edge leaves its district");
  }
  const ports = /* @__PURE__ */ new Set();
  for (const port of catalog.basePorts) {
    const id = key(port.districtId, port.id);
    if (ports.has(id) || ![0, 1, 2, 3].includes(port.facing) || !base.sites.some((site) => site.ref.districtId === port.districtId && site.ref.siteId === port.siteId && site.support))
      fail("invalid base port");
    ports.add(id);
  }
}
function availableAuthoredDistrictPorts(base, catalog, grants) {
  checkCatalog(base, catalog);
  const used = new Set(grants.flatMap((grant) => [key(grant.parent.districtId, grant.parent.portId), key(grant.id, grant.entryPortId)]));
  const ports = [...catalog.basePorts, ...grants.flatMap((grant) => {
    const template = catalog.templates.find((item) => item.id === grant.templateId) ?? fail("unknown template");
    return template.ports.map((port) => ({ ...port, districtId: grant.id, facing: (port.facing + grant.turn) % 4 }));
  })];
  return ports.filter((port) => !used.has(key(port.districtId, port.id)));
}
function positioned(template, grant) {
  return {
    ...template.district,
    id: grant.id,
    templateId: template.id,
    turn: grant.turn,
    logicalOrigin: { ...grant.logicalOrigin },
    worldOrigin: { ...grant.worldOrigin }
  };
}
function bounds(district, physical) {
  const points = district.floors.flatMap((floor) => [...new Set(floor.indices)].map((index) => {
    const vertex = floor.vertices[index], p = rotate(physical ? vertex.point : vertex.cell, district.turn);
    const origin = physical ? district.worldOrigin : district.logicalOrigin;
    return { x: p.x + origin.x, z: p.z + origin.z };
  }));
  if (!points.length) return fail("empty district");
  return points.reduce(
    (box, p) => ({
      minX: Math.min(box.minX, p.x),
      maxX: Math.max(box.maxX, p.x),
      minZ: Math.min(box.minZ, p.z),
      maxZ: Math.max(box.maxZ, p.z)
    }),
    { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }
  );
}
function overlaps(a, b) {
  return a.minX < b.maxX - 1e-7 && a.maxX > b.minX + 1e-7 && a.minZ < b.maxZ - 1e-7 && a.maxZ > b.minZ + 1e-7;
}
function disjoint(world, district) {
  return [false, true].every((physical) => {
    const box = bounds(district, physical);
    return world.definition.districts.every((other) => !overlaps(box, bounds(other, physical)));
  });
}
function entrance(world, child, fromRef, toRef, id) {
  const from = world.sites.find((site) => key(site.ref.districtId, site.ref.siteId) === key(fromRef.districtId, fromRef.siteId));
  const to = child.sites.find((site) => key(site.ref.districtId, site.ref.siteId) === key(toRef.districtId, toRef.siteId));
  if (!from?.support || !to?.support) return fail("entry has no dry support");
  const a = from.support.point, b = to.support.point, dx = to.cell.x - from.cell.x, dz = to.cell.z - from.cell.z;
  const length = Math.hypot(dx, dz), physicalLength = Math.hypot(b.x - a.x, b.z - a.z);
  if (!length || !physicalLength || Math.abs(b.y - a.y) / physicalLength > 0.3) return fail("entry slope is unsupported");
  const segments = Math.max(1, Math.ceil(length * 4)), half = 0.22;
  const vertices = [], sides = [], sideIndices = [];
  const indices = [], sites = [], route = [fromRef];
  const known = new Map([...world.sites, ...child.sites].map((site) => [`${site.cell.x},${site.cell.z}`, site]));
  const lerp = (x, y, t) => x + (y - x) * t;
  if (length > 1.02) for (const physical of [false, true]) {
    const p = physical ? a : from.cell, q = physical ? b : to.cell;
    const span = Math.hypot(q.x - p.x, q.z - p.z), ux = (q.x - p.x) / span, uz = (q.z - p.z) / span;
    const corners = [[0.51, -half], [span - 0.51, -half], [span - 0.51, half], [0.51, half]].map(([along, side]) => ({ x: p.x + ux * along - uz * side, z: p.z + uz * along + ux * side }));
    const box = {
      minX: Math.min(...corners.map((p2) => p2.x)),
      maxX: Math.max(...corners.map((p2) => p2.x)),
      minZ: Math.min(...corners.map((p2) => p2.z)),
      maxZ: Math.max(...corners.map((p2) => p2.z))
    };
    for (const floor of [...world.floors, ...child.floors].filter((floor2) => floor2.kind !== "water")) for (let i = 0; i < floor.indices.length; i += 3) {
      const triangle = floor.indices.slice(i, i + 3).map((index) => physical ? floor.vertices[index].point : floor.vertices[index].cell);
      if (Math.max(...triangle.map((p2) => p2.x)) <= box.minX || Math.min(...triangle.map((p2) => p2.x)) >= box.maxX || Math.max(...triangle.map((p2) => p2.z)) <= box.minZ || Math.min(...triangle.map((p2) => p2.z)) >= box.maxZ) continue;
      if (Math.abs(polygonArea(intersectPolygons(triangle, corners))) > 1e-10) fail("entry crosses existing terrain");
    }
  }
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, cell = { x: lerp(from.cell.x, to.cell.x, t), z: lerp(from.cell.z, to.cell.z, t) };
    const point = { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) };
    for (const sign of [-1, 0, 1]) {
      const at = { x: cell.x - dz / length * half * sign, z: cell.z + dx / length * half * sign };
      const landing = world.floorAt(at) ?? child.floorAt(at);
      vertices.push({ cell: at, point: landing?.point ?? {
        x: point.x - (b.z - a.z) / physicalLength * half * sign,
        y: point.y,
        z: point.z + (b.x - a.x) / physicalLength * half * sign
      } });
    }
    if (i && i < segments) {
      const existing = known.get(`${cell.x},${cell.z}`);
      if (existing) route.push(existing.ref);
      else {
        const site = { id: `step-${i}`, cell, floorId: "entry-floor", placement: false };
        sites.push(site);
        route.push(ref(id, site.id));
      }
    }
    if (i) for (const side of [0, 1]) {
      const j = (i - 1) * 3 + side;
      indices.push(j, j + 1, j + 3, j + 1, j + 4, j + 3);
    }
  }
  for (let i = 0; i < segments; i++) for (const side of [0, 2]) {
    const p = vertices[i * 3 + side].point, q = vertices[(i + 1) * 3 + side].point, start = sides.length;
    sides.push(p, q, { ...q, y: q.y - 0.16 }, { ...p, y: p.y - 0.16 });
    sideIndices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }
  const district = {
    id,
    templateId: "native05-district-entry-v1",
    turn: 0,
    logicalOrigin: { x: 0, z: 0 },
    worldOrigin: { x: 0, y: 0, z: 0 },
    floors: [{ id: "entry-floor", kind: "deck", vertices, indices, color: "#d8c7ad", material: { roughness: 0.9, metalness: 0, doubleSided: true } }],
    surfaces: [{ id: "entry-sides", kind: "bank", vertices: sides, indices: sideIndices, material: { color: "#baa78d", roughness: 0.95, metalness: 0 } }],
    sites,
    ports: []
  };
  route.push(toRef);
  const edgeKey = (edge) => JSON.stringify([key(edge.from.districtId, edge.from.siteId), key(edge.to.districtId, edge.to.siteId)].sort());
  const existingEdges = new Map([...world.definition.edges, ...child.definition.edges].map((edge) => [edgeKey(edge), edge]));
  const edges = route.slice(1).flatMap((to2, i) => {
    const edge = { from: route[i], to: to2, allows: ["walk"] }, existing = existingEdges.get(edgeKey(edge));
    if (existing && !existing.allows.includes("walk")) fail("landing has no authored walking connection");
    return existing ? [] : [edge];
  });
  return { district, edges };
}
function append(base, catalog, previous, world, grant) {
  if (!grant.id || world.definition.districts.some((district2) => district2.id === grant.id || district2.id === `${grant.id}:entry`)) fail("duplicate district grant");
  const template = catalog.templates.find((item) => item.id === grant.templateId) ?? fail("unknown template");
  const port = availableAuthoredDistrictPorts(base, catalog, previous).find((port2) => port2.districtId === grant.parent.districtId && port2.id === grant.parent.portId) ?? fail("parent port is missing or occupied");
  const entryPort = template.ports.find((port2) => port2.id === grant.entryPortId) ?? fail("unknown entry port");
  if ((entryPort.facing + grant.turn) % 4 !== (port.facing + 2) % 4) fail("ports must face each other");
  const district = positioned(template, grant);
  if (!disjoint(world, district)) fail("district overlaps acquired terrain");
  const edges = template.edges.map((edge) => ({ ...edge, from: { ...edge.from, districtId: grant.id }, to: { ...edge.to, districtId: grant.id } }));
  const child = compileWorldDefinition({ version: 1, id: grant.id, districts: [district], edges });
  const parentSite = world.sites.find((site) => site.ref.districtId === port.districtId && site.ref.siteId === port.siteId);
  const childSite = child.sites.find((site) => site.ref.siteId === entryPort.siteId);
  const forward = direction(port.facing), dx = childSite.cell.x - parentSite.cell.x, dz = childSite.cell.z - parentSite.cell.z;
  const gap = dx * forward.x + dz * forward.z;
  if (!Number.isInteger(gap) || gap < 1 || gap > 64 || Math.abs(dx * forward.z - dz * forward.x) > 1e-7 || grant.worldOrigin.y !== 0 || !parentSite.support || !childSite.support || !near(childSite.support.point, {
    x: parentSite.support.point.x + forward.x * gap,
    y: childSite.support.point.y,
    z: parentSite.support.point.z + forward.z * gap
  })) fail("grant differs from its fixed port alignment");
  const entry = entrance(world, child, ref(port.districtId, port.siteId), ref(grant.id, entryPort.siteId), `${grant.id}:entry`);
  const result = compileWorldDefinition({
    ...world.definition,
    revision: `districts:${fingerprint([base.definition.revision, catalog.candidate, [...previous, grant]])}`,
    districts: [...world.definition.districts, district, entry.district],
    edges: [...world.definition.edges, ...edges, ...entry.edges]
  });
  for (const old of world.sites) {
    const next = result.sites.find((site) => site.ref.districtId === old.ref.districtId && site.ref.siteId === old.ref.siteId);
    if (!next || next.placement !== old.placement || !near(next.point, old.point) || Boolean(next.support) !== Boolean(old.support) || old.support && !near(next.support.point, old.support.point)) fail("existing floor or rights changed");
  }
  return result;
}
function composeAuthoredDistrictWorld(base, catalog, grants) {
  checkCatalog(base, catalog);
  let world = base;
  for (let i = 0; i < grants.length; i++) world = append(base, catalog, grants.slice(0, i), world, grants[i]);
  return world;
}
function planAuthoredDistrict(base, catalog, grants, choice) {
  const world = composeAuthoredDistrictWorld(base, catalog, grants);
  const parent = availableAuthoredDistrictPorts(base, catalog, grants).find((port) => port.districtId === choice.parent.districtId && port.id === choice.parent.portId) ?? fail("parent port is missing or occupied");
  const template = catalog.templates.find((item) => item.id === choice.templateId) ?? fail("unknown template");
  const local = compileWorldDefinition({ version: 1, id: template.id, districts: [template.district], edges: template.edges });
  const parentPoint = world.sites.find((site) => site.ref.districtId === parent.districtId && site.ref.siteId === parent.siteId)?.support?.point ?? fail("port has no dry support");
  const entries = choice.entryPortId ? template.ports.filter((port) => port.id === choice.entryPortId) : [...template.ports].sort((a, b) => {
    const height = (port) => Math.abs((local.sites.find((site) => site.ref.siteId === port.siteId)?.support?.point.y ?? Infinity) - parentPoint.y);
    return height(a) - height(b) || Number(b.facing === 2) - Number(a.facing === 2);
  });
  const entry = entries[0] ?? fail("unknown entry port");
  const entrySite = local.sites.find((site) => site.ref.siteId === entry.siteId), parentSite = world.sites.find((site) => site.ref.districtId === parent.districtId && site.ref.siteId === parent.siteId);
  if (!entrySite?.support || !parentSite?.support) return fail("port has no dry support");
  const turn2 = (parent.facing + 2 - entry.facing + 4) % 4, forward = direction(parent.facing);
  const cell = rotate(entrySite.cell, turn2), point = rotate(entrySite.support.point, turn2);
  for (let gap = Math.max(1, Math.ceil(Math.abs(parentPoint.y - entrySite.support.point.y) / 0.3)); gap <= 64; gap++) {
    const grant = {
      id: choice.id,
      templateId: template.id,
      parent: { ...choice.parent },
      entryPortId: entry.id,
      turn: turn2,
      logicalOrigin: { x: parentSite.cell.x + forward.x * gap - cell.x, z: parentSite.cell.z + forward.z * gap - cell.z },
      worldOrigin: {
        x: parentSite.support.point.x + forward.x * gap - point.x,
        // All source terrain shares the same sea datum. Matching port
        // heights by lifting/sinking the whole district breaks the coast.
        y: 0,
        z: parentSite.support.point.z + forward.z * gap - point.z
      }
    };
    if (!Number.isInteger(grant.logicalOrigin.x) || !Number.isInteger(grant.logicalOrigin.z)) fail("ports require compatible logical coordinates");
    if (!disjoint(world, positioned(template, grant))) continue;
    const result = append(base, catalog, grants, world, grant);
    return { grant, grants: [...grants, grant], world: result };
  }
  return fail("no supported district position at this port");
}

// src/domain/growingIsland/space.ts
var HOME_CELL = { x: 2, z: 1 };
export {
  HOME_CELL,
  availableAuthoredDistrictPorts,
  compileWorldDefinition,
  planAuthoredDistrict
};
