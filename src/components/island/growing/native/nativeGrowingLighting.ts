import * as T from 'three';
import type { GardenTime } from '../../three/garden/presentation';

/** The approved renderer's neutral response and sky fill, at gameplay scale. */
export function nativeGrowingLighting(scene: T.Scene, renderer: T.WebGLRenderer, hemi: T.HemisphereLight, sun: T.DirectionalLight) {
    const fill = new T.DirectionalLight('#b9d6ff', .85); fill.position.set(4, 6, -5); scene.add(fill);
    const pixels = new Float32Array(64 * 32 * 4), horizon = new T.Color('#e8c4d0'), zenith = new T.Color('#91bada'), lower = new T.Color('#9fbed1');
    for (let y = 0; y < 32; y++) {
        const elevation = Math.cos(y / 31 * Math.PI), color = horizon.clone().lerp(elevation > 0 ? zenith : lower, Math.pow(Math.abs(elevation), .5));
        for (let x = 0; x < 64; x++) pixels.set([color.r, color.g, color.b, 1], (y * 64 + x) * 4);
    }
    const map = new T.DataTexture(pixels, 64, 32, T.RGBAFormat, T.FloatType); map.mapping = T.EquirectangularReflectionMapping; map.needsUpdate = true;
    const pmrem = new T.PMREMGenerator(renderer), environment = pmrem.fromEquirectangular(map); map.dispose(); pmrem.dispose();
    scene.environment = environment.texture; scene.environmentIntensity = .4;
    renderer.toneMapping = T.NeutralToneMapping; renderer.toneMappingExposure = 1;
    sun.shadow.normalBias = .02; sun.shadow.bias = -.00025; sun.shadow.intensity = .55;
    return {
        setTime(time: GardenTime) {
            const day = time === 'day' || time === 'morning', night = time === 'night';
            scene.background = new T.Color(night ? '#829dd1' : day ? '#b4d4e7' : '#d3c9e3');
            hemi.color.set(day ? '#e8f4ff' : '#d5e6ff'); hemi.groundColor.set('#b9afb6'); hemi.intensity = night ? 1.1 : 1.4;
            sun.color.set(day ? '#fff2dd' : night ? '#c7dfff' : '#ffdbc3'); sun.intensity = night ? 1.1 : day ? 2 : 1.7;
            sun.position.set(-5.4, 10.8, 7.4); fill.intensity = night ? .65 : day ? .85 : 1.1;
            renderer.toneMappingExposure = 1; renderer.shadowMap.needsUpdate = true;
        },
        dispose() { environment.dispose(); scene.environment = null; fill.removeFromParent(); },
    };
}
