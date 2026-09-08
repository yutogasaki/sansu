import * as THREE from 'three';

/** A static surface shared by ocean and shallows. Palette stays in vertex
 * colors; world coordinates keep the field continuous across separate meshes. */
export function createIslandWaterSurfaceMaterial(): THREE.MeshBasicMaterial {
    const material = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    material.name = 'island-water-surface-v1';
    material.userData.islandOwned = true;
    material.onBeforeCompile = shader => {
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec2 vIslandWaterXZ;')
            .replace('#include <project_vertex>', `#include <project_vertex>
    vIslandWaterXZ = (modelMatrix * vec4(transformed, 1.0)).xz;`);
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nvarying vec2 vIslandWaterXZ;')
            .replace('#include <color_fragment>', `#include <color_fragment>
    vec2 waterPoint = vIslandWaterXZ;
    float broadWater = sin(waterPoint.x * 0.72 + sin(waterPoint.y * 0.41) * 0.8)
        * sin(waterPoint.y * 0.55 - waterPoint.x * 0.18);
    float fineWater = sin(waterPoint.y * 5.6 + sin(waterPoint.x * 1.3) * 0.65
        + sin(waterPoint.y * 0.73));
    float brokenWater = smoothstep(0.25, 0.85,
        sin(waterPoint.x * 1.8 + waterPoint.y * 0.35) * 0.5 + 0.5);
    float waterCrest = smoothstep(0.91, 1.0, fineWater) * brokenWater;
    diffuseColor.rgb *= 0.96 + 0.055 * broadWater + 0.016 * fineWater;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), 0.023 * waterCrest);`);
    };
    return material;
}
