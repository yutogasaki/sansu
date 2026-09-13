import * as T from 'three';
import { describe, expect, it } from 'vitest';
import { poseReadingBook } from './readingBookPose';
import { buildHeldWork } from './facilityGeometry';
import { IslandMaterials } from '../three/primitives';

describe('the reading gesture changes only the book orientation', () => {
    it('adds directional pictures only to the new book display, preserving the pages, cover and tools', () => {
        const materials = new IslandMaterials();
        const old = buildHeldWork('library', materials), illustrated = buildHeldWork('library', materials, true);
        const tools = buildHeldWork('garden-hut', materials, true);
        try {
            expect(old.getObjectByName('life-book-tree')).toBeUndefined();
            expect(tools.getObjectByName('life-book-tree')).toBeUndefined();
            expect(illustrated.children).toHaveLength(old.children.length);
            illustrated.children.forEach((part, index) => {
                const previous = old.children[index] as T.Mesh, mesh = part as T.Mesh;
                expect(mesh.position).toEqual(previous.position); expect(mesh.rotation.toArray()).toEqual(previous.rotation.toArray());
                expect(mesh.geometry.getAttribute('position').array).toEqual(previous.geometry.getAttribute('position').array);
                expect(mesh.material).toBe(previous.material);
            });
            for (const name of ['life-book-tree', 'life-book-sun']) {
                const picture = illustrated.getObjectByName(name)!;
                expect(picture.parent).toBeInstanceOf(T.Mesh);
                expect(picture.children[0].position.z).toBeGreaterThan(0);
                expect(picture.children[0].position.y).toBeGreaterThan(.0125);
            }
        } finally {
            for (const root of [old, illustrated, tools]) root.traverse(part => { if (part instanceof T.Mesh) part.geometry.dispose(); });
            materials.dispose();
        }
    });
    it('holds an inverted picture, turns once and preserves the existing resident pose', () => {
        const resident = new T.Group(), book = new T.Group(); resident.add(book);
        resident.position.set(1, 2, 3); resident.rotation.set(.1, .2, .3);
        book.position.set(0, .49, .38); book.rotation.set(.1, .25, .13);
        const position = book.position.clone();
        expect(poseReadingBook(book, 0, false, .25)).toBe('upside-down');
        expect(book.rotation.y).toBeCloseTo(.25 + Math.PI);
        poseReadingBook(book, 3000, false, .25);
        expect(book.rotation.y).toBeCloseTo(.25 + Math.PI / 2);
        expect(poseReadingBook(book, 3500, false, .25)).toBe('upright');
        expect(book.rotation.y).toBe(.25);
        expect(book.position).toEqual(position);
        expect(book.rotation.x).toBe(.1); expect(book.rotation.z).toBe(.13);
        expect(resident.position.toArray()).toEqual([1, 2, 3]);
        expect(resident.rotation.toArray()).toEqual([.1, .2, .3, 'XYZ']);
    });
    it('uses a discrete orientation change for reduced motion and repeats deterministically', () => {
        const book = new T.Group();
        for (let attempt = 0; attempt < 2; attempt++) {
            poseReadingBook(book, 2999, true); expect(book.rotation.y).toBe(Math.PI);
            poseReadingBook(book, 3000, true); expect(book.rotation.y).toBe(0);
            poseReadingBook(book, 7000, true); expect(book.rotation.y).toBe(0);
        }
    });
});
