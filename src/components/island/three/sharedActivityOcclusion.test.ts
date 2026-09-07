import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { isSharedActivityOccluderMaterial, segmentHitsMesh } from './sharedActivityOcclusion';

function geometry(offset = 0, indexed = true) {
    const result = new THREE.BufferGeometry();
    result.setAttribute('position', new THREE.Float32BufferAttribute([
        offset - 1, -1, 0, offset + 1, -1, 0, offset, 1, 0,
    ], 3));
    if (indexed) result.setIndex([0, 1, 2]);
    return result;
}
function hits(mesh: THREE.Mesh, start = new THREE.Vector3(0, 0, 2), end = new THREE.Vector3(0, 0, -2)) {
    mesh.updateWorldMatrix(true, true);
    return segmentHitsMesh(start, end, { mesh, inverse: mesh.matrixWorld.clone().invert() });
}
function threeHits(mesh: THREE.Mesh, start: THREE.Vector3, end: THREE.Vector3) {
    mesh.updateWorldMatrix(true, true);
    const delta = end.clone().sub(start);
    return new THREE.Raycaster(start, delta.clone().normalize(), 0, delta.length()).intersectObject(mesh, false).length > 0;
}

describe('exact finite shared activity sight rays', () => {
    it.each([true, false])('matches Three sides under nonuniform and mirrored parents (indexed %s)', indexed => {
        const shape = geometry(0, indexed), material = new THREE.MeshBasicMaterial();
        const parent = new THREE.Group(), mesh = new THREE.Mesh(shape, material); parent.add(mesh);
        parent.position.set(3, .7, -2); parent.rotation.set(.2, .8, -.1);
        try {
            for (const x of [1.6, -1.6]) for (const side of [THREE.FrontSide, THREE.BackSide, THREE.DoubleSide]) {
                parent.scale.set(x, .7, 2.3); material.side = side; parent.updateWorldMatrix(true, true);
                for (const sign of [1, -1]) {
                    const start = mesh.localToWorld(new THREE.Vector3(0, 0, 2 * sign));
                    const end = mesh.localToWorld(new THREE.Vector3(0, 0, -2 * sign));
                    expect(hits(mesh, start, end)).toBe(threeHits(mesh, start, end));
                    const short = mesh.localToWorld(new THREE.Vector3(0, 0, .1 * sign));
                    expect(hits(mesh, start, short)).toBe(false);
                }
            }
        } finally { shape.dispose(); material.dispose(); }
    });

    it('tests triangles rather than a broad mesh envelope and permits a ray starting inside its box', () => {
        const shape = new THREE.BoxGeometry(4, 4, 4), material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(shape, material);
        try {
            // Both endpoints are inside the mesh bounds; no surface crosses the segment.
            expect(hits(mesh, new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1))).toBe(false);
            expect(hits(mesh, new THREE.Vector3(), new THREE.Vector3(0, 0, -3))).toBe(true);
            expect(hits(mesh, new THREE.Vector3(3, 0, 3), new THREE.Vector3(3, 0, -3))).toBe(false);
        } finally { shape.dispose(); material.dispose(); }
    });

    it('invalidates triangle bounds after vertex edits even when the geometry boundingBox is stale', () => {
        const shape = geometry(5), material = new THREE.MeshBasicMaterial(), mesh = new THREE.Mesh(shape, material);
        shape.computeBoundingBox();
        try {
            expect(hits(mesh)).toBe(false);
            const position = shape.getAttribute('position');
            for (let i = 0; i < position.count; i++) position.setX(i, position.getX(i) - 5);
            position.needsUpdate = true;
            expect(shape.boundingBox!.min.x).toBe(4);
            expect(hits(mesh)).toBe(true);
            // Attribute replacement must also invalidate the same geometry's cache.
            shape.setAttribute('position', geometry(5).getAttribute('position'));
            expect(hits(mesh)).toBe(false);
        } finally { shape.dispose(); material.dispose(); }
    });

    it('invalidates index and interleaved-position edits', () => {
        const shape = new THREE.BufferGeometry(), data = new THREE.InterleavedBuffer(new Float32Array([
            -1, -1, 0, 1, -1, 0, 0, 1, 0, 4, -1, 0, 6, -1, 0, 5, 1, 0,
        ]), 3);
        shape.setAttribute('position', new THREE.InterleavedBufferAttribute(data, 3, 0)); shape.setIndex([3, 4, 5]);
        const material = new THREE.MeshBasicMaterial(), mesh = new THREE.Mesh(shape, material);
        try {
            expect(hits(mesh)).toBe(false);
            shape.index!.set([0, 1, 2]); shape.index!.needsUpdate = true;
            expect(hits(mesh)).toBe(true);
            const position = shape.getAttribute('position');
            for (let i = 0; i < 3; i++) position.setX(i, position.getX(i) + 5);
            data.needsUpdate = true;
            expect(hits(mesh)).toBe(false);
        } finally { shape.dispose(); material.dispose(); }
    });

    it.each(['rigid', 'instanced', 'morphed'] as const)('respects hidden material groups and live draw ranges (%s)', mode => {
        const shape = new THREE.BufferGeometry();
        shape.setAttribute('position', new THREE.Float32BufferAttribute([
            -1, -1, 0, 1, -1, 0, 0, 1, 0, 4, -1, 0, 6, -1, 0, 5, 1, 0,
        ], 3));
        shape.addGroup(0, 3, 0); shape.addGroup(3, 3, 1);
        const hidden = new THREE.MeshBasicMaterial({ visible: false }), visible = new THREE.MeshBasicMaterial();
        if (mode === 'morphed') shape.morphAttributes.position = [shape.getAttribute('position').clone()];
        const mesh = mode === 'instanced' ? new THREE.InstancedMesh(shape, [hidden, visible], 1) : new THREE.Mesh(shape, [hidden, visible]);
        if (mesh instanceof THREE.InstancedMesh) mesh.setMatrixAt(0, new THREE.Matrix4());
        try {
            expect(hits(mesh)).toBe(false);
            hidden.visible = true; hidden.transparent = true; hidden.opacity = 0;
            expect(hits(mesh)).toBe(false);
            hidden.transparent = false;
            expect(hits(mesh)).toBe(true);
            shape.setDrawRange(3, 3);
            expect(hits(mesh)).toBe(false);
            shape.setDrawRange(0, 6);
            expect(hits(mesh)).toBe(true);
        } finally { shape.dispose(); hidden.dispose(); visible.dispose(); }
    });

    it('counts opaque alpha-zero surfaces, while excluding invisible or blended-away surfaces', () => {
        const material = new THREE.MeshBasicMaterial({ opacity: 0 });
        try {
            expect(isSharedActivityOccluderMaterial(material)).toBe(true);
            material.transparent = true;
            expect(isSharedActivityOccluderMaterial(material)).toBe(false);
            material.opacity = .5;
            expect(isSharedActivityOccluderMaterial(material)).toBe(true);
            material.visible = false;
            expect(isSharedActivityOccluderMaterial(material)).toBe(false);
        } finally { material.dispose(); }
    });
});
