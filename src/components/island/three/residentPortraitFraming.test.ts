import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { IslandResident } from './animals';
import { IslandMaterials, disposeGeometry } from './primitives';
import { boxCorners } from './sceneFraming';
import { fitIslandResidentPortraitCamera } from './residentPortraitFraming';

describe('actual resident outfit portrait', () => {
    for (const species of ['otter', 'rabbit', 'fox'] as const) for (const aspect of [390 / 245, 768 / 350]) {
        it(`shows ${species} face, ears and feet at aspect ${aspect} without changing its pose`, () => {
            const materials = new IslandMaterials(), resident = new IslandResident(species, materials, [2, 0, -1], () => {});
            const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 100);
            const pose = resident.group.children[0];
            const before = { position: resident.group.position.toArray(), rotation: resident.group.rotation.toArray(), pose: pose.rotation.toArray() };
            let frame: number[] | undefined;
            for (const look of ['original', 'scarf', 'cap', 'original'] as const) {
                resident.setAppearance(look);
                fitIslandResidentPortraitCamera(camera, resident.group, aspect);
                const currentFrame = [...camera.matrixWorld.elements, ...camera.projectionMatrix.elements];
                if (frame) expect(currentFrame).toEqual(frame); else frame = currentFrame;
                const forward = resident.group.getWorldDirection(new THREE.Vector3());
                expect(camera.position.clone().sub(resident.group.position).normalize().dot(forward)).toBeGreaterThan(.6);
                resident.group.traverseVisible(object => {
                    if (!(object instanceof THREE.Mesh)) return;
                    object.geometry.computeBoundingBox();
                    for (const point of boxCorners(object.geometry.boundingBox!)) {
                        const projected = point.applyMatrix4(object.matrixWorld).project(camera);
                        expect(Math.abs(projected.x)).toBeLessThan(.96); expect(Math.abs(projected.y)).toBeLessThan(.96);
                    }
                });
                expect({ position: resident.group.position.toArray(), rotation: resident.group.rotation.toArray(), pose: pose.rotation.toArray() }).toEqual(before);
            }
            // Entering the wardrobe after a stand/walk can leave the body above
            // its rest height. Fit actual transformed geometry, not only size.
            pose.position.y = .55; resident.setAppearance('cap');
            fitIslandResidentPortraitCamera(camera, resident.group, aspect);
            for (const point of boxCorners(new THREE.Box3().setFromObject(resident.group, true))) {
                const projected = point.project(camera);
                expect(Math.abs(projected.x)).toBeLessThan(.96); expect(Math.abs(projected.y)).toBeLessThan(.96);
            }
            resident.disposeAppearance(); disposeGeometry(resident.group); materials.dispose();
        });
    }
});
