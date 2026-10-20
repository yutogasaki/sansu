import design from '../../../docs/product/island-system/experience-design/layouts.json';
import { newIsland } from '../../domain/growingIsland/island';
import type { GrowingState, LandmarkKind, Species, Trait } from '../../domain/growingIsland/types';

export const experienceLayouts = design.layouts;
/** Explicit diagnostic input. Never reads or writes player IndexedDB. */
export function experienceFixture(layoutId: string): GrowingState {
    const layout = design.layouts.find(item => item.id === layoutId);
    if (!layout) throw new Error('unknown diagnostic island');
    const state = newIsland('experience-diagnostic', 0);
    state.land = { expanded: 'east', extra: ['west', 'south'], capes: [] };
    state.town = { clock: design.clock.town, bank: 0 }; state.nature.hours = design.clock.nature;
    state.landmarks = []; state.plots = []; state.tutorial = 'done'; state.unopened = []; state.arrivals = [];
    for (const group of design.groups) {
        const cells = layout.cells[group.prefix as keyof typeof layout.cells];
        if (cells.length !== group.count) throw new Error('diagnostic owner count');
        cells.forEach(([x, z], index) => {
            const id = `${group.prefix}${index + 1}`, cell = { x, z };
            if (group.kind === 'home' || group.kind === 'farm') state.plots.push({ id, kind: group.kind, cell, stage: group.kind === 'home' ? 2 : 1, plantedAt: 0, builtAt: 6, stagedAt: 30, style: 'plain', growth: 0, origin: 'seed', paid: 40 });
            else state.landmarks.push({ id, kind: group.kind as LandmarkKind, cell, growth: group.growth ?? 0,
                ...(group.kind === 'sapling' ? { maturedAt: index < 4 ? 500 : 980 } : {}),
                ...(group.kind === 'flower' ? { color: (['red', 'yellow', 'white', 'blue'] as const)[index % 4] } : {}) });
        });
    }
    state.villagers = design.residents.map((friend, index) => ({ ...friend, species: friend.species as Species, trait: friend.trait as Trait,
        variant: { color: index, accessory: 0, sparkle: false }, arrivedAt: 0 }));
    return state;
}
