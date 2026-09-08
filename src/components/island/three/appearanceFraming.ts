import * as THREE from 'three';
import type { IslandAppearanceSlotId } from '../../../domain/island/appearance';
import { getIslandLands, ISLAND_ITEMS, type IslandLandAccess } from '../../../domain/island/catalog';
import type { IslandStageItem } from './types';
import { islandTerrainEnvelope } from './terrainProfile';
import { fitLearningFrame } from './sceneFraming';

export interface IslandCosmeticFrame {
    requested: IslandAppearanceSlotId | 'all';
    actual: IslandAppearanceSlotId | 'all';
    targetIds: string[];
}
type Model = { item: IslandStageItem; group: THREE.Group };

/** Authored maximum envelopes keep scale identical across legacy/new styles,
 * earned maturity, preview cancellation and purchase. They never include the
 * ocean/background in a detail frame and never alter object visibility. */
export function fitIslandAppearanceCamera(camera: THREE.OrthographicCamera, requested: IslandCosmeticFrame['requested'],
    models: Iterable<Model>, land: IslandLandAccess, aspect: number): IslandCosmeticFrame {
    const frame: IslandCosmeticFrame = { requested, actual: requested, targetIds: [] };
    const offset = new THREE.Vector3(4.7, 8.8, 13.5);
    if (['houseBody', 'houseRoof', 'houseWindows'].includes(requested)) {
        const target = new THREE.Vector3(-2.5, 1.25, -1.1);
        camera.position.copy(target).add(offset); camera.lookAt(target); camera.updateMatrixWorld(true);
        const height = Math.max(4.5, 4.3 / aspect);
        camera.left = -height * aspect / 2; camera.right = height * aspect / 2; camera.top = height / 2; camera.bottom = -height / 2;
        camera.updateProjectionMatrix(); frame.targetIds = ['home-cottage']; return frame;
    }
    let bounds: THREE.Box3 | undefined;
    if (requested === 'tree') {
        bounds = new THREE.Box3(new THREE.Vector3(-1.45, -.05, -4.1), new THREE.Vector3(4.65, 5.3, 1.2));
        frame.targetIds = ['main-tree'];
    } else if (requested === 'flower' || requested === 'mushroom') {
        const placed = [...models].filter(({ item, group }) => item.kind === requested && item.position && group.visible);
        if (placed.length) {
            bounds = new THREE.Box3(); frame.targetIds = placed.map(({ item }) => item.id).sort();
            for (const { item, group } of placed) {
                const center = group.getWorldPosition(new THREE.Vector3()), radius = ISLAND_ITEMS[item.kind].radius + .07;
                bounds.union(new THREE.Box3(new THREE.Vector3(center.x - radius, -.04, center.z - radius),
                    new THREE.Vector3(center.x + radius, requested === 'flower' ? 1.75 : 1.25, center.z + radius)));
            }
        }
    }
    if (bounds) {
        const target = bounds.getCenter(new THREE.Vector3());
        camera.position.copy(target).add(requested === 'tree' ? new THREE.Vector3(4.7, 5.8, 10.5) : offset);
        camera.lookAt(target); camera.updateMatrixWorld(true);
        fitLearningFrame(camera, [bounds], aspect, requested === 'tree' ? 5.5 : 2.3); return frame;
    }
    frame.actual = 'all';
    const lands = getIslandLands(land), western = lands.some(area => area.x < -4), eastern = lands.some(area => area.x > 4);
    const target = new THREE.Vector3(western ? 0 : eastern ? 1.3 : -.08, .85, -.03);
    camera.position.copy(target).add(offset); camera.lookAt(target); camera.updateMatrixWorld(true);
    const points = lands.flatMap(islandTerrainEnvelope).map(point => new THREE.Vector3(...point));
    points.push(new THREE.Vector3(-3.1, 2.75, -2), new THREE.Vector3(1.3, 4.8, -1.65),
        new THREE.Vector3(-1.4, 0, 4.45), new THREE.Vector3(3.46, 3.3, -1.65));
    if (western) points.push(new THREE.Vector3(-6.7, 3.2, -1.2));
    const projected = new THREE.Box3().setFromPoints(points.map(point => point.applyMatrix4(camera.matrixWorldInverse)));
    const size = projected.getSize(new THREE.Vector3()), center = projected.getCenter(new THREE.Vector3());
    const height = Math.max(size.y, size.x / aspect) * 1.09;
    camera.left = center.x - height * aspect / 2; camera.right = center.x + height * aspect / 2;
    camera.top = center.y + height / 2; camera.bottom = center.y - height / 2; camera.updateProjectionMatrix();
    return frame;
}
