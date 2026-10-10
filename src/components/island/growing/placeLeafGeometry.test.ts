import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { placeLeafGeometry, placeLeafSpine } from './placeLeafGeometry';

describe('sculptural place leaves', () => {
    it('has one broad rounded blade, an early arch and a deeply drooping tip', () => {
        const geometry = placeLeafGeometry(), box = geometry.boundingBox!;
        expect(box.min.x).toBeLessThan(-.37); expect(box.min.x).toBeGreaterThan(-.40);
        expect(box.max.x).toBeGreaterThan(.37); expect(box.max.x).toBeLessThan(.40);
        expect(box.min.z).toBeCloseTo(-.95); expect(box.max.z).toBe(0);
        const spine = placeLeafSpine();
        expect(spine[0]).toEqual([0, 0, 0]);
        expect(spine.at(-1)![1]).toBeCloseTo(-.36); expect(spine.at(-1)![2]).toBeCloseTo(-.95);
        const peak = Math.max(...spine.map(point => point[1]));
        expect(peak).toBeGreaterThan(.32); expect(peak).toBeLessThan(.39);
        expect(spine[Math.round((spine.length - 1) / 3)][1]).toBeGreaterThan(.30);
        expect(peak - spine.at(-1)![1]).toBeGreaterThan(.68);
        for (let i = 1; i < spine.length; i++) expect(spine[i][2]).toBeLessThan(spine[i - 1][2]);

        // A single smooth width envelope keeps the silhouette free of star
        // points; the last wide section closes into a rounded drooping end.
        const positions = geometry.getAttribute('position');
        const sides = (positions.count - 2) / (spine.length - 2);
        const widths = spine.slice(1, -1).map((_, ring) => positions.getX(1 + ring * sides));
        const widest = widths.indexOf(Math.max(...widths));
        for (let i = 1; i < widths.length; i++) {
            if (i <= widest) expect(widths[i]).toBeGreaterThan(widths[i - 1]);
            else expect(widths[i]).toBeLessThan(widths[i - 1]);
        }
        expect(widths.at(-1)).toBeGreaterThan(.10);
        expect(widths.at(-1)! / widths.at(-2)!).toBeGreaterThan(.65);
        geometry.dispose();
    });

    it('is a closed finite volume with shared smooth normals and no open paper edges', () => {
        const geometry = placeLeafGeometry(), index = geometry.getIndex()!, positions = geometry.getAttribute('position');
        const normals = geometry.getAttribute('normal'), uv = geometry.getAttribute('uv');
        const edges = new Map<string, number>();
        const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
        let volume = 0;
        for (let i = 0; i < index.count; i += 3) {
            const face = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
            for (let j = 0; j < 3; j++) {
                const from = face[j], to = face[(j + 1) % 3], edge = `${Math.min(from, to)}:${Math.max(from, to)}`;
                edges.set(edge, (edges.get(edge) ?? 0) + 1);
            }
            a.fromBufferAttribute(positions, face[0]); b.fromBufferAttribute(positions, face[1]); c.fromBufferAttribute(positions, face[2]);
            expect(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()).toBeGreaterThan(1e-12);
            volume += a.dot(b.cross(c)) / 6;
        }
        expect([...edges.values()].every(count => count === 2)).toBe(true);
        expect(positions.count - edges.size + index.count / 3).toBe(2);
        expect(volume).toBeGreaterThan(.04);
        expect(volume).toBeLessThan(.10);
        for (const attribute of [positions, normals, uv]) expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
        for (let i = 0; i < normals.count; i++) expect(a.fromBufferAttribute(normals, i).length()).toBeCloseTo(1, 5);
        // Shared upper, side, and underside normals flow around the rolled blade.
        const rings = placeLeafSpine().length - 2, sides = (positions.count - 2) / rings;
        for (let ring = 6; ring < rings - 6; ring++) {
            for (const side of [0, sides / 4, sides / 2, 3 * sides / 4]) {
                a.fromBufferAttribute(normals, 1 + ring * sides + side);
                b.fromBufferAttribute(normals, 1 + (ring + 1) * sides + side);
                expect(a.dot(b)).toBeGreaterThan(.97);
            }
        }
        geometry.dispose();
    });

    it('raycasts through a fat upper and lower blade rather than a paper surface', () => {
        const geometry = placeLeafGeometry(), material = new T.MeshBasicMaterial(), leaf = new T.Mesh(geometry, material);
        const ray = new T.Raycaster(); leaf.updateMatrixWorld(true);
        for (const z of [-.25, -.475, -.70]) {
            ray.set(new T.Vector3(0, 1, z), new T.Vector3(0, -1, 0));
            const upper = ray.intersectObject(leaf)[0];
            ray.set(new T.Vector3(0, -1, z), new T.Vector3(0, 1, 0));
            const lower = ray.intersectObject(leaf)[0];
            expect(upper).toBeDefined(); expect(lower).toBeDefined();
            expect(upper.point.y - lower.point.y).toBeGreaterThan(.14);
        }
        geometry.dispose(); material.dispose();
    });

    it('keeps every vein point on the exact upper mesh while its sections turn with the droop', () => {
        const geometry = placeLeafGeometry(), material = new T.MeshBasicMaterial(), leaf = new T.Mesh(geometry, material);
        const ray = new T.Raycaster(); leaf.updateMatrixWorld(true);
        const positions = geometry.getAttribute('position'), spine = placeLeafSpine();
        const sides = (positions.count - 2) / (spine.length - 2);
        for (const [ring, [x, y, z]] of spine.slice(1, -1).entries()) {
            const upperVertex = 1 + ring * sides + sides / 4;
            expect([positions.getX(upperVertex), positions.getY(upperVertex), positions.getZ(upperVertex)]).toEqual([x, y, z]);
            ray.set(new T.Vector3(x, y + .3, z), new T.Vector3(0, -1, 0));
            const surface = ray.intersectObject(leaf)[0];
            expect(surface).toBeDefined(); expect(surface.point.y).toBeCloseTo(y, 5);
        }
        // Thick sections bend in space with the centre line. Near the rounded
        // end, the upper surface rolls forward of the underside by over .03 m.
        const lateRing = Math.floor((spine.length - 2) * .8);
        const upper = new T.Vector3().fromBufferAttribute(positions, 1 + lateRing * sides + sides / 4);
        const lower = new T.Vector3().fromBufferAttribute(positions, 1 + lateRing * sides + 3 * sides / 4);
        expect(upper.distanceTo(lower)).toBeGreaterThan(.12);
        expect(lower.z - upper.z).toBeGreaterThan(.08);
        geometry.dispose(); material.dispose();
    });
});
