import type { MeshPhysicalMaterial } from 'three';

/** Keep the authored optics; recover the physical diffuse term on non-finite refraction samples. */
export function guardNativeTransmission(material: MeshPhysicalMaterial) {
    if (!(material.transmission > 0)) return;
    material.onBeforeCompile = shader => {
        shader.fragmentShader = shader.fragmentShader.replace('#include <transmission_fragment>', `
            vec3 nativeDiffuseBeforeTransmission = totalDiffuse;
            #include <transmission_fragment>
            if (any(isnan(totalDiffuse)) || any(isinf(totalDiffuse))) {
                totalDiffuse = nativeDiffuseBeforeTransmission;
            }
        `);
    };
    material.customProgramCacheKey = () => 'native05-finite-transmission-v1';
}
