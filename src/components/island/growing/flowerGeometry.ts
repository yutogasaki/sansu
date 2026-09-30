import * as T from 'three';
import { batch, cylinder, ellipsoid, type IslandMaterials } from '../three/primitives';
import type { FlowerColor } from '../../../domain/growingIsland';
import { wonder } from './wonderPaint';

export const FLOWER_PAINT: Record<FlowerColor, string> = {
    red: '#e2574c', yellow: '#f5c84a', white: '#fbf6ee', blue: '#5b8fd9', orange: '#f08a3c', pink: '#f19aae',
    purple: '#9a74d6', sky: '#8fcdf0', cream: '#f7e3a8', mint: '#86d0a6', wonder: '#e23b3b',
};
export const FLOWER_NAME: Record<FlowerColor, string> = {
    red: 'あか', yellow: 'きいろ', white: 'しろ', blue: 'あお', orange: 'オレンジ', pink: 'ピンク',
    purple: 'むらさき', sky: 'みずいろ', cream: 'クリーム', mint: 'ミント', wonder: 'ふしぎな みずたま',
};

/** A clump of flowers in one colour; the wonder flower wears polka-dot petals. */
export function buildColorFlower(m: IslandMaterials, color: FlowerColor, growth: number) {
    const g = new T.Group(), stage = growth >= 6 ? 2 : growth >= 2 ? 1 : 0;
    const petals = color === 'wonder' ? wonder('dots-red') : m.surface(FLOWER_PAINT[color], .85);
    const stems = [[-.18, -.12], [.17, -.15], [0, .03], [-.15, .18], [.18, .17]];
    stems.forEach(([x, z], i) => {
        const h = .12 + stage * .15 + (i % 3) * .04;
        cylinder(g, m.surface('#478762', .85), [x, h / 2, z], .015, h);
        const leaf = ellipsoid(g, m.surface('#6f9f5b', .85), [x + .06, h * .45, z], [.1, .03, .05], 8); leaf.rotation.y = i;
        if (stage === 1) ellipsoid(g, petals, [x, h, z], [.055, .08, .055], 10);
        if (stage === 2) {
            for (let j = 0; j < 6; j++) {
                const a = j * Math.PI / 3 + i * .4;
                const petal = ellipsoid(g, petals, [x + Math.cos(a) * .08, h, z + Math.sin(a) * .08], [.075, .042, .095], 10);
                petal.rotation.y = -a + Math.PI / 2;
            }
            ellipsoid(g, m.surface(color === 'yellow' ? '#f08a3c' : '#ffe895', .8), [x, h + .038, z], [.048, .03, .048], 10);
        }
    });
    batch(g);
    return g;
}
