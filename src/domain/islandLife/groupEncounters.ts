import type { RuleEligibility } from './discovery';
import type { Cell, LifeItem, LifeState } from './model';
import { cellKey, homeCell, route, vacant } from './space';

/** Perimeter access is physical walkable ground, not the group's center or an
 * occupied interior cell. A flight is eligible only through this ground test. */
export function encounterAccess(state: LifeState, item: LifeItem): Cell[] {
    if (!item.cell) return [];
    const directions = item.access === 'front' ? [[0, 1]] : [[0, 1], [1, 0], [0, -1], [-1, 0]];
    return directions.map(([x, z]) => ({ x: item.cell!.x + x, z: item.cell!.z + z }))
        .filter(p => vacant(state, p) && route(state, homeCell, p));
}

export function groupEncounters(state: LifeState, groups: RuleEligibility[]) {
    if (!state.encounterVersion) return [];
    return groups.filter(r => r.ruleId === 'GF6' || r.ruleId === 'GT3').flatMap(group => {
        const plants = group.participantIds.flatMap(id => state.items.filter(i => i.id === id && i.cell));
        const perimeter = plants.flatMap(plant => encounterAccess(state, plant).map(point => ({ plant, point })));
        return state.items.filter(i => i.kind === 'water-bowl' && i.cell).flatMap(water => {
            const choices = encounterAccess(state, water).flatMap(from => perimeter.flatMap(({ plant, point }) => {
                const path = route(state, from, point);
                return path && path.length <= 5 ? [{ plant, path }] : [];
            })).sort((a, b) => a.path.length - b.path.length || a.plant.id.localeCompare(b.plant.id)
                || a.path.map(cellKey).join('|').localeCompare(b.path.map(cellKey).join('|')));
            const choice = choices[0];
            return choice ? [{ ruleId: group.ruleId === 'GF6' ? 'X1' as const : 'X2' as const,
                group, plants, water, plant: choice.plant, path: choice.path, distance: choice.path.length - 1 }] : [];
        });
    });
}
