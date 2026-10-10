import { shadeInfluence, waterInfluence } from '../islandLife/waterChannels';
import { waterLayout } from './environment';
import { PLACE_CATALOG } from './placeCatalog';
import { derivePlaces, placeWalkPath } from './places';
import type { DerivedPlace, PlaceRelation } from './placeTypes';
import { distance, reachableFromHome } from './space';
import type { GrowingState } from './types';

/** Existing water/shade and a real entrance path are required; effects are never added twice. */
export function derivePlaceRelations(state: GrowingState, places = derivePlaces(state)): PlaceRelation[] {
    const grown = places.filter(p => p.stage === 'grown' || p.stage === 'lived');
    const reached = reachableFromHome(state), layout = waterLayout(state), relations: PlaceRelation[] = [];
    const definitions: { id: PlaceRelation['id']; families: [DerivedPlace['family'], DerivedPlace['family']] }[] = [
        { id: 'C01', families: ['grove', 'spring'] }, { id: 'C02', families: ['spring', 'flowers'] },
        { id: 'C03', families: ['grove', 'community'] }, { id: 'C04', families: ['flowers', 'community'] },
    ];
    for (const definition of definitions) for (const a of grown.filter(p => p.family === definition.families[0]))
        for (const b of grown.filter(p => p.family === definition.families[1])) {
            let best: PlaceRelation['path'] | undefined;
            for (const from of a.entrances) for (const to of b.entrances) {
                if (distance(from, to) > PLACE_CATALOG.common.relationMaxWalkCells) continue;
                const path = placeWalkPath(reached, from, to, PLACE_CATALOG.common.relationMaxWalkCells);
                if (path && (!best || path.length < best.length)) best = path;
            }
            if (!best) continue;
            if (definition.id === 'C01' && ![...a.footprint, ...b.footprint].some(c => shadeInfluence(layout, c) > 0 && waterInfluence(layout, c) > 0)) continue;
            if (definition.id === 'C02' && !state.landmarks.some(l => l.cell && l.kind === 'flower'
                && b.mainIds.includes(l.id) && waterInfluence(layout, l.cell) > 0)) continue;
            if (definition.id === 'C03' && !b.footprint.some(c => shadeInfluence(layout, c) > 0)) continue;
            relations.push({ id: definition.id, placeIds: [a.id, b.id], path: best });
        }
    return relations;
}
