import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const dir = path.resolve('docs/design/2026-10-12-authored-p02-gallery/east-v6-entry-retracted/attempt-03');
const filename = path.join(dir, 'native-gallery-entry.glb'), bytes = fs.readFileSync(filename), jl = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.subarray(20, 20 + jl)), bin = bytes.subarray(28 + jl), sha = x => createHash('sha256').update(x).digest('hex');
function arr(id) {
    const a = gltf.accessors[id], v = gltf.bufferViews[a.bufferView], w = a.type === 'VEC3' ? 3 : 1, s = a.componentType === 5123 ? 2 : 4;
    return Array.from({ length: a.count }, (_, i) => Array.from({ length: w }, (_, k) => {
        const at = (v.byteOffset ?? 0) + (a.byteOffset ?? 0) + i * (v.byteStride ?? w * s) + k * s;
        return a.componentType === 5126 ? bin.readFloatLE(at) : a.componentType === 5123 ? bin.readUInt16LE(at) : bin.readUInt32LE(at);
    }));
}
const parts = new Map(gltf.nodes.map(n => { const p = gltf.meshes[n.mesh].primitives[0], v = arr(p.attributes.POSITION), ids = arr(p.indices).flat();
    return [n.name, Array.from({ length: ids.length / 3 }, (_, i) => ids.slice(i * 3, i * 3 + 3).map(k => v[k]))]; }));
const replacement = JSON.parse(fs.readFileSync(path.join(dir, 'lower-source-replacement.json'))), edges = new Map();
for (const name of ['solid-body/real-sixteen-stairs', 'walk-top/real-sixteen-stairs']) parts.get(name).forEach((t, i) => {
    const group = name.startsWith('walk') ? i < replacement.retainedTriangles[1] ? 'upper-walk' : 'new-low-walk'
        : i < replacement.retainedTriangles[0] ? 'upper-body' : i < replacement.retainedTriangles[0] + replacement.upperBoundaryEdges ? 'upper-cap' : 'new-low-body';
    for (let k = 0; k < 3; k++) { const a = t[k], b = t[(k + 1) % 3], key = [a.join(','), b.join(',')].sort().join('|');
        const row = edges.get(key) ?? { a, b, incidents: [] }; row.incidents.push({ name, triangle: i, group, vertices: t }); edges.set(key, row); }
});
const over = [...edges.values()].filter(e => e.incidents.length > 2), H = 1.6814100742340088;
const area = p => Math.abs(p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[2] - b[0] * a[2]; }, 0)) / 2;
function intersection(p, q) {
    let out = p; const orient = q.reduce((s, a, i) => { const b = q[(i + 1) % 3]; return s + a[0] * b[2] - b[0] * a[2]; }, 0) > 0 ? 1 : -1;
    for (let k = 0; k < 3; k++) {
        const a = q[k], b = q[(k + 1) % 3], inside = v => orient * ((b[0] - a[0]) * (v[2] - a[2]) - (b[2] - a[2]) * (v[0] - a[0]));
        const next = [];
        for (let i = 0; i < out.length; i++) { const c = out[i], d = out[(i + 1) % out.length], dc = inside(c), dd = inside(d);
            if (dc >= 0) next.push(c);
            if ((dc < 0) !== (dd < 0)) { const t = dc / (dc - dd); next.push(c.map((v, n) => v + (d[n] - v) * t)); }
        } out = next;
    } return out;
}
const topNames = ['terrain-threshold', 'front-junction', 'real-sixteen-stairs', 'aligned-opening', 'native-interior'].map(n => `walk-top/${n}`);
const coplanar = [];
for (let i = 0; i < topNames.length; i++) for (let j = i + 1; j < topNames.length; j++) {
    let count = 0, total = 0, example;
    for (const [ai, a] of parts.get(topNames[i]).entries()) {
        if (!a.every(v => v[1] === H)) continue;
        for (const [bi, b] of parts.get(topNames[j]).entries()) {
            if (!b.every(v => v[1] === H)) continue;
            const poly = intersection(a, b), overlap = poly.length > 2 ? area(poly) : 0;
            if (overlap > 1e-10) { count++; total += overlap; example ??= { triangles: [ai, bi], sourceTriangles: [a, b], polygon: poly, area: overlap }; }
        }
    }
    if (count) coplanar.push({ parts: [topNames[i], topNames[j]], trianglePairCount: count, summedArea: total, example });
}
const audit = { input: filename, sha256: sha(bytes), scope: 'Exact existing source triangles only; no new rig/world query or shape modification',
    sharedEdges: over, sharedEdgeCount: over.length,
    classification: 'Two individually closed stair solids are NOT one manifold union. Shared edges have four incidents across cap/upper/lower surfaces; not declared internal-only.',
    coplanarVisibleTopOverlaps: coplanar,
    verdict: coplanar.length ? 'HOLD: real visible coplanar top overlap exists; cannot use individual closure to claim an artifact-free assembled shape' : 'HOLD: external union not certified',
    inputsUnchanged: fs.readFileSync(filename).equals(bytes) };
fs.writeFileSync(path.join(dir, 'compound-interface-audit.json'), JSON.stringify(audit, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ sharedEdges: over.length, coplanarPairs: coplanar.map(r => ({ parts: r.parts, area: r.summedArea })), verdict: audit.verdict }, null, 2));
