import * as T from 'three';
import { TERRAIN_DRY_LEVEL, terracePlanOf } from '../../../domain/growingIsland/editableTerrainWorld';
import { buildTerraceGround } from './terraceGround';
import type { SceneLayout } from './sceneLayout';
import { worldFloorGeometry } from './worldFloorGeometry';

/** Rendering, pointer hits and footing consume one clipped triangle mesh. */
export function buildEditableGround(layout: SceneLayout, shoreProfile?: readonly number[], bridgeX?: number) {
    const root = new T.Group(); root.name = 'editable-island-ground';
    const geometry = worldFloorGeometry(layout.world, { x: layout.center, z: 2 });
    const positions = geometry.getAttribute('position'), colors = geometry.getAttribute('color');
    const sand = new T.Color('#d4c79f'), meadow = new T.Color('#a4cb87');
    for (let i = 0; i < positions.count; i++) {
        const y = positions.getY(i), shore = 1 - T.MathUtils.smoothstep(y, TERRAIN_DRY_LEVEL, -.16);
        const color = meadow.clone().lerp(sand, shore);
        const variation = .98 + .035 * Math.sin(positions.getX(i) * 1.8 + positions.getZ(i) * .7) * Math.sin(positions.getZ(i) * 1.4);
        colors.setXYZ(i, color.r * variation, color.g * variation, color.b * variation);
    }
    const material = new T.MeshStandardMaterial({ vertexColors: true, roughness: .96, side: T.DoubleSide });
    material.onBeforeCompile = shader => {
        shader.vertexShader = 'varying vec3 terrainPoint;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nterrainPoint=position;');
        shader.fragmentShader = 'varying vec3 terrainPoint;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
            vec2 p=terrainPoint.xz;
            float grain=fract(sin(dot(floor(p*65.),vec2(12.9898,78.233)))*43758.5453);
            float fade=1.-smoothstep(.012,.055,max(length(dFdx(p)),length(dFdy(p))));
            diffuseColor.rgb*=1.+(grain-.5)*.045*fade;`);
    };
    material.customProgramCacheKey = () => 'editable-contour-ground-v1';
    const floor = new T.Mesh(geometry, material); floor.name = 'growing-owned-floor'; floor.receiveShadow = true;
    floor.userData.terrainSurface = true; root.add(floor);
    // DEV terrace form: the same floor still carries hits and footing, but the visible
    // land is the stacked terrace plates built from the same plan.
    const plan = terracePlanOf(layout.world), terraces = plan ? buildTerraceGround(layout, plan, shoreProfile, bridgeX) : undefined;
    if (terraces) { material.visible = false; root.add(terraces.root); }
    const banks: T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>[] = [];
    for (const surface of layout.world.surfaces) {
        const bankGeometry = new T.BufferGeometry();
        bankGeometry.setAttribute('position', new T.Float32BufferAttribute(surface.vertices.flatMap(point => [point.x - layout.center, point.y, point.z - 2]), 3));
        bankGeometry.setIndex([...surface.indices]); bankGeometry.computeVertexNormals();
        const bankMaterial = new T.MeshStandardMaterial({ color: surface.material.color, roughness: .96, side: T.DoubleSide });
        const bank = new T.Mesh(bankGeometry, bankMaterial); bank.name = 'editable-underwater-bank'; bank.receiveShadow = true; root.add(bank); banks.push(bank);
    }
    return { root, floor, dispose() { terraces?.dispose(); geometry.dispose(); material.dispose(); for (const bank of banks) { bank.geometry.dispose(); bank.material.dispose(); } } };
}
