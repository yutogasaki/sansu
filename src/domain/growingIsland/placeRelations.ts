import { editableIslandWorld } from './editableTerrainWorld';
import { shadeInfluence, waterInfluence } from '../islandLife/waterChannels';
import { waterLayout } from './environment';
import { PLACE_CATALOG } from './placeCatalog';
import { derivePlaces, placeWalkSearch } from './places';
import type { DerivedPlace, PlaceRelation } from './placeTypes';
import { key, reachableFromHome } from './space';
import type { GrowingState } from './types';
import type { IslandWorld } from './worldDefinition';

/** Existing water/shade and a real entrance path are required; effects are never added twice. */
export function derivePlaceRelations(state: GrowingState, places: DerivedPlace[] | undefined = undefined, world?: IslandWorld): PlaceRelation[] {
    world ??= editableIslandWorld(state);
    const grown = (places ?? derivePlaces(state, world)).filter(p => p.stage === 'grown' || p.stage === 'lived');
    const reached = reachableFromHome(state, undefined, world), layout = waterLayout(state, world), relations: PlaceRelation[] = [];
    const definitions: { id: PlaceRelation['id']; families: [DerivedPlace['family'], DerivedPlace['family']] }[] = [
        { id: 'C01', families: ['grove', 'spring'] }, { id: 'C02', families: ['spring', 'flowers'] },
        { id: 'C03', families: ['grove', 'community'] }, { id: 'C04', families: ['flowers', 'community'] },
    ];
    for (const definition of definitions) for (const a of grown.filter(p => p.family === definition.families[0]))
        for (const b of grown.filter(p => p.family === definition.families[1])) {
            const search = placeWalkSearch(reached, a.entrances, PLACE_CATALOG.common.relationMaxWalkCells, world);
            const candidates = b.entrances.filter(cell => search.costs.has(key(cell))).sort((x, y) => search.costs.get(key(x))! - search.costs.get(key(y))!);
            const best = candidates[0] ? search.path(candidates[0]) : undefined;
            if (!best) continue;
            if (definition.id === 'C01' && ![...a.footprint, ...b.footprint].some(c => shadeInfluence(layout, c) > 0 && waterInfluence(layout, c) > 0)) continue;
            if (definition.id === 'C02' && !state.landmarks.some(l => l.cell && l.kind === 'flower'
                && b.mainIds.includes(l.id) && waterInfluence(layout, l.cell) > 0)) continue;
            if (definition.id === 'C03' && !b.footprint.some(c => shadeInfluence(layout, c) > 0)) continue;
            relations.push({ id: definition.id, placeIds: [a.id, b.id], path: best });
        }
    return relations;
}
