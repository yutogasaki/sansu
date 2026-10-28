import * as T from 'three';
import type { buildEditableGround } from '../../../src/components/island/growing/editableGround';

type Ground = ReturnType<typeof buildEditableGround>;
const patched = new WeakSet<T.MeshStandardMaterial>();
const revision = 'continuous-ground-v1';

function once(source: string, marker: string, replacement: string) {
    if (source.split(marker).length !== 2) throw Error(`Continuous ground shader changed: ${marker}`);
    return source.replace(marker, replacement);
}

/** Material-only comparison. Geometry, floor queries, normals, bank meshes and
 * the existing grain/lighting hooks remain intact. The old material palette is
 * evaluated after normal/position interpolation, instead of interpolating
 * already-classified vertex colours across each triangle. This cannot repair
 * the underlying silhouette or a discontinuity in the source normals. */
export function applyContinuousMaterial(ground: Ground,
    mode = new URLSearchParams(location.search).get('groundTrial')): Ground {
    if (mode !== 'continuous') return ground;
    const material = ground.floor.material;
    if (patched.has(material)) return ground;
    const previousCompile = material.onBeforeCompile, previousKey = material.customProgramCacheKey;
    material.onBeforeCompile = (shader, renderer) => {
        // In particular, keep buildEditableGround's world-space grain pass.
        previousCompile.call(material, shader, renderer);
        shader.vertexShader = `varying vec3 continuousGroundPoint;
varying vec3 continuousGroundNormal;
` + shader.vertexShader;
        shader.vertexShader = once(shader.vertexShader, '#include <begin_vertex>', `#include <begin_vertex>
continuousGroundPoint = position;
continuousGroundNormal = normal;`);
        shader.fragmentShader = `varying vec3 continuousGroundPoint;
varying vec3 continuousGroundNormal;
uniform vec3 continuousGrass;
uniform vec3 continuousGrassLight;
uniform vec3 continuousEarth;
uniform vec3 continuousRock;
uniform vec3 continuousSand;
uniform vec3 continuousWetSand;
` + shader.fragmentShader;
        // Replace only the colour attribute multiplication. The existing grain
        // code that follows this marker and all later lighting remain active.
        shader.fragmentShader = once(shader.fragmentShader, '#include <color_fragment>', `
float continuousSlope = 1. - abs(normalize(continuousGroundNormal).y);
float continuousBroad = .5 + .5 * sin(continuousGroundPoint.x * .9 + sin(continuousGroundPoint.z * 1.2)) * sin(continuousGroundPoint.z * .8);
vec3 continuousColor = mix(continuousGrass, continuousGrassLight, continuousBroad * .4);
vec3 continuousCliff = mix(continuousEarth, continuousRock, smoothstep(.25, 1.2, continuousGroundPoint.y) * .65);
continuousColor = mix(continuousColor, continuousCliff, smoothstep(.09, .32, continuousSlope));
continuousColor = mix(continuousColor, continuousSand, 1. - smoothstep(-.30, -.13, continuousGroundPoint.y));
continuousColor = mix(continuousColor, continuousWetSand, 1. - smoothstep(-.37, -.32, continuousGroundPoint.y));
diffuseColor.rgb *= continuousColor;`);
        for (const [name, color] of Object.entries({
            continuousGrass: '#91b47b', continuousGrassLight: '#b4c28a',
            continuousEarth: '#98765b', continuousRock: '#8c959a',
            continuousSand: '#d1ba8c', continuousWetSand: '#8eaa9e',
        })) shader.uniforms[name] = { value: new T.Color(color) };
    };
    material.customProgramCacheKey = () => `${previousKey.call(material)}:${revision}`;
    material.needsUpdate = true;
    patched.add(material);
    ground.root.userData.strategyTrial = { ...ground.root.userData.strategyTrial, mode: 'continuous', materialRevision: revision };
    queueMicrotask(() => {
        if (typeof document === 'undefined') return;
        const host = document.querySelector<HTMLElement>('[data-growing-world]');
        if (host) { host.dataset.strategyTrial = 'continuous'; host.dataset.strategyMaterialRevision = revision; }
    });
    return ground;
}
