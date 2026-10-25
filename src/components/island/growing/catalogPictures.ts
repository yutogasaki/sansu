import type { WebGLRenderer } from 'three';
import type { IslandMaterials } from '../three/primitives';
import { keepsakeKind, FLOWER_COLORS, type GrowingState, type LandmarkKind, type SeedKind } from '../../../domain/growingIsland';
import { buildPlot } from './plotGeometry';
import { landmarkModel } from './objectLayer';
import { buildKeepsake } from './keepsakeGeometry';
import { miniaturePicture } from './menuMiniatures';
import { storedCatalog } from './storedCatalog';

export type CatalogPictures = Record<string, string>;

/** One cached render target at a time, on the existing world renderer. No new GPU context. */
export function catalogPictureMaker(renderer: WebGLRenderer, materials: IslandMaterials) {
    let key = '', pictures: CatalogPictures = {};
    return (state: GrowingState): CatalogPictures => {
        const nextKey = JSON.stringify([state.plots, state.landmarks, state.keepsakes]);
        if (key === nextKey) return pictures;
        const next: CatalogPictures = {};
        const add = (id: string, model: Parameters<typeof miniaturePicture>[1]) => {
            const image = miniaturePicture(renderer, model, true);
            if (image) next[id] = image;
        };
        for (const kind of ['home', 'farm', 'play', 'wild', 'market', 'festival', 'wonder'] as SeedKind[])
            add(`seed:${kind}`, buildPlot(materials, kind, 2, 'plain', 6));
        for (const kind of ['bench', 'water-bowl', 'sapling', 'water-channel', 'picnic-table', 'planter', 'swing', 'lantern', 'fence', 'lighthouse', 'bandstand', 'slide', 'trampoline', 'fountain', 'bakery', 'postbox'] as LandmarkKind[])
            add(`landmark:${kind}`, landmarkModel(materials, state, { id: `catalog:${kind}`, kind, growth: 0 }, new Set()));
        for (const color of FLOWER_COLORS)
            add(`flower:${color}`, landmarkModel(materials, state, { id: `catalog:${color}`, kind: 'flower', color, growth: 0 }, new Set()));
        const visible = new Set(storedCatalog(state).groups.flatMap(group => group.items.map(item => item.id)));
        for (const plot of state.plots.filter(p => !p.cell && visible.has(p.id)))
            add(plot.id, buildPlot(materials, plot.kind, plot.stage, plot.style ?? 'plain', plot.growth, plot.roof));
        for (const item of state.landmarks.filter(l => !l.cell && visible.has(l.id))) add(item.id, landmarkModel(materials, state, item, new Set()));
        for (const item of state.keepsakes.filter(k => !k.cell && visible.has(k.id))) add(item.id, buildKeepsake(materials, keepsakeKind(item.unitId)));
        key = nextKey; pictures = next; return pictures;
    };
}
