import * as T from 'three';
import type { GardenTime } from './presentation';

export const gardenLight = {
    morning: { sky:'#d3edff',hemisphere:'#ffffff',ground:'#a5c4b5',ambient:2.2,sun:'#fff1d6',power:1.9,exposure:1.04 },
    day: { sky:'#c4e9ff',hemisphere:'#ffffff',ground:'#9dbdad',ambient:2.2,sun:'#fff6e8',power:2.2,exposure:1.04 },
    dusk: { sky:'#f4d5e4',hemisphere:'#f5eaff',ground:'#839bc0',ambient:1.9,sun:'#ffdcad',power:2.0,exposure:1.04 },
    night: { sky:'#829dd1',hemisphere:'#dceaff',ground:'#789bb4',ambient:1.8,sun:'#c7dfff',power:1.2,exposure:1.08 },
} as const;
export function applyGardenLight(scene:T.Scene,renderer:T.WebGLRenderer,hemisphere:T.HemisphereLight,sun:T.DirectionalLight,time:GardenTime){
    const light=gardenLight[time];scene.background=new T.Color(light.sky);
    hemisphere.color.set(light.hemisphere);hemisphere.groundColor.set(light.ground);hemisphere.intensity=light.ambient;
    sun.color.set(light.sun);sun.intensity=light.power;sun.position.set(-3.5,time === 'morning' ? 5 : 8,-2);
    sun.shadow.radius=3;renderer.toneMappingExposure=light.exposure;renderer.shadowMap.needsUpdate=true;
}
