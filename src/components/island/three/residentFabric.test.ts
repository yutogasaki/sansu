import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { disposeGeometry, IslandMaterials } from './primitives';
import { makeResidentRig } from './residentRig';
import { RESIDENT_VISUAL_CANDIDATE } from './residentFabric';

describe('one cloth resident in the shared island', () => {
    it('keeps atlas UVs through body/head batching and every articulated hand/foot', () => {
        const materials = new IslandMaterials(), rig = makeResidentRig('otter', materials);
        const cloth = materials.residentFabric();
        try {
            expect(rig.pose.userData.visualCandidate).toBe(RESIDENT_VISUAL_CANDIDATE);
            for (const part of [rig.body, rig.head, ...rig.shoulders, ...rig.feet]) {
                const mapped: THREE.Mesh[] = [];
                part.traverse(object => { if (object instanceof THREE.Mesh && object.material === cloth) mapped.push(object); });
                expect(mapped.length).toBeGreaterThan(0);
                for (const object of mapped) {
                    const uv = object.geometry.getAttribute('uv');
                    expect(uv.count).toBe(object.geometry.getAttribute('position').count);
                    for (let i = 0; i < uv.count; i++) {
                        expect(uv.getX(i)).toBeGreaterThan(0); expect(uv.getX(i)).toBeLessThan(1);
                        expect(uv.getY(i)).toBeGreaterThan(0); expect(uv.getY(i)).toBeLessThan(1);
                    }
                }
            }
            expect(rig.handContacts.every(hand => hand.parent instanceof THREE.Mesh && hand.parent.material === cloth)).toBe(true);
        } finally { disposeGeometry(rig.pose); materials.dispose(); }
    });

    it('does not put cloth on the rabbit or fox, even when sharing the material cache', () => {
        const materials = new IslandMaterials(), cloth = materials.residentFabric();
        try {
            for (const species of ['rabbit', 'fox'] as const) {
                const rig = makeResidentRig(species, materials);
                expect(rig.pose.userData.visualCandidate).toBeUndefined();
                rig.pose.traverse(object => { if (object instanceof THREE.Mesh) expect(object.material).not.toBe(cloth); });
                disposeGeometry(rig.pose);
            }
        } finally { materials.dispose(); }
    });

    it('reuses both atlas textures across resident rebuilds and releases them with the scene materials', () => {
        const materials = new IslandMaterials();
        const cloth = materials.residentFabric(), map = cloth.map!, relief = cloth.bumpMap!;
        const disposed: string[] = [];
        map.addEventListener('dispose', () => disposed.push('color'));
        relief.addEventListener('dispose', () => disposed.push('relief'));
        for (let i = 0; i < 3; i++) {
            const rig = makeResidentRig('otter', materials);
            expect(materials.residentFabric()).toBe(cloth);
            disposeGeometry(rig.pose);
            expect(disposed).toEqual([]);
        }
        expect(map.colorSpace).toBe(THREE.SRGBColorSpace);
        expect(relief.colorSpace).toBe(THREE.NoColorSpace);
        expect(map.generateMipmaps && relief.generateMipmaps).toBe(true);
        materials.dispose(); expect(disposed).toEqual(['color', 'relief']);
    });
});
