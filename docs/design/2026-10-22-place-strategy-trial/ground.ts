import * as T from 'three';
import { buildEditableGround } from '../../../src/components/island/growing/editableGround';
import type { SceneLayout } from '../../../src/components/island/growing/sceneLayout';
import type { GrowingState } from '../../../src/domain/growingIsland/types';
import { gardenWeight, trialGardens } from './garden';

export function buildTrialGround(layout: SceneLayout, state: GrowingState) {
    const ground = buildEditableGround(layout);
    const requested = new URLSearchParams(location.search).get('groundTrial');
    const mode = requested === 'material' || requested === 'garden' ? requested : 'baseline';
    const gardens = mode === 'garden' ? trialGardens(state, layout.world) : [];
    ground.root.userData.strategyTrial = { mode, gardens };
    queueMicrotask(() => {
        const host = document.querySelector<HTMLElement>('[data-growing-world]');
        if (host) { host.dataset.strategyTrial = mode; host.dataset.strategyGardens = JSON.stringify(gardens); }
    });
    if (mode === 'baseline') return ground;
    const geometry = ground.floor.geometry, positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal');
    const colors = geometry.getAttribute('color');
    const grass = new T.Color('#91b47b'), grassLight = new T.Color('#b4c28a');
    const earth = new T.Color('#98765b'), rock = new T.Color('#8c959a');
    const sand = new T.Color('#d1ba8c'), wetSand = new T.Color('#8eaa9e'), court = new T.Color('#c7b694');
    const vertices = layout.world.floors.filter(f => f.kind === 'ground').flatMap(f => f.vertices);
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
        const slope = 1 - Math.abs(normals.getY(i));
        const broad = .5 + .5 * Math.sin(x * .9 + Math.sin(z * 1.2)) * Math.sin(z * .8);
        const color = grass.clone().lerp(grassLight, broad * .4);
        const steep = T.MathUtils.smoothstep(slope, .09, .32);
        color.lerp(earth.clone().lerp(rock, T.MathUtils.smoothstep(y, .25, 1.2) * .65), steep);
        const beach = 1 - T.MathUtils.smoothstep(y, -.30, -.13);
        color.lerp(sand, beach).lerp(wetSand, 1 - T.MathUtils.smoothstep(y, -.37, -.32));
        if (mode === 'garden' && vertices[i]) color.lerp(court, gardenWeight(vertices[i].cell, gardens, state, layout.world) * .82);
        colors.setXYZ(i, color.r, color.g, color.b);
    }
    colors.needsUpdate = true;
    ground.floor.material.customProgramCacheKey = () => `place-strategy-${mode}-v1`;
    return ground;
}
