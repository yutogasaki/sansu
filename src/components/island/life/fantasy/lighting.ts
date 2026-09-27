import * as T from 'three';
import type { GardenTime } from './presentation';

export const gardenLight = {
    day: { sky:'#b7cec0',hemisphere:'#fff6df',ground:'#789690',ambient:2.0,sun:'#fff0d2',power:2.2,exposure:.96 },
    dusk: { sky:'#98aead',hemisphere:'#d9e5dc',ground:'#3d6870',ambient:1.45,sun:'#ffd399',power:2.6,exposure:.96 },
    night: { sky:'#344f63',hemisphere:'#b8d6e6',ground:'#3e655e',ambient:1.30,sun:'#a0c4d6',power:1.0,exposure:1.02 },
} as const;
export function applyGardenLight(scene:T.Scene,renderer:T.WebGLRenderer,hemisphere:T.HemisphereLight,sun:T.DirectionalLight,time:GardenTime){
    const light=gardenLight[time];scene.background=new T.Color(light.sky);
    hemisphere.color.set(light.hemisphere);hemisphere.groundColor.set(light.ground);hemisphere.intensity=light.ambient;
    sun.color.set(light.sun);sun.intensity=light.power;sun.position.set(-3.5,8,-2);
    sun.shadow.radius=3;renderer.toneMappingExposure=light.exposure;renderer.shadowMap.needsUpdate=true;
}
