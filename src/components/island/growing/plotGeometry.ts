import * as T from 'three';
import type { IslandMaterials } from '../three/primitives';
import type { PlotStyle, SeedKind } from '../../../domain/growingIsland';
import { buildFarm, buildPlay, buildWild } from './fieldGeometry';
import { buildHome } from './homeGeometry';
import { mesh, type Paint } from './plotParts';

export { ROOF_COLORS } from './plotParts';

export function buildPlot(m: IslandMaterials, kind: SeedKind, stage: number, style: PlotStyle, growth: number, roofColor?: number) {
    const paint: Paint = (color, roughness = .85) => m.surface(color, roughness);
    if (kind === 'home') return buildHome(paint, stage, style, roofColor);
    if (kind === 'farm' || kind === 'market') return buildFarm(paint, stage, style, kind === 'market');
    if (kind === 'play' || kind === 'festival') return buildPlay(paint, stage, style, kind === 'festival');
    return buildWild(paint, stage, style, growth);
}

export function buildKeepsake(m: IslandMaterials) {
    const paint: Paint = (color, roughness = .6) => m.surface(color, roughness);
    const root = new T.Group();
    mesh(root, new T.CylinderGeometry(.34, .38, .12, 16), paint('#d9ccb0'), [0, .06, 0]);
    mesh(root, new T.CylinderGeometry(.24, .24, .06, 16), paint('#7fb8c8', .3), [0, .14, 0]);
    mesh(root, new T.CylinderGeometry(.04, .05, .36, 8), paint('#d9ccb0'), [0, .3, 0]);
    const star = mesh(root, new T.OctahedronGeometry(.1), paint('#f0cf6a', .4), [0, .56, 0]); star.name = 'keepsake-star';
    return root;
}

export function buildLighthouse(m: IslandMaterials) {
    const paint: Paint = (color, roughness = .8) => m.surface(color, roughness);
    const root = new T.Group();
    for (let i = 0; i < 4; i++) mesh(root, new T.CylinderGeometry(.2 - i * .02, .22 - i * .02, .3, 14), paint(i % 2 ? '#d77a86' : '#f3ecdc'), [0, .15 + i * .3, 0]);
    mesh(root, new T.CylinderGeometry(.14, .14, .16, 12), paint('#ffe39a', .3), [0, 1.3, 0]);
    mesh(root, new T.ConeGeometry(.18, .2, 12), paint('#a2644e'), [0, 1.48, 0]);
    return root;
}

/** A glowing bud over a changed place. Opening it is the child's own tap (§11). */
export function buildBud(m: IslandMaterials) {
    const root = new T.Group(); root.name = 'growing-bud';
    const glow = m.surface('#fff1b0', .3, 0, true);
    mesh(root, new T.SphereGeometry(.16, 16, 12), glow, [0, 0, 0]).scale.y = 1.2;
    for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5, petal = mesh(root, new T.SphereGeometry(.09, 10, 8), m.surface('#f6c6d4', .6), [Math.cos(a) * .13, -.05, Math.sin(a) * .13]);
        petal.scale.set(1, .5, 1.4); petal.rotation.y = -a;
    }
    root.traverse(o => { if (o instanceof T.Mesh) o.castShadow = false; });
    return root;
}
